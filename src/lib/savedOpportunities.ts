// ---------------------------------------------------------------------------
// Saved opportunity limits.
//
// The AI matcher / performance tracker only ever look at a bounded number of
// saved opportunities, and `bookmarks/{uid}` stores full opportunity snapshots
// in an unbounded array. To keep the payload small and the list cost stable, we
// cap the saved section at MAX_SAVED_OPPORTUNITIES and drop the OLDEST entries
// whenever a new save pushes it past the limit.
// ---------------------------------------------------------------------------

export const MAX_SAVED_OPPORTUNITIES = 25;

export interface TrimSavedResult<T> {
  opportunityIds: string[];
  items: T[];
  removedIds: string[];
}

/**
 * Keeps only the newest `max` saved opportunities.
 *
 * `opportunityIds` is append-ordered (oldest first), so the newest entries are
 * at the tail. Items are filtered to the surviving ids. Returns the input
 * unchanged (removedIds empty) when already within the limit.
 */
export function trimSavedOpportunities<T extends { id?: string }>(
  opportunityIds: string[],
  items: T[],
  max: number = MAX_SAVED_OPPORTUNITIES
): TrimSavedResult<T> {
  const ids = Array.isArray(opportunityIds)
    ? opportunityIds.filter((id): id is string => typeof id === "string")
    : [];
  const list = Array.isArray(items) ? items : [];

  if (ids.length <= max) {
    return { opportunityIds: ids, items: list, removedIds: [] };
  }

  const dropped = ids.length - max;
  const removedIds = ids.slice(0, dropped);
  const keptIds = ids.slice(dropped);
  const keptSet = new Set(keptIds);
  const keptItems = list.filter((it) => it && typeof it.id === "string" && keptSet.has(it.id));

  return { opportunityIds: keptIds, items: keptItems, removedIds };
}
