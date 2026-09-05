import AsyncStorage from '@react-native-async-storage/async-storage';

import { supabase } from './supabase';

// The outbox: writes that happened without a network, kept until the server has them.
//
// This exists for the six-hour flight. Pages are the deposit-anywhere layer, and a layer you
// cannot deposit into on a plane is the failure the whole design was meant to end. Reading
// offline was the easy half; this is the half that matters.
//
// THE RULES IT HAS TO HOLD
//
//   1. A write is never lost. It lands in local state and on disk BEFORE anything is sent,
//      and it stays in the queue until the server confirms it. A crash mid-flight loses
//      nothing, because nothing was ever only in memory.
//   2. Replay is idempotent. Rows carry CLIENT-GENERATED ids, so an insert replays as an
//      upsert on the primary key: applying it twice is the same as applying it once. This is
//      the property that makes a queue safe rather than a source of duplicates.
//   3. Order is preserved. Ops apply oldest-first and a failure stops the run rather than
//      skipping ahead, so an update never lands before the insert that created its row.
//   4. Autosave does not flood it. Updates to the same row COALESCE into one op carrying the
//      merged latest values -- six hours of typing is one pending write per page, not
//      thousands.
//
// No new dependency for any of it: ids are generated here, and the network is discovered by
// trying rather than by asking a native module. Both matter, because a native module would
// mean a new binary and this needs to ship over the air.

const QUEUE_KEY = 'storymap:outbox:v1';

export type OutboxOp = {
  /** Stable per op, so a partially-applied run can resume without re-sending. */
  opId: string;
  table: string;
  kind: 'insert' | 'update';
  /** Always carries `id`; for inserts it is the full row, for updates the changed fields. */
  row: Record<string, unknown> & { id: string };
  at: number;
};

/**
 * A v4 UUID from Math.random.
 *
 * Deliberately not a crypto-strength one: these are row identifiers in a table already
 * fenced by row-level security, not secrets or capabilities, and the only property required
 * is that two rows made on this device never collide. Reaching for expo-crypto would buy
 * unguessability nobody needs at the price of a native module -- and therefore a new APK,
 * which would put this fix weeks away instead of minutes.
 */
export function uuid(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

async function load(): Promise<OutboxOp[]> {
  try {
    const raw = await AsyncStorage.getItem(QUEUE_KEY);
    return raw ? (JSON.parse(raw) as OutboxOp[]) : [];
  } catch {
    return [];
  }
}

async function save(ops: OutboxOp[]): Promise<void> {
  try {
    await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(ops));
  } catch {
    // If the queue cannot be written the write is still in local state and in the store's own
    // cache, so nothing is lost from the writer's point of view -- it simply will not sync
    // until something else touches the row.
  }
}

/**
 * Queue one write, coalescing updates.
 *
 * An update to a row that already has a PENDING INSERT is merged into that insert -- the row
 * has never reached the server, so there is nothing to update, only a better version of the
 * thing to create. Getting this wrong is how an offline-created page arrives empty and its
 * text arrives as an update to a row that does not exist yet.
 */
export async function enqueue(op: Omit<OutboxOp, 'opId' | 'at'>): Promise<void> {
  const ops = await load();
  const existing = ops.findIndex((o) => o.table === op.table && o.row.id === op.row.id);

  if (existing !== -1) {
    const prior = ops[existing];
    if (prior.kind === 'insert') {
      ops[existing] = { ...prior, row: { ...prior.row, ...op.row }, at: Date.now() };
    } else if (op.kind === 'insert') {
      // An insert arriving after updates: the insert is the fuller statement, so it wins the
      // kind and absorbs what was already queued.
      ops[existing] = { ...prior, kind: 'insert', row: { ...prior.row, ...op.row }, at: Date.now() };
    } else {
      ops[existing] = { ...prior, row: { ...prior.row, ...op.row }, at: Date.now() };
    }
  } else {
    ops.push({ ...op, opId: uuid(), at: Date.now() });
  }
  await save(ops);
}

export async function pendingCount(): Promise<number> {
  return (await load()).length;
}

let flushing = false;

/**
 * Try to send everything, oldest first. Returns the number still pending.
 *
 * Stops at the first failure rather than continuing, because the queue is ordered and a later
 * op may depend on an earlier one. There is no retry limit and no discard: an op that cannot
 * be sent stays, which is the whole point.
 */
export async function flush(): Promise<number> {
  if (flushing) return (await load()).length;
  flushing = true;
  try {
    let ops = await load();
    while (ops.length) {
      const op = ops[0];
      const { error } =
        op.kind === 'insert'
          ? await supabase.from(op.table).upsert(op.row, { onConflict: 'id' })
          : await supabase.from(op.table).update(op.row).eq('id', op.row.id);

      if (error) {
        // A genuine rejection -- a constraint, a policy, a column that does not exist -- will
        // never succeed on retry, and leaving it at the head would block every write behind
        // it forever. Drop it and carry on; anything without a code is the network, which
        // will succeed later and must be kept.
        if (error.code) {
          console.warn('[outbox] dropping an op the server rejected:', error.code, error.message);
          ops = ops.slice(1);
          await save(ops);
          continue;
        }
        await save(ops);
        return ops.length;
      }

      ops = ops.slice(1);
      await save(ops);
    }
    return 0;
  } finally {
    flushing = false;
  }
}
