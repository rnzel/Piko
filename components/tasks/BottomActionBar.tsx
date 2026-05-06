import { Colors } from "@/constants/theme";
import Ionicons from "@expo/vector-icons/Ionicons";
import React from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";

type Props = {
  selectedCount: number;
  onCancel: () => void;
  onDelete: () => void;
  insetsBottom: number;
};

const BottomActionBar = ({
  selectedCount,
  onCancel,
  onDelete,
  insetsBottom,
}: Props) => {
  return (
    <View
      style={[styles.bottomActionBar, { paddingBottom: insetsBottom + 12 }]}
    >
      <TouchableOpacity
        onPress={onCancel}
        style={styles.bottomActionCancel}
        activeOpacity={0.7}
        accessibilityLabel="Cancel selection"
      >
        <Ionicons name="close" size={20} color={Colors.light.text} />
        <Text style={styles.bottomActionCancelText}>Cancel</Text>
      </TouchableOpacity>

      <TouchableOpacity
        onPress={onDelete}
        style={styles.bottomActionDelete}
        activeOpacity={0.7}
        accessibilityLabel="Delete selected tasks"
      >
        <Ionicons name="trash-outline" size={20} color="#FFFFFF" />
        <Text style={styles.bottomActionDeleteText}>
          Delete ({selectedCount})
        </Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  bottomActionBar: {
    position: "absolute",
    bottom: 80,
    left: 16,
    right: 16,
    gap: 12,
    flexDirection: "row",
    alignItems: "center",
    paddingTop: 20,
    borderRadius: 24,
    backgroundColor: "#FFFFFF",
  },
  bottomActionCancel: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 14,
    borderRadius: 50,
    borderWidth: 1,
    borderColor: Colors.light.border,
    backgroundColor: "#FFFFFF",
  },
  bottomActionCancelText: {
    fontSize: 15,
    fontWeight: "600",
    color: Colors.light.text,
  },
  bottomActionDelete: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 14,
    borderRadius: 50,
    backgroundColor: Colors.light.error,
  },
  bottomActionDeleteText: {
    fontSize: 15,
    fontWeight: "600",
    color: "#FFFFFF",
  },
});

export default BottomActionBar;
