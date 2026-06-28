import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Modal,
  Alert,
  ActivityIndicator,
  TextInput,
} from "react-native";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { useTheme } from "@/hooks/useTheme";
import { useAuth } from "@/context/AuthContext";
import { useDepartment } from "@/context/DepartmentContext";
import { fetchCasesFromProxy, deleteCaseFromProxy } from "@/lib/api";
import { getApiUrl } from "@/lib/query-client";
import { Spacing, BorderRadius, Typography } from "@/constants/theme";
import type { RootStackParamList } from "@/navigation/RootStackNavigator";

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;
type Role = "consultant" | "resident" | "doctor";

const ROLE_OPTIONS: { value: Role; label: string; icon: keyof typeof Feather.glyphMap; desc: string }[] = [
  { value: "consultant", label: "Consultant", icon: "award", desc: "Senior doctor, attending physician" },
  { value: "resident", label: "Resident", icon: "user", desc: "Resident doctor, trainee" },
  { value: "doctor", label: "Other / Not specified", icon: "activity", desc: "General doctor role" },
];

export default function ProfileScreen() {
  const navigation = useNavigation<NavigationProp>();
  const { theme, isDark } = useTheme();
  const { user, token, authMethod, logout } = useAuth();
  const insets = useSafeAreaInsets();

  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const [clearingCases, setClearingCases] = useState(false);

  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [passwordSuccess, setPasswordSuccess] = useState(false);
  const [showCurrentPw, setShowCurrentPw] = useState(false);
  const [showNewPw, setShowNewPw] = useState(false);
  const [showConfirmPw, setShowConfirmPw] = useState(false);

  const [showRoleModal, setShowRoleModal] = useState(false);
  const [profileRole, setProfileRole] = useState<Role>("doctor");
  const [selectedRole, setSelectedRole] = useState<Role>("doctor");
  const [roleSaving, setRoleSaving] = useState(false);

  const isGoogleUser = authMethod === "google";
  const { department, membership, isHOD, shiftSession, activeShift, checkOut, refresh: refreshDept, incomingCount } = useDepartment();
  const [localPlan, setLocalPlan] = useState<string | null>(null);

  useEffect(() => {
    if (user?.id) loadProfile();
  }, [user?.id]);

  useEffect(() => {
    if (!user?.id) return;
    const url = new URL(
      `/api/subscription/status?userId=${encodeURIComponent(user.id)}&userEmail=${encodeURIComponent(user.email || "")}`,
      getApiUrl()
    ).href;
    fetch(url, { headers: token ? { Authorization: `Bearer ${token}` } : {} })
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d?.plan) setLocalPlan(d.plan); })
      .catch(() => {});
  }, [user?.id]);

  const loadProfile = async () => {
    try {
      const url = new URL(`/api/profile?userId=${encodeURIComponent(user!.id)}`, getApiUrl()).href;
      const res = await fetch(url, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (res.ok) {
        const data = await res.json();
        const role = (data.role as Role) || "doctor";
        setProfileRole(role);
        setSelectedRole(role);
      }
    } catch { }
  };

  const handleSaveRole = async () => {
    if (!user?.id) return;
    setRoleSaving(true);
    try {
      const url = new URL("/api/profile", getApiUrl()).href;
      const res = await fetch(url, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ userId: user.id, role: selectedRole }),
      });
      if (res.ok) {
        setProfileRole(selectedRole);
        setShowRoleModal(false);
      } else {
        Alert.alert("Error", "Could not save role. Please try again.");
      }
    } catch {
      Alert.alert("Error", "Connection error. Please try again.");
    } finally {
      setRoleSaving(false);
    }
  };

  const closePasswordModal = () => {
    setShowPasswordModal(false);
    setCurrentPassword(""); setNewPassword(""); setConfirmPassword("");
    setPasswordError(null); setPasswordSuccess(false);
    setShowCurrentPw(false); setShowNewPw(false); setShowConfirmPw(false);
  };

  const handleChangePassword = async () => {
    setPasswordError(null);
    if (newPassword.length < 6) { setPasswordError("Password must be at least 6 characters."); return; }
    if (newPassword !== confirmPassword) { setPasswordError("Passwords do not match."); return; }
    if (!isGoogleUser && !currentPassword.trim()) { setPasswordError("Please enter your current password."); return; }
    setPasswordLoading(true);
    try {
      const url = new URL("/api/auth/change-password", getApiUrl());
      const res = await fetch(url.toString(), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          currentPassword: isGoogleUser ? undefined : currentPassword.trim(),
          newPassword: newPassword.trim(),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.success) {
        setPasswordSuccess(true);
      } else {
        setPasswordError(data.error || "Could not update password. Please try again.");
      }
    } catch {
      setPasswordError("Connection error. Please try again.");
    } finally {
      setPasswordLoading(false);
    }
  };

  const handleClearAllCases = async () => {
    setClearingCases(true);
    let cases: any[] = [];
    try {
      const result = await fetchCasesFromProxy<any[]>();
      cases = Array.isArray(result) ? result : [];
    } catch {
      setClearingCases(false);
      Alert.alert("Error", "Could not fetch cases. Please try again.");
      return;
    }
    setClearingCases(false);
    if (cases.length === 0) {
      Alert.alert("No Cases", "Your account has no cases to delete.");
      return;
    }
    Alert.alert(
      "Delete All Cases",
      `This will permanently delete all ${cases.length} cases. This cannot be undone.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: `Delete ${cases.length} Cases`,
          style: "destructive",
          onPress: async () => {
            setClearingCases(true);
            let deleted = 0;
            for (const c of cases) {
              try { await deleteCaseFromProxy(c.id); deleted++; } catch {}
            }
            setClearingCases(false);
            Alert.alert("Done", `${deleted} of ${cases.length} cases deleted.`);
          },
        },
      ]
    );
  };

  const handleCheckOut = async () => {
    const result = await checkOut();
    if (!result.success) {
      if (result.pendingCases) {
        Alert.alert("Pending Handovers", `You have ${result.pendingCases} case(s) not yet handed over. Please hand them over before ending your shift.`);
      } else {
        Alert.alert("Error", result.error || "Could not end shift");
      }
    } else {
      refreshDept();
    }
  };

  const { nightShift } = useTheme();
  const nightShiftOptions: { label: string; value: import("@/hooks/useNightShift").NightShiftPref; icon: string }[] = [
    { label: "Auto (9pm–6am)", value: "auto", icon: "moon" },
    { label: "Always Light", value: "light", icon: "sun" },
    { label: "Always Dark", value: "dark", icon: "minus-circle" },
  ];

  const getRoleLabel = (role: Role) => {
    if (membership?.role === "hod") return "HOD";
    const r = ROLE_OPTIONS.find(o => o.value === role);
    return r?.label ?? "Doctor";
  };

  const menuItems = [
    { icon: "bar-chart-2", label: "My Stats", onPress: () => navigation.navigate("Stats") },
    { icon: "monitor", label: "Link to Web", onPress: () => navigation.navigate("LinkDevices") },
    { icon: "credit-card", label: "My Subscriptions", onPress: () => (navigation as any).navigate("MySubscriptions") },
    { icon: "star", label: "Upgrade Plan", onPress: () => navigation.navigate("Upgrade", {}) },
    { icon: "user-check", label: "My Role", sub: getRoleLabel(profileRole), onPress: () => { setSelectedRole(profileRole); setShowRoleModal(true); } },
    { icon: "lock", label: isGoogleUser ? "Set Password" : "Change Password", onPress: () => setShowPasswordModal(true) },
    { icon: "bell", label: "Notifications", onPress: () => navigation.navigate("Notifications") },
    { icon: "shield", label: "Privacy", onPress: () => navigation.navigate("Privacy") },
    { icon: "compass", label: "Take a Tour", onPress: () => (navigation as any).navigate("Tour") },
    { icon: "help-circle", label: "Help & Support", onPress: () => navigation.navigate("HelpSupport") },
    { icon: "info", label: "About ErMate", onPress: () => navigation.navigate("About") },
  ];

  return (
    <View style={[styles.container, { backgroundColor: theme.backgroundDefault }]}>
      <ScrollView
        contentContainerStyle={[styles.content, { paddingTop: insets.top + Spacing.xl, paddingBottom: 120 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Profile card */}
        <View style={[styles.profileCard, { backgroundColor: theme.card }]}>
          <View style={[styles.avatar, { backgroundColor: theme.primaryLight }]}>
            <Text style={[styles.avatarText, { color: theme.primary }]}>
              {user?.name?.charAt(0)?.toUpperCase() || "D"}
            </Text>
          </View>
          <Text style={[styles.name, { color: theme.text }]}>{user?.name || "Doctor"}</Text>
          <Text style={[styles.email, { color: theme.textSecondary }]}>{user?.email || ""}</Text>

          <View style={styles.roleRow}>
            <View style={[styles.roleBadge, { backgroundColor: isDark ? "#1e293b" : "#F1F5F9" }]}>
              <Feather name="award" size={12} color={theme.textSecondary} />
              <Text style={[styles.roleText, { color: theme.textSecondary }]}>
                {getRoleLabel(profileRole)}
              </Text>
            </View>
            {user?.hospital ? (
              <View style={[styles.roleBadge, { backgroundColor: isDark ? "#1e293b" : "#F1F5F9" }]}>
                <Feather name="home" size={12} color={theme.textMuted} />
                <Text style={[styles.roleText, { color: theme.textMuted }]}>{user.hospital}</Text>
              </View>
            ) : null}
          </View>

          <View style={[styles.planBadge, { backgroundColor: theme.primaryLight }]}>
            <Feather name="zap" size={13} color={theme.primary} />
            <Text style={[styles.planText, { color: theme.primary }]}>
              {localPlan === "pro" ? "Pro" : localPlan === "base" ? "Base" : (user?.subscription_plan || "Free")} Plan
            </Text>
          </View>
        </View>

        {/* Department section */}
        {department ? (
          <View style={[styles.section, { backgroundColor: theme.card, marginBottom: Spacing.sm }]}>
            <View style={[styles.menuItem, { borderBottomWidth: 1, borderBottomColor: theme.border }]}>
              <Feather name="activity" size={20} color={theme.primary} />
              <View style={{ flex: 1 }}>
                <Text style={[styles.menuLabel, { color: theme.text }]}>{department.name}</Text>
                <Text style={[{ fontSize: 12, color: theme.textSecondary }]}>
                  {membership?.role === "hod" ? "HOD" : membership?.role === "consultant" ? "Consultant" : "Resident"}
                </Text>
              </View>
              {shiftSession ? (
                <View style={[{ flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: "#d1fae5", paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 }]}>
                  <View style={[{ width: 6, height: 6, borderRadius: 3, backgroundColor: "#10b981" }]} />
                  <Text style={[{ fontSize: 12, fontWeight: "700", color: "#065f46" }]}>{activeShift?.name || "On Shift"}</Text>
                </View>
              ) : null}
            </View>
            {shiftSession ? (
              <Pressable
                style={({ pressed }) => [styles.menuItem, { borderBottomWidth: 1, borderBottomColor: theme.border, opacity: pressed ? 0.7 : 1 }]}
                onPress={() => navigation.navigate("HandoverDetail")}
              >
                <Feather name="arrow-right-circle" size={20} color={theme.textSecondary} />
                <Text style={[styles.menuLabel, { color: theme.text }]}>Incoming Handovers</Text>
                {incomingCount > 0 ? (
                  <View style={[{ backgroundColor: theme.danger, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10 }]}>
                    <Text style={[{ color: "#fff", fontSize: 12, fontWeight: "800" }]}>{incomingCount}</Text>
                  </View>
                ) : <Feather name="chevron-right" size={20} color={theme.textMuted} />}
              </Pressable>
            ) : null}
            {isHOD ? (
              <>
                <Pressable
                  style={({ pressed }) => [styles.menuItem, { borderBottomWidth: 1, borderBottomColor: theme.border, opacity: pressed ? 0.7 : 1 }]}
                  onPress={() => navigation.navigate("AdminDashboard")}
                >
                  <Feather name="shield" size={20} color={theme.textSecondary} />
                  <Text style={[styles.menuLabel, { color: theme.text }]}>HOD Dashboard</Text>
                  <Feather name="chevron-right" size={20} color={theme.textMuted} />
                </Pressable>
                <Pressable
                  style={({ pressed }) => [styles.menuItem, { opacity: pressed ? 0.7 : 1 }]}
                  onPress={() => navigation.navigate("ManageRoster")}
                >
                  <Feather name="users" size={20} color={theme.textSecondary} />
                  <Text style={[styles.menuLabel, { color: theme.text }]}>Manage Roster</Text>
                  <Feather name="chevron-right" size={20} color={theme.textMuted} />
                </Pressable>
              </>
            ) : null}
            {shiftSession ? (
              <Pressable
                style={({ pressed }) => [styles.menuItem, { borderTopWidth: 1, borderTopColor: theme.border, opacity: pressed ? 0.7 : 1 }]}
                onPress={handleCheckOut}
              >
                <Feather name="log-out" size={20} color={theme.danger} />
                <Text style={[styles.menuLabel, { color: theme.danger }]}>End Shift</Text>
              </Pressable>
            ) : null}
          </View>
        ) : (
          <Pressable
            style={({ pressed }) => [styles.section, { backgroundColor: theme.card, marginBottom: Spacing.sm, opacity: pressed ? 0.85 : 1 }]}
            onPress={() => navigation.navigate("SetupDepartment")}
          >
            <View style={styles.menuItem}>
              <Feather name="users" size={20} color={theme.primary} />
              <View style={{ flex: 1 }}>
                <Text style={[styles.menuLabel, { color: theme.primary }]}>Set Up Department</Text>
                <Text style={[{ fontSize: 12, color: theme.textSecondary }]}>Create your team, manage shifts & handovers</Text>
              </View>
              <Feather name="chevron-right" size={20} color={theme.primary} />
            </View>
          </Pressable>
        )}

        {/* Main menu */}
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
              <View style={{ flex: 1 }}>
                <Text style={[styles.menuLabel, { color: theme.text }]}>{item.label}</Text>
                {item.sub ? (
                  <Text style={[{ fontSize: 12, color: theme.textSecondary, marginTop: 1 }]}>{item.sub}</Text>
                ) : null}
              </View>
              <Feather name="chevron-right" size={20} color={theme.textMuted} />
            </Pressable>
          ))}
        </View>

        {/* Display mode */}
        <View style={[styles.section, { backgroundColor: theme.card, marginTop: Spacing.sm }]}>
          <View style={[styles.menuItem, { borderBottomWidth: 1, borderBottomColor: theme.border }]}>
            <Feather name="moon" size={20} color={theme.textSecondary} />
            <Text style={[styles.menuLabel, { color: theme.text }]}>Display Mode</Text>
          </View>
          <View style={styles.nightShiftOptions}>
            {nightShiftOptions.map((opt) => (
              <Pressable
                key={opt.value}
                style={[
                  styles.nightShiftOption,
                  {
                    backgroundColor: nightShift.pref === opt.value ? theme.primary : theme.backgroundSecondary,
                    borderColor: nightShift.pref === opt.value ? theme.primary : theme.border,
                  },
                ]}
                onPress={() => nightShift.setPref(opt.value)}
              >
                <Feather
                  name={opt.icon as any}
                  size={14}
                  color={nightShift.pref === opt.value ? "#FFFFFF" : theme.textSecondary}
                />
                <Text style={[
                  styles.nightShiftLabel,
                  { color: nightShift.pref === opt.value ? "#FFFFFF" : theme.textSecondary },
                ]}>{opt.label}</Text>
              </Pressable>
            ))}
          </View>
          {nightShift.isNightTime && nightShift.pref === "auto" ? (
            <View style={[styles.nightShiftActive, { backgroundColor: "#1e1b4b20" }]}>
              <Feather name="moon" size={12} color="#818cf8" />
              <Text style={[styles.nightShiftActiveText, { color: "#818cf8" }]}>Night shift active</Text>
            </View>
          ) : null}
        </View>

        {/* Danger zone */}
        <View style={[styles.section, { backgroundColor: theme.card, marginTop: Spacing.sm }]}>
          <View style={[styles.menuItem, { borderBottomWidth: 1, borderBottomColor: theme.border }]}>
            <Feather name="trash-2" size={20} color={theme.danger} />
            <Text style={[styles.menuLabel, { color: theme.danger, fontWeight: "600" }]}>Data Management</Text>
          </View>
          <Pressable
            style={({ pressed }) => [styles.menuItem, { opacity: clearingCases ? 0.5 : pressed ? 0.7 : 1 }]}
            onPress={clearingCases ? undefined : handleClearAllCases}
            disabled={clearingCases}
          >
            {clearingCases ? (
              <ActivityIndicator size="small" color={theme.danger} />
            ) : (
              <Feather name="x-circle" size={20} color={theme.danger} />
            )}
            <Text style={[styles.menuLabel, { color: theme.danger }]}>
              {clearingCases ? "Deleting cases…" : "Delete All Cases"}
            </Text>
            {!clearingCases && <Feather name="chevron-right" size={20} color={theme.danger} />}
          </Pressable>
        </View>

        <Pressable
          style={({ pressed }) => [
            styles.logoutBtn,
            { backgroundColor: theme.dangerLight, opacity: pressed ? 0.8 : 1 },
          ]}
          onPress={() => setShowLogoutModal(true)}
        >
          <Feather name="log-out" size={20} color={theme.danger} />
          <Text style={[styles.logoutText, { color: theme.danger }]}>Logout</Text>
        </Pressable>

        <Text style={[styles.version, { color: theme.textMuted }]}>ErMate v1.0.0</Text>
      </ScrollView>

      {/* Logout modal */}
      <Modal visible={showLogoutModal} transparent animationType="fade" onRequestClose={() => setShowLogoutModal(false)}>
        <Pressable style={styles.modalOverlay} onPress={() => setShowLogoutModal(false)}>
          <Pressable style={[styles.modalContent, { backgroundColor: theme.card }]} onPress={() => {}}>
            <Text style={[styles.modalTitle, { color: theme.text }]}>Logout</Text>
            <Text style={[styles.modalDesc, { color: theme.textSecondary }]}>Are you sure you want to logout?</Text>
            <View style={styles.modalActions}>
              <Pressable style={[styles.modalBtn, { backgroundColor: theme.backgroundTertiary }]} onPress={() => setShowLogoutModal(false)}>
                <Text style={[styles.modalBtnText, { color: theme.text }]}>Cancel</Text>
              </Pressable>
              <Pressable style={[styles.modalBtn, { backgroundColor: theme.danger }]} onPress={() => { setShowLogoutModal(false); logout(); }}>
                <Text style={[styles.modalBtnText, { color: "#FFFFFF" }]}>Logout</Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      {/* Role picker modal */}
      <Modal visible={showRoleModal} transparent animationType="fade" onRequestClose={() => setShowRoleModal(false)}>
        <Pressable style={styles.modalOverlay} onPress={() => setShowRoleModal(false)}>
          <Pressable style={[styles.modalContent, { backgroundColor: theme.card, maxWidth: 360 }]} onPress={() => {}}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: theme.text, marginBottom: 0 }]}>My Role</Text>
              <Pressable onPress={() => setShowRoleModal(false)}>
                <Feather name="x" size={22} color={theme.textMuted} />
              </Pressable>
            </View>
            <Text style={[styles.modalDesc, { color: theme.textSecondary, marginBottom: Spacing.lg }]}>
              This helps ErMate personalise your experience and subscription pricing.
            </Text>

            {ROLE_OPTIONS.map((opt) => (
              <Pressable
                key={opt.value}
                onPress={() => setSelectedRole(opt.value)}
                style={[
                  styles.roleOption,
                  {
                    borderColor: selectedRole === opt.value ? theme.primary : theme.border,
                    backgroundColor: selectedRole === opt.value ? (isDark ? "rgba(29,184,112,0.10)" : "#F0FDF6") : theme.backgroundDefault,
                  },
                ]}
              >
                <View style={[styles.roleOptionIcon, {
                  backgroundColor: selectedRole === opt.value ? theme.primary + "20" : theme.backgroundSecondary,
                }]}>
                  <Feather name={opt.icon} size={18} color={selectedRole === opt.value ? theme.primary : theme.textMuted} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.roleOptionLabel, {
                    color: selectedRole === opt.value ? (isDark ? "#FFFFFF" : "#0D1117") : theme.text,
                    fontWeight: selectedRole === opt.value ? "700" : "500",
                  }]}>{opt.label}</Text>
                  <Text style={[{ fontSize: 12, color: theme.textMuted, marginTop: 1 }]}>{opt.desc}</Text>
                </View>
                <View style={[styles.radioOuter, { borderColor: selectedRole === opt.value ? theme.primary : theme.border }]}>
                  {selectedRole === opt.value && <View style={[styles.radioInner, { backgroundColor: theme.primary }]} />}
                </View>
              </Pressable>
            ))}

            <View style={[styles.modalActions, { marginTop: Spacing.lg }]}>
              <Pressable style={[styles.modalBtn, { backgroundColor: theme.backgroundTertiary }]} onPress={() => setShowRoleModal(false)}>
                <Text style={[styles.modalBtnText, { color: theme.text }]}>Cancel</Text>
              </Pressable>
              <Pressable
                style={[styles.modalBtn, { backgroundColor: theme.primary, opacity: roleSaving ? 0.7 : 1 }]}
                onPress={handleSaveRole}
                disabled={roleSaving}
              >
                {roleSaving ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Text style={[styles.modalBtnText, { color: "#FFFFFF" }]}>Save</Text>
                )}
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      {/* Change password modal */}
      <Modal visible={showPasswordModal} transparent animationType="fade" onRequestClose={closePasswordModal}>
        <Pressable style={styles.modalOverlay} onPress={closePasswordModal}>
          <Pressable style={[styles.modalContent, { backgroundColor: theme.card }]} onPress={() => {}}>
            <View style={[styles.modalHeader, { marginBottom: Spacing.md }]}>
              <Text style={[styles.modalTitle, { color: theme.text, marginBottom: 0 }]}>
                {isGoogleUser ? "Set Password" : "Change Password"}
              </Text>
              <Pressable onPress={closePasswordModal}>
                <Feather name="x" size={22} color={theme.textMuted} />
              </Pressable>
            </View>

            {passwordSuccess ? (
              <View style={{ alignItems: "center", paddingVertical: Spacing.lg }}>
                <View style={[styles.successIcon, { backgroundColor: theme.primary + "20" }]}>
                  <Feather name="check-circle" size={32} color={theme.primary} />
                </View>
                <Text style={[styles.modalDesc, { color: theme.textSecondary, textAlign: "center", marginBottom: Spacing.xl }]}>
                  Password updated successfully. Use it next time you sign in.
                </Text>
                <Pressable
                  style={[styles.modalBtn, { backgroundColor: theme.primary, flex: 0, paddingHorizontal: Spacing.xl, height: 44 }]}
                  onPress={closePasswordModal}
                >
                  <Text style={[styles.modalBtnText, { color: "#FFFFFF" }]}>Done</Text>
                </Pressable>
              </View>
            ) : (
              <View>
                {isGoogleUser ? (
                  <Text style={[styles.modalDesc, { color: theme.textSecondary, marginBottom: Spacing.md }]}>
                    You signed in with Google. Set a password so you can also log in with your email.
                  </Text>
                ) : (
                  <View style={[styles.pwInputRow, { borderColor: theme.border, backgroundColor: theme.backgroundDefault }]}>
                    <Feather name="lock" size={18} color={theme.textMuted} />
                    <TextInput
                      style={[styles.pwInput, { color: theme.text }]}
                      placeholder="Current password"
                      placeholderTextColor={theme.textMuted}
                      secureTextEntry={!showCurrentPw}
                      value={currentPassword}
                      onChangeText={setCurrentPassword}
                      autoCapitalize="none"
                    />
                    <Pressable onPress={() => setShowCurrentPw(v => !v)}>
                      <Feather name={showCurrentPw ? "eye-off" : "eye"} size={18} color={theme.textMuted} />
                    </Pressable>
                  </View>
                )}
                <View style={[styles.pwInputRow, { borderColor: theme.border, backgroundColor: theme.backgroundDefault }]}>
                  <Feather name="lock" size={18} color={theme.textMuted} />
                  <TextInput
                    style={[styles.pwInput, { color: theme.text }]}
                    placeholder="New password"
                    placeholderTextColor={theme.textMuted}
                    secureTextEntry={!showNewPw}
                    value={newPassword}
                    onChangeText={setNewPassword}
                    autoCapitalize="none"
                  />
                  <Pressable onPress={() => setShowNewPw(v => !v)}>
                    <Feather name={showNewPw ? "eye-off" : "eye"} size={18} color={theme.textMuted} />
                  </Pressable>
                </View>
                <View style={[styles.pwInputRow, { borderColor: theme.border, backgroundColor: theme.backgroundDefault }]}>
                  <Feather name="lock" size={18} color={theme.textMuted} />
                  <TextInput
                    style={[styles.pwInput, { color: theme.text }]}
                    placeholder="Confirm new password"
                    placeholderTextColor={theme.textMuted}
                    secureTextEntry={!showConfirmPw}
                    value={confirmPassword}
                    onChangeText={setConfirmPassword}
                    autoCapitalize="none"
                  />
                  <Pressable onPress={() => setShowConfirmPw(v => !v)}>
                    <Feather name={showConfirmPw ? "eye-off" : "eye"} size={18} color={theme.textMuted} />
                  </Pressable>
                </View>
                {passwordError ? (
                  <View style={[styles.errorBox, { backgroundColor: theme.danger + "15", borderColor: theme.danger + "40" }]}>
                    <Feather name="alert-circle" size={14} color={theme.danger} />
                    <Text style={[styles.errorText, { color: theme.danger }]}>{passwordError}</Text>
                  </View>
                ) : null}
                <View style={[styles.modalActions, { marginTop: Spacing.md }]}>
                  <Pressable style={[styles.modalBtn, { backgroundColor: theme.backgroundTertiary }]} onPress={closePasswordModal}>
                    <Text style={[styles.modalBtnText, { color: theme.text }]}>Cancel</Text>
                  </Pressable>
                  <Pressable
                    style={[styles.modalBtn, { backgroundColor: theme.primary, opacity: passwordLoading ? 0.7 : 1 }]}
                    onPress={handleChangePassword}
                    disabled={passwordLoading}
                  >
                    {passwordLoading ? (
                      <ActivityIndicator size="small" color="#FFFFFF" />
                    ) : (
                      <Text style={[styles.modalBtnText, { color: "#FFFFFF" }]}>
                        {isGoogleUser ? "Set Password" : "Update"}
                      </Text>
                    )}
                  </Pressable>
                </View>
              </View>
            )}
          </Pressable>
        </Pressable>
      </Modal>
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
    width: 80, height: 80, borderRadius: BorderRadius.full,
    justifyContent: "center", alignItems: "center", marginBottom: Spacing.md,
  },
  avatarText: { ...Typography.h1 },
  name: { ...Typography.h3, marginBottom: Spacing.xs },
  email: { ...Typography.body, marginBottom: Spacing.sm },
  roleRow: { flexDirection: "row", gap: 8, flexWrap: "wrap", justifyContent: "center", marginBottom: Spacing.md },
  roleBadge: {
    flexDirection: "row", alignItems: "center", gap: 5,
    paddingHorizontal: 10, paddingVertical: 5, borderRadius: BorderRadius.full,
  },
  roleText: { fontSize: 12, fontWeight: "500" },
  planBadge: {
    flexDirection: "row", alignItems: "center",
    paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.full, gap: Spacing.xs,
  },
  planText: { ...Typography.label },

  section: { borderRadius: BorderRadius.lg, marginBottom: Spacing.lg },
  menuItem: {
    flexDirection: "row", alignItems: "center",
    padding: Spacing.lg, gap: Spacing.md,
  },
  menuLabel: { flex: 1, ...Typography.body },

  nightShiftOptions: {
    flexDirection: "row", gap: Spacing.sm,
    padding: Spacing.md, flexWrap: "wrap",
  },
  nightShiftOption: {
    flexDirection: "row", alignItems: "center", gap: 6,
    paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.full, borderWidth: 1,
  },
  nightShiftLabel: { fontSize: 12, fontWeight: "500" },
  nightShiftActive: {
    flexDirection: "row", alignItems: "center", gap: 6,
    margin: Spacing.md, marginTop: 0,
    padding: Spacing.sm, borderRadius: BorderRadius.md,
  },
  nightShiftActiveText: { fontSize: 12 },

  logoutBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center",
    padding: Spacing.lg, borderRadius: BorderRadius.lg, gap: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  logoutText: { ...Typography.h4 },
  version: { ...Typography.caption, textAlign: "center", marginTop: Spacing.sm },

  modalOverlay: {
    flex: 1, backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center", alignItems: "center", padding: Spacing.xl,
  },
  modalContent: {
    width: "100%", maxWidth: 340,
    borderRadius: BorderRadius.lg, padding: Spacing.xl,
  },
  modalHeader: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    marginBottom: Spacing.md,
  },
  modalTitle: { ...Typography.h3, marginBottom: Spacing.sm },
  modalDesc: { ...Typography.body, marginBottom: Spacing.xl },
  modalActions: { flexDirection: "row", gap: Spacing.md },
  modalBtn: {
    flex: 1, height: 44, borderRadius: BorderRadius.md,
    justifyContent: "center", alignItems: "center",
  },
  modalBtnText: { ...Typography.bodyMedium },

  roleOption: {
    flexDirection: "row", alignItems: "center", gap: 12,
    borderWidth: 1.5, borderRadius: BorderRadius.md,
    padding: 14, marginBottom: 10,
  },
  roleOptionIcon: {
    width: 38, height: 38, borderRadius: 10,
    alignItems: "center", justifyContent: "center",
  },
  roleOptionLabel: { fontSize: 15 },
  radioOuter: {
    width: 20, height: 20, borderRadius: 10, borderWidth: 2,
    alignItems: "center", justifyContent: "center",
  },
  radioInner: { width: 10, height: 10, borderRadius: 5 },

  pwInputRow: {
    flexDirection: "row", alignItems: "center",
    borderWidth: 1, borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.md, height: 50,
    gap: Spacing.sm, marginBottom: Spacing.md,
  },
  pwInput: { flex: 1, fontSize: 15, fontFamily: "System" },

  errorBox: {
    flexDirection: "row", alignItems: "center", gap: 8,
    borderWidth: 1, borderRadius: BorderRadius.md,
    padding: 10, marginBottom: Spacing.md,
  },
  errorText: { fontSize: 13, flex: 1 },
  successIcon: {
    width: 72, height: 72, borderRadius: 36,
    alignItems: "center", justifyContent: "center", marginBottom: Spacing.lg,
  },
});
