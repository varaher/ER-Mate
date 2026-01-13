import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  ActivityIndicator,
  Alert,
  Platform,
} from "react-native";
import { useNavigation } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import * as Clipboard from "expo-clipboard";
import * as Linking from "expo-linking";
import { useTheme } from "@/hooks/useTheme";
import { useAuth } from "@/context/AuthContext";
import { fetchFromApi, apiPost } from "@/lib/api";
import { Spacing, BorderRadius, Typography, TriageColors } from "@/constants/theme";

interface LinkedDevice {
  id: string;
  device_name: string;
  device_type: string;
  last_active: string;
  is_current: boolean;
}

export default function LinkDevicesScreen() {
  const navigation = useNavigation();
  const { theme } = useTheme();
  const { user, token } = useAuth();
  const insets = useSafeAreaInsets();
  const [loading, setLoading] = useState(false);
  const [linkCode, setLinkCode] = useState<string | null>(null);
  const [linkUrl, setLinkUrl] = useState<string | null>(null);
  const [expiresIn, setExpiresIn] = useState(300);
  const [devices, setDevices] = useState<LinkedDevice[]>([]);

  useEffect(() => {
    loadLinkedDevices();
  }, []);

  useEffect(() => {
    if (expiresIn > 0 && linkCode) {
      const timer = setInterval(() => {
        setExpiresIn((prev) => Math.max(0, prev - 1));
      }, 1000);
      return () => clearInterval(timer);
    }
  }, [expiresIn, linkCode]);

  const loadLinkedDevices = async () => {
    try {
      const response = await fetchFromApi<LinkedDevice[]>("/auth/devices");
      setDevices(response || []);
    } catch (err) {
      setDevices([]);
    }
  };

  const generateLinkCode = async () => {
    setLoading(true);
    try {
      const response = await apiPost<{ code: string; url: string; expires_in: number }>(
        "/auth/generate-link-code",
        {}
      );
      if (response.data) {
        setLinkCode(response.data.code);
        setLinkUrl(response.data.url);
        setExpiresIn(response.data.expires_in || 300);
      } else {
        throw new Error(response.error || "Failed to generate link code");
      }
    } catch (err: any) {
      Alert.alert(
        "Link Generation Failed",
        "Unable to generate link code. This feature requires the web linking service to be available. Please try again later.",
        [{ text: "OK" }]
      );
      setLinkCode(null);
      setLinkUrl(null);
    } finally {
      setLoading(false);
    }
  };

  const copyLinkUrl = async () => {
    if (linkUrl) {
      await Clipboard.setStringAsync(linkUrl);
      Alert.alert("Copied!", "Link copied to clipboard. Open it in your browser to connect.");
    }
  };

  const openInBrowser = async () => {
    if (linkUrl) {
      if (Platform.OS === "web") {
        window.open(linkUrl, "_blank");
      } else {
        await Linking.openURL(linkUrl);
      }
    }
  };

  const unlinkDevice = async (deviceId: string) => {
    Alert.alert("Unlink Device", "Are you sure you want to remove this device?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Unlink",
        style: "destructive",
        onPress: async () => {
          try {
            await apiPost(`/auth/unlink-device`, { device_id: deviceId });
            loadLinkedDevices();
          } catch (err) {
            setDevices((prev) => prev.filter((d) => d.id !== deviceId));
          }
        },
      },
    ]);
  };

  const formatExpiry = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const formatLastActive = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    
    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffMins < 1440) return `${Math.floor(diffMins / 60)}h ago`;
    return date.toLocaleDateString();
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.backgroundDefault }]}>
      <ScrollView
        contentContainerStyle={[styles.content, { paddingTop: insets.top + 60, paddingBottom: 40 }]}
        showsVerticalScrollIndicator={false}
      >
        <View style={[styles.infoCard, { backgroundColor: theme.primaryLight }]}>
          <Feather name="monitor" size={32} color={theme.primary} />
          <Text style={[styles.infoTitle, { color: theme.primary }]}>Link to Web</Text>
          <Text style={[styles.infoText, { color: theme.text }]}>
            Access ErMate from your computer browser. Your cases sync automatically across all devices.
          </Text>
        </View>

        <View style={[styles.section, { backgroundColor: theme.card }]}>
          <Text style={[styles.sectionTitle, { color: theme.text }]}>Generate Link</Text>
          
          {!linkCode ? (
            <Pressable
              style={({ pressed }) => [
                styles.generateBtn,
                { backgroundColor: theme.primary, opacity: pressed ? 0.8 : 1 },
              ]}
              onPress={generateLinkCode}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <>
                  <Feather name="link" size={20} color="#fff" />
                  <Text style={styles.generateBtnText}>Generate Link Code</Text>
                </>
              )}
            </Pressable>
          ) : (
            <View style={styles.linkCodeContainer}>
              <View style={[styles.codeBox, { backgroundColor: theme.backgroundDefault }]}>
                <Text style={[styles.codeText, { color: theme.primary }]}>{linkCode}</Text>
                <Text style={[styles.expiryText, { color: expiresIn < 60 ? TriageColors.red : theme.textSecondary }]}>
                  Expires in {formatExpiry(expiresIn)}
                </Text>
              </View>
              
              <View style={styles.linkActions}>
                <Pressable
                  style={[styles.linkActionBtn, { backgroundColor: theme.primaryLight }]}
                  onPress={copyLinkUrl}
                >
                  <Feather name="copy" size={18} color={theme.primary} />
                  <Text style={[styles.linkActionText, { color: theme.primary }]}>Copy Link</Text>
                </Pressable>
                <Pressable
                  style={[styles.linkActionBtn, { backgroundColor: theme.successLight }]}
                  onPress={openInBrowser}
                >
                  <Feather name="external-link" size={18} color={theme.success} />
                  <Text style={[styles.linkActionText, { color: theme.success }]}>Open Web</Text>
                </Pressable>
              </View>

              {expiresIn === 0 ? (
                <Pressable
                  style={[styles.refreshBtn, { borderColor: theme.primary }]}
                  onPress={generateLinkCode}
                >
                  <Feather name="refresh-cw" size={16} color={theme.primary} />
                  <Text style={[styles.refreshText, { color: theme.primary }]}>Generate New Code</Text>
                </Pressable>
              ) : null}
            </View>
          )}

          <View style={styles.instructions}>
            <Text style={[styles.instructionTitle, { color: theme.text }]}>How to link:</Text>
            <View style={styles.step}>
              <View style={[styles.stepNumber, { backgroundColor: theme.primaryLight }]}>
                <Text style={[styles.stepNumberText, { color: theme.primary }]}>1</Text>
              </View>
              <Text style={[styles.stepText, { color: theme.textSecondary }]}>
                Open ermate-web.replit.app in your browser
              </Text>
            </View>
            <View style={styles.step}>
              <View style={[styles.stepNumber, { backgroundColor: theme.primaryLight }]}>
                <Text style={[styles.stepNumberText, { color: theme.primary }]}>2</Text>
              </View>
              <Text style={[styles.stepText, { color: theme.textSecondary }]}>
                Click "Link with Mobile App"
              </Text>
            </View>
            <View style={styles.step}>
              <View style={[styles.stepNumber, { backgroundColor: theme.primaryLight }]}>
                <Text style={[styles.stepNumberText, { color: theme.primary }]}>3</Text>
              </View>
              <Text style={[styles.stepText, { color: theme.textSecondary }]}>
                Enter the code above or use the direct link
              </Text>
            </View>
          </View>
        </View>

        {devices.length > 0 ? (
          <View style={[styles.section, { backgroundColor: theme.card }]}>
            <Text style={[styles.sectionTitle, { color: theme.text }]}>Linked Devices</Text>
            {devices.map((device) => (
              <View
                key={device.id}
                style={[styles.deviceItem, { borderBottomColor: theme.border }]}
              >
                <View style={[styles.deviceIcon, { backgroundColor: theme.primaryLight }]}>
                  <Feather
                    name={device.device_type === "mobile" ? "smartphone" : "monitor"}
                    size={20}
                    color={theme.primary}
                  />
                </View>
                <View style={styles.deviceInfo}>
                  <Text style={[styles.deviceName, { color: theme.text }]}>
                    {device.device_name}
                    {device.is_current ? " (This device)" : ""}
                  </Text>
                  <Text style={[styles.deviceLastActive, { color: theme.textSecondary }]}>
                    Last active: {formatLastActive(device.last_active)}
                  </Text>
                </View>
                {!device.is_current ? (
                  <Pressable
                    style={[styles.unlinkBtn, { backgroundColor: theme.dangerLight }]}
                    onPress={() => unlinkDevice(device.id)}
                  >
                    <Feather name="x" size={16} color={theme.danger} />
                  </Pressable>
                ) : null}
              </View>
            ))}
          </View>
        ) : null}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { paddingHorizontal: Spacing.lg },
  infoCard: {
    alignItems: "center",
    padding: Spacing.xl,
    borderRadius: BorderRadius.lg,
    marginBottom: Spacing.lg,
  },
  infoTitle: { ...Typography.h3, marginTop: Spacing.sm },
  infoText: { ...Typography.body, textAlign: "center", marginTop: Spacing.sm },
  section: {
    padding: Spacing.lg,
    borderRadius: BorderRadius.lg,
    marginBottom: Spacing.lg,
  },
  sectionTitle: { ...Typography.h4, marginBottom: Spacing.md },
  generateBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.sm,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.md,
  },
  generateBtnText: { ...Typography.label, color: "#fff" },
  linkCodeContainer: { alignItems: "center" },
  codeBox: {
    alignItems: "center",
    paddingVertical: Spacing.xl,
    paddingHorizontal: Spacing["3xl"],
    borderRadius: BorderRadius.lg,
    marginBottom: Spacing.md,
  },
  codeText: { fontSize: 32, fontWeight: "700", letterSpacing: 8 },
  expiryText: { ...Typography.small, marginTop: Spacing.sm },
  linkActions: {
    flexDirection: "row",
    gap: Spacing.md,
    marginBottom: Spacing.md,
  },
  linkActionBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.md,
  },
  linkActionText: { ...Typography.label },
  refreshBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    marginTop: Spacing.sm,
  },
  refreshText: { ...Typography.label },
  instructions: { marginTop: Spacing.xl },
  instructionTitle: { ...Typography.label, marginBottom: Spacing.md },
  step: { flexDirection: "row", alignItems: "center", gap: Spacing.md, marginBottom: Spacing.sm },
  stepNumber: {
    width: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
  },
  stepNumberText: { ...Typography.label },
  stepText: { ...Typography.body, flex: 1 },
  deviceItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
  },
  deviceIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: "center",
    alignItems: "center",
    marginRight: Spacing.md,
  },
  deviceInfo: { flex: 1 },
  deviceName: { ...Typography.body },
  deviceLastActive: { ...Typography.small },
  unlinkBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: "center",
    alignItems: "center",
  },
});
