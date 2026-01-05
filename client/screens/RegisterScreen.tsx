import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  Alert,
  ActivityIndicator,
  Pressable,
} from "react-native";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { KeyboardAwareScrollViewCompat } from "@/components/KeyboardAwareScrollViewCompat";
import { useAuth } from "@/context/AuthContext";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius, Typography } from "@/constants/theme";
import type { RootStackParamList } from "@/navigation/RootStackNavigator";

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

export default function RegisterScreen() {
  const navigation = useNavigation<NavigationProp>();
  const { register } = useAuth();
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [hospital, setHospital] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const handleRegister = async () => {
    if (!name || !email || !password) {
      Alert.alert("Required", "Please fill in all required fields");
      return;
    }

    if (password !== confirmPassword) {
      Alert.alert("Error", "Passwords do not match");
      return;
    }

    if (password.length < 6) {
      Alert.alert("Error", "Password must be at least 6 characters");
      return;
    }

    setLoading(true);
    const result = await register({
      name: name.trim(),
      email: email.trim().toLowerCase(),
      password,
      hospital: hospital.trim() || undefined,
      role: "resident",
    });
    setLoading(false);

    if (!result.success) {
      Alert.alert("Registration Failed", result.error || "Please try again");
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.backgroundDefault }]}>
      <KeyboardAwareScrollViewCompat
        contentContainerStyle={[
          styles.content,
          { paddingTop: insets.top + Spacing["3xl"], paddingBottom: insets.bottom + Spacing["3xl"] },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <Pressable
            style={({ pressed }) => [styles.backButton, { opacity: pressed ? 0.7 : 1 }]}
            onPress={() => navigation.goBack()}
          >
            <Feather name="arrow-left" size={24} color={theme.text} />
          </Pressable>
          <Text style={[styles.title, { color: theme.text }]}>Create Account</Text>
          <Text style={[styles.subtitle, { color: theme.textSecondary }]}>
            Join ErMate for Emergency Care
          </Text>
        </View>

        <View style={styles.form}>
          <View style={styles.inputGroup}>
            <Text style={[styles.label, { color: theme.text }]}>Full Name *</Text>
            <View style={[styles.inputContainer, { backgroundColor: theme.card, borderColor: theme.border }]}>
              <Feather name="user" size={20} color={theme.textMuted} style={styles.inputIcon} />
              <TextInput
                style={[styles.input, { color: theme.text }]}
                placeholder="Dr. John Doe"
                placeholderTextColor={theme.textMuted}
                value={name}
                onChangeText={setName}
                autoCapitalize="words"
              />
            </View>
          </View>

          <View style={styles.inputGroup}>
            <Text style={[styles.label, { color: theme.text }]}>Email *</Text>
            <View style={[styles.inputContainer, { backgroundColor: theme.card, borderColor: theme.border }]}>
              <Feather name="mail" size={20} color={theme.textMuted} style={styles.inputIcon} />
              <TextInput
                style={[styles.input, { color: theme.text }]}
                placeholder="doctor@hospital.com"
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
            <Text style={[styles.label, { color: theme.text }]}>Hospital/Institution</Text>
            <View style={[styles.inputContainer, { backgroundColor: theme.card, borderColor: theme.border }]}>
              <Feather name="home" size={20} color={theme.textMuted} style={styles.inputIcon} />
              <TextInput
                style={[styles.input, { color: theme.text }]}
                placeholder="City General Hospital"
                placeholderTextColor={theme.textMuted}
                value={hospital}
                onChangeText={setHospital}
              />
            </View>
          </View>

          <View style={styles.inputGroup}>
            <Text style={[styles.label, { color: theme.text }]}>Password *</Text>
            <View style={[styles.inputContainer, { backgroundColor: theme.card, borderColor: theme.border }]}>
              <Feather name="lock" size={20} color={theme.textMuted} style={styles.inputIcon} />
              <TextInput
                style={[styles.input, { color: theme.text }]}
                placeholder="Min 6 characters"
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

          <View style={styles.inputGroup}>
            <Text style={[styles.label, { color: theme.text }]}>Confirm Password *</Text>
            <View style={[styles.inputContainer, { backgroundColor: theme.card, borderColor: theme.border }]}>
              <Feather name="lock" size={20} color={theme.textMuted} style={styles.inputIcon} />
              <TextInput
                style={[styles.input, { color: theme.text }]}
                placeholder="Re-enter password"
                placeholderTextColor={theme.textMuted}
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                secureTextEntry={!showPassword}
                autoCapitalize="none"
              />
            </View>
          </View>

          <Pressable
            style={({ pressed }) => [
              styles.button,
              { backgroundColor: theme.primary, opacity: pressed || loading ? 0.8 : 1 },
            ]}
            onPress={handleRegister}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={styles.buttonText}>Create Account</Text>
            )}
          </Pressable>

          <Pressable
            style={({ pressed }) => [styles.secondaryButton, { opacity: pressed ? 0.7 : 1 }]}
            onPress={() => navigation.goBack()}
          >
            <Text style={[styles.secondaryButtonText, { color: theme.textSecondary }]}>
              Already have an account?{" "}
              <Text style={{ color: theme.primary, fontWeight: "600" }}>Sign In</Text>
            </Text>
          </Pressable>
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
  },
  header: {
    marginBottom: Spacing["2xl"],
  },
  backButton: {
    padding: Spacing.sm,
    marginLeft: -Spacing.sm,
    marginBottom: Spacing.lg,
    alignSelf: "flex-start",
  },
  title: {
    ...Typography.h1,
    marginBottom: Spacing.xs,
  },
  subtitle: {
    ...Typography.body,
  },
  form: {
    gap: Spacing.md,
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
});
