import GroupInvitesPanel from "@/components/groups/GroupInvitesPanel";
import GroupMembersPanel from "@/components/groups/GroupMembersPanel";
import GroupWorkspaceHeader from "@/components/groups/GroupWorkspaceHeader";
import EmptyState from "@/components/ui/EmptyState";
import Loading from "@/components/ui/Loading";
import { Colors } from "@/constants/theme";
import { useAuth } from "@/contexts/AuthContext";
import { groupService } from "@/services/groupService";
import { Group, GroupMember, Invitation, Membership } from "@/types";
import * as Clipboard from "expo-clipboard";
import { useLocalSearchParams } from "expo-router";
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Alert, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const GroupWorkspaceScreen = () => {
  const { groupId } = useLocalSearchParams<{ groupId: string }>();
  const { user, isGuest } = useAuth();
  const insets = useSafeAreaInsets();

  const [group, setGroup] = useState<Group | null>(null);
  const [membership, setMembership] = useState<Membership | null>(null);
  const [members, setMembers] = useState<GroupMember[]>([]);
  const [pendingInvites, setPendingInvites] = useState<Invitation[]>([]);
  const [loading, setLoading] = useState(true);
  const [inviting, setInviting] = useState(false);

  const isAdminLike = useMemo(() => {
    return membership?.role === "owner" || membership?.role === "admin";
  }, [membership?.role]);

  // Use ref to track isGuest without it being a useCallback dependency,
  // preventing unnecessary re-fetches when isGuest remains stable.
  const isGuestRef = useRef(isGuest);
  isGuestRef.current = isGuest;

  const loadWorkspace = useCallback(async () => {
    if (!groupId || !user) return;
    setLoading(true);
    try {
      const loadedGroup = await groupService.getGroupById(groupId);
      const loadedMembership = await groupService.getMembership(
        groupId,
        user.uid,
      );
      setGroup(loadedGroup);
      setMembership(loadedMembership);

      if (loadedGroup && !isGuestRef.current) {
        const loadedMembers = await groupService.getGroupMembers(groupId);
        setMembers(loadedMembers);

        if (
          loadedMembership?.role === "owner" ||
          loadedMembership?.role === "admin"
        ) {
          const invites = await groupService.getGroupInvitations(
            groupId,
            user.uid,
          );
          setPendingInvites(invites.filter((i) => i.status === "pending"));
        } else {
          setPendingInvites([]);
        }
      } else {
        setMembers([]);
        setPendingInvites([]);
      }
    } catch (e) {
      console.error("[GroupWorkspace] load failed:", e);
      Alert.alert("Error", "Failed to load workspace. Please try again.");
    } finally {
      setLoading(false);
    }
  }, [groupId, user]);

  useEffect(() => {
    loadWorkspace();
  }, [loadWorkspace]);

  const handleCopyCode = useCallback(async () => {
    if (!group?.code) return;
    try {
      await Clipboard.setStringAsync(group.code);
      Alert.alert("Copied", `Group code ${group.code} copied.`);
    } catch {
      Alert.alert("Group Code", `Code: ${group.code}`);
    }
  }, [group?.code]);

  const handleInvite = useCallback(
    async (email: string) => {
      if (!group || !user) return;
      setInviting(true);
      try {
        const result = await groupService.inviteMemberToGroup({
          group,
          invitedByUid: user.uid,
          invitedByDisplayName: user.displayName,
          invitedEmail: email,
          existingMembers: members,
        });
        Alert.alert(
          result.success ? "Success" : "Invite failed",
          result.message,
        );
        if (result.success) {
          await loadWorkspace();
        }
      } finally {
        setInviting(false);
      }
    },
    [group, user, members, loadWorkspace],
  );

  if (loading) {
    return (
      <View style={[styles.container, { paddingTop: insets.top + 16 }]}>
        <Loading />
      </View>
    );
  }

  if (!group) {
    return (
      <View style={[styles.container, { paddingTop: insets.top + 16 }]}>
        <EmptyState
          icon="alert-circle-outline"
          title="Group not found"
          subtitle="This group may have been removed or archived."
        />
      </View>
    );
  }

  if (!membership) {
    return (
      <View style={[styles.container, { paddingTop: insets.top + 16 }]}>
        <EmptyState
          icon="lock-closed-outline"
          title="Access restricted"
          subtitle="You are no longer a member of this group."
        />
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top + 16 }]}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.screenTitle}>Group Workspace</Text>
        <GroupWorkspaceHeader
          group={group}
          membership={membership}
          onCopyCode={handleCopyCode}
        />

        <GroupMembersPanel members={members} />

        {isAdminLike ? (
          <GroupInvitesPanel
            pendingInvites={pendingInvites}
            onInvite={handleInvite}
            loading={inviting}
            excludeIds={[
              user?.uid || "",
              user?.email || "",
              ...members.map((m) => m.uid),
              ...members.map((m) => m.email),
              ...pendingInvites.map((i) => i.invitedEmail),
            ]}
          />
        ) : null}

        <View style={styles.placeholderCard}>
          <Text style={styles.placeholderTitle}>Shared tasks</Text>
          <Text style={styles.placeholderSubtitle}>
            Shared group task runtime will be enabled in a future milestone.
            Your current task flow remains local-first for stability.
          </Text>
        </View>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.light.background,
    paddingHorizontal: 16,
  },
  scroll: {
    flex: 1,
  },
  screenTitle: {
    fontSize: 24,
    fontWeight: "700",
    color: Colors.light.text,
    marginBottom: 12,
  },
  placeholderCard: {
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: Colors.light.border,
    borderRadius: 18,
    padding: 14,
    marginBottom: 14,
  },
  placeholderTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: Colors.light.text,
    marginBottom: 6,
  },
  placeholderSubtitle: {
    fontSize: 13,
    lineHeight: 19,
    color: Colors.light.textSecondary,
  },
});

export default GroupWorkspaceScreen;
