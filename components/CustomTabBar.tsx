import { Colors } from "@/constants/theme";
import Ionicons from "@expo/vector-icons/Ionicons";
import { BottomTabBarProps } from "@react-navigation/bottom-tabs";
import React from "react";
import { Dimensions, StyleSheet, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const { width } = Dimensions.get("window");

const CustomTabBar = ({
  state,
  descriptors,
  navigation,
}: BottomTabBarProps) => {
  const insets = useSafeAreaInsets();

  // Only render intended bottom-nav routes
  const visibleRouteNames = ["index", "groups", "notifications", "profile"];
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
              case "groups":
                return isFocused ? "people" : "people-outline";
              case "notifications":
                return isFocused ? "notifications" : "notifications-outline";
              case "profile":
                return isFocused ? "person" : "person-outline";
              default:
                return "ellipse-outline";
            }
          };

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
  },
});

export default CustomTabBar;
