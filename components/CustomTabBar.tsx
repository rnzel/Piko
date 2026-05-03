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

  // Filter out empty placeholder route
  const routes = state.routes.filter((route) => route.name !== "_empty");

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
              style={styles.tabItem}
              activeOpacity={0.7}
            >
              <View
                style={[
                  styles.iconContainer,
                  isFocused && styles.iconContainerFocused,
                ]}
              >
                <Ionicons
                  name={getIconName(route.name)}
                  size={24}
                  color={
                    isFocused ? Colors.light.tint : Colors.light.iconDefault
                  }
                />
                {isFocused && <View style={styles.focusIndicator} />}
              </View>
              <View style={styles.labelContainer}>
                <View style={[styles.label, isFocused && styles.labelFocused]}>
                  <Ionicons
                    name={getIconName(route.name)}
                    size={20}
                    color={
                      isFocused ? Colors.light.tint : Colors.light.iconDefault
                    }
                  />
                </View>
              </View>
            </TouchableOpacity>
          );
        })}

        {/* Center FAB for adding tasks */}
        <View style={styles.fabContainer}>
          <TouchableOpacity
            style={styles.fab}
            onPress={() => {
              // Emit event for opening add task modal
              navigation.emit({
                type: "tabPress",
                target: "add-task",
                canPreventDefault: true,
              });
            }}
            activeOpacity={0.8}
          >
            <Ionicons name="add" size={28} color="#FFFFFF" />
          </TouchableOpacity>
        </View>
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
    alignItems: "flex-end",
    justifyContent: "space-between",
    backgroundColor: "#FFFFFF",
    borderRadius: 24,
    paddingVertical: 8,
    paddingHorizontal: 8,
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: -2,
    },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 8,
    height: 64,
  },
  tabItem: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 8,
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "transparent",
  },
  iconContainerFocused: {
    backgroundColor: Colors.light.tintLight,
  },
  focusIndicator: {
    position: "absolute",
    bottom: 2,
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: Colors.light.tint,
  },
  labelContainer: {
    position: "absolute",
    top: -28,
    opacity: 0,
  },
  label: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    backgroundColor: "#FFFFFF",
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  labelFocused: {
    opacity: 1,
  },
  fabContainer: {
    position: "absolute",
    top: -20,
    left: "50%",
    marginLeft: -32,
  },
  fab: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: Colors.light.tint,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: Colors.light.tint,
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
});

export default CustomTabBar;
