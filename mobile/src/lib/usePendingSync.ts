import { useCallback, useEffect, useState } from 'react';

import { flush, pendingCount, subscribePending } from './outbox';

// How many local writes have not reached the server yet, and a way to push them now.
//
// The outbox already retries after every write and whenever the app returns to the
// foreground. What it did not do was retry while the app simply sat open after the network
// came back, or tell the writer anything was waiting at all -- so work written offline looked
// exactly like work that was safe. While something is pending this retries every 30 seconds,
// and the count is there to be shown.
const RETRY_MS = 30_000;

export function usePendingSync(): { pending: number; syncNow: () => Promise<void> } {
  const [pending, setPending] = useState(0);

  useEffect(() => {
    let alive = true;
    void pendingCount().then((n) => alive && setPending(n));
    const unsub = subscribePending((n) => alive && setPending(n));
    return () => {
      alive = false;
      unsub();
    };
  }, []);

  useEffect(() => {
    if (pending === 0) return;
    const id = setInterval(() => void flush(), RETRY_MS);
    return () => clearInterval(id);
  }, [pending]);

  // Stable, because screens put it in header options and a new identity every render would
  // set those options every render.
  const syncNow = useCallback(async () => {
    setPending(await flush());
  }, []);

  return { pending, syncNow };
}
