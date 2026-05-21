import React, { useState, useRef } from "react";
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  Pressable,
  ActivityIndicator,
  Alert,
  ScrollView,
} from "react-native";
import { useNavigation, useRoute, RouteProp } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useHeaderHeight } from "@react-navigation/elements";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { useTheme } from "@/hooks/useTheme";
import { useAuth } from "@/context/AuthContext";
import { apiPost, invalidateCases } from "@/lib/api";
import { getApiUrl } from "@/lib/query-client";
import { Spacing, BorderRadius, Typography } from "@/constants/theme";
import type { RootStackParamList } from "@/navigation/RootStackNavigator";

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;
type RouteProps = RouteProp<RootStackParamList, "QuickCaseSheet">;

export default function QuickCaseSheetScreen() {
  const navigation = useNavigation<NavigationProp>();
  const route = useRoute<RouteProps>();
  const { theme } = useTheme();
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const caseType = route.params?.type || "adult";

  const [loading, setLoading] = useState(false);
  const nameRef = useRef("");
  const ageRef = useRef("");
  const [sex, setSex] = useState("Male");
  const uhidRef = useRef("");
  const phoneRef = useRef("");
  const hrRef = useRef("");
  const bpSysRef = useRef("");
  const bpDiaRef = useRef("");
  const spo2Ref = useRef("");

  const handleCreate = async () => {
    const name = nameRef.current.trim();
    const age = ageRef.current.trim();

    if (!name) {
      Alert.alert("Required", "Please enter the patient's name.");
      return;
    }
    if (!age) {
      Alert.alert("Required", "Please enter the patient's age.");
      return;
    }

    setLoading(true);
    try {
      const payload: any = {
        patient: {
          name,
          age,
          sex,
          uhid: uhidRef.current.trim() || "",
          phone: phoneRef.current.trim() || "",
          address: "Not provided",
          mode_of_arrival: "Walk-in",
          brought_by: "Self",
          informant_name: name,
          informant_reliability: "Reliable",
          identification_mark: "None noted",
          arrival_datetime: new Date().toISOString(),
        },
        vitals_at_arrival: {
          hr: parseInt(hrRef.current) || null,
          bp_systolic: parseInt(bpSysRef.current) || null,
          bp_diastolic: parseInt(bpDiaRef.current) || null,
          rr: null,
          spo2: parseInt(spo2Ref.current) || null,
          temperature: 36.8,
          gcs_e: 4,
          gcs_v: 5,
          gcs_m: 6,
          grbs: 100,
          pain_score: 0,
        },
        presenting_complaint: { text: "", onset_type: "", course: "", duration: "" },
        em_resident: user?.name || "",
        case_type: caseType === "pediatric" ? "pediatric" : "adult",
      };

      const res = await apiPost<any>("/cases", payload);

      if (res.success && res.data) {
        const caseId = res.data.id || res.data._id || res.data.case_id;
        await invalidateCases();

        if (user?.id) {
          try {
            const baseUrl = getApiUrl();
            await fetch(`${baseUrl}/api/subscription/increment-case`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ userId: user.id, userEmail: user.email || "" }),
            });
          } catch (e) {}
        }

        if (caseId) {
          const screenName = caseType === "pediatric" ? "PediatricCaseSheet" : "CaseSheet";
          navigation.replace(screenName, {
            caseId: String(caseId),
            patientType: caseType,
          });
        } else {
          Alert.alert("Error", "Case created but no ID returned.");
        }
      } else {
        const errorMsg = Array.isArray(res.error)
          ? res.error.map((e: any) => e.msg || e).join(", ")
          : (res.error || "Failed to create case");
        Alert.alert("Error", String(errorMsg));
      }
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err || "Failed to create case");
      Alert.alert("Error", errMsg);
    } finally {
      setLoading(false);
    }
  };

  const isPed = caseType === "pediatric";

  return (
    <View style={[styles.container, { backgroundColor: theme.backgroundDefault }]}>
      <ScrollView
        contentContainerStyle={[styles.content, { paddingTop: headerHeight + Spacing.md, paddingBottom: insets.bottom + Spacing["4xl"] }]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <View style={[styles.banner, { backgroundColor: isPed ? "#06b6d420" : `${theme.primary}20` }]}>
          <Feather name={isPed ? "heart" : "user"} size={24} color={isPed ? "#06b6d4" : theme.primary} />
          <View style={styles.bannerText}>
            <Text style={[styles.bannerTitle, { color: theme.text }]}>
              {isPed ? "Pediatric Case Sheet" : "Adult Case Sheet"}
            </Text>
            <Text style={[styles.bannerSubtitle, { color: theme.textSecondary }]}>
              Quick start without triage
            </Text>
          </View>
        </View>

        <Text style={[styles.sectionLabel, { color: theme.textSecondary }]}>Patient Details</Text>

        <View style={[styles.inputGroup, { backgroundColor: theme.card }]}>
          <Text style={[styles.label, { color: theme.textSecondary }]}>Name *</Text>
          <TextInput
            style={[styles.input, { backgroundColor: theme.backgroundSecondary, color: theme.text }]}
            placeholder="Patient name"
            placeholderTextColor={theme.textMuted}
            onChangeText={(t) => { nameRef.current = t; }}
            autoCapitalize="words"
          />
        </View>

        <View style={[styles.inputGroup, { backgroundColor: theme.card }]}>
          <Text style={[styles.label, { color: theme.textSecondary }]}>Age *</Text>
          <TextInput
            style={[styles.input, { backgroundColor: theme.backgroundSecondary, color: theme.text }]}
            placeholder="Age in years"
            placeholderTextColor={theme.textMuted}
            keyboardType="numeric"
            onChangeText={(t) => { ageRef.current = t; }}
          />
        </View>

        <View style={[styles.inputGroup, { backgroundColor: theme.card }]}>
          <Text style={[styles.label, { color: theme.textSecondary }]}>Sex</Text>
          <View style={styles.sexRow}>
            {["Male", "Female", "Other"].map((s) => (
              <Pressable
                key={s}
                style={[
                  styles.sexBtn,
                  {
                    backgroundColor: sex === s ? theme.primary : theme.backgroundSecondary,
                    borderColor: sex === s ? theme.primary : theme.border,
                  },
                ]}
                onPress={() => setSex(s)}
              >
                <Text style={[styles.sexBtnText, { color: sex === s ? "#FFFFFF" : theme.text }]}>{s}</Text>
              </Pressable>
            ))}
          </View>
        </View>

        <Text style={[styles.sectionLabel, { color: theme.textSecondary, marginTop: Spacing.md }]}>Vitals (Optional)</Text>
        <View style={[styles.inputGroup, { backgroundColor: theme.card }]}>
          <View style={styles.vitalsRow}>
            <View style={styles.vitalCell}>
              <Text style={[styles.vitalLabel, { color: theme.textSecondary }]}>HR (bpm)</Text>
              <TextInput
                style={[styles.vitalInput, { backgroundColor: theme.backgroundSecondary, color: theme.text }]}
                placeholder="--"
                placeholderTextColor={theme.textMuted}
                keyboardType="numeric"
                maxLength={3}
                onChangeText={(t) => { hrRef.current = t; }}
              />
            </View>
            <View style={[styles.vitalCell, { flex: 2 }]}>
              <Text style={[styles.vitalLabel, { color: theme.textSecondary }]}>BP (sys / dia)</Text>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                <TextInput
                  style={[styles.vitalInput, { backgroundColor: theme.backgroundSecondary, color: theme.text, flex: 1 }]}
                  placeholder="120"
                  placeholderTextColor={theme.textMuted}
                  keyboardType="numeric"
                  maxLength={3}
                  onChangeText={(t) => { bpSysRef.current = t; }}
                />
                <Text style={{ color: theme.textMuted, fontWeight: "700" }}>/</Text>
                <TextInput
                  style={[styles.vitalInput, { backgroundColor: theme.backgroundSecondary, color: theme.text, flex: 1 }]}
                  placeholder="80"
                  placeholderTextColor={theme.textMuted}
                  keyboardType="numeric"
                  maxLength={3}
                  onChangeText={(t) => { bpDiaRef.current = t; }}
                />
              </View>
            </View>
            <View style={styles.vitalCell}>
              <Text style={[styles.vitalLabel, { color: theme.textSecondary }]}>SpO2 (%)</Text>
              <TextInput
                style={[styles.vitalInput, { backgroundColor: theme.backgroundSecondary, color: theme.text }]}
                placeholder="--"
                placeholderTextColor={theme.textMuted}
                keyboardType="numeric"
                maxLength={3}
                onChangeText={(t) => { spo2Ref.current = t; }}
              />
            </View>
          </View>
        </View>

        <View style={[styles.inputGroup, { backgroundColor: theme.card }]}>
          <Text style={[styles.label, { color: theme.textSecondary }]}>UHID (Optional)</Text>
          <TextInput
            style={[styles.input, { backgroundColor: theme.backgroundSecondary, color: theme.text }]}
            placeholder="Hospital ID"
            placeholderTextColor={theme.textMuted}
            onChangeText={(t) => { uhidRef.current = t; }}
          />
        </View>

        <View style={[styles.inputGroup, { backgroundColor: theme.card }]}>
          <Text style={[styles.label, { color: theme.textSecondary }]}>Phone (Optional)</Text>
          <TextInput
            style={[styles.input, { backgroundColor: theme.backgroundSecondary, color: theme.text }]}
            placeholder="Phone number"
            placeholderTextColor={theme.textMuted}
            keyboardType="phone-pad"
            onChangeText={(t) => { phoneRef.current = t; }}
          />
        </View>

        <Pressable
          style={[styles.createBtn, { backgroundColor: isPed ? "#06b6d4" : theme.primary, opacity: loading ? 0.7 : 1 }]}
          onPress={handleCreate}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator size="small" color="#FFFFFF" />
          ) : (
            <>
              <Feather name="arrow-right" size={20} color="#FFFFFF" />
              <Text style={styles.createBtnText}>
                {isPed ? "Open Pediatric Case Sheet" : "Open Adult Case Sheet"}
              </Text>
            </>
          )}
        </Pressable>

        <Pressable
          style={[styles.triageLink]}
          onPress={() => {
            navigation.replace("Triage");
          }}
        >
          <Feather name="clipboard" size={16} color={theme.primary} />
          <Text style={[styles.triageLinkText, { color: theme.primary }]}>
            Start with full triage instead
          </Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { paddingHorizontal: Spacing.lg },
  banner: {
    flexDirection: "row",
    alignItems: "center",
    padding: Spacing.lg,
    borderRadius: BorderRadius.lg,
    marginBottom: Spacing.xl,
    gap: Spacing.md,
  },
  bannerText: { flex: 1 },
  bannerTitle: { fontSize: Typography.lg, fontWeight: "700" },
  bannerSubtitle: { fontSize: Typography.sm, marginTop: 2 },
  sectionLabel: {
    fontSize: Typography.xs,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 1,
    marginBottom: Spacing.md,
    marginLeft: Spacing.xs,
  },
  inputGroup: {
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    marginBottom: Spacing.sm,
  },
  label: { fontSize: Typography.sm, fontWeight: "500", marginBottom: Spacing.xs },
  input: {
    height: 44,
    borderRadius: BorderRadius.sm,
    paddingHorizontal: Spacing.md,
    fontSize: Typography.base,
  },
  sexRow: { flexDirection: "row", gap: Spacing.sm },
  sexBtn: {
    flex: 1,
    height: 40,
    borderRadius: BorderRadius.sm,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
  },
  sexBtnText: { fontSize: Typography.sm, fontWeight: "600" },
  createBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    height: 52,
    borderRadius: BorderRadius.md,
    marginTop: Spacing.xl,
    gap: Spacing.sm,
  },
  createBtnText: { color: "#FFFFFF", fontSize: Typography.base, fontWeight: "700" },
  triageLink: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginTop: Spacing.lg,
    gap: Spacing.xs,
    paddingVertical: Spacing.md,
  },
  triageLinkText: { fontSize: Typography.sm, fontWeight: "500" },
  vitalsRow: { flexDirection: "row", gap: Spacing.sm },
  vitalCell: { flex: 1 },
  vitalLabel: { fontSize: 11, fontWeight: "500", marginBottom: 4 },
  vitalInput: {
    height: 40,
    borderRadius: BorderRadius.sm,
    paddingHorizontal: Spacing.sm,
    fontSize: Typography.base,
    textAlign: "center",
  },
});
