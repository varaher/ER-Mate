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
} from "react-native";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import * as AuthSession from "expo-auth-session";
import * as WebBrowser from "expo-web-browser";
import * as Crypto from "expo-crypto";
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

  const redirectUri = AuthSession.makeRedirectUri({
    scheme: "ermate",
  });

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

  const handleGoogleSignIn = useCallback(async () => {
    setGoogleLoading(true);
    try {
      const state = Crypto.randomUUID();
      const nonce = Crypto.randomUUID();

      const params = new URLSearchParams({
        client_id: GOOGLE_CLIENT_ID,
        redirect_uri: redirectUri,
        response_type: "token",
        scope: "openid profile email",
        state,
        nonce,
        include_granted_scopes: "true",
      });

      const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;

      const result = await WebBrowser.openAuthSessionAsync(authUrl, redirectUri);

      if (result.type === "success" && result.url) {
        const hashFragment = result.url.split("#")[1];
        if (hashFragment) {
          const responseParams = new URLSearchParams(hashFragment);
          const accessToken = responseParams.get("access_token");

          if (accessToken) {
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
          } else {
            Alert.alert("Sign-In Error", "No access token received from Google");
          }
        } else {
          Alert.alert("Sign-In Error", "Invalid response from Google");
        }
      } else if (result.type === "cancel" || result.type === "dismiss") {
        // user cancelled
      }
    } catch (error) {
      console.error("[LoginScreen] Google sign-in error:", error);
      Alert.alert("Error", "Something went wrong during Google sign-in");
    } finally {
      setGoogleLoading(false);
    }
  }, [redirectUri, googleSignIn]);

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
});
