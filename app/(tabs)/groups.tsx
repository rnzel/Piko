import GroupCard from "@/components/groups/GroupCard";
import GroupModal from "@/components/groups/GroupModal";
import MemberChips from "@/components/groups/MemberChips";
import MemberSearch from "@/components/groups/MemberSearch";
import EmptyState from "@/components/ui/EmptyState";
import Loading from "@/components/ui/Loading";
import { Colors } from "@/constants/theme";
import { useAuth } from "@/contexts/AuthContext";
import { groupService } from "@/services/groupService";
import { Group } from "@/types";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useFocusEffect } from "@react-navigation/native";
import React, { useCallback, useState } from "react";
import {
  Alert,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import styles from "./groups.styles";

const GroupsScreen = () => {
  const { user, isGuest } = useAuth();
  const [groups, setGroups] = useState<Group[]>([]);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showJoinModal, setShowJoinModal] = useState(false);
  const [newGroupName, setNewGroupName] = useState("");
  const [joinGroupCode, setJoinGroupCode] = useState("");
  const [invitedMembers, setInvitedMembers] = useState<
    { id: string; email: string; displayName: string }[]
  >([]);
  const insets = useSafeAreaInsets();
  const [loadingGroups, setLoadingGroups] = useState<boolean>(true);

  // Load groups
  const loadGroups = useCallback(async () => {
    if (!user && !isGuest) return;
    setLoadingGroups(true);
    try {
      const loadedGroups = await groupService.getGroups();
      setGroups(loadedGroups);
    } catch (error) {
      console.error("Error loading groups:", error);
    } finally {
      setLoadingGroups(false);
    }
  }, [user, isGuest]);

  useFocusEffect(
    useCallback(() => {
      loadGroups();
    }, [loadGroups]),
  );

  // Create new group
  const createGroup = async () => {
    if (!newGroupName.trim()) {
      Alert.alert("Error", "Please enter a group name.");
      return;
    }

    if (!user) {
      Alert.alert("Error", "You must be logged in to create a group.");
      return;
    }

    try {
      const memberEmails = invitedMembers.map((m) => m.email);
      const newGroup = await groupService.createGroup(
        newGroupName.trim(),
        user.uid,
        memberEmails,
      );
      setGroups((prev) => [newGroup, ...prev]);
      setNewGroupName("");
      setInvitedMembers([]);
      setShowCreateModal(false);
      Alert.alert(
        "Group Created!",
        `Share this code with others: ${newGroup.code}`,
      );
    } catch (error) {
      console.error("Error creating group:", error);
      Alert.alert("Error", "Failed to create group.");
    }
  };

  // Join group
  const joinGroup = async () => {
    if (!joinGroupCode.trim() || joinGroupCode.length !== 6) {
      Alert.alert("Error", "Please enter a valid 6-digit code.");
      return;
    }

    if (!user) {
      Alert.alert("Error", "You must be logged in to join a group.");
      return;
    }

    try {
      const group = await groupService.joinGroup(
        joinGroupCode.trim(),
        user.uid,
      );
      if (group) {
        setGroups((prev) => {
          const filtered = prev.filter((g) => g.id !== group.id);
          return [group, ...filtered];
        });
        setJoinGroupCode("");
        setShowJoinModal(false);
        Alert.alert("Success", `You joined "${group.name}"!`);
      } else {
        Alert.alert("Error", "Group not found. Please check the code.");
      }
    } catch (error) {
      console.error("Error joining group:", error);
      Alert.alert("Error", "Failed to join group.");
    }
  };

  // Leave group
  const leaveGroup = (group: Group) => {
    if (!user) return;

    if (group.createdBy === user.uid) {
      Alert.alert(
        "Delete Group",
        "As the creator, you can delete this group. This will remove it for all members.",
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Delete",
            style: "destructive",
            onPress: async () => {
              try {
                await groupService.deleteGroup(group.id, user.uid);
                setGroups((prev) => prev.filter((g) => g.id !== group.id));
              } catch (error) {
                console.error("Error deleting group:", error);
              }
            },
          },
        ],
      );
    } else {
      Alert.alert(
        "Leave Group",
        `Are you sure you want to leave "${group.name}"?`,
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Leave",
            style: "destructive",
            onPress: async () => {
              try {
                await groupService.leaveGroup(group.id, user.uid);
                setGroups((prev) => prev.filter((g) => g.id !== group.id));
              } catch (error) {
                console.error("Error leaving group:", error);
              }
            },
          },
        ],
      );
    }
  };

  // Copy code to clipboard
  const copyCode = (code: string) => {
    Alert.alert("Group Code", `Code: ${code}\n\nCopied to clipboard!`);
  };

  const handleAddMember = (member: {
    id: string;
    email: string;
    displayName: string;
  }) => {
    if (invitedMembers.some((m) => m.email === member.email)) return;
    setInvitedMembers((prev) => [...prev, member]);
  };

  const handleRemoveMember = (email: string) => {
    setInvitedMembers((prev) => prev.filter((m) => m.email !== email));
  };

  // Not logged in state
  if (!user && !isGuest) {
    return (
      <View style={[styles.container, { paddingTop: insets.top + 20 }]}>
        <View style={styles.authContainer}>
          <Ionicons
            name="people-outline"
            size={64}
            color={Colors.light.textTertiary}
          />
          <Text style={styles.authTitle}>Groups</Text>
          <Text style={styles.authSubtitle}>
            Sign in to create or join groups and collaborate with others.
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top + 20 }]}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Groups</Text>
        <View style={styles.headerActions}>
          <TouchableOpacity
            style={styles.headerAction}
            onPress={() => setShowJoinModal(true)}
          >
            <Ionicons
              name="enter-outline"
              size={20}
              color={Colors.light.text}
            />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.headerAction}
            onPress={() => setShowCreateModal(true)}
          >
            <Ionicons name="add" size={24} color={Colors.light.text} />
          </TouchableOpacity>
        </View>
      </View>

      {/* Groups list */}
      <ScrollView
        style={styles.groupsList}
        contentContainerStyle={[
          styles.listContent,
          { paddingBottom: insets.bottom + 100 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {loadingGroups ? (
          <Loading />
        ) : groups.length === 0 ? (
          <EmptyState
            icon="people-outline"
            title="No groups yet"
            subtitle="Create or join a group to collaborate"
          />
        ) : (
          groups.map((group) => (
            <GroupCard
              key={group.id}
              group={group}
              onPress={() => {}}
              onLongPress={leaveGroup}
              onCopyCode={copyCode}
            />
          ))
        )}
      </ScrollView>

      {/* Create Group Modal */}
      <GroupModal
        visible={showCreateModal}
        onClose={() => {
          setShowCreateModal(false);
          setNewGroupName("");
          setInvitedMembers([]);
        }}
        title="Create Group"
        footer={
          <TouchableOpacity
            style={styles.modalSaveButton}
            onPress={createGroup}
          >
            <Text style={styles.modalSaveButtonText}>Create Group</Text>
          </TouchableOpacity>
        }
      >
        <View style={styles.modalSection}>
          <Text style={styles.modalLabel}>Group Name</Text>
          <TextInput
            style={styles.modalInput}
            placeholder="e.g. Design Team"
            placeholderTextColor={Colors.light.textTertiary}
            value={newGroupName}
            onChangeText={setNewGroupName}
            autoFocus
          />
        </View>

        <View style={styles.modalSection}>
          <Text style={styles.modalLabel}>Invite Members</Text>
          <MemberSearch
            onSelect={handleAddMember}
            excludeIds={[
              user?.uid || "",
              user?.email || "",
              ...invitedMembers.map((m) => m.id),
              ...invitedMembers.map((m) => m.email),
            ]}
          />
          <MemberChips
            members={invitedMembers.map((m) => m.email)}
            onRemove={handleRemoveMember}
          />
        </View>
      </GroupModal>

      {/* Join Group Modal */}
      <GroupModal
        visible={showJoinModal}
        onClose={() => {
          setShowJoinModal(false);
          setJoinGroupCode("");
        }}
        title="Join Group"
        footer={
          <TouchableOpacity style={styles.modalSaveButton} onPress={joinGroup}>
            <Text style={styles.modalSaveButtonText}>Join Group</Text>
          </TouchableOpacity>
        }
      >
        <View style={styles.modalSection}>
          <Text style={styles.modalLabel}>Group Code</Text>
          <Text style={styles.modalSubtitle}>
            Enter the 6-digit code shared with you.
          </Text>
          <TextInput
            style={[styles.modalInput, styles.codeInput]}
            placeholder="000000"
            placeholderTextColor={Colors.light.textTertiary}
            value={joinGroupCode}
            onChangeText={(text) =>
              setJoinGroupCode(text.replace(/[^0-9]/g, "").slice(0, 6))
            }
            keyboardType="number-pad"
            maxLength={6}
          />
        </View>
      </GroupModal>
    </View>
  );
};

export default GroupsScreen;
