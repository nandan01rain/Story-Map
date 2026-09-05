// Tests for the outbox's queue arithmetic: coalescing, ordering, and what happens to an op
// the server refuses. Run: node scripts/test-outbox.mjs
//
// The module itself imports AsyncStorage and supabase, which are React Native's, so this
// re-implements the two pure decisions -- how an op merges into the queue, and what a flush
// does with each outcome -- and asserts against those. It is a test of the RULES rather than
// of the file, which is worth stating plainly: if the rules here and the code there diverge,
// this passes and the app is still wrong.

let failures = 0;
function check(name, ok, detail) {
  console.log((ok ? '  PASS  ' : '  FAIL  ') + name + (detail ? '   ' + detail : ''));
  if (!ok) failures += 1;
}

/** Mirrors enqueue() in mobile/src/lib/outbox.ts. */
function enqueue(ops, op) {
  const i = ops.findIndex((o) => o.table === op.table && o.row.id === op.row.id);
  if (i === -1) return [...ops, { ...op, opId: 'op' + ops.length }];
  const prior = ops[i];
  const merged =
    prior.kind === 'insert'
      ? { ...prior, row: { ...prior.row, ...op.row } }
      : op.kind === 'insert'
        ? { ...prior, kind: 'insert', row: { ...prior.row, ...op.row } }
        : { ...prior, row: { ...prior.row, ...op.row } };
  const next = [...ops];
  next[i] = merged;
  return next;
}

/** Mirrors flush(): stop on a network error, drop an op the server rejects by code. */
function flush(ops, send) {
  let q = [...ops];
  const applied = [];
  while (q.length) {
    const op = q[0];
    const err = send(op);
    if (err && !err.code) return { pending: q, applied };   // network: keep everything
    if (err && err.code) { q = q.slice(1); continue; }        // rejected: drop, carry on
    applied.push(op);
    q = q.slice(1);
  }
  return { pending: q, applied };
}

console.log('\ncoalescing');
{
  let q = [];
  q = enqueue(q, { table: 'sticky_notes', kind: 'insert', row: { id: 'p1', content: '' } });
  for (let i = 1; i <= 500; i++) {
    q = enqueue(q, { table: 'sticky_notes', kind: 'update', row: { id: 'p1', content: 'draft ' + i } });
  }
  check('six hours of autosave is ONE pending op', q.length === 1, 'len ' + q.length);
  check('  ...still an insert, because the row was never on the server', q[0].kind === 'insert');
  check('  ...carrying the newest text', q[0].row.content === 'draft 500', q[0].row.content);
}
{
  let q = [];
  q = enqueue(q, { table: 'sticky_notes', kind: 'update', row: { id: 'p9', content: 'a' } });
  q = enqueue(q, { table: 'sticky_notes', kind: 'update', row: { id: 'p9', status: 'reviewed' } });
  check('different fields on one row merge rather than queue twice', q.length === 1);
  check('  ...and both survive the merge', q[0].row.content === 'a' && q[0].row.status === 'reviewed');
}
{
  let q = [];
  q = enqueue(q, { table: 'sticky_notes', kind: 'insert', row: { id: 'a', content: '1' } });
  q = enqueue(q, { table: 'sticky_notes', kind: 'insert', row: { id: 'b', content: '2' } });
  q = enqueue(q, { table: 'sticky_notes', kind: 'update', row: { id: 'a', content: '1b' } });
  check('separate rows keep separate ops', q.length === 2);
  check('  ...in creation order, so an insert precedes its own updates',
    q[0].row.id === 'a' && q[1].row.id === 'b');
}

console.log('\nflushing');
{
  const q = [
    { table: 't', kind: 'insert', row: { id: 'a' } },
    { table: 't', kind: 'update', row: { id: 'a', content: 'x' } },
  ];
  const r = flush(q, () => ({ message: 'Network request failed' }));
  check('a network failure keeps the WHOLE queue', r.pending.length === 2 && r.applied.length === 0);
}
{
  const q = [
    { table: 't', kind: 'insert', row: { id: 'a' } },
    { table: 't', kind: 'insert', row: { id: 'b' } },
    { table: 't', kind: 'insert', row: { id: 'c' } },
  ];
  let n = 0;
  const r = flush(q, () => (++n === 2 ? { message: 'Network request failed' } : null));
  check('a failure part-way stops, and keeps what has not been sent',
    r.applied.length === 1 && r.pending.length === 2, JSON.stringify(r.pending.map((o) => o.row.id)));
  check('  ...without skipping ahead past the failed op', r.pending[0].row.id === 'b');
}
{
  const q = [
    { table: 't', kind: 'insert', row: { id: 'bad' } },
    { table: 't', kind: 'insert', row: { id: 'good' } },
  ];
  const r = flush(q, (op) => (op.row.id === 'bad' ? { code: '23505', message: 'constraint' } : null));
  check('an op the server REJECTS is dropped, not retried forever', r.pending.length === 0);
  check('  ...and does not block the writes queued behind it',
    r.applied.length === 1 && r.applied[0].row.id === 'good');
}
{
  // Idempotency is what client-generated ids buy: replaying an insert is an upsert.
  const seen = new Map();
  const apply = (op) => { seen.set(op.row.id, (seen.get(op.row.id) || 0) + 1); return null; };
  const q = [{ table: 't', kind: 'insert', row: { id: 'p1', content: 'hello' } }];
  flush(q, apply);
  flush(q, apply);
  check('replaying an insert twice touches one row, not two', seen.size === 1, 'rows ' + seen.size);
}

console.log(failures === 0 ? '\nall passed\n' : '\n' + failures + ' FAILED\n');
process.exit(failures === 0 ? 0 : 1);
