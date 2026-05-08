import { groupStorage, membershipStorage } from "@/services/storageService";
import { syncOrchestrator } from "@/services/SyncOrchestrator";
import { taskService } from "@/services/taskService";
import { Group, GroupMember } from "@/types";
import { generateGroupCode, generateId } from "@/utils/ids";

// Group service with global group support
export const groupService = {
  // Get all groups the user is a member of
  async getGroups(): Promise<Group[]> {
    return await groupStorage.getGroups();
  },

  // Create new group (global)
  async createGroup(
    name: string,
    createdBy: string,
    invitedMembers: string[] = [],
  ): Promise<Group> {
    const newGroup: Group = {
      id: generateId(),
      name,
      code: generateGroupCode(),
      createdBy,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      memberCount: 1,
      isArchived: false,
    };

    // Ensure code uniqueness
    let attempt = 0;
    while (attempt < 5) {
      const exists = await this.codeExists(newGroup.code);
      if (!exists) break;
      newGroup.code = generateGroupCode();
      attempt++;
    }

    const creatorMember: GroupMember = {
      uid: createdBy,
      email: "",
      displayName: "",
      role: "owner",
      joinedAt: Date.now(),
      notificationsEnabled: true,
    };

    // Use the new addGroup signature with creatorRole
    await syncOrchestrator.addGroup(newGroup, creatorMember);

    // Add creator's membership locally
    const memberships = await membershipStorage.getMemberships(createdBy);
    memberships.push({
      groupId: newGroup.id,
      groupName: newGroup.name,
      groupCode: newGroup.code,
      role: "owner",
      joinedAt: Date.now(),
    });
    await membershipStorage.saveMemberships(createdBy, memberships);

    return newGroup;
  },

  // Join group by code
  async joinGroup(code: string, userId: string): Promise<Group | null> {
    // Check if we have the group locally first
    const groups = await this.getGroups();
    const localGroup = groups.find((g) => g.code === code);

    if (localGroup) {
      // Update local membership
      if (!localGroup.createdBy) {
        // Legacy group without proper owner — add membership anyway
      }
      const memberships = await membershipStorage.getMemberships(userId);
      const existing = memberships.find((m) => m.groupId === localGroup.id);
      if (!existing) {
        memberships.push({
          groupId: localGroup.id,
          groupName: localGroup.name,
          groupCode: localGroup.code,
          role: "member",
          joinedAt: Date.now(),
        });
        await membershipStorage.saveMemberships(userId, memberships);
      }
      return localGroup;
    }

    return null;
  },

  // Leave group
  async leaveGroup(groupId: string, userId: string): Promise<void> {
    const groups = await this.getGroups();
    const group = groups.find((g) => g.id === groupId);

    if (group) {
      // Remove from memberships
      const memberships = await membershipStorage.getMemberships(userId);
      const filtered = memberships.filter((m) => m.groupId !== groupId);
      await membershipStorage.saveMemberships(userId, filtered);

      // Remove group from local groups list if user is a simple member
      // (owner should use deleteGroup instead)
      await syncOrchestrator.removeGroupMember(groupId, userId);
    }
  },

  // Delete group (only for owner)
  async deleteGroup(groupId: string, userId: string): Promise<void> {
    const groups = await this.getGroups();
    const group = groups.find((g) => g.id === groupId);

    if (group && group.createdBy === userId) {
      // Delete all tasks belonging to this group
      const tasks = await taskService.getTasksByGroup(groupId);
      await Promise.all(tasks.map((t) => taskService.deleteTask(t.id)));
      await syncOrchestrator.deleteGroup(groupId);
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

  // Get groups by member
  async getGroupsByMember(userId: string): Promise<Group[]> {
    const memberships = await membershipStorage.getMemberships(userId);
    const groupIds = memberships.map((m) => m.groupId);
    const groups = await this.getGroups();
    return groups.filter((g) => groupIds.includes(g.id));
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
      group.updatedAt = Date.now();
      await syncOrchestrator.updateGroup(group);
      return group;
    }

    return null;
  },

  // Check if user is member of group
  async isMember(groupId: string, userId: string): Promise<boolean> {
    const memberships = await membershipStorage.getMemberships(userId);
    return memberships.some((m) => m.groupId === groupId);
  },

  // Check if group code exists
  async codeExists(code: string): Promise<boolean> {
    const group = await this.getGroupByCode(code);
    return group !== null;
  },

  // Clear all groups
  async clearAllGroups(): Promise<void> {
    await groupStorage.saveGroups([]);
  },
};

export default groupService;
