import React, { useState, useEffect, useRef } from "react";
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
import { useHeaderHeight } from "@react-navigation/elements";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import * as Clipboard from "expo-clipboard";
import * as Linking from "expo-linking";
import { CameraView, useCameraPermissions } from "expo-camera";
import { useTheme } from "@/hooks/useTheme";
import { useAuth } from "@/context/AuthContext";
import { getApiUrl } from "@/lib/query-client";
import { Spacing, BorderRadius, Typography, TriageColors } from "@/constants/theme";

type Tab = "scan" | "share";

export default function LinkDevicesScreen() {
  const navigation = useNavigation();
  const { theme } = useTheme();
  const { user, token } = useAuth();
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();

  const [activeTab, setActiveTab] = useState<Tab>("scan");

  // ── Scan tab state
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();
  const [scanning, setScanning] = useState(false);
  const [approving, setApproving] = useState(false);
  const [approved, setApproved] = useState(false);
  const scannedRef = useRef(false);

  // ── Share tab state
  const [loading, setLoading] = useState(false);
  const [linkCode, setLinkCode] = useState<string | null>(null);
  const [linkUrl, setLinkUrl] = useState<string | null>(null);
  const [expiresIn, setExpiresIn] = useState(300);

  // Reset scan state when switching back to scan tab
  useEffect(() => {
    if (activeTab === "scan") {
      scannedRef.current = false;
      setApproving(false);
      setApproved(false);
      setScanning(false);
    }
  }, [activeTab]);

  // Share-tab expiry countdown
  useEffect(() => {
    if (expiresIn > 0 && linkCode) {
      const timer = setInterval(() => {
        setExpiresIn((prev) => {
          if (prev <= 1) {
            setLinkCode(null);
            setLinkUrl(null);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
      return () => clearInterval(timer);
    }
  }, [expiresIn, linkCode]);

  // ── QR scan handler ─────────────────────────────────
  const handleBarCodeScanned = async ({ data }: { data: string }) => {
    if (scannedRef.current || approving || approved) return;
    scannedRef.current = true;
    setScanning(false);

    // Extract qr_token from URL
    let qrToken: string | null = null;
    try {
      const url = new URL(data);
      qrToken = url.searchParams.get("qr_token");
    } catch {
      // data might just be a plain token
      qrToken = data.trim();
    }

    if (!qrToken) {
      Alert.alert("Invalid QR", "This QR code is not an ErMate desktop link. Please scan the QR from ermate.in/web.", [
        { text: "Scan Again", onPress: () => { scannedRef.current = false; setScanning(true); } },
      ]);
      return;
    }

    if (!user || !token) {
      Alert.alert("Not Signed In", "Please sign in first.");
      return;
    }

    setApproving(true);
    try {
      const baseUrl = getApiUrl();
      const res = await fetch(`${baseUrl}/api/device-link/approve`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ token: qrToken }),
      });

      const result = await res.json();

      if (result.success) {
        setApproved(true);
      } else {
        throw new Error(result.error || "Failed to approve session");
      }
    } catch (err: any) {
      Alert.alert(
        "Link Failed",
        err.message === "QR code expired"
          ? "This QR code has expired. Please refresh the desktop page and scan the new code."
          : err.message || "Could not link device. Please try again.",
        [{ text: "Try Again", onPress: () => { scannedRef.current = false; setApproving(false); } }]
      );
    } finally {
      setApproving(false);
    }
  };

  // ── Share-code helpers ──────────────────────────────
  const generateLinkCode = async () => {
    if (!user || !token) {
      Alert.alert("Not Signed In", "Please sign in first to generate a link code.");
      return;
    }
    setLoading(true);
    try {
      const baseUrl = getApiUrl();
      const response = await fetch(`${baseUrl}/api/auth/generate-link-code`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: user.id, userEmail: user.email, userName: user.name, token }),
      });
      const result = await response.json();
      if (result.success && result.data) {
        setLinkCode(result.data.code);
        setLinkUrl(result.data.url);
        setExpiresIn(result.data.expires_in || 300);
      } else {
        throw new Error(result.error || "Failed to generate link code");
      }
    } catch (err: any) {
      Alert.alert("Link Generation Failed", err.message || "Unable to generate link code. Please try again.");
      setLinkCode(null);
      setLinkUrl(null);
    } finally {
      setLoading(false);
    }
  };

  const copyCode = async () => {
    if (linkCode) {
      await Clipboard.setStringAsync(linkCode);
      Alert.alert("Copied!", "Link code copied to clipboard.");
    }
  };

  const copyLinkUrl = async () => {
    if (linkUrl) {
      await Clipboard.setStringAsync(linkUrl);
      Alert.alert("Copied!", "Link URL copied to clipboard. Open it in your browser.");
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

  const formatExpiry = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  // ── Scan tab rendering ──────────────────────────────
  const renderScanTab = () => {
    if (approved) {
      return (
        <View style={styles.approvedContainer}>
          <View style={[styles.approvedIcon, { backgroundColor: theme.successLight || "#d1fae5" }]}>
            <Feather name="check" size={36} color={theme.success || "#22c55e"} />
          </View>
          <Text style={[styles.approvedTitle, { color: theme.success || "#22c55e" }]}>Desktop Linked!</Text>
          <Text style={[styles.approvedSub, { color: theme.textSecondary }]}>
            Your desktop browser should now load your cases automatically.
          </Text>
          <Pressable
            style={[styles.scanAgainBtn, { borderColor: theme.primary }]}
            onPress={() => {
              scannedRef.current = false;
              setApproved(false);
              setApproving(false);
            }}
          >
            <Feather name="refresh-cw" size={16} color={theme.primary} />
            <Text style={[styles.scanAgainText, { color: theme.primary }]}>Link Another Device</Text>
          </Pressable>
        </View>
      );
    }

    if (approving) {
      return (
        <View style={styles.approvingContainer}>
          <ActivityIndicator size="large" color={theme.primary} />
          <Text style={[styles.approvingText, { color: theme.textSecondary }]}>Linking desktop session...</Text>
        </View>
      );
    }

    if (!cameraPermission) {
      return (
        <View style={styles.permissionContainer}>
          <ActivityIndicator color={theme.primary} />
        </View>
      );
    }

    if (!cameraPermission.granted) {
      if (cameraPermission.status === "denied" && !cameraPermission.canAskAgain) {
        return (
          <View style={styles.permissionContainer}>
            <Feather name="camera-off" size={40} color={theme.textMuted} />
            <Text style={[styles.permissionTitle, { color: theme.text }]}>Camera Access Required</Text>
            <Text style={[styles.permissionSub, { color: theme.textSecondary }]}>
              Enable camera access in Settings to scan QR codes.
            </Text>
            {Platform.OS !== "web" ? (
              <Pressable
                style={[styles.permBtn, { backgroundColor: theme.primary }]}
                onPress={async () => {
                  try { await Linking.openSettings(); } catch {}
                }}
              >
                <Text style={styles.permBtnText}>Open Settings</Text>
              </Pressable>
            ) : null}
          </View>
        );
      }
      return (
        <View style={styles.permissionContainer}>
          <Feather name="camera" size={40} color={theme.textMuted} />
          <Text style={[styles.permissionTitle, { color: theme.text }]}>Camera permission needed</Text>
          <Text style={[styles.permissionSub, { color: theme.textSecondary }]}>
            Allow camera access to scan the QR code on your desktop.
          </Text>
          <Pressable
            style={[styles.permBtn, { backgroundColor: theme.primary }]}
            onPress={requestCameraPermission}
          >
            <Text style={styles.permBtnText}>Allow Camera</Text>
          </Pressable>
        </View>
      );
    }

    return (
      <View style={styles.cameraContainer}>
        <CameraView
          style={styles.camera}
          barcodeScannerSettings={{ barcodeTypes: ["qr"] }}
          onBarcodeScanned={handleBarCodeScanned}
        />
        <View style={styles.scanOverlay}>
          <View style={[styles.scanFrame, { borderColor: theme.primary }]}>
            <View style={[styles.corner, styles.cornerTL, { borderColor: theme.primary }]} />
            <View style={[styles.corner, styles.cornerTR, { borderColor: theme.primary }]} />
            <View style={[styles.corner, styles.cornerBL, { borderColor: theme.primary }]} />
            <View style={[styles.corner, styles.cornerBR, { borderColor: theme.primary }]} />
          </View>
        </View>
        <View style={[styles.scanHintBar, { backgroundColor: "rgba(0,0,0,0.6)" }]}>
          <Text style={styles.scanHintText}>Point at the QR code on your desktop browser</Text>
        </View>
      </View>
    );
  };

  // ── Share tab rendering ─────────────────────────────
  const renderShareTab = () => (
    <View>
      {!linkCode ? (
        <Pressable
          style={({ pressed }) => [
            styles.generateBtn,
            { backgroundColor: theme.primary, opacity: pressed || loading ? 0.8 : 1 },
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
          <Pressable onPress={copyCode} style={[styles.codeBox, { backgroundColor: theme.backgroundDefault }]}>
            <Text style={[styles.codeText, { color: theme.primary }]}>{linkCode}</Text>
            <Text style={[styles.expiryText, { color: expiresIn < 60 ? TriageColors.red : theme.textSecondary }]}>
              Expires in {formatExpiry(expiresIn)}
            </Text>
            <Text style={[styles.tapToCopy, { color: theme.textMuted }]}>Tap to copy code</Text>
          </Pressable>

          <View style={styles.linkActions}>
            <Pressable style={[styles.linkActionBtn, { backgroundColor: theme.primaryLight }]} onPress={copyLinkUrl}>
              <Feather name="copy" size={18} color={theme.primary} />
              <Text style={[styles.linkActionText, { color: theme.primary }]}>Copy Link</Text>
            </Pressable>
            <Pressable
              style={[styles.linkActionBtn, { backgroundColor: theme.successLight || theme.primaryLight }]}
              onPress={openInBrowser}
            >
              <Feather name="external-link" size={18} color={theme.success || theme.primary} />
              <Text style={[styles.linkActionText, { color: theme.success || theme.primary }]}>Open Web</Text>
            </Pressable>
          </View>

          <Pressable style={[styles.refreshBtn, { borderColor: theme.primary }]} onPress={generateLinkCode}>
            <Feather name="refresh-cw" size={16} color={theme.primary} />
            <Text style={[styles.refreshText, { color: theme.primary }]}>Generate New Code</Text>
          </Pressable>
        </View>
      )}

      <View style={[styles.instructions, { marginTop: Spacing.xl }]}>
        <Text style={[styles.instructionTitle, { color: theme.text }]}>How to link using a code:</Text>
        {[
          "On your computer, open the ErMate web app",
          "Tap \"Enter Code\" tab on the web page",
          "Tap the button above to generate your link code",
          "Enter the 6-digit code on the web page",
        ].map((step, i) => (
          <View key={i} style={styles.step}>
            <View style={[styles.stepNumber, { backgroundColor: theme.primaryLight }]}>
              <Text style={[styles.stepNumberText, { color: theme.primary }]}>{i + 1}</Text>
            </View>
            <Text style={[styles.stepText, { color: theme.textSecondary }]}>{step}</Text>
          </View>
        ))}
      </View>
    </View>
  );

  return (
    <View style={[styles.container, { backgroundColor: theme.backgroundDefault }]}>
      <ScrollView
        contentContainerStyle={[styles.content, { paddingTop: headerHeight + 12, paddingBottom: insets.bottom + 40 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Info card */}
        <View style={[styles.infoCard, { backgroundColor: theme.primaryLight }]}>
          <Feather name="monitor" size={28} color={theme.primary} />
          <Text style={[styles.infoTitle, { color: theme.primary }]}>Link to Desktop</Text>
          <Text style={[styles.infoText, { color: theme.text }]}>
            Access ErMate from your computer. Your phone only approves the session once — desktop works independently after that.
          </Text>
        </View>

        {/* Tab bar */}
        <View style={[styles.tabBar, { backgroundColor: theme.card }]}>
          <Pressable
            style={[styles.tabItem, activeTab === "scan" && { backgroundColor: theme.primary }]}
            onPress={() => setActiveTab("scan")}
          >
            <Feather name="camera" size={16} color={activeTab === "scan" ? "#fff" : theme.textSecondary} />
            <Text style={[styles.tabLabel, { color: activeTab === "scan" ? "#fff" : theme.textSecondary }]}>
              Scan QR
            </Text>
          </Pressable>
          <Pressable
            style={[styles.tabItem, activeTab === "share" && { backgroundColor: theme.primary }]}
            onPress={() => setActiveTab("share")}
          >
            <Feather name="hash" size={16} color={activeTab === "share" ? "#fff" : theme.textSecondary} />
            <Text style={[styles.tabLabel, { color: activeTab === "share" ? "#fff" : theme.textSecondary }]}>
              Share Code
            </Text>
          </Pressable>
        </View>

        {/* Tab content */}
        <View style={[styles.section, { backgroundColor: theme.card }]}>
          {activeTab === "scan" ? renderScanTab() : renderShareTab()}
        </View>
      </ScrollView>
    </View>
  );
}

const CORNER_SIZE = 22;
const CORNER_WIDTH = 3;

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { paddingHorizontal: Spacing.lg },

  infoCard: {
    alignItems: "center",
    padding: Spacing.lg,
    borderRadius: BorderRadius.lg,
    marginBottom: Spacing.md,
    gap: Spacing.xs,
  },
  infoTitle: { ...Typography.h4, marginTop: Spacing.xs },
  infoText: { ...Typography.small, textAlign: "center" },

  tabBar: {
    flexDirection: "row",
    borderRadius: BorderRadius.md,
    padding: 4,
    marginBottom: Spacing.md,
    gap: 4,
  },
  tabItem: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.xs,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.sm,
  },
  tabLabel: { ...Typography.label },

  section: {
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    marginBottom: Spacing.lg,
    overflow: "hidden",
  },

  // Scan tab
  cameraContainer: {
    height: 280,
    borderRadius: BorderRadius.md,
    overflow: "hidden",
    position: "relative",
  },
  camera: { flex: 1 },
  scanOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "center",
    alignItems: "center",
  },
  scanFrame: {
    width: 180,
    height: 180,
    position: "relative",
  },
  corner: {
    position: "absolute",
    width: CORNER_SIZE,
    height: CORNER_SIZE,
    borderColor: "transparent",
  },
  cornerTL: { top: 0, left: 0, borderTopWidth: CORNER_WIDTH, borderLeftWidth: CORNER_WIDTH, borderTopLeftRadius: 4 },
  cornerTR: { top: 0, right: 0, borderTopWidth: CORNER_WIDTH, borderRightWidth: CORNER_WIDTH, borderTopRightRadius: 4 },
  cornerBL: { bottom: 0, left: 0, borderBottomWidth: CORNER_WIDTH, borderLeftWidth: CORNER_WIDTH, borderBottomLeftRadius: 4 },
  cornerBR: { bottom: 0, right: 0, borderBottomWidth: CORNER_WIDTH, borderRightWidth: CORNER_WIDTH, borderBottomRightRadius: 4 },
  scanHintBar: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    padding: Spacing.sm,
    alignItems: "center",
  },
  scanHintText: { ...Typography.small, color: "#fff" },

  permissionContainer: {
    alignItems: "center",
    paddingVertical: Spacing.xl,
    gap: Spacing.sm,
  },
  permissionTitle: { ...Typography.h4, marginTop: Spacing.xs },
  permissionSub: { ...Typography.small, textAlign: "center" },
  permBtn: {
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.xl,
    borderRadius: BorderRadius.md,
    marginTop: Spacing.sm,
  },
  permBtnText: { ...Typography.label, color: "#fff" },

  approvingContainer: {
    alignItems: "center",
    paddingVertical: Spacing.xl,
    gap: Spacing.md,
  },
  approvingText: { ...Typography.body },

  approvedContainer: {
    alignItems: "center",
    paddingVertical: Spacing.xl,
    gap: Spacing.sm,
  },
  approvedIcon: {
    width: 72,
    height: 72,
    borderRadius: 36,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: Spacing.sm,
  },
  approvedTitle: { ...Typography.h3 },
  approvedSub: { ...Typography.small, textAlign: "center" },
  scanAgainBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.lg,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    marginTop: Spacing.md,
  },
  scanAgainText: { ...Typography.label },

  // Share tab
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
    width: "100%",
  },
  codeText: { fontSize: 32, fontWeight: "700", letterSpacing: 8 },
  expiryText: { ...Typography.small, marginTop: Spacing.sm },
  tapToCopy: { ...Typography.caption, marginTop: Spacing.xs },
  linkActions: { flexDirection: "row", gap: Spacing.md, marginBottom: Spacing.md },
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

  instructions: {},
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
});
