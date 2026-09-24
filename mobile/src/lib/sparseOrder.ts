import { useCallback, useState, useEffect } from 'react';

// Sparse ordinals, shared by every drag-ordered list whose rows carry a numeric `position`
// (treatments, storyboard events). A drop writes ONE row -- the dropped one takes a value
// strictly between its settled neighbours -- rather than renumbering the list, which matters
// because the order of loose material churns constantly.

/** Gap between consecutive positions when rows are appended. */
export const POSITION_GAP = 1000;

/**
 * A position strictly between two neighbours. numeric, not int, so there is always room --
 * a list dragged into a tight gap never needs a renumbering pass.
 */
export function positionBetween(before: number | null, after: number | null): number {
  if (before == null && after == null) return POSITION_GAP;
  if (before == null) return (after as number) - POSITION_GAP;
  if (after == null) return before + POSITION_GAP;
  return (before + after) / 2;
}

/**
 * The drag contract for a useSortableList over position-ordered rows. `items` is LOCAL state
 * because the drag reorders it live and the drop then reads the settled order; a memo off the
 * store would be reset under the drag by every store update. `source` re-seeds it whenever
 * the store changes. `reposition` is called once per drop, and only if the position moved.
 */
export function useSparseReorder<T extends { id: string; position: number | string }>(
  source: T[],
  reposition: (id: string, position: number) => void,
) {
  const [items, setItems] = useState<T[]>(source);
  useEffect(() => setItems(source), [source]);

  const handleMove = useCallback((id: string, from: number, to: number) => {
    setItems((prev) => {
      if (from === to || !prev.some((x) => x.id === id)) return prev;
      const next = [...prev];
      const [moved] = next.splice(from, 1);
      next.splice(to, 0, moved);
      return next;
    });
  }, []);

  const handleDrop = useCallback(
    (id: string) => {
      const idx = items.findIndex((x) => x.id === id);
      if (idx === -1) return;
      const before = idx > 0 ? Number(items[idx - 1].position) : null;
      const after = idx < items.length - 1 ? Number(items[idx + 1].position) : null;
      const next = positionBetween(before, after);
      if (next !== Number(items[idx].position)) reposition(id, next);
    },
    [items, reposition],
  );

  return { items, handleMove, handleDrop };
}
