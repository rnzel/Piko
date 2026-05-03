import CustomTabBar from "@/components/CustomTabBar";
import { Tabs } from "expo-router";
import React from "react";

export default function TabLayout() {
  return (
    <Tabs
      tabBar={(props) => <CustomTabBar {...props} />}
      screenOptions={{
        headerShown: false,
        tabBarShowLabel: false,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Tasks",
        }}
      />
      <Tabs.Screen
        name="groups"
        options={{
          title: "Groups",
        }}
      />
      {/* Placeholder for the FAB in the middle, not a navigable tab */}
      <Tabs.Screen
        name="_empty"
        options={{
          title: "",
          href: null,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: "Profile",
        }}
      />
    </Tabs>
  );
}
