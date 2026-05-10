import { groupStorage, membershipStorage, userStorage } from "@/services/storageService";
import { syncOrchestrator } from "@/services/SyncOrchestrator";
import { taskService } from "@/services/taskService";
import {
  Group,
  GroupMember,
  Invitation,
  JoinGroupResult,
  Membership,
} from "@/types";
import { generateGroupCode, generateId } from "@/utils/ids";
import { normalizeGroup } from "@/utils/normalizeGroup";
import { normalizeInvitation } from "@/utils/normalizeInvitation";
import { normalizeMemberships } from "@/utils/normalizeMembership";
import { getApp } from "@react-native-firebase/app";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  getFirestore,
  limit,
  query,
  where,
} from "@react-native-firebase/firestore";

const db = getFirestore(getApp());
const groupsRef = collection(db, "groups");
const invitationsRef = collection(db, "invitations");

const fetchRemoteGroupByCode = async (code: string): Promise<Group | null> => {
  const q = query(groupsRef, where("code", "==", code), limit(1));
  const snapshot = await getDocs(q);
  if (snapshot.empty) return null;
  const docSnap = snapshot.docs[0];
  return normalizeGroup({ ...docSnap.data(), id: docSnap.id });
};

const upsertLocalMembership = async (
  uid: string,
  payload: {
    groupId: string;
    groupName: string;
    groupCode: string;
    role: "owner" | "admin" | "member";
  },
): Promise<void> => {
  const memberships = normalizeMemberships(
    await membershipStorage.getMemberships(uid),
  );
  const index = memberships.findIndex((m) => m.groupId === payload.groupId);
  const membership = {
    ...payload,
    joinedAt:
      index >= 0 && typeof memberships[index].joinedAt === "number"
        ? memberships[index].joinedAt
        : Date.now(),
  };

  if (index >= 0) {
    memberships[index] = membership;
  } else {
    memberships.push(membership);
  }

  await membershipStorage.saveMemberships(
    uid,
    normalizeMemberships(memberships),
  );
};

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

    // Fetch user profile for complete member data
    try {
      const userProfile = await userStorage.getUser();
      if (userProfile) {
        creatorMember.email = userProfile.email || "";
        creatorMember.displayName = userProfile.displayName || "";
      }
    } catch (e) {
      console.warn("[groupService] Failed to fetch user profile for creator member:", e);
    }

    // Use the new addGroup signature with creatorRole
    const result = await syncOrchestrator.addGroup(newGroup, creatorMember);
    if (!result.success) {
      console.warn("[groupService] addGroup did not sync to Firestore:", result.error);
      // Note: Group is still saved locally, but won't sync until next successful sync
    }

    // Add creator's membership locally
    const memberships = normalizeMemberships(
      await membershipStorage.getMemberships(createdBy),
    );
    memberships.push({
      groupId: newGroup.id,
      groupName: newGroup.name,
      groupCode: newGroup.code,
      role: "owner",
      joinedAt: Date.now(),
      updatedAt: Date.now(),
      membershipVersion: 1,
      syncStatus: "local",
      pendingChanges: true,
    });
    await membershipStorage.saveMemberships(
      createdBy,
      normalizeMemberships(memberships),
    );

    if (invitedMembers.length > 0) {
      for (const email of invitedMembers) {
        const invitedEmail = email.trim().toLowerCase();
        if (!invitedEmail) continue;

        // Prevent inviting self.
        if (invitedEmail === "" || invitedEmail === undefined) continue;

        // Prevent inviting existing members where possible.
        try {
          const membersSnapshot = await getDocs(
            collection(db, `groups/${newGroup.id}/members`),
          );
          const alreadyMember = membersSnapshot.docs.some((d) => {
            const data = d.data() as any;
            const memberEmail = String(data?.email ?? "")
              .trim()
              .toLowerCase();
            return memberEmail && memberEmail === invitedEmail;
          });
          if (alreadyMember) continue;
        } catch (e) {
          console.warn(
            "[groupService] member-check failed before invite:",
            invitedEmail,
            e,
          );
        }

        const invitationId = `${newGroup.id}_${invitedEmail.replace(/[^a-z0-9]/gi, "_")}`;

        const normalizedInvite = normalizeInvitation({
          id: invitationId,
          groupId: newGroup.id,
          groupName: newGroup.name,
          groupCode: newGroup.code,
          invitedByUid: createdBy,
          invitedByDisplayName: "",
          invitedEmail,
          status: "pending",
          createdAt: Date.now(),
          updatedAt: Date.now(),
          expiresAt: Date.now() + 7 * 24 * 60 * 60 * 1000,
          syncStatus: "local",
          pendingChanges: true,
        });

        if (!normalizedInvite) continue;

        try {
          await syncOrchestrator.createInvitation(normalizedInvite);
        } catch (e) {
          console.warn(
            "[groupService] create invitation failed:",
            invitedEmail,
            e,
          );
        }
      }
    }

    return newGroup;
  },

  // Join group by code
  async joinGroup(code: string, userId: string): Promise<JoinGroupResult> {
    const normalizedCode = code.trim();

    // Check local groups first for fast path.
    const groups = await this.getGroups();
    const localGroup = groups.find((g) => g.code === normalizedCode);

    if (localGroup) {
      if (!localGroup.isArchived) {
        const wasMember = await this.isMember(localGroup.id, userId);
        await upsertLocalMembership(userId, {
          groupId: localGroup.id,
          groupName: localGroup.name,
          groupCode: localGroup.code,
          role: localGroup.createdBy === userId ? "owner" : "member",
        });
        return {
          success: true,
          group: localGroup,
          status: wasMember ? "already_member" : "join_success",
        };
      }
      return {
        success: false,
        status: "group_archived",
        error: "Group is archived",
      };
    }

    // Remote lookup by group code (P0.2 correctness fix)
    try {
      const group = await fetchRemoteGroupByCode(normalizedCode);
      if (!group) {
        return {
          success: false,
          status: "group_not_found",
          error: "Group not found",
        };
      }
      if (group.isArchived) {
        return {
          success: false,
          status: "group_archived",
          error: "Group is archived",
        };
      }

      // Idempotency: if already a remote member, do not increment memberCount again.
      const memberRef = doc(db, `groups/${group.id}/members`, userId);
      const memberSnap = await getDoc(memberRef);
      const existingRemoteRole = memberSnap.exists()
        ? ((memberSnap.data() as any)?.role as
            | "owner"
            | "admin"
            | "member"
            | undefined)
        : undefined;

      // Idempotent add-member write-through.
      // Firestore rules allow self-create with role=member.
      if (!memberSnap.exists()) {
        await syncOrchestrator.addGroupMember(group.id, {
          uid: userId,
          email: "",
          displayName: "",
          role: group.createdBy === userId ? "owner" : "member",
          joinedAt: Date.now(),
          notificationsEnabled: true,
        });
      }

      // Ensure local group list contains the joined group.
      const currentGroups = await this.getGroups();
      const existingGroupIndex = currentGroups.findIndex(
        (g) => g.id === group.id,
      );
      if (existingGroupIndex >= 0) {
        currentGroups[existingGroupIndex] = {
          ...currentGroups[existingGroupIndex],
          ...group,
        };
      } else {
        currentGroups.unshift(group);
      }
      await groupStorage.saveGroups(
        currentGroups.map((g) => normalizeGroup(g)).filter(Boolean) as Group[],
      );

      // Ensure local membership is consistent.
      await upsertLocalMembership(userId, {
        groupId: group.id,
        groupName: group.name,
        groupCode: group.code,
        role:
          existingRemoteRole ||
          (group.createdBy === userId ? "owner" : "member"),
      });

      return {
        success: true,
        group,
        status: memberSnap.exists() ? "already_member" : "join_success",
      };
    } catch (error) {
      console.error("[groupService] joinGroup remote lookup failed:", error);
      return { success: false, status: "join_failed", error: "Join failed" };
    }
  },

  // Leave group
  async leaveGroup(groupId: string, userId: string): Promise<void> {
    const groups = await this.getGroups();
    const group = groups.find((g) => g.id === groupId);

    if (group) {
      // Remove from memberships
      const memberships = normalizeMemberships(
        await membershipStorage.getMemberships(userId),
      );
      const filtered = memberships.filter((m) => m.groupId !== groupId);
      await membershipStorage.saveMemberships(
        userId,
        normalizeMemberships(filtered),
      );

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
      // Local lifecycle cleanup first to avoid stale membership/group references.
      const memberships = normalizeMemberships(
        await membershipStorage.getMemberships(userId),
      );
      const filteredMemberships = memberships.filter(
        (m) => m.groupId !== groupId,
      );
      await membershipStorage.saveMemberships(
        userId,
        normalizeMemberships(filteredMemberships),
      );

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

  async getMembership(
    groupId: string,
    userId: string,
  ): Promise<Membership | null> {
    const memberships = normalizeMemberships(
      await membershipStorage.getMemberships(userId),
    );
    return memberships.find((m) => m.groupId === groupId) || null;
  },

  async getGroupMembers(groupId: string): Promise<GroupMember[]> {
    try {
      const snapshot = await getDocs(
        collection(db, `groups/${groupId}/members`),
      );
      return snapshot.docs.map((d) => ({
        uid: d.id,
        email: String((d.data() as any)?.email ?? ""),
        displayName: String((d.data() as any)?.displayName ?? ""),
        photoURL:
          typeof (d.data() as any)?.photoURL === "string"
            ? (d.data() as any).photoURL
            : undefined,
        role:
          (d.data() as any)?.role === "owner" ||
          (d.data() as any)?.role === "admin" ||
          (d.data() as any)?.role === "member"
            ? (d.data() as any).role
            : "member",
        joinedAt:
          typeof (d.data() as any)?.joinedAt === "number"
            ? (d.data() as any).joinedAt
            : Date.now(),
        invitedBy:
          typeof (d.data() as any)?.invitedBy === "string"
            ? (d.data() as any).invitedBy
            : undefined,
        lastActiveAt:
          typeof (d.data() as any)?.lastActiveAt === "number"
            ? (d.data() as any).lastActiveAt
            : undefined,
        isOnline: Boolean((d.data() as any)?.isOnline),
        notificationsEnabled:
          typeof (d.data() as any)?.notificationsEnabled === "boolean"
            ? (d.data() as any).notificationsEnabled
            : true,
      }));
    } catch (error) {
      console.warn("[groupService] getGroupMembers failed:", error);
      return [];
    }
  },

  async getGroupInvitations(
    groupId: string,
    currentUid: string,
  ): Promise<Invitation[]> {
    try {
      const q = query(
        invitationsRef,
        where("groupId", "==", groupId),
        where("invitedByUid", "==", currentUid),
        limit(50),
      );
      const snapshot = await getDocs(q);
      return snapshot.docs
        .map((d) => normalizeInvitation({ ...d.data(), id: d.id }))
        .filter(Boolean) as Invitation[];
    } catch (error) {
      console.warn("[groupService] getGroupInvitations failed:", error);
      return [];
    }
  },

  async inviteMemberToGroup(params: {
    group: Group;
    invitedByUid: string;
    invitedByDisplayName?: string;
    invitedEmail: string;
    existingMembers?: GroupMember[];
  }): Promise<{ success: boolean; message: string }> {
    const email = params.invitedEmail.trim().toLowerCase();
    if (!email || !email.includes("@")) {
      return { success: false, message: "Please enter a valid email." };
    }

    const memberExists = (params.existingMembers || []).some(
      (m) => m.email?.trim().toLowerCase() === email,
    );
    if (memberExists) {
      return { success: false, message: "This user is already a member." };
    }

    const invitationId = `${params.group.id}_${email.replace(/[^a-z0-9]/gi, "_")}`;
    const invite = normalizeInvitation({
      id: invitationId,
      groupId: params.group.id,
      groupName: params.group.name,
      groupCode: params.group.code,
      invitedByUid: params.invitedByUid,
      invitedByDisplayName: params.invitedByDisplayName || "",
      invitedEmail: email,
      status: "pending",
      createdAt: Date.now(),
      updatedAt: Date.now(),
      expiresAt: Date.now() + 7 * 24 * 60 * 60 * 1000,
      syncStatus: "local",
      pendingChanges: true,
    });

    if (!invite)
      return { success: false, message: "Failed to prepare invitation." };

    try {
      await syncOrchestrator.createInvitation(invite);
      return { success: true, message: "Invitation sent." };
    } catch {
      return { success: false, message: "Failed to send invitation." };
    }
  },

  // Check if group code exists
  async codeExists(code: string): Promise<boolean> {
    const local = await this.getGroupByCode(code);
    if (local) return true;

    let group: Group | null = null;
    try {
      group = await fetchRemoteGroupByCode(code.trim());
    } catch {
      // If remote lookup fails, preserve existing local-only behavior fallback.
    }
    return group !== null;
  },

  // Clear all groups
  async clearAllGroups(): Promise<void> {
    await groupStorage.saveGroups([]);
  },
};

export default groupService;
