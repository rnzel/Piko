import { Colors } from "@/constants/theme";
import { Group, Membership } from "@/types";
import Ionicons from "@expo/vector-icons/Ionicons";
import React from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";

type Props = {
  group: Group;
  membership: Membership | null;
  onCopyCode: () => void;
};

const GroupWorkspaceHeader = ({ group, membership, onCopyCode }: Props) => {
  return (
    <View style={styles.card}>
      <View style={styles.row}>
        <View style={styles.iconWrap}>
          <Ionicons name="people" size={22} color={Colors.light.tint} />
        </View>
        <View style={styles.main}>
          <Text style={styles.title}>{group.name}</Text>
          <Text style={styles.meta}>
            {group.memberCount ?? 0} members • Role:{" "}
            {membership?.role ?? "member"}
          </Text>
        </View>
      </View>

      <View style={styles.footerRow}>
        <TouchableOpacity style={styles.codeButton} onPress={onCopyCode}>
          <Ionicons name="copy-outline" size={14} color={Colors.light.tint} />
          <Text style={styles.codeText}>{group.code}</Text>
        </TouchableOpacity>
        {group.isArchived ? (
          <Text style={styles.archived}>Archived</Text>
        ) : null}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 18,
    borderWidth: 1,
    borderColor: Colors.light.border,
    padding: 16,
    marginBottom: 14,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  iconWrap: {
    width: 42,
    height: 42,
    borderRadius: 12,
    backgroundColor: Colors.light.tintLight,
    alignItems: "center",
    justifyContent: "center",
  },
  main: { flex: 1 },
  title: { fontSize: 18, fontWeight: "700", color: Colors.light.text },
  meta: { fontSize: 13, color: Colors.light.textSecondary, marginTop: 2 },
  footerRow: {
    marginTop: 12,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  codeButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 999,
    backgroundColor: Colors.light.tintLight,
  },
  codeText: { color: Colors.light.tint, fontWeight: "700", letterSpacing: 1 },
  archived: { color: Colors.light.error, fontSize: 12, fontWeight: "700" },
});

export default GroupWorkspaceHeader;
