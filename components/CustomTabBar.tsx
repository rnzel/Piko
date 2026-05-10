import { Colors } from "@/constants/theme";
import { notificationService } from "@/services/notificationService";
import Ionicons from "@expo/vector-icons/Ionicons";
import { BottomTabBarProps } from "@react-navigation/bottom-tabs";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  Dimensions,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const { width } = Dimensions.get("window");

const CustomTabBar = ({
  state,
  descriptors,
  navigation,
}: BottomTabBarProps) => {
  const insets = useSafeAreaInsets();
  const [unreadCount, setUnreadCount] = useState(0);
  const prevIndexRef = useRef(state.index);

  // Fetch unread count
  const fetchUnread = useCallback(async () => {
    const count = await notificationService.getUnreadCount();
    setUnreadCount(count);
  }, []);

  // Poll every 10s and refresh when tab index changes
  useEffect(() => {
    fetchUnread();

    if (prevIndexRef.current !== state.index) {
      prevIndexRef.current = state.index;
      fetchUnread();
    }

    const interval = setInterval(fetchUnread, 10000);

    return () => {
      clearInterval(interval);
    };
  }, [fetchUnread, state.index]);

  // Only render intended bottom-nav routes
  const visibleRouteNames = ["index", "notifications", "profile"];
  const routes = state.routes.filter((route) =>
    visibleRouteNames.includes(route.name),
  );

  return (
    <View
      style={[styles.tabBarContainer, { paddingBottom: insets.bottom + 10 }]}
    >
      <View style={styles.tabBar}>
        {routes.map((route, index) => {
          const { options } = descriptors[route.key];
          const label =
            options.tabBarLabel !== undefined
              ? options.tabBarLabel
              : options.title !== undefined
                ? options.title
                : route.name;

          const isFocused = state.index === index;

          // Adjust index for the empty route
          const actualIndex = state.routes.findIndex(
            (r) => r.name === route.name,
          );

          const onPress = () => {
            const event = navigation.emit({
              type: "tabPress",
              target: route.key,
              canPreventDefault: true,
            });

            if (!isFocused && !event.defaultPrevented) {
              navigation.navigate(route.name);
            }
          };

          const onLongPress = () => {
            navigation.emit({
              type: "tabLongPress",
              target: route.key,
            });
          };

          // Map route names to icon names
          const getIconName = (routeName: string) => {
            switch (routeName) {
              case "index":
                return isFocused ? "checkbox" : "checkbox-outline";
              case "notifications":
                return isFocused ? "notifications" : "notifications-outline";
              case "profile":
                return isFocused ? "person" : "person-outline";
              default:
                return "ellipse-outline";
            }
          };

          const isNotificationTab = route.name === "notifications";

          return (
            <TouchableOpacity
              key={route.key}
              accessibilityRole="button"
              accessibilityState={isFocused ? { selected: true } : {}}
              accessibilityLabel={options.tabBarAccessibilityLabel}
              onPress={onPress}
              onLongPress={onLongPress}
              activeOpacity={0.7}
            >
              {/* Main icon container */}
              <View style={[styles.iconContainer]}>
                <Ionicons
                  name={getIconName(route.name)}
                  size={20}
                  color={
                    isFocused ? Colors.light.tint : Colors.light.iconDefault
                  }
                />
                {isNotificationTab && unreadCount > 0 && (
                  <View style={styles.badge}>
                    <Text style={styles.badgeText}>
                      {unreadCount > 99 ? "99+" : unreadCount}
                    </Text>
                  </View>
                )}
              </View>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  tabBarContainer: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: "transparent",
    paddingHorizontal: 16,
    paddingTop: 10,
  },
  tabBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#FFFFFF",
    borderRadius: 50,
    paddingVertical: 8,
    paddingHorizontal: 8,
    borderColor: Colors.light.border,
    borderWidth: 1,
  },
  tabItem: {
    borderColor: Colors.light.border,
    borderWidth: 1,
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  iconContainer: {
    borderColor: Colors.light.border,
    borderWidth: 1,
    width: 48,
    height: 48,
    borderRadius: 50,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "transparent",
    position: "relative",
  },
  badge: {
    position: "absolute",
    top: -4,
    right: -4,
    backgroundColor: Colors.light.error,
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 4,
    borderWidth: 2,
    borderColor: "#FFFFFF",
  },
  badgeText: {
    color: "#FFFFFF",
    fontSize: 11,
    fontWeight: "bold",
  },
});

export default CustomTabBar;
