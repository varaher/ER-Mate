import { useEffect, useRef } from "react";
import { Platform } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { getApiUrl } from "@/lib/query-client";

async function registerPushToken(token: string) {
  try {
    const authToken = await AsyncStorage.getItem("token");
    if (!authToken) return;
    await fetch(`${getApiUrl()}/api/department/push-token`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${authToken}`,
      },
      body: JSON.stringify({ token, platform: Platform.OS }),
    });
  } catch (e) {
    console.warn("[PushNotifications] Failed to register token:", e);
  }
}

export async function requestAndRegisterPushToken(): Promise<string | null> {
  if (Platform.OS === "web") return null;
  try {
    const Notifications = await import("expo-notifications");
    const Constants = (await import("expo-constants")).default;

    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowAlert: true,
        shouldPlaySound: true,
        shouldSetBadge: false,
        shouldShowBanner: true,
        shouldShowList: true,
      }),
    });

    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;
    if (existingStatus !== "granted") {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }
    if (finalStatus !== "granted") return null;

    const projectId =
      Constants.expoConfig?.extra?.eas?.projectId ??
      (Constants as any).easConfig?.projectId;
    if (!projectId) {
      console.warn("[PushNotifications] No EAS project ID found");
      return null;
    }

    const tokenData = await Notifications.getExpoPushTokenAsync({ projectId });
    const token = tokenData.data;
    await registerPushToken(token);
    return token;
  } catch (e) {
    console.warn("[PushNotifications] Token registration error:", e);
    return null;
  }
}

export function usePushNotificationSetup(
  isAuthenticated: boolean,
  onNotificationTapped: (data: Record<string, any>) => void
) {
  const listenerRef = useRef<any>(null);

  useEffect(() => {
    if (!isAuthenticated || Platform.OS === "web") return;

    requestAndRegisterPushToken().catch(() => {});

    let mounted = true;
    import("expo-notifications").then((Notifications) => {
      if (!mounted) return;
      listenerRef.current =
        Notifications.addNotificationResponseReceivedListener((response) => {
          const data = response.notification.request.content.data as Record<string, any>;
          if (data) onNotificationTapped(data);
        });
    }).catch(() => {});

    return () => {
      mounted = false;
      listenerRef.current?.remove();
      listenerRef.current = null;
    };
  }, [isAuthenticated]);
}
