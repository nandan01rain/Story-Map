import { useEffect, useMemo } from 'react';
import type { SharedValue } from 'react-native-reanimated';

// Works around useSortableList seeding its `positions` shared value exactly once:
//
//   const positions = useSharedValue(listToObject(data));
//
// useSharedValue ignores its argument on every render after the first, so a list that
// mounts empty and is filled by an async fetch keeps the positions map it was born with
// -- {} -- and every row then draws at the same offset, stacked on top of each other.
// Only the topmost one is visible, which reads as "the fetch returned one item".
//
// Re-seeding on the ID SET rather than on `items` is the important part: `items` is also
// reordered mid-drag, and overwriting positions then would fight the drag it is in the
// middle of. The set only changes when rows are actually added or removed -- including
// the first load, which is the case this exists for.
export function useSortablePositions(items: { id: string }[], positions: SharedValue<Record<string, number>>) {
  const idSetKey = useMemo(() => items.map((item) => item.id).sort().join('|'), [items]);

  useEffect(() => {
    const seeded: Record<string, number> = {};
    items.forEach((item, index) => {
      seeded[item.id] = index;
    });
    positions.value = seeded;
    // Deliberately keyed on the set, not on `items` -- see above.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idSetKey]);
}
