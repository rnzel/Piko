import { Colors } from "@/constants/theme";
import { Group } from "@/types";
import Ionicons from "@expo/vector-icons/Ionicons";
import React from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";

type Props = {
  group: Group;
  onPress: (group: Group) => void;
  onLongPress: (group: Group) => void;
  onCopyCode: (code: string) => void;
};

const GroupCard = ({ group, onPress, onLongPress, onCopyCode }: Props) => {
  return (
    <TouchableOpacity
      style={styles.container}
      activeOpacity={0.7}
      onPress={() => onPress(group)}
      onLongPress={() => onLongPress(group)}
      accessibilityLabel={`${group.name} group, ${group.members.length} members`}
      accessibilityRole="button"
    >
      <View style={styles.header}>
        <View style={styles.iconContainer}>
          <Ionicons name="people" size={24} color={Colors.light.tint} />
        </View>
        <View style={styles.info}>
          <Text style={styles.name} numberOfLines={1}>
            {group.name}
          </Text>
          <Text style={styles.meta}>
            {group.members.length} member
            {group.members.length !== 1 ? "s" : ""} &bull; Code:{" "}
            <Text style={styles.code} onPress={() => onCopyCode(group.code)}>
              {group.code}
            </Text>
          </Text>
        </View>
        <TouchableOpacity
          style={styles.moreButton}
          onPress={() => onLongPress(group)}
          accessibilityLabel={`More options for ${group.name}`}
          accessibilityRole="button"
        >
          <Ionicons
            name="ellipsis-horizontal"
            size={20}
            color={Colors.light.textTertiary}
          />
        </TouchableOpacity>
      </View>

      <View style={styles.membersPreview}>
        {group.members.slice(0, 5).map((member, index) => (
          <View
            key={index}
            style={[styles.memberAvatar, { zIndex: 10 - index }]}
          >
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
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: "#FFFFFF",
    borderRadius: 24,
    padding: 20,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: Colors.light.border,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 16,
  },
  iconContainer: {
    width: 52,
    height: 52,
    borderRadius: 16,
    backgroundColor: Colors.light.tintLight,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 16,
  },
  info: {
    flex: 1,
  },
  name: {
    fontSize: 18,
    fontWeight: "700",
    color: Colors.light.text,
    marginBottom: 4,
  },
  meta: {
    fontSize: 13,
    color: Colors.light.textSecondary,
  },
  code: {
    color: Colors.light.tint,
    fontWeight: "600",
  },
  moreButton: {
    padding: 4,
    marginLeft: 8,
  },
  membersPreview: {
    flexDirection: "row",
    alignItems: "center",
    paddingLeft: 4,
  },
  memberAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: Colors.light.tint,
    alignItems: "center",
    justifyContent: "center",
    marginRight: -10,
    borderWidth: 2,
    borderColor: "#FFFFFF",
  },
  moreMembersBadge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: Colors.light.card,
    alignItems: "center",
    justifyContent: "center",
    marginLeft: 14,
    borderWidth: 1,
    borderColor: Colors.light.border,
  },
  moreMembersText: {
    fontSize: 11,
    fontWeight: "700",
    color: Colors.light.textSecondary,
  },
});

export default GroupCard;
