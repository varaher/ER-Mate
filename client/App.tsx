import React, { useEffect } from "react";
import { Platform, StyleSheet } from "react-native";
import { NavigationContainer } from "@react-navigation/native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { KeyboardProvider } from "react-native-keyboard-controller";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import * as SplashScreen from "expo-splash-screen";
import * as Font from "expo-font";
import { Feather, MaterialIcons, MaterialCommunityIcons, Ionicons, FontAwesome } from "@expo/vector-icons";

import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "@/lib/query-client";

import RootStackNavigator from "@/navigation/RootStackNavigator";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { AuthProvider } from "@/context/AuthContext";
import { CaseProvider } from "@/context/CaseContext";
import { DepartmentProvider } from "@/context/DepartmentContext";
import ShiftSelectScreen from "@/screens/ShiftSelectScreen";
import { PWABanner } from "@/components/PWABanner";

if (Platform.OS !== "web") {
  SplashScreen.preventAutoHideAsync();
}

export default function App() {
  const [fontsLoaded] = Font.useFonts({
    ...Feather.font,
    ...MaterialIcons.font,
    ...MaterialCommunityIcons.font,
    ...Ionicons.font,
    ...FontAwesome.font,
  });

  useEffect(() => {
    if (Platform.OS !== "web") {
      SplashScreen.hideAsync().catch(() => {});
    }
  }, []);

  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <CaseProvider>
            <DepartmentProvider>
              <SafeAreaProvider>
                <GestureHandlerRootView style={styles.root}>
                  <KeyboardProvider>
                    <PWABanner />
                    <NavigationContainer>
                      <RootStackNavigator />
                    </NavigationContainer>
                    <ShiftSelectScreen />
                    <StatusBar style="auto" />
                  </KeyboardProvider>
                </GestureHandlerRootView>
              </SafeAreaProvider>
            </DepartmentProvider>
          </CaseProvider>
        </AuthProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  loading: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
  },
});
