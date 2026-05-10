import { Colors } from "@/constants/theme";
import { GroupMember } from "@/types";
import Ionicons from "@expo/vector-icons/Ionicons";
import React from "react";
import { StyleSheet, Text, View } from "react-native";

type Props = {
  members: GroupMember[];
};

const GroupMembersPanel = ({ members }: Props) => {
  return (
    <View style={styles.card}>
      <Text style={styles.title}>Members</Text>
      {members.length === 0 ? (
        <Text style={styles.empty}>No members loaded.</Text>
      ) : (
        members.map((m) => (
          <View style={styles.row} key={m.uid}>
            <View style={styles.avatar}>
              <Ionicons name="person" size={14} color={Colors.light.tint} />
            </View>
            <View style={styles.main}>
              <Text style={styles.name}>
                {m.displayName || m.email || m.uid}
              </Text>
              <Text style={styles.email}>{m.email || "No email"}</Text>
            </View>
            <Text style={styles.role}>{m.role}</Text>
          </View>
        ))
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: Colors.light.border,
    borderRadius: 18,
    padding: 14,
    marginBottom: 14,
  },
  title: {
    fontSize: 16,
    fontWeight: "700",
    color: Colors.light.text,
    marginBottom: 8,
  },
  empty: { color: Colors.light.textSecondary, fontSize: 13 },
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: Colors.light.divider,
  },
  avatar: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: Colors.light.tintLight,
    marginRight: 10,
  },
  main: { flex: 1 },
  name: { color: Colors.light.text, fontWeight: "600", fontSize: 13 },
  email: { color: Colors.light.textSecondary, fontSize: 12, marginTop: 1 },
  role: {
    color: Colors.light.textSecondary,
    fontSize: 12,
    textTransform: "uppercase",
  },
});

export default GroupMembersPanel;
