import MemberSearch from "@/components/groups/MemberSearch";
import { Colors } from "@/constants/theme";
import { Invitation } from "@/types";
import React from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";

type Props = {
  pendingInvites: Invitation[];
  onInvite: (email: string) => Promise<void>;
  loading?: boolean;
  excludeIds?: string[];
};

const GroupInvitesPanel = ({
  pendingInvites,
  onInvite,
  loading,
  excludeIds = [],
}: Props) => {
  return (
    <View style={styles.card}>
      <Text style={styles.title}>Invite members</Text>
      <MemberSearch
        excludeIds={excludeIds}
        onSelect={async (user) => {
          await onInvite(user.email);
        }}
        placeholder="Search member or type email"
      />

      {loading ? (
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="small" color={Colors.light.tint} />
        </View>
      ) : null}

      <Text style={styles.pendingTitle}>Pending invitations</Text>
      {pendingInvites.length === 0 ? (
        <Text style={styles.empty}>No pending invitations.</Text>
      ) : (
        pendingInvites.map((invite) => (
          <View key={invite.id} style={styles.item}>
            <Text style={styles.email}>{invite.invitedEmail}</Text>
            <Text style={styles.status}>{invite.status}</Text>
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
  loadingWrap: { paddingVertical: 8 },
  pendingTitle: {
    fontSize: 12,
    color: Colors.light.textSecondary,
    marginTop: 10,
    marginBottom: 6,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  empty: { color: Colors.light.textSecondary, fontSize: 13 },
  item: {
    flexDirection: "row",
    justifyContent: "space-between",
    borderTopWidth: 1,
    borderTopColor: Colors.light.divider,
    paddingVertical: 8,
  },
  email: { color: Colors.light.text, fontSize: 13 },
  status: {
    color: Colors.light.textSecondary,
    fontSize: 12,
    textTransform: "capitalize",
  },
});

export default GroupInvitesPanel;
