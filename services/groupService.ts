import { groupStorage } from "@/services/storageService";
import { syncFacade } from "@/services/syncFacade";
import { taskService } from "@/services/taskService";
import { Group } from "@/types";
import { generateGroupCode, generateId } from "@/utils/ids";

// Group service with sync support
export const groupService = {
  // Get all groups
  async getGroups(): Promise<Group[]> {
    return await groupStorage.getGroups();
  },

  // Create new group
  async createGroup(
    name: string,
    createdBy: string,
    invitedMembers: string[] = [],
  ): Promise<Group> {
    const members = Array.from(new Set([createdBy, ...invitedMembers]));
    const newGroup: Group = {
      id: generateId(),
      name,
      code: generateGroupCode(),
      members,
      createdAt: Date.now(),
      createdBy,
    };

    // Ensure code uniqueness
    let attempt = 0;
    while (attempt < 5) {
      const exists = await this.codeExists(newGroup.code);
      if (!exists) break;
      newGroup.code = generateGroupCode();
      attempt++;
    }

    await syncFacade.addGroup(newGroup);
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
        await syncFacade.updateGroup(group);
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
      await syncFacade.updateGroup(group);
    }
  },

  // Delete group (only for creator)
  async deleteGroup(groupId: string, userId: string): Promise<void> {
    const groups = await this.getGroups();
    const group = groups.find((g) => g.id === groupId);

    if (group && group.createdBy === userId) {
      // Delete all tasks belonging to this group
      const tasks = await taskService.getTasksByGroup(groupId);
      await Promise.all(tasks.map((t) => taskService.deleteTask(t.id)));
      await syncFacade.deleteGroup(groupId);
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
      await syncFacade.updateGroup(group);
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
    await syncFacade.saveGroups([]);
  },
};

export default groupService;
