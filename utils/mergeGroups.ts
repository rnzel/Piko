import { Group } from "@/types";

/**
 * @deprecated Group collaboration has been removed.
 * Returns an empty array — no groups to merge.
 */
export function mergeGroups(_local: Group[], _remote: Group[]): Group[] {
  return [];
}

export default mergeGroups;
