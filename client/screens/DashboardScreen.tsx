import React, { useMemo, useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  RefreshControl,
  ActivityIndicator,
  Modal,
  Platform,
  Alert,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useNavigation, useFocusEffect } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";
import * as Sharing from "expo-sharing";
import * as FileSystem from "expo-file-system/legacy";
import * as IntentLauncher from "expo-intent-launcher";
import { useTheme } from "@/hooks/useTheme";
import { useAuth } from "@/context/AuthContext";
import { useDepartment } from "@/context/DepartmentContext";
import { fetchFromApi, fetchCasesFromProxy } from "@/lib/api";
import { getApiUrl } from "@/lib/query-client";
import { isPediatric } from "@/lib/pediatricVitals";
import { getCachedCaseData, mergeCaseWithCache } from "@/lib/caseCache";
import { getDraftByBackendId, type DraftCase } from "@/lib/draftManager";
import { Spacing, BorderRadius, Typography, TriageColors } from "@/constants/theme";
import type { RootStackParamList } from "@/navigation/RootStackNavigator";
import QuickStartScreen from "@/screens/QuickStartScreen";

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

interface CaseItem {
  id: string;
  patient: {
    name: string;
    age: string;
    sex: string;
  };
  presenting_complaint?: {
    text: string;
  };
  triage_priority: number;
  status: string;
  created_at: string;
}

const getPriorityColor = (level: number) => {
  switch (level) {
    case 1: return TriageColors.red;
    case 2: return TriageColors.orange;
    case 3: return TriageColors.yellow;
    case 4: return TriageColors.green;
    case 5: return TriageColors.blue;
    default: return TriageColors.gray;
  }
};

const getStatusBadge = (status: string, priority: number) => {
  if (status === "completed" || status === "discharged") {
    return { text: "Discharged", color: TriageColors.green, bg: "#f0fdf4" };
  }
  if (priority === 1) {
    return { text: "CRITICAL", color: TriageColors.red, bg: "#fef2f2" };
  }
  if (priority === 2) {
    return { text: "Urgent", color: TriageColors.orange, bg: "#fff7ed" };
  }
  return { text: "In Progress", color: TriageColors.blue, bg: "#eff6ff" };
};

export default function DashboardScreen() {
  const navigation = useNavigation<NavigationProp>();
  const { theme } = useTheme();
  const { user } = useAuth();
  const { department, shiftSession, activeShift, incomingCount, isHOD } = useDepartment();
  const insets = useSafeAreaInsets();
  const [downloadModalVisible, setDownloadModalVisible] = useState(false);
  const [selectedCase, setSelectedCase] = useState<CaseItem | null>(null);
  const [exporting, setExporting] = useState(false);
  const [draftsMap, setDraftsMap] = useState<Record<string, DraftCase>>({});
  const [aiCredits, setAiCredits] = useState<number | null>(null);
  const [localPlan, setLocalPlan] = useState<string | null>(null);
  const [showTutorial, setShowTutorial] = useState(false);
  const [tutorialChecked, setTutorialChecked] = useState(false);
  const [showNewPatientModal, setShowNewPatientModal] = useState(false);

  useEffect(() => {
    const checkTutorial = async () => {
      try {
        const completed = await AsyncStorage.getItem("ermate_tutorial_completed");
        if (!completed) {
          setShowTutorial(true);
        }
      } catch {}
      setTutorialChecked(true);
    };
    checkTutorial();
  }, []);

  const handleTutorialComplete = useCallback(() => {
    setShowTutorial(false);
  }, []);

  const { data: cases = [], isLoading: loading, error: queryError, refetch, isRefetching } = useQuery<CaseItem[]>({
    queryKey: ["cases", user?.id],
    queryFn: () => fetchCasesFromProxy<CaseItem[]>(),
    refetchOnMount: true,
    enabled: !!user?.id,
  });

  useFocusEffect(
    useCallback(() => {
      if (user?.id) refetch();
    }, [user?.id])
  );

  useEffect(() => {
    const fetchCredits = async () => {
      if (!user?.id) return;
      try {
        const baseUrl = getApiUrl();
        const url = new URL(`/api/subscription/status?userId=${encodeURIComponent(user.id)}&userEmail=${encodeURIComponent(user.email || "")}`, baseUrl).href;
        const res = await fetch(url);
        const text = await res.text();
        try {
          const data = JSON.parse(text);
          setLocalPlan(data.plan ?? "free");
          if (data.plan === "free" || data.plan === "base") {
            setAiCredits(data.credits_balance ?? 0);
          } else {
            setAiCredits(null);
          }
        } catch {
          setAiCredits(null);
        }
      } catch {
        setAiCredits(null);
      }
    };
    fetchCredits();
  }, [user?.id]);

  useEffect(() => {
    const checkDrafts = async () => {
      const draftsByCase: Record<string, DraftCase> = {};
      for (const caseItem of cases) {
        const draft = await getDraftByBackendId(caseItem.id);
        if (draft && draft.status === "draft") {
          draftsByCase[caseItem.id] = draft;
        }
      }
      setDraftsMap(draftsByCase);
    };
    if (cases.length > 0) {
      checkDrafts();
    }
  }, [cases]);

  const todayCases = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const filtered = cases.filter((c) => {
      const caseDate = new Date(c.created_at);
      caseDate.setHours(0, 0, 0, 0);
      return caseDate.getTime() === today.getTime();
    });

    filtered.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    return filtered;
  }, [cases]);

  const stats = useMemo(() => {
    const critical = todayCases.filter((c) => c.triage_priority === 1 || c.triage_priority === 2).length;
    const pending = todayCases.filter((c) => c.status !== "completed" && c.status !== "discharged").length;
    const discharged = todayCases.filter((c) => c.status === "completed" || c.status === "discharged").length;
    return { total: todayCases.length, critical, pending, discharged };
  }, [todayCases]);

  const error = queryError ? (queryError as Error).message : null;
  const refreshing = isRefetching;

  const onRefresh = async () => {
    await refetch();
  };

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });
  };

  const calculateTimeInER = (createdAt: string) => {
    const start = new Date(createdAt);
    const now = new Date();
    const diffMs = now.getTime() - start.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const hours = Math.floor(diffMins / 60);
    const mins = diffMins % 60;
    return {
      display: hours > 0 ? `${hours}h ${mins}m` : `${mins}m`,
      exceeds4Hours: hours >= 4,
    };
  };

  const openDownloadModal = (caseItem: CaseItem) => {
    setSelectedCase(caseItem);
    setDownloadModalVisible(true);
  };

  const getMimeType = (filename: string) => {
    if (filename.endsWith(".pdf")) return "application/pdf";
    if (filename.endsWith(".docx")) return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
    return "application/octet-stream";
  };

  const getUTI = (filename: string) => {
    if (filename.endsWith(".pdf")) return "com.adobe.pdf";
    if (filename.endsWith(".docx")) return "org.openxmlformats.wordprocessingml.document";
    return "public.data";
  };

  const openOrShareFile = async (fileUri: string, filename: string) => {
    const mimeType = getMimeType(filename);
    const uti = getUTI(filename);

    if (Platform.OS === "android") {
      try {
        const contentUri = await FileSystem.getContentUriAsync(fileUri);
        await IntentLauncher.startActivityAsync("android.intent.action.VIEW", {
          data: contentUri,
          flags: 1,
          type: mimeType,
        });
        return;
      } catch (_e) {
        // Fall through to share sheet
      }
    }

    if (await Sharing.isAvailableAsync()) {
      await Sharing.shareAsync(fileUri, {
        mimeType,
        dialogTitle: `Save ${filename}`,
        UTI: uti,
      });
    } else {
      Alert.alert("Download Complete", `"${filename}" has been saved.`);
    }
  };

  const buildDischargeSummaryFromCase = (caseData: any) => {
    const vitals = caseData.vitals_at_arrival || caseData.vitals || {};
    const abcde = caseData.abcde || {};
    const treatment = caseData.treatment || {};
    const disposition = caseData.disposition || {};
    const exam = caseData.examination || {};
    const sample = caseData.sample || {};
    const history = caseData.history || {};
    const patient = caseData.patient || {};
    const primaryAssessment = caseData.primary_assessment || {};

    const gcsE = vitals.gcs_e || primaryAssessment.disability_gcs_e || 4;
    const gcsV = vitals.gcs_v || primaryAssessment.disability_gcs_v || 5;
    const gcsM = vitals.gcs_m || primaryAssessment.disability_gcs_m || 6;
    const gcsTotal = gcsE + gcsV + gcsM;

    const formatAirway = () => {
      const status = abcde.airway?.abcdeStatus || "Normal";
      if (status === "Normal") return "Patent, self-maintained, no obstruction";
      const parts = [];
      if (abcde.airway?.status) parts.push(abcde.airway.status);
      if (abcde.airway?.maintenance) parts.push(abcde.airway.maintenance);
      if (abcde.airway?.interventions?.length) parts.push(`Interventions: ${abcde.airway.interventions.join(", ")}`);
      return parts.length > 0 ? parts.join(", ") : "Patent";
    };

    const formatBreathing = () => {
      const parts = [];
      const rr = vitals.rr || primaryAssessment.breathing_rr;
      const spo2 = vitals.spo2 || primaryAssessment.breathing_spo2;
      if (rr) parts.push(`RR: ${rr}/min`);
      if (spo2) parts.push(`SpO2: ${spo2}%`);
      const status = abcde.breathing?.abcdeStatus || "Normal";
      if (status === "Normal") {
        parts.push("Effortless, bilateral air entry");
      } else {
        if (abcde.breathing?.effort) parts.push(`WOB: ${abcde.breathing.effort}`);
        if (abcde.breathing?.airEntry) parts.push(`Air Entry: ${abcde.breathing.airEntry}`);
      }
      return parts.join(", ");
    };

    const formatCirculation = () => {
      const parts = [];
      const hr = vitals.hr || primaryAssessment.circulation_hr;
      const bpSys = vitals.bp_systolic || primaryAssessment.circulation_bp_systolic;
      const bpDia = vitals.bp_diastolic || primaryAssessment.circulation_bp_diastolic;
      if (hr) parts.push(`HR: ${hr} bpm`);
      if (bpSys && bpDia) parts.push(`BP: ${bpSys}/${bpDia} mmHg`);
      const status = abcde.circulation?.abcdeStatus || "Normal";
      if (status === "Normal") {
        parts.push("Regular pulse, CRT <2s, warm");
      } else {
        if (abcde.circulation?.pulseQuality) parts.push(`Rhythm: ${abcde.circulation.pulseQuality}`);
        if (abcde.circulation?.capillaryRefill) parts.push(`CRT: ${abcde.circulation.capillaryRefill}`);
      }
      return parts.join(", ");
    };

    const formatDisability = () => {
      const parts = [];
      parts.push(`GCS: E${gcsE}V${gcsV}M${gcsM} (${gcsTotal}/15)`);
      const status = abcde.disability?.abcdeStatus || "Normal";
      if (status === "Normal") {
        parts.push("Alert, PERL, no focal deficits");
      } else {
        if (abcde.disability?.motorResponse) parts.push(`AVPU: ${abcde.disability.motorResponse}`);
        if (abcde.disability?.pupilSize) parts.push(`Pupils: ${abcde.disability.pupilSize}`);
      }
      const grbs = vitals.grbs || abcde.disability?.glucose;
      if (grbs) parts.push(`GRBS: ${grbs} mg/dL`);
      return parts.join(", ");
    };

    const formatExposure = () => {
      const parts = [];
      const temp = vitals.temperature || abcde.exposure?.temperature;
      if (temp) parts.push(`Temp: ${temp}°F`);
      const status = abcde.exposure?.abcdeStatus || "Normal";
      if (status === "Normal") {
        parts.push("No external injuries, no bleeding");
      } else {
        if (abcde.exposure?.findings) parts.push(abcde.exposure.findings);
      }
      return parts.join(", ");
    };

    const formatSystemicExam = (system: string) => {
      if (system === "respiratory") {
        const notes = exam.respiratory_additional_notes || exam.respiratory?.notes;
        if (notes) return notes;
        const status = exam.respiratory_status || "Normal";
        if (status === "Normal") return "Bilateral equal air entry. Vesicular breath sounds. No wheeze, crackles, or rhonchi. Normal percussion notes.";
        return "";
      }
      if (system === "cvs") {
        const notes = exam.cvs_additional_notes || exam.cardiovascular?.notes;
        if (notes) return notes;
        const status = exam.cvs_status || "Normal";
        if (status === "Normal") return "S1 S2 heard, normal intensity. No murmurs, gallops, or rubs. JVP not elevated. Peripheral pulses well felt bilaterally.";
        return "";
      }
      if (system === "abdomen") {
        const notes = exam.abdomen_additional_notes || exam.abdominal?.notes;
        if (notes) return notes;
        const status = exam.abdomen_status || "Normal";
        if (status === "Normal") return "Soft, non-distended, non-tender. No guarding or rigidity. No organomegaly. Bowel sounds present and normal.";
        return "";
      }
      if (system === "cns") {
        const notes = exam.cns_additional_notes || exam.neurological?.notes;
        if (notes) return notes;
        const status = exam.cns_status || "Normal";
        if (status === "Normal") return `Conscious, oriented to time, place, and person. GCS ${gcsTotal}/15. Cranial nerves intact. Pupils BERL. Motor power 5/5 in all limbs. Reflexes normal.`;
        return "";
      }
      return "";
    };

    return {
      mlc: caseData.mlc || patient.mlc || false,
      allergy: sample.allergies || history.allergies?.join(", ") || patient.allergies || "No known allergies",
      vitals_arrival: {
        hr: vitals.hr?.toString() || "",
        bp: `${vitals.bp_systolic || ""}/${vitals.bp_diastolic || ""}`,
        rr: vitals.rr?.toString() || "",
        spo2: vitals.spo2?.toString() || "",
        gcs: gcsTotal.toString(),
        pain_score: vitals.pain_score?.toString() || "",
        grbs: vitals.grbs?.toString() || "",
        temp: vitals.temperature?.toString() || "",
      },
      presenting_complaint: caseData.presenting_complaint?.text || "",
      history_of_present_illness: history.hpi || history.events_hopi || sample.eventsHopi || "",
      past_medical_history: history.past_medical?.join(", ") || sample.pastMedicalHistory || "",
      family_history: patient.family_history || "",
      lmp: history.last_meal_lmp || sample.lastMeal || "",
      primary_assessment: {
        airway: formatAirway(),
        breathing: formatBreathing(),
        circulation: formatCirculation(),
        disability: formatDisability(),
        exposure: formatExposure(),
        efast: caseData.adjuncts?.efast_notes || abcde.efast || "",
      },
      secondary_assessment: {
        pallor: exam.general_pallor || false,
        icterus: exam.general_icterus || false,
        cyanosis: exam.general_cyanosis || false,
        clubbing: exam.general_clubbing || false,
        lymphadenopathy: exam.general_lymphadenopathy || false,
        edema: exam.general_edema || false,
      },
      systemic_exam: {
        chest: formatSystemicExam("respiratory"),
        cvs: formatSystemicExam("cvs"),
        pa: formatSystemicExam("abdomen"),
        cns: formatSystemicExam("cns"),
        extremities: "",
      },
      course_in_hospital: caseData.discharge_summary?.course_in_hospital || (() => {
        const courseParts: string[] = [];
        const medsText = treatment.medications?.map((m: any) => `${m.name || ""} ${m.dose || ""} ${m.route || ""} ${m.frequency || ""}`.trim()).join("\n");
        if (medsText) courseParts.push("MEDICATIONS GIVEN IN ER:\n" + medsText);
        if (treatment.infusions?.length > 0) {
          const infText = treatment.infusions.map((inf: any) => `${inf.drug_name || inf.name || ""} ${inf.dose || ""} ${inf.dilution ? `in ${inf.dilution}` : ""} ${inf.rate ? `@ ${inf.rate}` : ""}`.trim()).join("\n");
          if (infText) courseParts.push("INFUSIONS:\n" + infText);
        }
        const addendumNotes = caseData.treatment?.addendum_notes || caseData.addendum_notes || [];
        const notesList = Array.isArray(addendumNotes) ? addendumNotes : (addendumNotes ? [addendumNotes] : []);
        if (notesList.length > 0) courseParts.push("CLINICAL NOTES:\n" + notesList.join("\n"));
        return courseParts.join("\n\n");
      })(),
      investigations: treatment.investigations || "",
      diagnosis: treatment.primary_diagnosis || treatment.provisional_diagnosis || "",
      discharge_medications: caseData.discharge_summary?.discharge_medications || "",
      disposition_type: disposition.type || disposition.disposition_type || "Normal Discharge",
      condition_at_discharge: disposition.condition || disposition.condition_at_discharge || "STABLE",
      vitals_discharge: {
        hr: "", bp: "", rr: "", spo2: "", gcs: "", pain_score: "", grbs: "", temp: "",
      },
      follow_up_advice: disposition.follow_up || disposition.follow_up_instructions || "",
      ed_resident: caseData.em_resident || "",
      ed_consultant: caseData.discharge_summary?.ed_consultant || "",
      sign_time_resident: "",
      sign_time_consultant: "",
      discharge_date: new Date().toLocaleDateString(),
    };
  };

  const exportDocument = async (type: "casesheet" | "discharge", format: "pdf" | "word") => {
    if (!selectedCase) return;
    
    setExporting(true);
    try {
      const caseResponse = await fetchFromApi<any>(`/cases/${selectedCase.id}`);
      const cached = await getCachedCaseData(selectedCase.id);
      const caseData = cached ? mergeCaseWithCache(caseResponse, cached) : caseResponse;
      
      const expressBaseUrl = getApiUrl();
      const endpoint = type === "discharge"
        ? (format === "pdf" ? "/api/export/discharge-pdf" : "/api/export/discharge-docx")
        : (format === "pdf" ? "/api/export/casesheet-pdf" : "/api/export/casesheet-docx");

      // For casesheet export: clinical detail sections (history, exam, treatment, etc.)
      // live primarily in the local cache (entered by the user on this device). The backend
      // reliably stores patient/triage/vitals/abcde. Build the export payload cache-first.
      const buildCasesheetPayload = () => ({
        ...caseResponse,
        ...(cached?.primary_assessment && Object.keys(cached.primary_assessment).length > 0
          ? { primary_assessment: cached.primary_assessment }
          : {}),
        ...(cached?.history && Object.keys(cached.history).length > 0
          ? { history: cached.history }
          : {}),
        ...(cached?.examination && Object.keys(cached.examination).length > 0
          ? { examination: cached.examination }
          : {}),
        ...(cached?.treatment && Object.keys(cached.treatment).length > 0
          ? { treatment: { ...(caseResponse.treatment || {}), ...cached.treatment } }
          : {}),
        ...(cached?.investigations && Object.keys(cached.investigations).length > 0
          ? { investigations: { ...(caseResponse.investigations || {}), ...cached.investigations } }
          : {}),
        ...(cached?.procedures && Object.keys(cached.procedures).length > 0
          ? { procedures: { ...(caseResponse.procedures || {}), ...cached.procedures } }
          : {}),
        ...(cached?.addendum_notes && cached.addendum_notes.length > 0
          ? { addendum_notes: cached.addendum_notes }
          : {}),
      });

      const exportData = type === "discharge"
        ? {
            patient: caseData.patient,
            discharge_summary: caseData.discharge_summary && Object.keys(caseData.discharge_summary).length > 0
              ? caseData.discharge_summary
              : buildDischargeSummaryFromCase(caseData),
            created_at: caseData.created_at,
          }
        : buildCasesheetPayload();

      const typePrefix = type === "discharge" ? "discharge" : "casesheet";
      const extension = format === "pdf" ? "pdf" : "docx";
      const filename = `${typePrefix}_${(selectedCase.patient?.name || "patient").replace(/\s+/g, "_")}_${Date.now()}.${extension}`;

      const fullUrl = new URL(endpoint, expressBaseUrl).href;
      console.log("[EXPORT] URL:", fullUrl);

      if (Platform.OS === "web") {
        const response = await fetch(fullUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(exportData),
        });
        if (!response.ok) {
          const errText = await response.text();
          throw new Error(`Export failed (${response.status}): ${errText.slice(0, 200)}`);
        }
        const blob = await response.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      } else {
        const response = await fetch(fullUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(exportData),
        });
        console.log("[EXPORT] Response status:", response.status, "content-type:", response.headers.get("content-type"));
        if (!response.ok) {
          const errText = await response.text();
          throw new Error(`Export failed (${response.status}): ${errText.slice(0, 200)}`);
        }
        const blob = await response.blob();
        console.log("[EXPORT] Blob size:", blob.size, "type:", blob.type);
        if (blob.size === 0) {
          throw new Error("Server returned empty file");
        }
        const reader = new FileReader();
        const base64Data = await new Promise<string>((resolve, reject) => {
          reader.onload = () => {
            const result = reader.result as string;
            const base64 = result.split(",")[1];
            resolve(base64);
          };
          reader.onerror = reject;
          reader.readAsDataURL(blob);
        });

        const fileUri = (FileSystem.documentDirectory || "") + filename;
        await FileSystem.writeAsStringAsync(fileUri, base64Data, {
          encoding: FileSystem.EncodingType.Base64,
        });
        
        const fileInfo = await FileSystem.getInfoAsync(fileUri);
        console.log("[EXPORT] File saved:", fileUri, "exists:", fileInfo.exists, "size:", (fileInfo as any).size);
        
        if (!fileInfo.exists) {
          throw new Error("File was not saved properly");
        }

        await openOrShareFile(fileUri, filename);
      }
      
      setDownloadModalVisible(false);
    } catch (err: any) {
      console.log("[EXPORT] Error:", err);
      Alert.alert("Export Failed", err.message || "Failed to export document");
    } finally {
      setExporting(false);
    }
  };

  const isCompleted = (status: string) => status === "completed" || status === "discharged";
  const canDownload = (_status: string) => true;

  if (showTutorial && tutorialChecked) {
    return <QuickStartScreen onComplete={handleTutorialComplete} />;
  }

  if (loading) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: theme.backgroundDefault }]}>
        <ActivityIndicator size="large" color={theme.primary} />
        <Text style={[styles.loadingText, { color: theme.textSecondary }]}>Loading dashboard...</Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.backgroundDefault }]}>
      <View style={[styles.header, { backgroundColor: theme.card, paddingTop: insets.top + Spacing.md }]}>
        <View style={styles.headerLeft}>
          <View style={[styles.logoContainer, { backgroundColor: theme.primaryLight }]}>
            <Feather name="activity" size={24} color={theme.primary} />
          </View>
          <View>
            <Text style={[styles.logoText, { color: theme.primary }]}>ErMate</Text>
            <Text style={[styles.greeting, { color: theme.textSecondary }]}>
              Welcome, {user?.name || "Doctor"}
            </Text>
          </View>
        </View>
        <Pressable
          style={({ pressed }) => [styles.headerBtn, { opacity: pressed ? 0.7 : 1 }]}
          onPress={() => navigation.navigate("Upgrade", {})}
        >
          <Feather name="star" size={22} color={theme.warning} />
        </Pressable>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={{ paddingBottom: 120 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        showsVerticalScrollIndicator={false}
      >
        {error ? (
          <View style={[styles.errorBanner, { backgroundColor: theme.dangerLight }]}>
            <Feather name="alert-circle" size={20} color={theme.danger} />
            <Text style={[styles.errorText, { color: theme.danger }]}>{error}</Text>
            <Pressable onPress={() => refetch()}>
              <Text style={[styles.retryText, { color: theme.primary }]}>Retry</Text>
            </Pressable>
          </View>
        ) : null}

        {department ? (
          <Pressable
            style={({ pressed }) => [
              styles.shiftBanner,
              {
                backgroundColor: shiftSession ? "#ecfdf5" : theme.card,
                borderColor: shiftSession ? "#10b981" : theme.border,
                opacity: pressed ? 0.9 : 1,
              },
            ]}
            onPress={() => navigation.navigate("Profile" as any)}
          >
            <View style={[styles.shiftBannerLeft]}>
              <View style={[styles.shiftDot, { backgroundColor: shiftSession ? "#10b981" : theme.textMuted }]} />
              <View>
                <Text style={[styles.shiftBannerTitle, { color: shiftSession ? "#065f46" : theme.text }]}>
                  {shiftSession ? `${activeShift?.name || "Morning"} Shift — ${department.name}` : `${department.name} · No Active Shift`}
                </Text>
                <Text style={[styles.shiftBannerSub, { color: shiftSession ? "#059669" : theme.textMuted }]}>
                  {shiftSession ? "Currently on shift · Tap to manage" : "Tap Profile to start your shift"}
                </Text>
              </View>
            </View>
            {incomingCount > 0 ? (
              <Pressable
                style={[styles.handoverBadge, { backgroundColor: theme.danger }]}
                onPress={() => navigation.navigate("HandoverDetail")}
              >
                <Feather name="arrow-right-circle" size={14} color="#fff" />
                <Text style={styles.handoverBadgeText}>{incomingCount} handover{incomingCount > 1 ? "s" : ""}</Text>
              </Pressable>
            ) : (
              <Feather name="chevron-right" size={18} color={shiftSession ? "#059669" : theme.textMuted} />
            )}
          </Pressable>
        ) : null}

        <Pressable
          style={({ pressed }) => [
            styles.newPatientBtn,
            { backgroundColor: theme.card, borderColor: theme.primary, opacity: pressed ? 0.9 : 1 },
          ]}
          onPress={() => setShowNewPatientModal(true)}
        >
          <View style={[styles.newPatientIcon, { backgroundColor: theme.primary }]}>
            <Feather name="plus" size={24} color="#FFFFFF" />
          </View>
          <View style={styles.newPatientText}>
            <Text style={[styles.newPatientTitle, { color: theme.text }]}>New Patient</Text>
            <Text style={[styles.newPatientSubtitle, { color: theme.textSecondary }]}>
              Voice dictation or manual entry
            </Text>
          </View>
          <Feather name="chevron-right" size={24} color={theme.primary} />
        </Pressable>

        <View style={styles.quickSheetRow}>
          <Pressable
            style={({ pressed }) => [
              styles.quickSheetBtn,
              { backgroundColor: theme.card, borderColor: "#10b981", opacity: pressed ? 0.9 : 1 },
            ]}
            onPress={() => navigation.navigate("QuickCaseSheet" as any, { type: "adult" })}
          >
            <Feather name="user" size={20} color="#10b981" />
            <Text style={[styles.quickSheetBtnTitle, { color: theme.text }]}>Start Adult</Text>
            <Text style={[styles.quickSheetBtnSub, { color: theme.textSecondary }]}>Case Sheet</Text>
          </Pressable>
          <Pressable
            style={({ pressed }) => [
              styles.quickSheetBtn,
              { backgroundColor: theme.card, borderColor: "#06b6d4", opacity: pressed ? 0.9 : 1 },
            ]}
            onPress={() => navigation.navigate("QuickCaseSheet" as any, { type: "pediatric" })}
          >
            <Feather name="heart" size={20} color="#06b6d4" />
            <Text style={[styles.quickSheetBtnTitle, { color: theme.text }]}>Start Pediatric</Text>
            <Text style={[styles.quickSheetBtnSub, { color: theme.textSecondary }]}>Case Sheet</Text>
          </Pressable>
        </View>

        <Pressable
          style={({ pressed }) => [
            styles.newPatientBtn,
            { backgroundColor: theme.card, borderColor: "#06b6d4", opacity: pressed ? 0.9 : 1 },
          ]}
          onPress={() => navigation.navigate("PediatricDrugCalculator" as any)}
        >
          <View style={[styles.newPatientIcon, { backgroundColor: "#06b6d4" }]}>
            <Feather name="book-open" size={24} color="#FFFFFF" />
          </View>
          <View style={styles.newPatientText}>
            <Text style={[styles.newPatientTitle, { color: theme.text }]}>Pediatric Drug Calculator</Text>
            <Text style={[styles.newPatientSubtitle, { color: theme.textSecondary }]}>
              Weight-based dosing reference
            </Text>
          </View>
          <Feather name="chevron-right" size={24} color="#06b6d4" />
        </Pressable>

        <View style={styles.statsRow}>
          {[
            { value: stats.total, label: "Today", color: theme.primary },
            { value: stats.critical, label: "Critical", color: TriageColors.red },
            { value: stats.pending, label: "Pending", color: TriageColors.orange },
            { value: stats.discharged, label: "Done", color: TriageColors.green },
          ].map((stat, i) => (
            <View key={i} style={[styles.statCard, { backgroundColor: theme.card, borderLeftColor: stat.color }]}>
              <Text style={[styles.statNumber, { color: stat.color }]}>{stat.value}</Text>
              <Text style={[styles.statLabel, { color: theme.textSecondary }]}>{stat.label}</Text>
            </View>
          ))}
        </View>

        <Pressable
          style={({ pressed }) => [
            styles.statsNavCard,
            { backgroundColor: theme.card, borderColor: theme.primary + "30", opacity: pressed ? 0.85 : 1 },
          ]}
          onPress={() => navigation.navigate("Stats")}
        >
          <View style={[styles.statsNavIcon, { backgroundColor: theme.primary + "15" }]}>
            <Feather name="bar-chart-2" size={20} color={theme.primary} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.statsNavTitle, { color: theme.text }]}>My Weekly Stats</Text>
            <Text style={[styles.statsNavSub, { color: theme.textSecondary }]}>
              Cases documented, time saved, top presentations
            </Text>
          </View>
          <Feather name="chevron-right" size={20} color={theme.primary} />
        </Pressable>

        <Pressable
          style={({ pressed }) => [
            styles.statsNavCard,
            {
              backgroundColor: theme.card,
              borderColor: "#818CF830",
              opacity: pressed ? 0.85 : 1,
              marginTop: Spacing.sm,
            },
          ]}
          onPress={() => navigation.navigate("Handover")}
        >
          <View style={[styles.statsNavIcon, { backgroundColor: "#818CF815" }]}>
            <Feather name="clipboard" size={20} color="#818CF8" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.statsNavTitle, { color: theme.text }]}>Handover Sheet</Text>
            <Text style={[styles.statsNavSub, { color: theme.textSecondary }]}>
              Select cases, add pending notes, export PDF
            </Text>
          </View>
          <Feather name="chevron-right" size={20} color="#818CF8" />
        </Pressable>

        {aiCredits !== null ? (
          <Pressable
            style={({ pressed }) => [
              styles.creditsWidget,
              {
                backgroundColor: theme.card,
                borderColor: aiCredits === 0 ? TriageColors.red : aiCredits <= 2 ? "#d97706" : theme.primary,
                opacity: pressed ? 0.9 : 1,
              },
            ]}
            onPress={() => navigation.navigate("Upgrade", {})}
          >
            <View style={styles.creditsWidgetLeft}>
              <Feather name="cpu" size={20} color={theme.primary} />
              <View>
                <Text style={[styles.creditsWidgetTitle, { color: theme.text }]}>AI Credits</Text>
                {aiCredits === 0 ? (
                  <Text style={[styles.creditsWidgetStatus, { color: TriageColors.red }]}>Exhausted</Text>
                ) : aiCredits <= 2 ? (
                  <Text style={[styles.creditsWidgetStatus, { color: "#d97706" }]}>Low balance</Text>
                ) : null}
              </View>
            </View>
            <View style={styles.creditsWidgetRight}>
              <Text style={[styles.creditsWidgetValue, { color: aiCredits === 0 ? TriageColors.red : theme.primary }]}>{aiCredits}</Text>
              <Text style={[styles.creditsWidgetLabel, { color: theme.textSecondary }]}>remaining</Text>
            </View>
          </Pressable>
        ) : null}

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={[styles.sectionTitle, { color: theme.text }]}>Today's Patients</Text>
            <Text style={[styles.sectionCount, { color: theme.textSecondary }]}>{todayCases.length} cases</Text>
          </View>

          {todayCases.length === 0 ? (
            <View style={[styles.emptyState, { backgroundColor: theme.card }]}>
              <Feather name="users" size={48} color={theme.textMuted} />
              <Text style={[styles.emptyText, { color: theme.textSecondary }]}>No patients today</Text>
              <Text style={[styles.emptySubtext, { color: theme.textMuted }]}>Tap "New Patient" to start</Text>
            </View>
          ) : (
            todayCases.map((caseItem) => {
              const time = calculateTimeInER(caseItem.created_at);
              const status = getStatusBadge(caseItem.status, caseItem.triage_priority);

              return (
                <View
                  key={caseItem.id}
                  style={[
                    styles.caseCard,
                    { backgroundColor: theme.card },
                    time.exceeds4Hours && status.text !== "Discharged" && styles.caseCardWarning,
                  ]}
                >
                  {/* Tappable info area — opens case sheet */}
                  <Pressable
                    style={({ pressed }) => [styles.caseCardInner, { opacity: pressed ? 0.8 : 1 }]}
                    onPress={() => {
                      const patientAge = parseFloat(caseItem.patient?.age) || 0;
                      const screenName = isPediatric(patientAge) ? "PediatricCaseSheet" : "CaseSheet";
                      navigation.navigate(screenName, { caseId: caseItem.id });
                    }}
                  >
                    <View style={[styles.priorityBar, { backgroundColor: getPriorityColor(caseItem.triage_priority) }]} />
                    <View style={styles.caseContent}>
                      <View style={styles.caseTopRow}>
                        <View style={styles.caseInfo}>
                          <Text style={[styles.patientName, { color: theme.text }]}>
                            {caseItem.patient?.name || "Unknown"}
                          </Text>
                          <Text style={[styles.patientDetails, { color: theme.textSecondary }]}>
                            {caseItem.patient?.age || "?"} yrs | {caseItem.patient?.sex || "N/A"}
                          </Text>
                        </View>
                        <View style={styles.badgesRow}>
                          {draftsMap[caseItem.id] ? (
                            <View style={[styles.draftBadge, { backgroundColor: "#fef3c7" }]}>
                              <Feather name="edit-3" size={10} color="#d97706" />
                              <Text style={styles.draftBadgeText}>Draft</Text>
                            </View>
                          ) : null}
                          <View style={[styles.statusBadge, { backgroundColor: status.bg }]}>
                            <Text style={[styles.statusText, { color: status.color }]}>{status.text}</Text>
                          </View>
                        </View>
                      </View>

                      {caseItem.presenting_complaint?.text ? (
                        <Text style={[styles.complaint, { color: theme.textSecondary }]} numberOfLines={1}>
                          {caseItem.presenting_complaint.text}
                        </Text>
                      ) : null}

                      <View style={styles.timeInfo}>
                        <Feather name="clock" size={14} color={theme.textMuted} />
                        <Text style={[styles.timeText, { color: theme.textMuted }]}>
                          {formatTime(caseItem.created_at)} | {time.display}
                        </Text>
                        {time.exceeds4Hours && status.text !== "Discharged" ? (
                          <View style={[styles.warningBadge, { backgroundColor: "#fef3c7" }]}>
                            <Text style={styles.warningText}>Over 4h</Text>
                          </View>
                        ) : null}
                      </View>
                    </View>
                  </Pressable>
                  {/* Action buttons — siblings of info Pressable, not nested inside it */}
                  <View style={styles.caseActions}>
                    <Pressable
                      style={[styles.actionBtn, { backgroundColor: theme.primaryLight }]}
                      onPress={() => navigation.navigate("ViewCase", { caseId: caseItem.id })}
                    >
                      <Feather name="eye" size={16} color={theme.primary} />
                      <Text style={[styles.actionBtnLabel, { color: theme.primary }]}>View</Text>
                    </Pressable>
                    <Pressable
                      style={[styles.actionBtn, { backgroundColor: theme.successLight }]}
                      onPress={() => navigation.navigate("ViewDischargeSummary", { caseId: caseItem.id })}
                    >
                      <Feather name="file-text" size={16} color={theme.success} />
                      <Text style={[styles.actionBtnLabel, { color: theme.success }]}>Summary</Text>
                    </Pressable>
                    <Pressable
                      style={[styles.actionBtn, { backgroundColor: "#e0f2fe" }]}
                      onPress={() => navigation.navigate("DischargeSummary", { caseId: caseItem.id })}
                    >
                      <Feather name="clipboard" size={16} color="#0284c7" />
                      <Text style={[styles.actionBtnLabel, { color: "#0284c7" }]}>Discharge</Text>
                    </Pressable>
                    <Pressable
                      style={[styles.actionBtn, { backgroundColor: "#fef3c7" }]}
                      onPress={() => navigation.navigate("AddendumNotes", { caseId: caseItem.id })}
                    >
                      <Feather name="edit" size={16} color="#d97706" />
                      <Text style={[styles.actionBtnLabel, { color: "#d97706" }]}>Notes</Text>
                    </Pressable>
                    {canDownload(caseItem.status) ? (
                      <Pressable
                        style={[styles.actionBtn, { backgroundColor: "#f3e8ff" }]}
                        onPress={() => openDownloadModal(caseItem)}
                      >
                        <Feather name="download" size={16} color="#9333ea" />
                        <Text style={[styles.actionBtnLabel, { color: "#9333ea" }]}>Export</Text>
                      </Pressable>
                    ) : null}
                  </View>
                </View>
              );
            })
          )}
        </View>
      </ScrollView>

      <Modal
        visible={downloadModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setDownloadModalVisible(false)}
      >
        <Pressable 
          style={styles.modalOverlay} 
          onPress={() => setDownloadModalVisible(false)}
        >
          <View style={[styles.downloadModal, { backgroundColor: theme.card }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: theme.text }]}>Download Documents</Text>
              <Pressable onPress={() => setDownloadModalVisible(false)}>
                <Feather name="x" size={24} color={theme.textSecondary} />
              </Pressable>
            </View>
            
            {selectedCase ? (
              <Text style={[styles.modalPatient, { color: theme.textSecondary }]}>
                {selectedCase.patient?.name || "Patient"}
              </Text>
            ) : null}

            {exporting ? (
              <View style={styles.exportingContainer}>
                <ActivityIndicator size="large" color={theme.primary} />
                <Text style={[styles.exportingText, { color: theme.textSecondary }]}>
                  Generating document...
                </Text>
              </View>
            ) : (
              <View style={styles.downloadOptions}>
                <Text style={[styles.downloadSectionTitle, { color: theme.text }]}>Case Sheet</Text>
                <View style={styles.downloadRow}>
                  <Pressable
                    style={[styles.downloadBtn, { backgroundColor: "#fee2e2" }]}
                    onPress={() => exportDocument("casesheet", "pdf")}
                  >
                    <Feather name="file" size={20} color="#dc2626" />
                    <Text style={[styles.downloadBtnText, { color: "#dc2626" }]}>PDF</Text>
                  </Pressable>
                  <Pressable
                    style={[styles.downloadBtn, { backgroundColor: "#dbeafe" }]}
                    onPress={() => exportDocument("casesheet", "word")}
                  >
                    <Feather name="file-text" size={20} color="#2563eb" />
                    <Text style={[styles.downloadBtnText, { color: "#2563eb" }]}>Word</Text>
                  </Pressable>
                </View>

                <Text style={[styles.downloadSectionTitle, { color: theme.text, marginTop: Spacing.lg }]}>
                      Discharge Summary
                    </Text>
                    <View style={styles.downloadRow}>
                      <Pressable
                        style={[styles.downloadBtn, { backgroundColor: "#fee2e2" }]}
                        onPress={() => exportDocument("discharge", "pdf")}
                      >
                        <Feather name="file" size={20} color="#dc2626" />
                        <Text style={[styles.downloadBtnText, { color: "#dc2626" }]}>PDF</Text>
                      </Pressable>
                      <Pressable
                        style={[styles.downloadBtn, { backgroundColor: "#dbeafe" }]}
                        onPress={() => exportDocument("discharge", "word")}
                      >
                        <Feather name="file-text" size={20} color="#2563eb" />
                        <Text style={[styles.downloadBtnText, { color: "#2563eb" }]}>Word</Text>
                      </Pressable>
                    </View>
              </View>
            )}
          </View>
        </Pressable>
      </Modal>

      <Modal
        visible={showNewPatientModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowNewPatientModal(false)}
      >
        <Pressable style={styles.newPatientModalOverlay} onPress={() => setShowNewPatientModal(false)}>
          <Pressable style={[styles.newPatientModalSheet, { backgroundColor: theme.card }]} onPress={() => {}}>
            <View style={[styles.newPatientModalHandle, { backgroundColor: theme.border }]} />
            <Text style={[styles.newPatientModalTitle, { color: theme.text }]}>Start New Case</Text>
            <Text style={[styles.newPatientModalSub, { color: theme.textSecondary }]}>How do you want to document this patient?</Text>

            <Pressable
              style={({ pressed }) => [
                styles.newPatientOption,
                { backgroundColor: theme.primary, opacity: pressed ? 0.9 : 1, marginBottom: Spacing.md },
              ]}
              onPress={() => {
                setShowNewPatientModal(false);
                navigation.navigate("VoiceCaseSheet");
              }}
            >
              <View style={styles.newPatientOptionIcon}>
                <Feather name="mic" size={28} color="#FFFFFF" />
              </View>
              <View style={styles.newPatientOptionText}>
                <Text style={styles.newPatientOptionTitle}>Speak This Case</Text>
                <Text style={styles.newPatientOptionSub}>Talk naturally — ErMate fills everything including triage</Text>
              </View>
              <Feather name="chevron-right" size={20} color="#FFFFFF" />
            </Pressable>

            <Pressable
              style={({ pressed }) => [
                styles.newPatientOption,
                { backgroundColor: theme.card, borderWidth: 1.5, borderColor: theme.border, opacity: pressed ? 0.8 : 1 },
              ]}
              onPress={() => {
                setShowNewPatientModal(false);
                navigation.navigate("QuickCaseSheet" as any, { type: "adult" });
              }}
            >
              <View style={[styles.newPatientOptionIcon, { backgroundColor: theme.backgroundSecondary }]}>
                <Feather name="edit-3" size={24} color={theme.textSecondary} />
              </View>
              <View style={styles.newPatientOptionText}>
                <Text style={[styles.newPatientOptionTitle, { color: theme.text }]}>Fill Manually</Text>
                <Text style={[styles.newPatientOptionSub, { color: theme.textSecondary }]}>Triage form then case sheet, step by step</Text>
              </View>
              <Feather name="chevron-right" size={20} color={theme.textMuted} />
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  loadingContainer: { flex: 1, justifyContent: "center", alignItems: "center" },
  loadingText: { marginTop: 12, ...Typography.body },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: Spacing.xl,
    paddingBottom: Spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(0,0,0,0.05)",
  },
  headerLeft: { flexDirection: "row", alignItems: "center", gap: 12 },
  logoContainer: {
    width: 44,
    height: 44,
    borderRadius: BorderRadius.md,
    justifyContent: "center",
    alignItems: "center",
  },
  logoText: { ...Typography.h3 },
  greeting: { ...Typography.caption },
  headerBtn: { padding: Spacing.sm },
  scrollView: { flex: 1 },
  errorBanner: {
    flexDirection: "row",
    alignItems: "center",
    padding: Spacing.md,
    marginHorizontal: Spacing.lg,
    marginTop: Spacing.lg,
    borderRadius: BorderRadius.sm,
    gap: Spacing.sm,
  },
  errorText: { flex: 1, ...Typography.small },
  retryText: { ...Typography.label },
  shiftBanner: {
    flexDirection: "row",
    alignItems: "center",
    marginHorizontal: Spacing.lg,
    marginTop: Spacing.lg,
    padding: Spacing.md,
    borderRadius: BorderRadius.lg,
    borderWidth: 1.5,
    gap: Spacing.sm,
  },
  shiftBannerLeft: { flex: 1, flexDirection: "row", alignItems: "center", gap: 10 },
  shiftDot: { width: 10, height: 10, borderRadius: 5 },
  shiftBannerTitle: { fontSize: 13, fontWeight: "700" },
  shiftBannerSub: { fontSize: 11, marginTop: 2 },
  handoverBadge: { flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8 },
  handoverBadgeText: { color: "#fff", fontSize: 12, fontWeight: "700" },
  newPatientBtn: {
    flexDirection: "row",
    alignItems: "center",
    marginHorizontal: Spacing.lg,
    marginTop: Spacing.lg,
    padding: Spacing.lg,
    borderRadius: BorderRadius.lg,
    borderWidth: 2,
    gap: Spacing.md,
  },
  newPatientIcon: {
    width: 48,
    height: 48,
    borderRadius: BorderRadius.full,
    justifyContent: "center",
    alignItems: "center",
  },
  newPatientText: { flex: 1 },
  newPatientTitle: { ...Typography.h4 },
  newPatientSubtitle: { ...Typography.small },
  quickSheetRow: {
    flexDirection: "row",
    marginHorizontal: Spacing.lg,
    marginTop: Spacing.sm,
    gap: Spacing.sm,
  },
  quickSheetBtn: {
    flex: 1,
    alignItems: "center",
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.sm,
    borderRadius: BorderRadius.md,
    borderWidth: 1.5,
    gap: 4,
  },
  quickSheetBtnTitle: { fontSize: 14, fontWeight: "700" },
  quickSheetBtnSub: { fontSize: 11 },
  statsRow: {
    flexDirection: "row",
    marginHorizontal: Spacing.lg,
    marginTop: Spacing.lg,
    gap: Spacing.sm,
  },
  statCard: {
    flex: 1,
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    borderLeftWidth: 4,
    alignItems: "center",
  },
  statNumber: { ...Typography.h2 },
  statLabel: { ...Typography.caption, marginTop: 2 },
  section: { marginTop: Spacing.xl, marginHorizontal: Spacing.lg },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: Spacing.md,
  },
  sectionTitle: { ...Typography.h4 },
  sectionCount: { ...Typography.small },
  emptyState: {
    alignItems: "center",
    paddingVertical: Spacing["4xl"],
    borderRadius: BorderRadius.md,
  },
  emptyText: { ...Typography.body, marginTop: Spacing.md },
  emptySubtext: { ...Typography.small, marginTop: Spacing.xs },
  caseCard: {
    flexDirection: "column",
    borderRadius: BorderRadius.md,
    marginBottom: Spacing.sm,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.05)",
  },
  caseCardInner: {
    flexDirection: "row",
  },
  caseCardWarning: { borderColor: TriageColors.yellow, borderWidth: 2 },
  priorityBar: { width: 6 },
  caseContent: { flex: 1, padding: Spacing.md },
  caseTopRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" },
  caseInfo: { flex: 1 },
  patientName: { ...Typography.h4 },
  patientDetails: { ...Typography.small, marginTop: 2 },
  badgesRow: { flexDirection: "row", alignItems: "center", gap: Spacing.xs },
  draftBadge: { flexDirection: "row", alignItems: "center", paddingHorizontal: Spacing.xs, paddingVertical: 2, borderRadius: BorderRadius.full, gap: 2 },
  draftBadgeText: { fontSize: 10, fontWeight: "600", color: "#d97706" },
  statusBadge: { paddingHorizontal: Spacing.sm, paddingVertical: 4, borderRadius: BorderRadius.full },
  statusText: { ...Typography.caption, fontWeight: "700" },
  complaint: { ...Typography.small, marginTop: Spacing.sm, fontStyle: "italic" },
  caseBottomRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: Spacing.sm,
  },
  timeInfo: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: Spacing.sm },
  timeText: { ...Typography.caption },
  warningBadge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, marginLeft: 6 },
  warningText: { fontSize: 10, fontWeight: "600", color: "#d97706" },
  caseActions: { flexDirection: "row", gap: Spacing.xs, paddingHorizontal: Spacing.md, paddingBottom: Spacing.md },
  actionBtn: { paddingVertical: 6, paddingHorizontal: 8, borderRadius: BorderRadius.sm, alignItems: "center", gap: 2, flex: 1 },
  actionBtnLabel: { fontSize: 9, fontWeight: "600", textAlign: "center" },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    alignItems: "center",
    padding: Spacing.xl,
  },
  downloadModal: {
    width: "100%",
    maxWidth: 340,
    borderRadius: BorderRadius.lg,
    padding: Spacing.xl,
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: Spacing.sm,
  },
  modalTitle: { ...Typography.h3 },
  modalPatient: { ...Typography.body, marginBottom: Spacing.lg },
  exportingContainer: {
    alignItems: "center",
    paddingVertical: Spacing["3xl"],
  },
  exportingText: { ...Typography.body, marginTop: Spacing.md },
  downloadOptions: {},
  downloadSectionTitle: { ...Typography.label, marginBottom: Spacing.sm },
  downloadRow: {
    flexDirection: "row",
    gap: Spacing.md,
  },
  downloadBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.sm,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.md,
  },
  downloadBtnText: { ...Typography.label },
  downloadNote: { ...Typography.small, textAlign: "center" as const },
  statsNavCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
    padding: Spacing.md,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    marginHorizontal: Spacing.lg,
    marginTop: Spacing.md,
  },
  statsNavIcon: {
    width: 40,
    height: 40,
    borderRadius: BorderRadius.md,
    justifyContent: "center",
    alignItems: "center",
  },
  statsNavTitle: { ...Typography.bodyMedium, fontSize: 14 },
  statsNavSub: { fontSize: 12, marginTop: 2 },
  creditsWidget: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: Spacing.md,
    borderRadius: BorderRadius.lg,
    borderWidth: 1.5,
    marginHorizontal: Spacing.lg,
    marginTop: Spacing.md,
  },
  creditsWidgetLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
  },
  creditsWidgetTitle: { ...Typography.bodyMedium, fontSize: 14 },
  creditsWidgetStatus: { fontSize: 11, fontWeight: "600" },
  creditsWidgetRight: { alignItems: "flex-end" },
  creditsWidgetValue: { fontSize: 24, fontWeight: "800" },
  creditsWidgetLabel: { fontSize: 10, fontWeight: "500" },
  newPatientModalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "flex-end",
  },
  newPatientModalSheet: {
    borderTopLeftRadius: BorderRadius.xl,
    borderTopRightRadius: BorderRadius.xl,
    padding: Spacing.xl,
    paddingBottom: 40,
  },
  newPatientModalHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    alignSelf: "center",
    marginBottom: Spacing.lg,
  },
  newPatientModalTitle: { ...Typography.h3, marginBottom: Spacing.xs },
  newPatientModalSub: { ...Typography.body, marginBottom: Spacing.xl },
  newPatientOption: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
    padding: Spacing.lg,
    borderRadius: BorderRadius.lg,
  },
  newPatientOptionIcon: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: "rgba(255,255,255,0.2)",
    justifyContent: "center",
    alignItems: "center",
  },
  newPatientOptionText: { flex: 1 },
  newPatientOptionTitle: { fontSize: 16, fontWeight: "700", color: "#FFFFFF", marginBottom: 2 },
  newPatientOptionSub: { fontSize: 12, color: "rgba(255,255,255,0.8)", lineHeight: 16 },
});
