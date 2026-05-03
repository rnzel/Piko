import { groupStorage } from "@/services/storageService";
import { Group } from "@/types";

// Generate unique ID
const generateId = (): string => {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
};

// Generate 6-digit group code
const generateGroupCode = (): string => {
  const chars = "0123456789";
  let code = "";
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
};

// Group service for local storage (guest mode)
export const groupService = {
  // Get all groups
  async getGroups(): Promise<Group[]> {
    return await groupStorage.getGroups();
  },

  // Create new group
  async createGroup(name: string, createdBy: string): Promise<Group> {
    const newGroup: Group = {
      id: generateId(),
      name,
      code: generateGroupCode(),
      members: [createdBy],
      createdAt: Date.now(),
      createdBy,
    };

    await groupStorage.addGroup(newGroup);
    return newGroup;
  },

  // Join group by code
  async joinGroup(code: string, userId: string): Promise<Group | null> {
    const groups = await this.getGroups();
    const group = groups.find((g) => g.code === code);

    if (group) {
      // Add user to members if not already a member
      if (!group.members.includes(userId)) {
        group.members.push(userId);
        await groupStorage.updateGroup(group);
      }
      return group;
    }

    return null;
  },

  // Leave group
  async leaveGroup(groupId: string, userId: string): Promise<void> {
    const groups = await this.getGroups();
    const group = groups.find((g) => g.id === groupId);

    if (group) {
      group.members = group.members.filter((m) => m !== userId);
      await groupStorage.updateGroup(group);
    }
  },

  // Delete group (only for creator)
  async deleteGroup(groupId: string, userId: string): Promise<void> {
    const groups = await this.getGroups();
    const group = groups.find((g) => g.id === groupId);

    if (group && group.createdBy === userId) {
      await groupStorage.deleteGroup(groupId);
    }
  },

  // Get group by ID
  async getGroupById(groupId: string): Promise<Group | null> {
    const groups = await this.getGroups();
    return groups.find((g) => g.id === groupId) || null;
  },

  // Get group by code
  async getGroupByCode(code: string): Promise<Group | null> {
    const groups = await this.getGroups();
    return groups.find((g) => g.code === code) || null;
  },

  // Get groups where user is a member
  async getGroupsByMember(userId: string): Promise<Group[]> {
    const groups = await this.getGroups();
    return groups.filter((g) => g.members.includes(userId));
  },

  // Get groups created by user
  async getGroupsCreatedBy(userId: string): Promise<Group[]> {
    const groups = await this.getGroups();
    return groups.filter((g) => g.createdBy === userId);
  },

  // Update group name
  async updateGroupName(
    groupId: string,
    newName: string,
  ): Promise<Group | null> {
    const groups = await this.getGroups();
    const group = groups.find((g) => g.id === groupId);

    if (group) {
      group.name = newName;
      await groupStorage.updateGroup(group);
      return group;
    }

    return null;
  },

  // Check if user is member of group
  async isMember(groupId: string, userId: string): Promise<boolean> {
    const group = await this.getGroupById(groupId);
    return group ? group.members.includes(userId) : false;
  },

  // Check if group code exists
  async codeExists(code: string): Promise<boolean> {
    const group = await this.getGroupByCode(code);
    return group !== null;
  },

  // Clear all groups
  async clearAllGroups(): Promise<void> {
    await groupStorage.clearGroups();
  },
};

export default groupService;
