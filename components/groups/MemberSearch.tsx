import { Colors } from "@/constants/theme";
import Ionicons from "@expo/vector-icons/Ionicons";
import React, { useCallback, useEffect, useState } from "react";
import {
    ActivityIndicator,
    FlatList,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from "react-native";

type UserResult = {
  id: string;
  email: string;
  displayName: string;
};

type Props = {
  onSelect: (user: UserResult) => void;
  excludeIds: string[];
  placeholder?: string;
};

// Mock search function since we're in guest/local mode mostly
// In a real app, this would call a backend service
const mockSearchUsers = async (query: string): Promise<UserResult[]> => {
  await new Promise((resolve) => setTimeout(resolve, 500));
  if (!query.trim()) return [];

  const mockUsers: UserResult[] = [
    { id: "1", email: "alex@example.com", displayName: "Alex Rivera" },
    { id: "2", email: "sarah@example.com", displayName: "Sarah Chen" },
    { id: "3", email: "jordan@example.com", displayName: "Jordan Smith" },
    { id: "4", email: "taylor@example.com", displayName: "Taylor Wong" },
  ];

  return mockUsers.filter(
    (u) =>
      u.email.toLowerCase().includes(query.toLowerCase()) ||
      u.displayName.toLowerCase().includes(query.toLowerCase()),
  );
};

const MemberSearch = ({ onSelect, excludeIds, placeholder }: Props) => {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<UserResult[]>([]);
  const [loading, setLoading] = useState(false);

  const handleSearch = useCallback(
    async (text: string) => {
      setQuery(text);
      if (!text.trim()) {
        setResults([]);
        return;
      }

      setLoading(true);
      try {
        const filtered = await mockSearchUsers(text);
        setResults(
          filtered.filter(
            (u) => !excludeIds.includes(u.id) && !excludeIds.includes(u.email),
          ),
        );
      } catch (error) {
        console.error("Search error:", error);
      } finally {
        setLoading(false);
      }
    },
    [excludeIds],
  );

  // Debounce logic
  useEffect(() => {
    const timer = setTimeout(() => {
      if (query) handleSearch(query);
    }, 300);
    return () => clearTimeout(timer);
  }, [query, handleSearch]);

  const renderItem = ({ item }: { item: UserResult }) => (
    <TouchableOpacity
      style={styles.resultItem}
      onPress={() => {
        onSelect(item);
        setQuery("");
        setResults([]);
      }}
    >
      <View style={styles.avatar}>
        <Text style={styles.avatarText}>{item.displayName[0]}</Text>
      </View>
      <View style={styles.userInfo}>
        <Text style={styles.userName}>{item.displayName}</Text>
        <Text style={styles.userEmail}>{item.email}</Text>
      </View>
      <Ionicons name="add-circle-outline" size={24} color={Colors.light.tint} />
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <View style={styles.inputContainer}>
        <Ionicons
          name="search-outline"
          size={20}
          color={Colors.light.textSecondary}
          style={styles.searchIcon}
        />
        <TextInput
          style={styles.input}
          placeholder={placeholder || "Search by name or email"}
          placeholderTextColor={Colors.light.textTertiary}
          value={query}
          onChangeText={setQuery}
          autoCapitalize="none"
          autoCorrect={false}
        />
        {loading && (
          <ActivityIndicator
            size="small"
            color={Colors.light.tint}
            style={styles.loader}
          />
        )}
      </View>

      {results.length > 0 && (
        <View style={styles.resultsContainer}>
          <FlatList
            data={results}
            renderItem={renderItem}
            keyExtractor={(item) => item.id}
            scrollEnabled={false} // Container usually inside a scrollview
            keyboardShouldPersistTaps="handled"
          />
        </View>
      )}

      {query.length > 0 && !loading && results.length === 0 && (
        <TouchableOpacity
          style={styles.manualAdd}
          onPress={() => {
            if (query.includes("@")) {
              onSelect({
                id: query,
                email: query,
                displayName: query.split("@")[0],
              });
              setQuery("");
            }
          }}
        >
          <Text style={styles.manualAddText}>
            {query.includes("@") ? `Invite "${query}"` : "Keep typing email..."}
          </Text>
        </TouchableOpacity>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    zIndex: 100,
  },
  inputContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Colors.light.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.light.border,
    paddingHorizontal: 12,
  },
  searchIcon: {
    marginRight: 8,
  },
  input: {
    flex: 1,
    paddingVertical: 12,
    fontSize: 15,
    color: Colors.light.text,
  },
  loader: {
    marginLeft: 8,
  },
  resultsContainer: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    marginTop: 8,
    borderWidth: 1,
    borderColor: Colors.light.border,
    overflow: "hidden",
    elevation: 4,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
  },
  resultItem: {
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.light.divider,
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.light.tintLight,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  avatarText: {
    fontSize: 14,
    fontWeight: "700",
    color: Colors.light.tint,
  },
  userInfo: {
    flex: 1,
  },
  userName: {
    fontSize: 14,
    fontWeight: "600",
    color: Colors.light.text,
  },
  userEmail: {
    fontSize: 12,
    color: Colors.light.textSecondary,
  },
  manualAdd: {
    padding: 12,
    alignItems: "center",
  },
  manualAddText: {
    fontSize: 13,
    color: Colors.light.tint,
    fontWeight: "600",
  },
});

export default MemberSearch;
