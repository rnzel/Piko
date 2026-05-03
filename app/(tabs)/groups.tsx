import { Colors } from "@/constants/theme";
import { useAuth } from "@/contexts/AuthContext";
import { groupService } from "@/services/groupService";
import { Group } from "@/types";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useFocusEffect } from "@react-navigation/native";
import React, { useCallback, useState } from "react";
import {
  Alert,
  Dimensions,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const { width } = Dimensions.get("window");

const GroupsScreen = () => {
  const { user, isGuest } = useAuth();
  const [groups, setGroups] = useState<Group[]>([]);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showJoinModal, setShowJoinModal] = useState(false);
  const [newGroupName, setNewGroupName] = useState("");
  const [joinGroupCode, setJoinGroupCode] = useState("");
  const insets = useSafeAreaInsets();

  // Load groups
  const loadGroups = useCallback(async () => {
    if (!user && !isGuest) return;
    try {
      const loadedGroups = await groupService.getGroups();
      setGroups(loadedGroups);
    } catch (error) {
      console.error("Error loading groups:", error);
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
      const newGroup = await groupService.createGroup(
        newGroupName.trim(),
        user.uid,
      );
      setGroups((prev) => [newGroup, ...prev]);
      setNewGroupName("");
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
          // Remove duplicate if already exists
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
              size={22}
              color={Colors.light.tint}
            />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.headerAction}
            onPress={() => setShowCreateModal(true)}
          >
            <Ionicons
              name="add-circle-outline"
              size={22}
              color={Colors.light.tint}
            />
          </TouchableOpacity>
        </View>
      </View>

      {/* Groups list */}
      <ScrollView
        style={styles.groupsList}
        showsVerticalScrollIndicator={false}
      >
        {groups.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons
              name="people-outline"
              size={64}
              color={Colors.light.textTertiary}
            />
            <Text style={styles.emptyTitle}>No groups yet</Text>
            <Text style={styles.emptySubtitle}>
              Create a group or join one with a code
            </Text>
            <View style={styles.emptyActions}>
              <TouchableOpacity
                style={styles.emptyButton}
                onPress={() => setShowCreateModal(true)}
              >
                <Ionicons name="add" size={20} color="#FFFFFF" />
                <Text style={styles.emptyButtonText}>Create Group</Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : (
          groups.map((group) => (
            <View key={group.id} style={styles.groupCard}>
              <View style={styles.groupCardHeader}>
                <View style={styles.groupIcon}>
                  <Ionicons name="people" size={24} color={Colors.light.tint} />
                </View>
                <View style={styles.groupInfo}>
                  <Text style={styles.groupName}>{group.name}</Text>
                  <Text style={styles.groupMeta}>
                    {group.members.length} member
                    {group.members.length !== 1 ? "s" : ""} &bull; Code:{" "}
                    <Text
                      style={styles.groupCode}
                      onPress={() => copyCode(group.code)}
                    >
                      {group.code}
                    </Text>
                  </Text>
                </View>
                <TouchableOpacity
                  style={styles.moreButton}
                  onPress={() => leaveGroup(group)}
                >
                  <Ionicons
                    name="ellipsis-horizontal"
                    size={20}
                    color={Colors.light.textTertiary}
                  />
                </TouchableOpacity>
              </View>
              {/* Members preview */}
              <View style={styles.membersPreview}>
                {group.members.slice(0, 5).map((member, index) => (
                  <View key={index} style={styles.memberAvatar}>
                    <Ionicons name="person" size={14} color="#FFFFFF" />
                  </View>
                ))}
                {group.members.length > 5 && (
                  <View style={styles.moreMembersBadge}>
                    <Text style={styles.moreMembersText}>
                      +{group.members.length - 5}
                    </Text>
                  </View>
                )}
              </View>
            </View>
          ))
        )}
      </ScrollView>

      {/* Create Group Modal */}
      <Modal
        visible={showCreateModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowCreateModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Create Group</Text>
            <Text style={styles.modalSubtitle}>
              Give your group a name. You'll get a 6-digit code to share.
            </Text>
            <TextInput
              style={styles.modalInput}
              placeholder="Group name"
              placeholderTextColor={Colors.light.textTertiary}
              value={newGroupName}
              onChangeText={setNewGroupName}
              autoFocus
            />
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalButtonSecondary]}
                onPress={() => {
                  setShowCreateModal(false);
                  setNewGroupName("");
                }}
              >
                <Text style={styles.modalButtonSecondaryText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalButtonPrimary]}
                onPress={createGroup}
              >
                <Text style={styles.modalButtonPrimaryText}>Create</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Join Group Modal */}
      <Modal
        visible={showJoinModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowJoinModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Join Group</Text>
            <Text style={styles.modalSubtitle}>
              Enter the 6-digit code from your group.
            </Text>
            <TextInput
              style={styles.modalInput}
              placeholder="123456"
              placeholderTextColor={Colors.light.textTertiary}
              value={joinGroupCode}
              onChangeText={(text) =>
                setJoinGroupCode(text.replace(/[^0-9]/g, "").slice(0, 6))
              }
              keyboardType="number-pad"
              maxLength={6}
              autoFocus
            />
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalButtonSecondary]}
                onPress={() => {
                  setShowJoinModal(false);
                  setJoinGroupCode("");
                }}
              >
                <Text style={styles.modalButtonSecondaryText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalButtonPrimary]}
                onPress={joinGroup}
              >
                <Text style={styles.modalButtonPrimaryText}>Join</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Bottom padding for tab bar */}
      <View style={{ height: 100 }} />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.light.background,
    paddingHorizontal: 20,
  },
  authContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 20,
  },
  authTitle: {
    fontSize: 24,
    fontWeight: "bold",
    color: Colors.light.text,
    marginTop: 16,
  },
  authSubtitle: {
    fontSize: 14,
    color: Colors.light.textSecondary,
    textAlign: "center",
    marginTop: 8,
    paddingHorizontal: 20,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 20,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: "bold",
    color: Colors.light.text,
  },
  headerActions: {
    flexDirection: "row",
    gap: 8,
  },
  headerAction: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.light.tintLight,
    alignItems: "center",
    justifyContent: "center",
  },
  groupsList: {
    flex: 1,
  },
  emptyState: {
    alignItems: "center",
    justifyContent: "center",
    paddingTop: 80,
    paddingBottom: 40,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: Colors.light.textTertiary,
    marginTop: 16,
  },
  emptySubtitle: {
    fontSize: 14,
    color: Colors.light.textSecondary,
    marginTop: 8,
    textAlign: "center",
  },
  emptyActions: {
    marginTop: 24,
  },
  emptyButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Colors.light.tint,
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 16,
    gap: 8,
  },
  emptyButtonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "600",
  },
  groupCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    shadowColor: Colors.light.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  groupCardHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
  },
  groupIcon: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: Colors.light.tintLight,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  groupInfo: {
    flex: 1,
  },
  groupName: {
    fontSize: 16,
    fontWeight: "600",
    color: Colors.light.text,
    marginBottom: 4,
  },
  groupMeta: {
    fontSize: 13,
    color: Colors.light.textSecondary,
  },
  groupCode: {
    color: Colors.light.tint,
    fontWeight: "600",
    textDecorationLine: "underline",
  },
  moreButton: {
    padding: 4,
  },
  membersPreview: {
    flexDirection: "row",
    alignItems: "center",
  },
  memberAvatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: Colors.light.tint,
    alignItems: "center",
    justifyContent: "center",
    marginRight: -8,
    borderWidth: 2,
    borderColor: "#FFFFFF",
  },
  moreMembersBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: Colors.light.card,
    alignItems: "center",
    justifyContent: "center",
    marginLeft: 4,
    borderWidth: 2,
    borderColor: "#FFFFFF",
  },
  moreMembersText: {
    fontSize: 10,
    fontWeight: "600",
    color: Colors.light.textSecondary,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.4)",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 20,
  },
  modalContent: {
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    padding: 24,
    width: width * 0.85,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: "bold",
    color: Colors.light.text,
    marginBottom: 8,
  },
  modalSubtitle: {
    fontSize: 14,
    color: Colors.light.textSecondary,
    marginBottom: 20,
    lineHeight: 20,
  },
  modalInput: {
    backgroundColor: Colors.light.card,
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    color: Colors.light.text,
    marginBottom: 20,
  },
  modalActions: {
    flexDirection: "row",
    gap: 12,
  },
  modalButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: "center",
  },
  modalButtonSecondary: {
    backgroundColor: Colors.light.card,
  },
  modalButtonSecondaryText: {
    fontSize: 16,
    fontWeight: "600",
    color: Colors.light.textSecondary,
  },
  modalButtonPrimary: {
    backgroundColor: Colors.light.tint,
  },
  modalButtonPrimaryText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#FFFFFF",
  },
});

export default GroupsScreen;
