import React, { useState, useRef } from "react";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { Feather } from "@expo/vector-icons";
import { BlurView } from "expo-blur";
import {
  Platform,
  StyleSheet,
  View,
  Text,
  Pressable,
  Modal,
  Animated,
  TouchableWithoutFeedback,
} from "react-native";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius, Typography } from "@/constants/theme";
import type { RootStackParamList } from "@/navigation/RootStackNavigator";

import DashboardScreen from "@/screens/DashboardScreen";
import CasesScreen from "@/screens/CasesScreen";
import LearnScreen from "@/screens/LearnScreen";
import LogsScreen from "@/screens/LogsScreen";
import ProfileScreen from "@/screens/ProfileScreen";

export type MainTabParamList = {
  DashboardTab: undefined;
  CasesTab: undefined;
  NewPatient: undefined;
  LearnTab: undefined;
  LogsTab: undefined;
  ProfileTab: undefined;
};

const Tab = createBottomTabNavigator<MainTabParamList>();

const ACCENT_VOICE = "#7c3aed";

function NewPatientButton() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { theme, isDark } = useTheme();
  const [visible, setVisible] = useState(false);
  const backdropOpacity = useRef(new Animated.Value(0)).current;
  const sheetY = useRef(new Animated.Value(400)).current;

  const openSheet = () => {
    setVisible(true);
    Animated.parallel([
      Animated.timing(backdropOpacity, { toValue: 1, duration: 220, useNativeDriver: true }),
      Animated.spring(sheetY, { toValue: 0, useNativeDriver: true, bounciness: 4 }),
    ]).start();
  };

  const closeSheet = (cb?: () => void) => {
    Animated.parallel([
      Animated.timing(backdropOpacity, { toValue: 0, duration: 180, useNativeDriver: true }),
      Animated.timing(sheetY, { toValue: 400, duration: 200, useNativeDriver: true }),
    ]).start(() => {
      setVisible(false);
      cb?.();
    });
  };

  const go = (screen: keyof RootStackParamList, params?: any) => {
    closeSheet(() => navigation.navigate(screen as any, params));
  };

  const STANDARD_ENTRIES = [
    { icon: "clipboard" as const, label: "Start with Triage", sub: "Full triage → case sheet", color: theme.primary, action: () => go("Triage") },
    { icon: "user" as const, label: "Adult Case Sheet", sub: "Quick start, skip triage", color: theme.primary, action: () => go("QuickCaseSheet" as any, { type: "adult" }) },
    { icon: "heart" as const, label: "Pediatric Case Sheet", sub: "For patients aged 16", color: "#06b6d4", action: () => go("QuickCaseSheet" as any, { type: "pediatric" }) },
  ];

  return (
    <>
      <Pressable
        onPress={openSheet}
        style={({ pressed }) => [
          styles.fabButton,
          { backgroundColor: theme.primary, opacity: pressed ? 0.8 : 1 },
        ]}
      >
        <Feather name="plus" size={28} color="#FFFFFF" />
      </Pressable>

      <Modal visible={visible} transparent animationType="none" onRequestClose={() => closeSheet()}>
        <TouchableWithoutFeedback onPress={() => closeSheet()}>
          <Animated.View style={[styles.backdrop, { opacity: backdropOpacity }]} />
        </TouchableWithoutFeedback>

        <Animated.View
          style={[
            styles.sheet,
            {
              backgroundColor: isDark ? "#1a1a2e" : "#ffffff",
              transform: [{ translateY: sheetY }],
            },
          ]}
        >
          {/* Handle */}
          <View style={[styles.handle, { backgroundColor: theme.border }]} />

          <Text style={[styles.sheetTitle, { color: theme.text }]}>New Patient</Text>
          <Text style={[styles.sheetSub, { color: theme.textSecondary }]}>
            Speak the case — get a copyable note in seconds
          </Text>

          {/* ── VOICE MODE (primary) ──────────────────────────────── */}
          <Pressable
            style={({ pressed }) => [
              styles.voiceCard,
              {
                backgroundColor: pressed ? `${ACCENT_VOICE}22` : `${ACCENT_VOICE}14`,
                borderColor: `${ACCENT_VOICE}45`,
              },
            ]}
            onPress={() => go("VoiceCaseSheet" as any)}
          >
            <View style={[styles.voiceCardLeft, { backgroundColor: ACCENT_VOICE }]}>
              <Feather name="mic" size={20} color="#fff" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.voiceCardTitle, { color: theme.text }]}>Speak the Case</Text>
              <Text style={[styles.voiceCardDesc, { color: theme.textSecondary }]}>
                Dictate naturally — AI writes the note, ready to copy into any EMR. Correct it by chatting.
              </Text>
            </View>
            <Feather name="chevron-right" size={16} color={ACCENT_VOICE} />
          </Pressable>

          {/* ── STANDARD MODE (secondary) ─────────────────────────── */}
          <View style={[styles.modeSection, { borderColor: theme.border }]}>
            <View style={styles.modeSectionHeader}>
              <View style={[styles.modeIconBadge, { backgroundColor: `${theme.primary}18` }]}>
                <Feather name="edit-3" size={14} color={theme.primary} />
              </View>
              <View>
                <Text style={[styles.modeSectionTitle, { color: theme.text }]}>Prefer to type it in?</Text>
                <Text style={[styles.modeSectionDesc, { color: theme.textSecondary }]}>
                  Manual form — all fields, AI diagnosis, ABG analysis
                </Text>
              </View>
            </View>
            {STANDARD_ENTRIES.map((e) => (
              <Pressable
                key={e.label}
                style={({ pressed }) => [
                  styles.entryRow,
                  { backgroundColor: pressed ? theme.backgroundSecondary : "transparent" },
                ]}
                onPress={e.action}
              >
                <View style={[styles.entryDot, { backgroundColor: `${e.color}18` }]}>
                  <Feather name={e.icon} size={16} color={e.color} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.entryLabel, { color: theme.text }]}>{e.label}</Text>
                  <Text style={[styles.entrySub, { color: theme.textSecondary }]}>{e.sub}</Text>
                </View>
                <Feather name="chevron-right" size={16} color={theme.textMuted} />
              </Pressable>
            ))}
          </View>
        </Animated.View>
      </Modal>
    </>
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
        name="LearnTab"
        component={LearnScreen}
        options={{
          title: "Learn",
          tabBarIcon: ({ color, size }) => (
            <Feather name="book-open" size={size} color={color} />
          ),
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

  // Bottom sheet
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.5)",
  },
  sheet: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: Spacing.lg,
    paddingBottom: 40,
    paddingTop: Spacing.sm,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 24,
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    alignSelf: "center",
    marginBottom: Spacing.lg,
  },
  sheetTitle: {
    fontSize: 20,
    fontWeight: "700",
    marginBottom: 4,
  },
  sheetSub: {
    fontSize: 14,
    marginBottom: Spacing.lg,
  },

  // Standard section
  modeSection: {
    borderWidth: 1,
    borderRadius: BorderRadius.lg,
    marginBottom: Spacing.md,
    overflow: "hidden",
  },
  modeSectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.sm,
  },
  modeIconBadge: {
    width: 30,
    height: 30,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  modeSectionTitle: {
    fontSize: 14,
    fontWeight: "700",
  },
  modeSectionDesc: {
    fontSize: 12,
    marginTop: 1,
  },
  entryRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm + 2,
  },
  entryDot: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  entryLabel: {
    fontSize: 16,
    fontWeight: "600",
  },
  entrySub: {
    fontSize: 12,
    marginTop: 1,
  },

  // Voice card
  voiceCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
    padding: Spacing.md,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
  },
  voiceCardLeft: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  voiceCardTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
    marginBottom: 3,
  },
  voiceCardTitle: {
    fontSize: 16,
    fontWeight: "700",
  },
  voiceCardDesc: {
    fontSize: 12,
    lineHeight: 16,
  },
  newBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  newBadgeText: {
    color: "#fff",
    fontSize: 9,
    fontWeight: "800",
    letterSpacing: 0.5,
  },
});
