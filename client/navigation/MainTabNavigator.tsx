import React from "react";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { Feather } from "@expo/vector-icons";
import { BlurView } from "expo-blur";
import { Platform, StyleSheet, View, Pressable } from "react-native";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius } from "@/constants/theme";
import type { RootStackParamList } from "@/navigation/RootStackNavigator";

import DashboardScreen from "@/screens/DashboardScreen";
import CasesScreen from "@/screens/CasesScreen";
import LogsScreen from "@/screens/LogsScreen";
import ProfileScreen from "@/screens/ProfileScreen";

export type MainTabParamList = {
  DashboardTab: undefined;
  CasesTab: undefined;
  NewPatient: undefined;
  LogsTab: undefined;
  ProfileTab: undefined;
};

const Tab = createBottomTabNavigator<MainTabParamList>();

function NewPatientButton() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { theme } = useTheme();

  return (
    <Pressable
      onPress={() => navigation.navigate("Triage")}
      style={({ pressed }) => [
        styles.fabButton,
        { backgroundColor: theme.primary, opacity: pressed ? 0.8 : 1 },
      ]}
    >
      <Feather name="plus" size={28} color="#FFFFFF" />
    </Pressable>
  );
}

function PlaceholderScreen() {
  return <View style={{ flex: 1 }} />;
}

export default function MainTabNavigator() {
  const { theme, isDark } = useTheme();

  return (
    <Tab.Navigator
      initialRouteName="DashboardTab"
      screenOptions={{
        tabBarActiveTintColor: theme.tabIconSelected,
        tabBarInactiveTintColor: theme.tabIconDefault,
        tabBarStyle: {
          position: "absolute",
          backgroundColor: Platform.select({
            ios: "transparent",
            android: theme.backgroundRoot,
          }),
          borderTopWidth: 0,
          elevation: 0,
          height: 85,
          paddingBottom: Platform.OS === "ios" ? 28 : 10,
        },
        tabBarBackground: () =>
          Platform.OS === "ios" ? (
            <BlurView
              intensity={100}
              tint={isDark ? "dark" : "light"}
              style={StyleSheet.absoluteFill}
            />
          ) : null,
        headerShown: false,
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: "500",
        },
      }}
    >
      <Tab.Screen
        name="DashboardTab"
        component={DashboardScreen}
        options={{
          title: "Dashboard",
          tabBarIcon: ({ color, size }) => (
            <Feather name="activity" size={size} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="CasesTab"
        component={CasesScreen}
        options={{
          title: "Cases",
          tabBarIcon: ({ color, size }) => (
            <Feather name="folder" size={size} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="NewPatient"
        component={PlaceholderScreen}
        options={{
          title: "",
          tabBarButton: () => <NewPatientButton />,
        }}
      />
      <Tab.Screen
        name="LogsTab"
        component={LogsScreen}
        options={{
          title: "Logs",
          tabBarIcon: ({ color, size }) => (
            <Feather name="list" size={size} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="ProfileTab"
        component={ProfileScreen}
        options={{
          title: "Profile",
          tabBarIcon: ({ color, size }) => (
            <Feather name="user" size={size} color={color} />
          ),
        }}
      />
    </Tab.Navigator>
  );
}

const styles = StyleSheet.create({
  fabButton: {
    width: 56,
    height: 56,
    borderRadius: BorderRadius.full,
    justifyContent: "center",
    alignItems: "center",
    marginTop: -Spacing.xl,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
});
