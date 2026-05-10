import { Group } from "@/types";

/**
 * @deprecated Group collaboration has been removed.
 * Returns null for all inputs.
 */
export const normalizeGroup = (_input: any): Group | null => {
  return null;
};

/**
 * @deprecated Group collaboration has been removed.
 * Returns an empty array.
 */
export const normalizeGroups = (_inputs: any[]): Group[] => {
  return [];
};

export default normalizeGroup;
