import { createNavigationContainerRef } from "@react-navigation/native";
import type { RootStackParamList } from "@/navigation/RootStackNavigator";

export const navigationRef = createNavigationContainerRef<RootStackParamList>();
