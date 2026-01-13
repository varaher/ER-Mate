import React from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Alert,
} from "react-native";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { useTheme } from "@/hooks/useTheme";
import { useAuth } from "@/context/AuthContext";
import { Spacing, BorderRadius, Typography } from "@/constants/theme";
import type { RootStackParamList } from "@/navigation/RootStackNavigator";

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

export default function ProfileScreen() {
  const navigation = useNavigation<NavigationProp>();
  const { theme } = useTheme();
  const { user, logout } = useAuth();
  const insets = useSafeAreaInsets();

  const handleLogout = () => {
    Alert.alert("Logout", "Are you sure you want to logout?", [
      { text: "Cancel", style: "cancel" },
      { text: "Logout", style: "destructive", onPress: () => logout() },
    ]);
  };

  const menuItems = [
    { icon: "monitor", label: "Link to Web", onPress: () => navigation.navigate("LinkDevices") },
    { icon: "star", label: "Upgrade Plan", onPress: () => navigation.navigate("Upgrade", {}) },
    { icon: "bell", label: "Notifications", onPress: () => {} },
    { icon: "shield", label: "Privacy", onPress: () => {} },
    { icon: "help-circle", label: "Help & Support", onPress: () => {} },
    { icon: "info", label: "About ErMate", onPress: () => {} },
  ];

  return (
    <View style={[styles.container, { backgroundColor: theme.backgroundDefault }]}>
      <ScrollView
        contentContainerStyle={[styles.content, { paddingTop: insets.top + Spacing.xl, paddingBottom: 120 }]}
        showsVerticalScrollIndicator={false}
      >
        <View style={[styles.profileCard, { backgroundColor: theme.card }]}>
          <View style={[styles.avatar, { backgroundColor: theme.primaryLight }]}>
            <Text style={[styles.avatarText, { color: theme.primary }]}>
              {user?.name?.charAt(0)?.toUpperCase() || "D"}
            </Text>
          </View>
          <Text style={[styles.name, { color: theme.text }]}>{user?.name || "Doctor"}</Text>
          <Text style={[styles.email, { color: theme.textSecondary }]}>{user?.email || ""}</Text>
          {user?.hospital ? (
            <View style={styles.hospitalRow}>
              <Feather name="home" size={14} color={theme.textMuted} />
              <Text style={[styles.hospital, { color: theme.textMuted }]}>{user.hospital}</Text>
            </View>
          ) : null}
          <View style={[styles.planBadge, { backgroundColor: theme.primaryLight }]}>
            <Feather name="award" size={14} color={theme.primary} />
            <Text style={[styles.planText, { color: theme.primary }]}>
              {user?.subscription_plan || "Free"} Plan
            </Text>
          </View>
        </View>

        <View style={[styles.section, { backgroundColor: theme.card }]}>
          {menuItems.map((item, index) => (
            <Pressable
              key={item.label}
              style={({ pressed }) => [
                styles.menuItem,
                { opacity: pressed ? 0.7 : 1 },
                index < menuItems.length - 1 && { borderBottomWidth: 1, borderBottomColor: theme.border },
              ]}
              onPress={item.onPress}
            >
              <Feather name={item.icon as any} size={20} color={theme.textSecondary} />
              <Text style={[styles.menuLabel, { color: theme.text }]}>{item.label}</Text>
              <Feather name="chevron-right" size={20} color={theme.textMuted} />
            </Pressable>
          ))}
        </View>

        <Pressable
          style={({ pressed }) => [
            styles.logoutBtn,
            { backgroundColor: theme.dangerLight, opacity: pressed ? 0.8 : 1 },
          ]}
          onPress={handleLogout}
        >
          <Feather name="log-out" size={20} color={theme.danger} />
          <Text style={[styles.logoutText, { color: theme.danger }]}>Logout</Text>
        </Pressable>

        <Text style={[styles.version, { color: theme.textMuted }]}>ErMate v1.0.0</Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { paddingHorizontal: Spacing.lg },
  profileCard: {
    alignItems: "center",
    padding: Spacing.xl,
    borderRadius: BorderRadius.lg,
    marginBottom: Spacing.lg,
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: BorderRadius.full,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: Spacing.md,
  },
  avatarText: { ...Typography.h1 },
  name: { ...Typography.h3, marginBottom: Spacing.xs },
  email: { ...Typography.body },
  hospitalRow: { flexDirection: "row", alignItems: "center", gap: Spacing.xs, marginTop: Spacing.sm },
  hospital: { ...Typography.small },
  planBadge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.full,
    marginTop: Spacing.md,
    gap: Spacing.xs,
  },
  planText: { ...Typography.label },
  section: { borderRadius: BorderRadius.lg, marginBottom: Spacing.lg },
  menuItem: {
    flexDirection: "row",
    alignItems: "center",
    padding: Spacing.lg,
    gap: Spacing.md,
  },
  menuLabel: { flex: 1, ...Typography.body },
  logoutBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    padding: Spacing.lg,
    borderRadius: BorderRadius.lg,
    gap: Spacing.sm,
  },
  logoutText: { ...Typography.h4 },
  version: { ...Typography.caption, textAlign: "center", marginTop: Spacing.xl },
});
