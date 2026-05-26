import React, { useState, useCallback, useEffect } from "react";
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  Alert,
  ActivityIndicator,
  Pressable,
  Platform,
  Modal,
} from "react-native";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import * as AuthSession from "expo-auth-session";
import * as WebBrowser from "expo-web-browser";
import * as AppleAuthentication from "expo-apple-authentication";
import * as Crypto from "expo-crypto";
import { KeyboardAwareScrollViewCompat } from "@/components/KeyboardAwareScrollViewCompat";
import { useAuth } from "@/context/AuthContext";
import { useTheme } from "@/hooks/useTheme";
import { warmUpBackend } from "@/lib/api";
import { getApiUrl } from "@/lib/query-client";
import { Colors, Spacing, BorderRadius, Typography } from "@/constants/theme";
import type { RootStackParamList } from "@/navigation/RootStackNavigator";

WebBrowser.maybeCompleteAuthSession();

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

const GOOGLE_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID || "1018674231904-qjp0qr7bvc3sh792mq74inbf02gdqtkb.apps.googleusercontent.com";

export default function LoginScreen() {
  const navigation = useNavigation<NavigationProp>();
  const { login, googleSignIn, loginWithToken } = useAuth();
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState("");
  const [googleLoading, setGoogleLoading] = useState(false);
  const [googleError, setGoogleError] = useState<string | null>(null);
  const [appleLoading, setAppleLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showForgotModal, setShowForgotModal] = useState(false);
  const [forgotEmail, setForgotEmail] = useState("");
  const [forgotLoading, setForgotLoading] = useState(false);
  const [forgotSent, setForgotSent] = useState(false);
  const [isAppleAvailable, setIsAppleAvailable] = useState(false);
  const [showLinkModal, setShowLinkModal] = useState(false);
  const [linkPassword, setLinkPassword] = useState("");
  const [linkPasswordVisible, setLinkPasswordVisible] = useState(false);
  const [linkLoading, setLinkLoading] = useState(false);
  const [linkError, setLinkError] = useState<string | null>(null);
  const [pendingGoogleParams, setPendingGoogleParams] = useState<{ name: string; email: string; accessToken?: string } | null>(null);

  // QR device linking (web only)
  const [showQrLogin, setShowQrLogin] = useState(false);
  const [qrToken, setQrToken] = useState<string | null>(null);
  const [qrUrl, setQrUrl] = useState<string | null>(null);
  const [qrStatus, setQrStatus] = useState<"idle" | "loading" | "waiting" | "expired">("idle");
  const qrPollRef = React.useRef<ReturnType<typeof setInterval> | null>(null);

  const stopQrPoll = () => {
    if (qrPollRef.current) {
      clearInterval(qrPollRef.current);
      qrPollRef.current = null;
    }
  };

  const startQrLogin = async () => {
    setShowQrLogin(true);
    setQrStatus("loading");
    setQrToken(null);
    setQrUrl(null);
    stopQrPoll();
    try {
      const baseUrl = getApiUrl();
      const res = await fetch(`${baseUrl}/api/device-link/generate`, { method: "POST", headers: { "Content-Type": "application/json" } });
      const data = await res.json();
      if (!data.success) throw new Error(data.error || "Failed to generate QR");
      setQrToken(data.token);
      setQrUrl(data.qr_url);
      setQrStatus("waiting");
      qrPollRef.current = setInterval(async () => {
        try {
          const pollRes = await fetch(`${baseUrl}/api/device-link/status?token=${data.token}`);
          const pollData = await pollRes.json();
          if (pollData.status === "approved" && pollData.authToken && pollData.user) {
            stopQrPoll();
            setShowQrLogin(false);
            const userData = { id: pollData.user.id || "", name: pollData.user.name || "", email: pollData.user.email || "" };
            await loginWithToken(pollData.authToken, userData);
          } else if (pollData.status === "expired") {
            stopQrPoll();
            setQrStatus("expired");
          }
        } catch {}
      }, 2000);
    } catch (err: any) {
      setQrStatus("idle");
      Alert.alert("Error", err.message || "Could not generate QR code");
    }
  };

  useEffect(() => {
    return () => stopQrPoll();
  }, []);

  useEffect(() => {
    warmUpBackend();
    if (Platform.OS === "ios") {
      AppleAuthentication.isAvailableAsync().then(setIsAppleAvailable).catch(() => setIsAppleAvailable(false));
    }
  }, []);

  // Web: handle Google OAuth redirect callback (implicit flow via URL hash)
  useEffect(() => {
    if (Platform.OS !== "web" || typeof window === "undefined") return;
    const hash = window.location.hash.substring(1);
    if (!hash) return;
    const params = new URLSearchParams(hash);
    const accessToken = params.get("access_token");
    const googleErrorParam = params.get("error");
    const errorDescription = params.get("error_description");
    const savedState = sessionStorage.getItem("google_oauth_state");
    const returnedState = params.get("state");

    // Google returned an error (e.g. redirect_uri_mismatch, access_denied)
    if (googleErrorParam) {
      window.history.replaceState(null, "", window.location.pathname);
      sessionStorage.removeItem("google_oauth_state");
      const msg = errorDescription
        ? decodeURIComponent(errorDescription.replace(/\+/g, " "))
        : googleErrorParam === "access_denied"
        ? "Sign-in was cancelled."
        : `Google sign-in error: ${googleErrorParam}`;
      setGoogleError(msg);
      return;
    }

    if (!accessToken) return;
    if (savedState && returnedState && savedState !== returnedState) {
      setGoogleError("Sign-in failed: security state mismatch. Please try again.");
      window.history.replaceState(null, "", window.location.pathname);
      return;
    }
    // Clear hash immediately so refresh doesn't re-trigger
    window.history.replaceState(null, "", window.location.pathname);
    sessionStorage.removeItem("google_oauth_state");
    setGoogleLoading(true);
    setGoogleError(null);
    (async () => {
      try {
        console.log("[Google Auth Web] Got access token, fetching user info");
        const userInfoRes = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
          headers: { Authorization: `Bearer ${accessToken}` },
        });
        const userInfo = await userInfoRes.json();
        console.log("[Google Auth Web] User:", userInfo.email);
        const googleParams = {
          name: userInfo.name || userInfo.given_name || "User",
          email: userInfo.email,
          accessToken,
        };
        const signInResult = await googleSignIn(googleParams);
        console.log("[Google Auth Web] Backend result:", signInResult);
        if (!signInResult.success) {
          if (signInResult.accountExists) {
            setPendingGoogleParams(googleParams);
            setShowLinkModal(true);
          } else {
            setGoogleError(signInResult.error || "Could not sign in with Google");
          }
        }
      } catch (error: any) {
        console.error("[Google Auth Web] Error:", error);
        setGoogleError(error?.message || "Something went wrong. Please try again.");
      } finally {
        setGoogleLoading(false);
      }
    })();
  }, [googleSignIn]);

  // Native only: expo-auth-session
  const redirectUri = AuthSession.makeRedirectUri({ projectNameForProxy: "@varah/ermate" });
  const discovery = AuthSession.useAutoDiscovery("https://accounts.google.com");
  const [request, response, promptAsync] = AuthSession.useAuthRequest(
    {
      clientId: GOOGLE_CLIENT_ID,
      redirectUri,
      scopes: ["openid", "profile", "email"],
      responseType: AuthSession.ResponseType.Code,
      usePKCE: true,
    },
    discovery
  );

  React.useEffect(() => {
    if (Platform.OS === "web") return;
    if (!response) return;
    if (response.type === "error") {
      setGoogleError(response.error?.message || "Google authorisation failed");
      setGoogleLoading(false);
      return;
    }
    if (response.type === "dismiss") {
      setGoogleLoading(false);
      return;
    }
    if (response.type === "success" && response.params?.code && request) {
      const code = response.params.code;
      (async () => {
        setGoogleLoading(true);
        setGoogleError(null);
        try {
          const tokenResponse = await AuthSession.exchangeCodeAsync(
            {
              clientId: GOOGLE_CLIENT_ID,
              redirectUri,
              code,
              extraParams: { code_verifier: request.codeVerifier ?? "" },
            },
            discovery!
          );
          const accessToken = tokenResponse.accessToken;
          const userInfoRes = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
            headers: { Authorization: `Bearer ${accessToken}` },
          });
          const userInfo = await userInfoRes.json();
          const signInResult = await googleSignIn({
            name: userInfo.name || userInfo.given_name || "User",
            email: userInfo.email,
            accessToken,
          });
          if (!signInResult.success) {
            setGoogleError(signInResult.error || "Could not sign in with Google");
          }
        } catch (error: any) {
          setGoogleError(error?.message || "Something went wrong during Google sign-in");
        } finally {
          setGoogleLoading(false);
        }
      })();
    }
  }, [response, googleSignIn, request, redirectUri, discovery]);

  const handleLogin = async () => {
    if (!email || !password) {
      Alert.alert("Required", "Please enter both email and password");
      return;
    }
    setLoading(true);
    setLoadingMessage("Connecting to server...");
    const slowTimer = setTimeout(() => {
      setLoadingMessage("Server is waking up, please wait...");
    }, 5000);
    const verySlowTimer = setTimeout(() => {
      setLoadingMessage("Almost there, hang tight...");
    }, 15000);
    try {
      let result = await login(email.trim().toLowerCase(), password);
      if (!result.success && result.error?.includes("taking too long")) {
        setLoadingMessage("Retrying connection...");
        result = await login(email.trim().toLowerCase(), password);
      }
      if (!result.success) {
        Alert.alert("Login Failed", result.error || "Invalid credentials");
      }
    } finally {
      clearTimeout(slowTimer);
      clearTimeout(verySlowTimer);
      setLoading(false);
      setLoadingMessage("");
    }
  };

  const handleForgotPassword = async () => {
    if (!forgotEmail.trim()) {
      Alert.alert("Required", "Please enter your email address");
      return;
    }
    setForgotLoading(true);
    try {
      const { getApiUrl } = await import("@/lib/query-client");
      const url = new URL("/api/auth/forgot-password", getApiUrl());
      const res = await fetch(url.toString(), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: forgotEmail.trim().toLowerCase() }),
      });
      const data = await res.json().catch(() => ({}));
      setForgotSent(true);
    } catch {
      setForgotSent(true);
    } finally {
      setForgotLoading(false);
    }
  };

  const handleLinkAccount = async () => {
    if (!pendingGoogleParams || !linkPassword.trim()) return;
    setLinkLoading(true);
    setLinkError(null);
    try {
      const result = await googleSignIn({
        ...pendingGoogleParams,
        password: linkPassword.trim(),
      });
      if (result.success) {
        setShowLinkModal(false);
        setLinkPassword("");
        setPendingGoogleParams(null);
      } else {
        setLinkError(result.error || "Incorrect password. Please try again.");
      }
    } catch (error: any) {
      setLinkError(error?.message || "Something went wrong. Please try again.");
    } finally {
      setLinkLoading(false);
    }
  };

  const handleGoogleSignIn = useCallback(async () => {
    setGoogleError(null);
    if (Platform.OS === "web" && typeof window !== "undefined") {
      // Web: full-page redirect using implicit token flow (no popup, no code exchange needed)
      const state = Math.random().toString(36).substring(2) + Date.now().toString(36);
      sessionStorage.setItem("google_oauth_state", state);
      const params = new URLSearchParams({
        client_id: GOOGLE_CLIENT_ID,
        redirect_uri: window.location.origin,
        response_type: "token",
        scope: "openid profile email",
        state,
        include_granted_scopes: "true",
      });
      window.location.href = `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
      return;
    }
    setGoogleLoading(true);
    try {
      await promptAsync();
    } catch (error) {
      console.error("[LoginScreen] Google sign-in error:", error);
      setGoogleError("Something went wrong during Google sign-in");
      setGoogleLoading(false);
    }
  }, [promptAsync]);

  const handleAppleSignIn = async () => {
    setAppleLoading(true);
    try {
      const nonce = await Crypto.digestStringAsync(
        Crypto.CryptoDigestAlgorithm.SHA256,
        Math.random().toString(36).substring(2)
      );
      const credential = await AppleAuthentication.signInAsync({
        requestedScopes: [
          AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
          AppleAuthentication.AppleAuthenticationScope.EMAIL,
        ],
        nonce,
      });
      const fullName = credential.fullName
        ? `${credential.fullName.givenName || ""} ${credential.fullName.familyName || ""}`.trim()
        : "";
      const appleEmail = credential.email || "";
      const result = await googleSignIn({
        name: fullName || "Apple User",
        email: appleEmail || `apple_${credential.user}@privaterelay.appleid.com`,
        idToken: credential.identityToken || undefined,
      });
      if (!result.success) {
        Alert.alert("Sign In Failed", result.error || "Apple sign-in failed. Please try again.");
      }
    } catch (error: any) {
      if (error.code !== "ERR_REQUEST_CANCELED") {
        console.error("[LoginScreen] Apple sign-in error:", error);
        Alert.alert("Error", "Something went wrong during Apple sign-in");
      }
    } finally {
      setAppleLoading(false);
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.backgroundDefault }]}>
      <KeyboardAwareScrollViewCompat
        contentContainerStyle={[
          styles.content,
          { paddingTop: insets.top + Spacing["4xl"], paddingBottom: insets.bottom + Spacing["4xl"] },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <View style={[styles.iconContainer, { backgroundColor: theme.primary }]}>
            <Feather name="activity" size={40} color="#FFFFFF" />
          </View>
          <Text style={[styles.title, { color: theme.text }]}>ErMate</Text>
          <Text style={[styles.subtitle, { color: theme.textSecondary }]}>
            Emergency Room EMR
          </Text>
        </View>

        <Pressable
          style={({ pressed }) => [
            styles.googleButton,
            {
              backgroundColor: theme.card,
              borderColor: theme.border,
              opacity: pressed || googleLoading || !request ? 0.8 : 1,
            },
          ]}
          onPress={handleGoogleSignIn}
          disabled={googleLoading || !request}
        >
          {googleLoading ? (
            <ActivityIndicator color={theme.text} size="small" />
          ) : (
            <>
              <View style={styles.googleIconContainer}>
                <Text style={styles.googleG}>G</Text>
              </View>
              <Text style={[styles.googleButtonText, { color: theme.text }]}>
                Sign in with Google
              </Text>
            </>
          )}
        </Pressable>

        {googleError ? (
          <View style={[styles.errorBox, { backgroundColor: "#fee2e2", borderColor: "#fca5a5" }]}>
            <Text style={{ color: "#b91c1c", fontSize: 13, textAlign: "center" }}>
              {googleError}
            </Text>
          </View>
        ) : null}

        {isAppleAvailable ? (
          <Pressable
            style={({ pressed }) => [
              styles.appleButton,
              { opacity: pressed || appleLoading ? 0.8 : 1 },
            ]}
            onPress={handleAppleSignIn}
            disabled={appleLoading}
          >
            {appleLoading ? (
              <ActivityIndicator color="#FFFFFF" size="small" />
            ) : (
              <>
                <Feather name="command" size={20} color="#FFFFFF" />
                <Text style={styles.appleButtonText}>Sign in with Apple</Text>
              </>
            )}
          </Pressable>
        ) : null}

        <View style={styles.dividerRow}>
          <View style={[styles.dividerLine, { backgroundColor: theme.border }]} />
          <Text style={[styles.dividerText, { color: theme.textMuted }]}>or</Text>
          <View style={[styles.dividerLine, { backgroundColor: theme.border }]} />
        </View>

        <View style={styles.form}>
          <View style={styles.inputGroup}>
            <Text style={[styles.label, { color: theme.text }]}>Email</Text>
            <View style={[styles.inputContainer, { backgroundColor: theme.card, borderColor: theme.border }]}>
              <Feather name="mail" size={20} color={theme.textMuted} style={styles.inputIcon} />
              <TextInput
                style={[styles.input, { color: theme.text }]}
                placeholder="Enter your email"
                placeholderTextColor={theme.textMuted}
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                autoComplete="email"
              />
            </View>
          </View>

          <View style={styles.inputGroup}>
            <Text style={[styles.label, { color: theme.text }]}>Password</Text>
            <View style={[styles.inputContainer, { backgroundColor: theme.card, borderColor: theme.border }]}>
              <Feather name="lock" size={20} color={theme.textMuted} style={styles.inputIcon} />
              <TextInput
                style={[styles.input, { color: theme.text }]}
                placeholder="Enter your password"
                placeholderTextColor={theme.textMuted}
                value={password}
                onChangeText={setPassword}
                secureTextEntry={!showPassword}
                autoCapitalize="none"
              />
              <Pressable onPress={() => setShowPassword(!showPassword)} style={styles.eyeButton}>
                <Feather name={showPassword ? "eye-off" : "eye"} size={20} color={theme.textMuted} />
              </Pressable>
            </View>
          </View>

          <Pressable
            onPress={() => {
              setForgotEmail(email);
              setForgotSent(false);
              setShowForgotModal(true);
            }}
            style={styles.forgotButton}
          >
            <Text style={[styles.forgotText, { color: theme.primary }]}>Forgot Password?</Text>
          </Pressable>
          <Pressable
            style={({ pressed }) => [
              styles.button,
              { backgroundColor: theme.primary, opacity: pressed || loading ? 0.8 : 1 },
            ]}
            onPress={handleLogin}
            disabled={loading}
          >
            {loading ? (
              <View style={styles.loadingRow}>
                <ActivityIndicator color="#FFFFFF" size="small" />
                <Text style={styles.loadingText}>Signing in...</Text>
              </View>
            ) : (
              <Text style={styles.buttonText}>Sign In</Text>
            )}
          </Pressable>
          {loading && loadingMessage ? (
            <Text style={[styles.loadingHint, { color: theme.textMuted }]}>{loadingMessage}</Text>
          ) : null}
          <Pressable
            style={({ pressed }) => [
              styles.secondaryButton,
              { opacity: pressed ? 0.7 : 1 },
            ]}
            onPress={() => navigation.navigate("Register")}
          >
            <Text style={[styles.secondaryButtonText, { color: theme.textSecondary }]}>
              Don't have an account?{" "}
              <Text style={{ color: theme.primary, fontWeight: "600" }}>Sign Up</Text>
            </Text>
          </Pressable>

          {Platform.OS === "web" ? (
            <View style={styles.qrSection}>
              <View style={styles.qrDividerRow}>
                <View style={[styles.dividerLine, { backgroundColor: theme.border }]} />
                <Text style={[styles.dividerText, { color: theme.textMuted }]}>or</Text>
                <View style={[styles.dividerLine, { backgroundColor: theme.border }]} />
              </View>
              {!showQrLogin ? (
                <Pressable
                  style={({ pressed }) => [styles.qrButton, { borderColor: theme.primary, opacity: pressed ? 0.7 : 1 }]}
                  onPress={startQrLogin}
                >
                  <Feather name="smartphone" size={18} color={theme.primary} />
                  <Text style={[styles.qrButtonText, { color: theme.primary }]}>Sign in with Phone QR</Text>
                </Pressable>
              ) : (
                <View style={[styles.qrBox, { backgroundColor: theme.card, borderColor: theme.border }]}>
                  <Text style={[styles.qrTitle, { color: theme.text }]}>Scan with ErMate on your phone</Text>
                  {qrStatus === "loading" ? (
                    <ActivityIndicator color={theme.primary} style={{ marginVertical: Spacing.xl }} />
                  ) : qrStatus === "expired" ? (
                    <View style={styles.qrExpiredBox}>
                      <Text style={[styles.qrExpiredText, { color: theme.error || "#ef4444" }]}>QR code expired</Text>
                      <Pressable style={[styles.qrRetryBtn, { backgroundColor: theme.primary }]} onPress={startQrLogin}>
                        <Text style={styles.qrRetryText}>Generate New QR</Text>
                      </Pressable>
                    </View>
                  ) : qrUrl ? (
                    <View style={styles.qrImageBox}>
                      {/* eslint-disable-next-line @typescript-eslint/no-var-requires */}
                      {React.createElement(require("react-native").Image, {
                        source: { uri: `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(qrUrl)}` },
                        style: styles.qrImage,
                        resizeMode: "contain",
                      })}
                      <Text style={[styles.qrHint, { color: theme.textMuted }]}>Open ErMate app → Profile → Link to Web → Approve this session</Text>
                    </View>
                  ) : null}
                  <Pressable onPress={() => { stopQrPoll(); setShowQrLogin(false); setQrStatus("idle"); }}>
                    <Text style={[styles.qrCancel, { color: theme.textMuted }]}>Cancel</Text>
                  </Pressable>
                </View>
              )}
            </View>
          ) : null}
        </View>

        <View style={styles.footer}>
          <Text style={[styles.footerText, { color: theme.textMuted }]}>
            For Emergency Medicine Professionals
          </Text>
        </View>
      </KeyboardAwareScrollViewCompat>
      <Modal
        visible={showForgotModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowForgotModal(false)}
      >
        <Pressable
          style={styles.modalOverlay}
          onPress={() => {
            setShowForgotModal(false);
            setForgotSent(false);
            setForgotEmail("");
          }}
        >
          <Pressable
            style={[styles.modalContent, { backgroundColor: theme.card }]}
            onPress={() => {}}
          >
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: theme.text }]}>
                {forgotSent ? "Check Your Email" : "Reset Password"}
              </Text>
              <Pressable onPress={() => { setShowForgotModal(false); setForgotSent(false); setForgotEmail(""); }}>
                <Feather name="x" size={24} color={theme.textMuted} />
              </Pressable>
            </View>
            {forgotSent ? (
              <View>
                <View style={[styles.successIcon, { backgroundColor: theme.primary + "20" }]}>
                  <Feather name="mail" size={32} color={theme.primary} />
                </View>
                <Text style={[styles.modalDesc, { color: theme.textSecondary, textAlign: "center" }]}>
                  If an account exists with this email, a password reset link has been sent. Please check your inbox and spam folder.
                </Text>
                <Pressable
                  style={[styles.modalButton, { backgroundColor: theme.primary }]}
                  onPress={() => { setShowForgotModal(false); setForgotSent(false); setForgotEmail(""); }}
                >
                  <Text style={styles.modalButtonText}>Done</Text>
                </Pressable>
              </View>
            ) : (
              <View>
                <Text style={[styles.modalDesc, { color: theme.textSecondary }]}>
                  Enter your email address and we'll send you a link to reset your password.
                </Text>
                <View style={[styles.inputContainer, { backgroundColor: theme.backgroundDefault, borderColor: theme.border }]}>
                  <Feather name="mail" size={20} color={theme.textMuted} style={styles.inputIcon} />
                  <TextInput
                    style={[styles.input, { color: theme.text }]}
                    placeholder="Enter your email"
                    placeholderTextColor={theme.textMuted}
                    value={forgotEmail}
                    onChangeText={setForgotEmail}
                    keyboardType="email-address"
                    autoCapitalize="none"
                    autoComplete="email"
                  />
                </View>
                <Pressable
                  style={[styles.modalButton, { backgroundColor: theme.primary, opacity: forgotLoading ? 0.7 : 1 }]}
                  onPress={handleForgotPassword}
                  disabled={forgotLoading}
                >
                  {forgotLoading ? (
                    <ActivityIndicator color="#FFFFFF" size="small" />
                  ) : (
                    <Text style={styles.modalButtonText}>Send Reset Link</Text>
                  )}
                </Pressable>
              </View>
            )}
          </Pressable>
        </Pressable>
      </Modal>

      {/* Link Google Account Modal */}
      <Modal
        visible={showLinkModal}
        transparent
        animationType="fade"
        onRequestClose={() => { setShowLinkModal(false); setLinkPassword(""); setLinkError(null); }}
      >
        <Pressable
          style={styles.modalOverlay}
          onPress={() => { setShowLinkModal(false); setLinkPassword(""); setLinkError(null); }}
        >
          <Pressable style={[styles.modalContent, { backgroundColor: theme.card }]} onPress={() => {}}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: theme.text }]}>Link Google Account</Text>
              <Pressable onPress={() => { setShowLinkModal(false); setLinkPassword(""); setLinkError(null); }}>
                <Feather name="x" size={24} color={theme.textMuted} />
              </Pressable>
            </View>

            <View style={[styles.successIcon, { backgroundColor: theme.primary + "20", marginBottom: Spacing.md }]}>
              <Feather name="link" size={28} color={theme.primary} />
            </View>

            <Text style={[styles.modalDesc, { color: theme.textSecondary, textAlign: "center" }]}>
              An account already exists for{"\n"}
              <Text style={{ fontWeight: "700", color: theme.text }}>{pendingGoogleParams?.email}</Text>
              {"\n\n"}Enter your existing password to sign in and link your Google account.
            </Text>

            {linkError ? (
              <View style={[styles.errorBox, { backgroundColor: "#fee2e2", borderColor: "#fca5a5", marginBottom: Spacing.md }]}>
                <Text style={{ color: "#b91c1c", fontSize: 13, textAlign: "center" }}>{linkError}</Text>
              </View>
            ) : null}

            <View style={[styles.inputContainer, { backgroundColor: theme.backgroundDefault, borderColor: theme.border, marginBottom: Spacing.sm }]}>
              <Feather name="lock" size={20} color={theme.textMuted} style={styles.inputIcon} />
              <TextInput
                style={[styles.input, { color: theme.text }]}
                placeholder="Your existing password"
                placeholderTextColor={theme.textMuted}
                value={linkPassword}
                onChangeText={setLinkPassword}
                secureTextEntry={!linkPasswordVisible}
                autoCapitalize="none"
                autoFocus
                onSubmitEditing={handleLinkAccount}
                returnKeyType="done"
              />
              <Pressable style={styles.eyeButton} onPress={() => setLinkPasswordVisible(v => !v)}>
                <Feather name={linkPasswordVisible ? "eye-off" : "eye"} size={20} color={theme.textMuted} />
              </Pressable>
            </View>

            <Pressable
              style={[styles.modalButton, { backgroundColor: theme.primary, opacity: linkLoading || !linkPassword.trim() ? 0.7 : 1 }]}
              onPress={handleLinkAccount}
              disabled={linkLoading || !linkPassword.trim()}
            >
              {linkLoading ? (
                <ActivityIndicator color="#FFFFFF" size="small" />
              ) : (
                <Text style={styles.modalButtonText}>Sign In and Link Google</Text>
              )}
            </Pressable>

            <Pressable
              style={[styles.secondaryButton]}
              onPress={() => { setShowLinkModal(false); setLinkPassword(""); setLinkError(null); }}
            >
              <Text style={[styles.secondaryButtonText, { color: theme.textMuted, fontSize: 13 }]}>
                Cancel — use email and password instead
              </Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flexGrow: 1,
    paddingHorizontal: Spacing.xl,
    justifyContent: "center",
  },
  header: {
    alignItems: "center",
    marginBottom: Spacing["4xl"],
  },
  iconContainer: {
    width: 80,
    height: 80,
    borderRadius: BorderRadius.xl,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: Spacing.lg,
  },
  title: {
    ...Typography.h1,
    marginBottom: Spacing.xs,
  },
  subtitle: {
    ...Typography.body,
  },
  googleButton: {
    height: Spacing.buttonHeight,
    borderRadius: BorderRadius.md,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    gap: Spacing.md,
  },
  errorBox: {
    padding: Spacing.md,
    borderRadius: BorderRadius.sm,
    borderWidth: 1,
    marginTop: Spacing.sm,
  },
  appleButton: {
    height: Spacing.buttonHeight,
    borderRadius: BorderRadius.md,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#000000",
    gap: Spacing.md,
    marginTop: Spacing.md,
  },
  appleButtonText: {
    color: "#FFFFFF",
    ...Typography.bodyMedium,
  },
  googleIconContainer: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: "#4285F4",
    justifyContent: "center",
    alignItems: "center",
  },
  googleG: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "700",
  },
  googleButtonText: {
    ...Typography.bodyMedium,
  },
  dividerRow: {
    flexDirection: "row",
    alignItems: "center",
    marginVertical: Spacing.xl,
    gap: Spacing.md,
  },
  dividerLine: {
    flex: 1,
    height: 1,
  },
  dividerText: {
    ...Typography.small,
  },
  form: {
    gap: Spacing.lg,
  },
  inputGroup: {
    gap: Spacing.sm,
  },
  label: {
    ...Typography.label,
  },
  inputContainer: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderRadius: BorderRadius.md,
    height: Spacing.inputHeight,
  },
  inputIcon: {
    marginLeft: Spacing.md,
  },
  input: {
    flex: 1,
    height: "100%",
    paddingHorizontal: Spacing.md,
    ...Typography.body,
  },
  eyeButton: {
    padding: Spacing.md,
  },
  button: {
    height: Spacing.buttonHeight,
    borderRadius: BorderRadius.md,
    justifyContent: "center",
    alignItems: "center",
    marginTop: Spacing.md,
  },
  buttonText: {
    color: "#FFFFFF",
    ...Typography.h4,
  },
  secondaryButton: {
    alignItems: "center",
    padding: Spacing.md,
  },
  secondaryButtonText: {
    ...Typography.body,
  },
  footer: {
    alignItems: "center",
    marginTop: Spacing["4xl"],
  },
  footerText: {
    ...Typography.caption,
  },
  loadingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
  },
  loadingText: {
    color: "#FFFFFF",
    ...Typography.bodyMedium,
  },
  loadingHint: {
    ...Typography.small,
    textAlign: "center",
    marginTop: Spacing.sm,
  },
  forgotButton: {
    alignSelf: "flex-end",
    marginTop: Spacing.xs,
  },
  forgotText: {
    ...Typography.small,
    fontWeight: "600",
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    alignItems: "center",
    padding: Spacing.xl,
  },
  modalContent: {
    width: "100%",
    maxWidth: 400,
    borderRadius: BorderRadius.lg,
    padding: Spacing.xl,
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: Spacing.lg,
  },
  modalTitle: {
    ...Typography.h3,
  },
  modalDesc: {
    ...Typography.body,
    marginBottom: Spacing.lg,
  },
  modalButton: {
    height: Spacing.buttonHeight,
    borderRadius: BorderRadius.md,
    justifyContent: "center",
    alignItems: "center",
    marginTop: Spacing.md,
  },
  modalButtonText: {
    color: "#FFFFFF",
    ...Typography.bodyMedium,
  },
  successIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    justifyContent: "center",
    alignItems: "center",
    alignSelf: "center",
    marginBottom: Spacing.lg,
  },
  qrSection: {
    marginTop: Spacing.lg,
  },
  qrDividerRow: {
    flexDirection: "row",
    alignItems: "center",
    marginVertical: Spacing.lg,
    gap: Spacing.md,
  },
  qrButton: {
    height: Spacing.buttonHeight,
    borderRadius: BorderRadius.md,
    borderWidth: 1.5,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: Spacing.sm,
  },
  qrButtonText: {
    ...Typography.bodyMedium,
    fontWeight: "600",
  },
  qrBox: {
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    padding: Spacing.lg,
    alignItems: "center",
    gap: Spacing.md,
  },
  qrTitle: {
    ...Typography.bodyMedium,
    fontWeight: "600",
    textAlign: "center",
  },
  qrImageBox: {
    alignItems: "center",
    gap: Spacing.sm,
  },
  qrImage: {
    width: 200,
    height: 200,
    borderRadius: BorderRadius.md,
  },
  qrHint: {
    ...Typography.small,
    textAlign: "center",
    maxWidth: 280,
  },
  qrExpiredBox: {
    alignItems: "center",
    gap: Spacing.md,
    paddingVertical: Spacing.md,
  },
  qrExpiredText: {
    ...Typography.body,
    fontWeight: "600",
  },
  qrRetryBtn: {
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.md,
  },
  qrRetryText: {
    color: "#FFFFFF",
    ...Typography.bodyMedium,
    fontWeight: "600",
  },
  qrCancel: {
    ...Typography.small,
    textDecorationLine: "underline",
  },
});
