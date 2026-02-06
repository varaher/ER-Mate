import React from "react";
import { ActivityIndicator, View, StyleSheet } from "react-native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import MainTabNavigator from "@/navigation/MainTabNavigator";
import { useScreenOptions } from "@/hooks/useScreenOptions";
import { useAuth } from "@/context/AuthContext";
import { useTheme } from "@/hooks/useTheme";
import { CaseData } from "@/context/CaseContext";

import LoginScreen from "@/screens/LoginScreen";
import RegisterScreen from "@/screens/RegisterScreen";
import TriageScreen from "@/screens/TriageScreen";
import CaseSheetScreen from "@/screens/CaseSheetScreen";
import PediatricCaseSheetScreen from "@/screens/PediatricCaseSheetScreen";
import PhysicalExamScreen from "@/screens/PhysicalExamScreen";
import InvestigationsScreen from "@/screens/InvestigationsScreen";
import TreatmentScreen from "@/screens/TreatmentScreen";
import DispositionScreen from "@/screens/DispositionScreen";
import DischargeSummaryScreen from "@/screens/DischargeSummaryScreen";
import UpgradeScreen from "@/screens/UpgradeScreen";
import ViewCaseScreen from "@/screens/ViewCaseScreen";
import LinkDevicesScreen from "@/screens/LinkDevicesScreen";
import AddendumNotesScreen from "@/screens/AddendumNotesScreen";
import ViewDischargeSummaryScreen from "@/screens/ViewDischargeSummaryScreen";
import NotificationsScreen from "@/screens/NotificationsScreen";
import PrivacyScreen from "@/screens/PrivacyScreen";
import HelpSupportScreen from "@/screens/HelpSupportScreen";
import AboutScreen from "@/screens/AboutScreen";

export type RootStackParamList = {
  Login: undefined;
  Register: undefined;
  Main: undefined;
  Triage: undefined;
  CaseSheet: { caseId: string; patientType?: string; caseData?: CaseData; triageData?: any };
  PediatricCaseSheet: { caseId: string; patientType?: string; caseData?: CaseData; triageData?: any };
  PhysicalExam: { caseId: string };
  Investigations: { caseId: string };
  Treatment: { caseId: string };
  Disposition: { caseId: string };
  DischargeSummary: { caseId: string };
  Upgrade: { lockReason?: string; lockMessage?: string };
  ViewCase: { caseId: string };
  LinkDevices: undefined;
  AddendumNotes: { caseId: string };
  ViewDischargeSummary: { caseId: string };
  Notifications: undefined;
  Privacy: undefined;
  HelpSupport: undefined;
  About: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();

export default function RootStackNavigator() {
  const screenOptions = useScreenOptions();
  const { isAuthenticated, isLoading } = useAuth();
  const { theme } = useTheme();

  if (isLoading) {
    return (
      <View style={[styles.loading, { backgroundColor: theme.backgroundDefault }]}>
        <ActivityIndicator size="large" color={theme.primary} />
      </View>
    );
  }

  return (
    <Stack.Navigator screenOptions={screenOptions}>
      {!isAuthenticated ? (
        <>
          <Stack.Screen
            name="Login"
            component={LoginScreen}
            options={{ headerShown: false }}
          />
          <Stack.Screen
            name="Register"
            component={RegisterScreen}
            options={{ headerShown: false }}
          />
        </>
      ) : (
        <>
          <Stack.Screen
            name="Main"
            component={MainTabNavigator}
            options={{ headerShown: false }}
          />
          <Stack.Screen
            name="Triage"
            component={TriageScreen}
            options={{
              presentation: "modal",
              headerTitle: "New Patient Triage",
            }}
          />
          <Stack.Screen
            name="CaseSheet"
            component={CaseSheetScreen}
            options={{
              presentation: "modal",
              headerTitle: "Case Sheet",
            }}
          />
          <Stack.Screen
            name="PediatricCaseSheet"
            component={PediatricCaseSheetScreen}
            options={{
              presentation: "modal",
              headerTitle: "Pediatric Case Sheet",
            }}
          />
          <Stack.Screen
            name="PhysicalExam"
            component={PhysicalExamScreen}
            options={{
              presentation: "modal",
              headerTitle: "Physical Examination",
            }}
          />
          <Stack.Screen
            name="Investigations"
            component={InvestigationsScreen}
            options={{
              presentation: "modal",
              headerTitle: "Investigations",
            }}
          />
          <Stack.Screen
            name="Treatment"
            component={TreatmentScreen}
            options={{
              presentation: "modal",
              headerTitle: "Treatment",
            }}
          />
          <Stack.Screen
            name="Disposition"
            component={DispositionScreen}
            options={{
              presentation: "modal",
              headerTitle: "Disposition",
            }}
          />
          <Stack.Screen
            name="DischargeSummary"
            component={DischargeSummaryScreen}
            options={{
              presentation: "modal",
              headerTitle: "Discharge Summary",
            }}
          />
          <Stack.Screen
            name="Upgrade"
            component={UpgradeScreen}
            options={{
              presentation: "modal",
              headerTitle: "Upgrade Plan",
            }}
          />
          <Stack.Screen
            name="ViewCase"
            component={ViewCaseScreen}
            options={{
              presentation: "modal",
              headerTitle: "View Case",
            }}
          />
          <Stack.Screen
            name="LinkDevices"
            component={LinkDevicesScreen}
            options={{
              presentation: "modal",
              headerTitle: "Link to Web",
            }}
          />
          <Stack.Screen
            name="AddendumNotes"
            component={AddendumNotesScreen}
            options={{
              presentation: "modal",
              headerTitle: "Addendum Notes",
            }}
          />
          <Stack.Screen
            name="ViewDischargeSummary"
            component={ViewDischargeSummaryScreen}
            options={{
              presentation: "modal",
              headerTitle: "View Discharge Summary",
            }}
          />
          <Stack.Screen
            name="Notifications"
            component={NotificationsScreen}
            options={{
              presentation: "modal",
              headerTitle: "Notifications",
            }}
          />
          <Stack.Screen
            name="Privacy"
            component={PrivacyScreen}
            options={{
              presentation: "modal",
              headerTitle: "Privacy",
            }}
          />
          <Stack.Screen
            name="HelpSupport"
            component={HelpSupportScreen}
            options={{
              presentation: "modal",
              headerTitle: "Help & Support",
            }}
          />
          <Stack.Screen
            name="About"
            component={AboutScreen}
            options={{
              presentation: "modal",
              headerTitle: "About ErMate",
            }}
          />
        </>
      )}
    </Stack.Navigator>
  );
}

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
});
