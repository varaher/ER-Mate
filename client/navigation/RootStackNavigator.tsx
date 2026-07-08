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
import PediatricDrugCalculatorScreen from "@/screens/PediatricDrugCalculatorScreen";
import SimulationListScreen from "@/screens/SimulationListScreen";
import SimulationScreen from "@/screens/SimulationScreen";
import SimulationResultScreen from "@/screens/SimulationResultScreen";
import EMReferenceScreen from "@/screens/EMReferenceScreen";
import TriviaHomeScreen from "@/screens/TriviaHomeScreen";
import TriviaQuizScreen from "@/screens/TriviaQuizScreen";
import TriviaResultScreen from "@/screens/TriviaResultScreen";
import type { QuizAnswer } from "@/screens/TriviaQuizScreen";
import type { TriviaCategory, TriviaDifficulty } from "@/data/triviaQuestions";
import QuickCaseSheetScreen from "@/screens/QuickCaseSheetScreen";
import StatsScreen from "@/screens/StatsScreen";
import MySubscriptionsScreen from "@/screens/MySubscriptionsScreen";
import RoundsScreen from "@/screens/RoundsScreen";
import HandoverScreen from "@/screens/HandoverScreen";
import SetupDepartmentScreen from "@/screens/department/SetupDepartmentScreen";
import ManageRosterScreen from "@/screens/department/ManageRosterScreen";
import AdminDashboardScreen from "@/screens/department/AdminDashboardScreen";
import HandoverDetailScreen from "@/screens/HandoverDetailScreen";
import EscalationScreen from "@/screens/EscalationScreen";
import TourScreen from "@/screens/TourScreen";
import CaseChatScreen from "@/screens/CaseChatScreen";
import PublicHandoverScreen from "@/screens/PublicHandoverScreen";
import HandoverChatScreen from "@/screens/HandoverChatScreen";

export type RootStackParamList = {
  Login: undefined;
  Register: undefined;
  Main: undefined;
  Triage: undefined;
  QuickCaseSheet: { type: "adult" | "pediatric" };
  CaseSheet: { caseId: string; patientType?: string; caseData?: CaseData; triageData?: any };
  PediatricCaseSheet: { caseId: string; patientType?: string; caseData?: CaseData; triageData?: any };
  PhysicalExam: { caseId: string };
  Investigations: { caseId: string };
  Treatment: { caseId: string };
  Disposition: { caseId: string };
  DischargeSummary: { caseId: string };
  Upgrade: { lockReason?: string; lockMessage?: string };
  ViewCase: { caseId: string; readOnly?: boolean };
  LinkDevices: undefined;
  AddendumNotes: { caseId: string };
  ViewDischargeSummary: { caseId: string };
  Notifications: undefined;
  Privacy: undefined;
  HelpSupport: undefined;
  About: undefined;
  PediatricDrugCalculator: { weight?: string } | undefined;
  Tour: undefined;
  SimulationList: undefined;
  Simulation: { caseId: string };
  EMReference: undefined;
  TriviaHome: undefined;
  TriviaQuiz: {
    categories: TriviaCategory[];
    difficulty: TriviaDifficulty | "all";
    questionCount: number;
  };
  TriviaResult: {
    questions: string[];
    answers: QuizAnswer[];
    totalTime: number;
    categories: TriviaCategory[];
    difficulty: TriviaDifficulty | "all";
  };
  SimulationResult: {
    caseId: string;
    elapsedTime: number;
    performedActions: string[];
    actionTimestamps: Record<string, number>;
    selectedDifferential: string | null;
    hasCrashed: boolean;
  };
  Stats: undefined;
  MySubscriptions: undefined;
  Rounds: { caseId?: string; lensId?: string } | undefined;
  Handover: undefined;
  HandoverChat: undefined;
  SetupDepartment: undefined;
  ManageRoster: undefined;
  AdminDashboard: undefined;
  HandoverDetail: undefined;
  Escalation: { caseId?: string } | undefined;
  CaseChat: { caseId?: string; patientName?: string };
  PublicHandover: undefined;
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
          <Stack.Screen
            name="PublicHandover"
            component={PublicHandoverScreen}
            options={{ headerTitle: "Quick Handover" }}
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
            name="QuickCaseSheet"
            component={QuickCaseSheetScreen}
            options={{
              presentation: "modal",
              headerTitle: "Quick Case Sheet",
            }}
          />
          <Stack.Screen
            name="CaseSheet"
            component={CaseSheetScreen}
            options={{
              presentation: "modal",
              headerShown: false,
            }}
          />
          <Stack.Screen
            name="PediatricCaseSheet"
            component={PediatricCaseSheetScreen}
            options={{
              presentation: "modal",
              headerShown: false,
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
          <Stack.Screen
            name="Tour"
            component={TourScreen}
            options={{
              headerTitle: "Feature Tour",
            }}
          />
          <Stack.Screen
            name="PediatricDrugCalculator"
            component={PediatricDrugCalculatorScreen}
            options={{
              presentation: "modal",
              headerTitle: "Pediatric Drug Calculator",
            }}
          />
          <Stack.Screen
            name="EMReference"
            component={EMReferenceScreen}
            options={{
              presentation: "modal",
              headerTitle: "EM Reference Library",
            }}
          />
          <Stack.Screen
            name="TriviaHome"
            component={TriviaHomeScreen}
            options={{
              presentation: "modal",
              headerTitle: "Trivia Time",
            }}
          />
          <Stack.Screen
            name="TriviaQuiz"
            component={TriviaQuizScreen}
            options={{
              presentation: "modal",
              headerTitle: "Quiz",
              gestureEnabled: false,
            }}
          />
          <Stack.Screen
            name="TriviaResult"
            component={TriviaResultScreen}
            options={{
              presentation: "modal",
              headerTitle: "Results",
              gestureEnabled: false,
            }}
          />
          <Stack.Screen
            name="SimulationList"
            component={SimulationListScreen}
            options={{
              presentation: "modal",
              headerTitle: "Simulation Lab",
            }}
          />
          <Stack.Screen
            name="Simulation"
            component={SimulationScreen}
            options={{
              headerShown: false,
              gestureEnabled: false,
            }}
          />
          <Stack.Screen
            name="SimulationResult"
            component={SimulationResultScreen}
            options={{
              presentation: "modal",
              headerTitle: "Simulation Results",
              gestureEnabled: false,
            }}
          />
          <Stack.Screen
            name="Stats"
            component={StatsScreen}
            options={{
              headerTitle: "My Stats",
            }}
          />
          <Stack.Screen
            name="MySubscriptions"
            component={MySubscriptionsScreen}
            options={{
              headerTitle: "My Subscriptions",
            }}
          />
          <Stack.Screen
            name="Rounds"
            component={RoundsScreen}
            options={{
              presentation: "modal",
              headerTitle: "Rounds",
            }}
          />
          <Stack.Screen
            name="Handover"
            component={HandoverScreen}
            options={{
              headerTitle: "Handover Sheet",
            }}
          />
          <Stack.Screen
            name="HandoverChat"
            component={HandoverChatScreen}
            options={{
              headerTitle: "Handover",
            }}
          />
          <Stack.Screen
            name="SetupDepartment"
            component={SetupDepartmentScreen}
            options={{
              presentation: "modal",
              headerTitle: "Create Department",
            }}
          />
          <Stack.Screen
            name="ManageRoster"
            component={ManageRosterScreen}
            options={{
              headerTitle: "Manage Roster",
            }}
          />
          <Stack.Screen
            name="AdminDashboard"
            component={AdminDashboardScreen}
            options={{
              headerTitle: "HOD Dashboard",
            }}
          />
          <Stack.Screen
            name="HandoverDetail"
            component={HandoverDetailScreen}
            options={{
              headerTitle: "Incoming Handovers",
            }}
          />
          <Stack.Screen
            name="Escalation"
            component={EscalationScreen}
            options={{
              presentation: "modal",
              headerTitle: "Escalations",
            }}
          />
          <Stack.Screen
            name="CaseChat"
            component={CaseChatScreen}
            options={{
              headerShown: false,
            }}
          />
          <Stack.Screen
            name="PublicHandover"
            component={PublicHandoverScreen}
            options={{ headerTitle: "Quick Handover" }}
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
