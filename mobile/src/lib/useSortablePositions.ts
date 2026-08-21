import { useMemo, useRef } from 'react';
import type { SharedValue } from 'react-native-reanimated';

// Works around two once-only initializations in react-native-reanimated-dnd that together
// make an async-loaded list draw every row on top of the first one:
//
//   useSortableList: const positions = useSharedValue(listToObject(data));
//   useSortable:     const initialTopVal = useMemo(() => positions.get()[id] * h, []);
//
// useSharedValue ignores its argument after the first render, so a list that mounts empty
// and is filled by a fetch keeps the positions map it was born with -- {} -- and each row
// then reads 0 for its own offset. Only the topmost row is visible, which reads as "the
// fetch returned one item".
//
// Seeding has to happen during RENDER, not in an effect. Rows compute initialTopVal when
// they mount, and children mount before parent effects run, so an effect in the screen
// always lands after the rows have already read the empty map. Assigning a shared value
// during render is safe -- it is not React state and nothing re-renders from it.
//
// Keyed on the ID SET rather than on `items`: `items` is also reordered mid-drag, and
// re-seeding then would fight the drag in progress. The set only changes when rows are
// genuinely added or removed -- including the first load, which is the case this exists
// for. Returns that key so the caller can also remount the rows, which is what makes the
// initialTopVal useMemo above recompute for rows that were already mounted.
export function useSortablePositions(
  items: { id: string }[],
  positions: SharedValue<Record<string, number>>,
): string {
  const idSetKey = useMemo(() => items.map((item) => item.id).sort().join('|'), [items]);
  const seededKey = useRef<string | null>(null);

  if (seededKey.current !== idSetKey) {
    seededKey.current = idSetKey;
    const seeded: Record<string, number> = {};
    items.forEach((item, index) => {
      seeded[item.id] = index;
    });
    positions.value = seeded;
  }

  return idSetKey;
}
