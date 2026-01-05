import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  Alert,
  ActivityIndicator,
  Pressable,
  Image,
} from "react-native";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { KeyboardAwareScrollViewCompat } from "@/components/KeyboardAwareScrollViewCompat";
import { useAuth } from "@/context/AuthContext";
import { useTheme } from "@/hooks/useTheme";
import { Colors, Spacing, BorderRadius, Typography } from "@/constants/theme";
import type { RootStackParamList } from "@/navigation/RootStackNavigator";

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

export default function LoginScreen() {
  const navigation = useNavigation<NavigationProp>();
  const { login } = useAuth();
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

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
