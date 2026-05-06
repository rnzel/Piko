import { Colors } from "@/constants/theme";
import Ionicons from "@expo/vector-icons/Ionicons";
import React from "react";
import { StyleSheet, Text, View } from "react-native";

type Props = {
  icon?: React.ComponentProps<typeof Ionicons>["name"];
  title: string;
  subtitle?: string;
};

const EmptyState = ({ icon = "clipboard-outline", title, subtitle }: Props) => {
  return (
    <View style={styles.container} accessibilityRole="summary">
      <Ionicons name={icon} size={64} color={Colors.light.textTertiary} />
      <Text style={styles.title}>{title}</Text>
      {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
    paddingVertical: 40,
  },
  title: {
    marginTop: 12,
    fontSize: 18,
    fontWeight: "600",
    color: Colors.light.text,
  },
  subtitle: {
    marginTop: 8,
    fontSize: 13,
    color: Colors.light.textSecondary,
    textAlign: "center",
    maxWidth: 320,
  },
});

export default EmptyState;
