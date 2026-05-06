import { Colors } from "@/constants/theme";
import React from "react";
import { ActivityIndicator, StyleSheet, View } from "react-native";

type Props = {
  size?: number | "small" | "large";
};

const Loading = ({ size = "large" }: Props) => {
  return (
    <View
      style={styles.container}
      accessibilityRole="progressbar"
      accessibilityLabel="Loading"
    >
      <ActivityIndicator size={size} color={Colors.light.tint} />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingVertical: 24,
    alignItems: "center",
  },
});

export default Loading;
