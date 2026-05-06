import { Colors } from "@/constants/theme";
import Ionicons from "@expo/vector-icons/Ionicons";
import React from "react";
import {
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from "react-native";

type Props = {
  members: string[];
  onRemove: (member: string) => void;
};

const MemberChips = ({ members, onRemove }: Props) => {
  if (members.length === 0) return null;

  return (
    <View style={styles.container}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {members.map((member) => (
          <View key={member} style={styles.chip}>
            <Text style={styles.chipText} numberOfLines={1}>
              {member}
            </Text>
            <TouchableOpacity
              onPress={() => onRemove(member)}
              style={styles.removeButton}
            >
              <Ionicons
                name="close-circle"
                size={18}
                color={Colors.light.textSecondary}
              />
            </TouchableOpacity>
          </View>
        ))}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginVertical: 12,
  },
  scrollContent: {
    paddingHorizontal: 4,
    gap: 8,
    flexDirection: "row",
  },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Colors.light.card,
    borderRadius: 50,
    paddingLeft: 12,
    paddingRight: 6,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: Colors.light.border,
    maxWidth: 200,
  },
  chipText: {
    fontSize: 13,
    color: Colors.light.text,
    marginRight: 4,
    fontWeight: "500",
  },
  removeButton: {
    padding: 2,
  },
});

export default MemberChips;
