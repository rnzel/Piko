import { Colors } from "@/constants/theme";
import { MigrationStrategy } from "@/services/migrationService";
import React from "react";
import {
    ActivityIndicator,
    Modal,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from "react-native";

type Props = {
  visible: boolean;
  loading: boolean;
  taskCount: number;
  groupCount: number;
  onSelect: (strategy: MigrationStrategy) => void;
};

const MigrationModal = ({
  visible,
  loading,
  taskCount,
  groupCount,
  onSelect,
}: Props) => {
  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={styles.overlay}>
        <View style={styles.card}>
          {loading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={Colors.light.tint} />
              <Text style={styles.loadingText}>Migrating your data...</Text>
            </View>
          ) : (
            <>
              <Text style={styles.title}>Welcome!</Text>
              <Text style={styles.message}>
                We found{" "}
                <Text style={styles.bold}>
                  {taskCount > 0 &&
                    `${taskCount} task${taskCount > 1 ? "s" : ""}`}
                  {taskCount > 0 && groupCount > 0 ? " and " : ""}
                  {groupCount > 0 &&
                    `${groupCount} group${groupCount > 1 ? "s" : ""}`}
                </Text>{" "}
                created on this device while you were using guest mode. Would
                you like to merge them with your account?
              </Text>

              <View style={styles.actions}>
                <TouchableOpacity
                  style={styles.primaryButton}
                  onPress={() => onSelect("merge")}
                >
                  <Text style={styles.primaryButtonText}>Merge Data</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.secondaryButton}
                  onPress={() => onSelect("keepAccount")}
                >
                  <Text style={styles.secondaryButtonText}>
                    Keep Account Data Only
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.cancelButton}
                  onPress={() => onSelect("cancel")}
                >
                  <Text style={styles.cancelButtonText}>Cancel</Text>
                </TouchableOpacity>
              </View>
            </>
          )}
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 24,
  },
  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    paddingHorizontal: 24,
    paddingVertical: 32,
    width: "100%",
    maxWidth: 380,
  },
  loadingContainer: {
    alignItems: "center",
    paddingVertical: 20,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: Colors.light.textSecondary,
  },
  title: {
    fontSize: 22,
    fontWeight: "700",
    color: Colors.light.text,
    marginBottom: 12,
    textAlign: "center",
  },
  message: {
    fontSize: 15,
    color: Colors.light.textSecondary,
    lineHeight: 22,
    textAlign: "center",
    marginBottom: 24,
  },
  bold: {
    fontWeight: "700",
    color: Colors.light.text,
  },
  actions: {
    gap: 10,
  },
  primaryButton: {
    backgroundColor: Colors.light.tint,
    borderRadius: 50,
    paddingVertical: 14,
    alignItems: "center",
  },
  primaryButtonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "600",
  },
  secondaryButton: {
    backgroundColor: Colors.light.tintLight,
    borderRadius: 50,
    paddingVertical: 14,
    alignItems: "center",
  },
  secondaryButtonText: {
    color: Colors.light.tint,
    fontSize: 16,
    fontWeight: "600",
  },
  cancelButton: {
    borderRadius: 50,
    paddingVertical: 14,
    alignItems: "center",
  },
  cancelButtonText: {
    color: Colors.light.textSecondary,
    fontSize: 16,
    fontWeight: "500",
  },
});

export default MigrationModal;
