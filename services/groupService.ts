import { Group, JoinGroupResult } from "@/types";

/** @deprecated Group collaboration has been removed. These stubs exist for backward compatibility. */
export const groupService = {
  getGroups: async (): Promise<Group[]> => [],
  createGroup: async (
    _name: string,
    _createdBy: string,
    _invitedMembers: string[] = [],
  ): Promise<Group> => {
    throw new Error("Groups are no longer supported.");
  },
  joinGroup: async (
    _code: string,
    _userId: string,
  ): Promise<JoinGroupResult> => {
    return { success: false, error: "Groups are no longer supported." };
  },
  leaveGroup: async (_groupId: string, _userId: string): Promise<void> => {},
  deleteGroup: async (_groupId: string, _userId: string): Promise<void> => {},
  getGroupById: async (_groupId: string): Promise<Group | null> => null,
  getGroupByCode: async (_code: string): Promise<Group | null> => null,
  getGroupsByMember: async (_userId: string): Promise<Group[]> => [],
  getGroupsCreatedBy: async (_userId: string): Promise<Group[]> => [],
  updateGroupName: async (
    _groupId: string,
    _newName: string,
  ): Promise<Group | null> => null,
  isMember: async (_groupId: string, _userId: string): Promise<boolean> =>
    false,
  getMembership: async (
    _groupId: string,
    _userId: string,
  ): Promise<any | null> => null,
  getGroupMembers: async (_groupId: string): Promise<any[]> => [],
  getGroupInvitations: async (
    _groupId: string,
    _currentUid: string,
  ): Promise<any[]> => [],
  inviteMemberToGroup: async (_params: any): Promise<any> => {
    return { success: false, message: "Groups are no longer supported." };
  },
  codeExists: async (_code: string): Promise<boolean> => false,
  clearAllGroups: async (): Promise<void> => {},
};

export default groupService;
