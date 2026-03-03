import React, { useState, useCallback } from "react";
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
import { KeyboardAwareScrollViewCompat } from "@/components/KeyboardAwareScrollViewCompat";
import { useAuth } from "@/context/AuthContext";
import { useTheme } from "@/hooks/useTheme";
import { Colors, Spacing, BorderRadius, Typography } from "@/constants/theme";
import type { RootStackParamList } from "@/navigation/RootStackNavigator";

WebBrowser.maybeCompleteAuthSession();

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

const GOOGLE_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID || "1018674231904-qjp0qr7bvc3sh792mq74inbf02gdqtkb.apps.googleusercontent.com";

export default function LoginScreen() {
  const navigation = useNavigation<NavigationProp>();
  const { login, googleSignIn } = useAuth();
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showForgotModal, setShowForgotModal] = useState(false);
  const [forgotEmail, setForgotEmail] = useState("");
  const [forgotLoading, setForgotLoading] = useState(false);
  const [forgotSent, setForgotSent] = useState(false);

  const useProxy = Platform.OS !== "web";
  const redirectUri = AuthSession.makeRedirectUri({
    scheme: "ermate",
    path: "auth",
    ...(useProxy ? { projectNameForProxy: "@anonymous/ermate" } : {}),
  });

  console.log("[LoginScreen] Redirect URI:", redirectUri, "Platform:", Platform.OS, "useProxy:", useProxy);

  const discovery = AuthSession.useAutoDiscovery("https://accounts.google.com");

  const [request, response, promptAsync] = AuthSession.useAuthRequest(
    {
      clientId: GOOGLE_CLIENT_ID,
      redirectUri,
      scopes: ["openid", "profile", "email"],
      responseType: AuthSession.ResponseType.Token,
    },
    discovery
  );

  React.useEffect(() => {
    if (response?.type === "success" && response.authentication?.accessToken) {
      const accessToken = response.authentication.accessToken;
      (async () => {
        setGoogleLoading(true);
        try {
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
            Alert.alert("Sign-In Failed", signInResult.error || "Could not sign in with Google");
          }
        } catch (error) {
          console.error("[LoginScreen] Google sign-in error:", error);
          Alert.alert("Error", "Something went wrong during Google sign-in");
        } finally {
          setGoogleLoading(false);
        }
      })();
    }
  }, [response, googleSignIn]);

  const handleLogin = async () => {
    if (!email || !password) {
      Alert.alert("Required", "Please enter both email and password");
      return;
    }
    setLoading(true);
    const result = await login(email.trim().toLowerCase(), password);
    setLoading(false);
    if (!result.success) {
      Alert.alert("Login Failed", result.error || "Invalid credentials");
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

  const handleGoogleSignIn = useCallback(async () => {
    setGoogleLoading(true);
    try {
      await promptAsync();
    } catch (error) {
      console.error("[LoginScreen] Google sign-in error:", error);
      Alert.alert("Error", "Something went wrong during Google sign-in");
      setGoogleLoading(false);
    }
  }, [promptAsync]);

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
              opacity: pressed || googleLoading ? 0.8 : 1,
            },
          ]}
          onPress={handleGoogleSignIn}
          disabled={googleLoading}
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
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={styles.buttonText}>Sign In</Text>
            )}
          </Pressable>

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
});
