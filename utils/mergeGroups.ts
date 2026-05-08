import { Group } from "@/types";

/**
 * Merge two group arrays with conflict resolution.
 *
 * Rules:
 * - Same ID → keep the one with the newer createdAt
 * - Different ID → keep both
 *
 * @param local - The source array (e.g., guest groups)
 * @param remote - The target array (e.g., authenticated user groups)
 * @returns A merged, deduplicated array of groups sorted by createdAt desc
 */
export function mergeGroups(local: Group[], remote: Group[]): Group[] {
  const map = new Map<string, Group>();

  // Index remote groups first
  for (const group of remote) {
    map.set(group.id, group);
  }

  // Merge local groups with conflict resolution
  for (const group of local) {
    const existing = map.get(group.id);
    if (!existing) {
      map.set(group.id, group);
    } else {
      // Same ID → keep the one with the newer createdAt
      if (group.createdAt > existing.createdAt) {
        map.set(group.id, group);
      }
    }
  }

  return Array.from(map.values()).sort((a, b) => b.createdAt - a.createdAt);
}
