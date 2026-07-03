import React from "react";
import {
  View,
  Text,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius } from "@/constants/theme";
import { SmartDictationExtracted } from "./SmartDictation";

export type TabType =
  | "patient"
  | "history"
  | "primary"
  | "exam"
  | "treatment"
  | "notes"
  | "disposition";

export interface TabCompletion {
  filled: number;
  total: number;
}

export interface DictationCompletion {
  patient: TabCompletion;
  history: TabCompletion;
  primary: TabCompletion;
  exam: TabCompletion;
  treatment: TabCompletion;
  notes: TabCompletion;
  disposition: TabCompletion;
  totalFilled: number;
  totalFields: number;
}

function isFilled(value: any): boolean {
  if (value === null || value === undefined) return false;
  if (typeof value === "string") {
    const t = value.toLowerCase().trim();
    return t !== "" && t !== "not mentioned" && t !== "none" && t !== "n/a" && t !== "unknown";
  }
  if (Array.isArray(value)) return value.length > 0;
  if (typeof value === "boolean") return value;
  if (typeof value === "object") return Object.values(value).some((v) => isFilled(v));
  return Boolean(value);
}

export function calculateDictationCompletion(
  data: SmartDictationExtracted
): DictationCompletion {
  const f = isFilled;

  const patient: TabCompletion = {
    filled: (
      [
        f(data.patientName),
        f(data.patientAge),
        f(data.patientSex),
        f(data.chiefComplaint) || (data.symptoms && data.symptoms.length > 0),
        f(data.vitalsSuggested?.hr),
        f(data.vitalsSuggested?.bp),
        f(data.vitalsSuggested?.spo2),
        f(data.vitalsSuggested?.rr),
        f(data.vitalsSuggested?.temperature),
        f(data.vitalsSuggested?.grbs),
      ] as boolean[]
    ).filter(Boolean).length,
    total: 10,
  };

  const history: TabCompletion = {
    filled: (
      [
        f(data.chiefComplaint) || (data.symptoms && data.symptoms.length > 0),
        f(data.allergies),
        f(data.currentMedications),
        f(data.pastMedicalHistory) || f(data.pastSurgicalHistory),
        f(data.historyOfPresentIllness) || (!!data.painDetails && f(data.painDetails)),
        f(data.familyHistory),
        f(data.socialHistory),
      ] as boolean[]
    ).filter(Boolean).length,
    total: 7,
  };

  const primary: TabCompletion = {
    filled: (
      [
        f(data.vitalsSuggested?.rr) || f(data.vitalsSuggested?.spo2),
        f(data.vitalsSuggested?.hr) || f(data.vitalsSuggested?.bp),
        f(data.vitalsSuggested?.grbs),
        f(data.vitalsSuggested?.temperature),
        f(data.vbgResults?.ph),
        f(data.abcdeFindings?.airway?.status) || f(data.abcdeFindings?.airway?.interventions),
        f(data.abcdeFindings?.breathing?.status) || f(data.abcdeFindings?.breathing?.addedSounds),
        f(data.abcdeFindings?.circulation?.status) || f(data.abcdeFindings?.circulation?.rhythm),
        f(data.abcdeFindings?.disability?.status) || f(data.abcdeFindings?.disability?.pupilSize),
        f(data.ecgInterpretation),
      ] as boolean[]
    ).filter(Boolean).length,
    total: 10,
  };

  const exam: TabCompletion = {
    filled: (
      [
        f(data.examFindings?.general) || f(data.examStructured?.general) || !!data.restAllNormal,
        f(data.examFindings?.heent),
        f(data.examFindings?.respiratory) || f(data.examStructured?.respiratory) || !!data.restAllNormal,
        f(data.examFindings?.cvs) || f(data.examStructured?.cvs) || !!data.restAllNormal,
        f(data.examFindings?.abdomen) || f(data.examStructured?.abdomen) || !!data.restAllNormal,
        f(data.examFindings?.cns) || f(data.examStructured?.cns) || !!data.restAllNormal,
        !!data.restAllNormal,
        f(data.examFindings?.skin),
        f(data.examFindings?.musculoskeletal) || f(data.examStructured?.extremities) || !!data.restAllNormal,
      ] as boolean[]
    ).filter(Boolean).length,
    total: 9,
  };

  const treatment: TabCompletion = {
    filled: (
      [
        !!(data.prescribedMedications && data.prescribedMedications.length > 0),
        !!(data.prescribedInfusions && data.prescribedInfusions.length > 0),
        f(data.treatmentNotes),
        f(data.investigationsOrdered),
        f(data.imagingOrdered),
        f(data.resultsSummary),
      ] as boolean[]
    ).filter(Boolean).length,
    total: 6,
  };

  const notes: TabCompletion = {
    filled: ([f(data.treatmentNotes) || f(data.addendumNotes)] as boolean[]).filter(Boolean).length,
    total: 1,
  };

  const disposition: TabCompletion = {
    filled: (
      [
        !!(data.diagnosis && data.diagnosis.length > 0),
        !!(data.differentialDiagnosis && data.differentialDiagnosis.length > 0),
        f(data.dispositionSuggested?.type),
        f(data.dispositionSuggested?.admitTo) || f(data.dispositionSuggested?.referTo),
      ] as boolean[]
    ).filter(Boolean).length,
    total: 4,
  };

  const totalFilled =
    patient.filled +
    history.filled +
    primary.filled +
    exam.filled +
    treatment.filled +
    notes.filled +
    disposition.filled;
  const totalFields =
    patient.total +
    history.total +
    primary.total +
    exam.total +
    treatment.total +
    notes.total +
    disposition.total;

  return {
    patient,
    history,
    primary,
    exam,
    treatment,
    notes,
    disposition,
    totalFilled,
    totalFields,
  };
}

export function getTabStatus(
  tc: TabCompletion
): "full" | "partial" | "empty" {
  if (tc.filled === 0) return "empty";
  if (tc.filled >= tc.total * 0.75) return "full";
  return "partial";
}

const STATUS_COLOR: Record<"full" | "partial" | "empty", string> = {
  full: "#10b981",
  partial: "#f59e0b",
  empty: "#ef4444",
};

const STATUS_ICON: Record<"full" | "partial" | "empty", string> = {
  full: "check-circle",
  partial: "alert-circle",
  empty: "x-circle",
};

const STATUS_LABEL: Record<"full" | "partial" | "empty", string> = {
  full: "Good coverage",
  partial: "Partial",
  empty: "Not captured",
};

const TAB_META: Array<{
  key: TabType;
  label: string;
  icon: string;
  desc: string;
}> = [
  { key: "patient", label: "Patient", icon: "user", desc: "Demographics & vitals" },
  { key: "history", label: "History", icon: "file-text", desc: "SAMPLE history" },
  { key: "primary", label: "Primary Survey", icon: "activity", desc: "ABCDE & adjuncts" },
  { key: "exam", label: "Examination", icon: "clipboard", desc: "System examination" },
  { key: "treatment", label: "Treatment", icon: "plus-square", desc: "Meds, fluids & investigations" },
  { key: "notes", label: "Notes", icon: "file", desc: "Addendum notes" },
  { key: "disposition", label: "Disposition", icon: "log-out", desc: "Diagnosis & plan" },
];

interface Props {
  visible: boolean;
  completion: DictationCompletion | null;
  onClose: () => void;
  onReviewGaps: (firstGapTab: TabType) => void;
}

export default function DictationResultModal({
  visible,
  completion,
  onClose,
  onReviewGaps,
}: Props) {
  const { theme } = useTheme();

  if (!completion) return null;

  const firstGap: TabType =
    TAB_META.find((t) => getTabStatus(completion[t.key]) === "empty")?.key ??
    "patient";

  const pct = Math.round((completion.totalFilled / completion.totalFields) * 100);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={[styles.sheet, { backgroundColor: theme.card }]}>
          <View style={styles.handle} />

          <View style={styles.topRow}>
            <View style={[styles.micCircle, { backgroundColor: theme.primary + "20" }]}>
              <Feather name="mic" size={22} color={theme.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.title, { color: theme.text }]}>
                Dictation Complete
              </Text>
              <Text style={[styles.subtitle, { color: theme.textSecondary }]}>
                {completion.totalFilled} of {completion.totalFields} fields captured ({pct}%)
              </Text>
            </View>
          </View>

          <View style={[styles.overallBar, { backgroundColor: theme.backgroundSecondary }]}>
            <View
              style={[
                styles.overallFill,
                {
                  width: `${pct}%` as any,
                  backgroundColor:
                    pct >= 75 ? "#10b981" : pct >= 40 ? "#f59e0b" : "#ef4444",
                },
              ]}
            />
          </View>

          <ScrollView style={{ maxHeight: 340 }} showsVerticalScrollIndicator={false}>
            {TAB_META.map((meta) => {
              const tc = completion[meta.key];
              const status = getTabStatus(tc);
              const color = STATUS_COLOR[status];
              const barPct = Math.round((tc.filled / tc.total) * 100);

              return (
                <View
                  key={meta.key}
                  style={[styles.row, { borderBottomColor: theme.border }]}
                >
                  <View style={styles.rowLeft}>
                    <View
                      style={[
                        styles.tabIcon,
                        { backgroundColor: color + "18" },
                      ]}
                    >
                      <Feather
                        name={meta.icon as any}
                        size={14}
                        color={color}
                      />
                    </View>
                    <View>
                      <Text style={[styles.tabLabel, { color: theme.text }]}>
                        {meta.label}
                      </Text>
                      <Text
                        style={[
                          styles.tabDesc,
                          { color: theme.textSecondary },
                        ]}
                      >
                        {tc.filled}/{tc.total} fields · {STATUS_LABEL[status]}
                      </Text>
                    </View>
                  </View>
                  <View style={styles.rowRight}>
                    <View style={[styles.miniBar, { backgroundColor: theme.backgroundSecondary }]}>
                      <View
                        style={[
                          styles.miniFill,
                          {
                            width: `${barPct}%` as any,
                            backgroundColor: color,
                          },
                        ]}
                      />
                    </View>
                    <Feather
                      name={STATUS_ICON[status] as any}
                      size={18}
                      color={color}
                    />
                  </View>
                </View>
              );
            })}
          </ScrollView>

          <View style={styles.actions}>
            {firstGap !== undefined && completion.totalFilled < completion.totalFields && (
              <Pressable
                style={({ pressed }) => [
                  styles.reviewBtn,
                  {
                    backgroundColor: theme.backgroundSecondary,
                    opacity: pressed ? 0.7 : 1,
                  },
                ]}
                onPress={() => onReviewGaps(firstGap)}
              >
                <Feather name="search" size={15} color={theme.primary} />
                <Text style={[styles.reviewBtnText, { color: theme.primary }]}>
                  Review gaps
                </Text>
              </Pressable>
            )}
            <Pressable
              style={({ pressed }) => [
                styles.doneBtn,
                { backgroundColor: theme.primary, opacity: pressed ? 0.85 : 1 },
              ]}
              onPress={onClose}
            >
              <Text style={styles.doneBtnText}>Done</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.45)",
    justifyContent: "flex-end",
  },
  sheet: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: Spacing.lg,
    paddingBottom: 32,
    paddingTop: 12,
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: "#d1d5db",
    alignSelf: "center",
    marginBottom: 16,
  },
  topRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 12,
  },
  micCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: "center",
    alignItems: "center",
  },
  title: { fontSize: 17, fontWeight: "700" },
  subtitle: { fontSize: 13, marginTop: 2 },
  overallBar: {
    height: 8,
    borderRadius: 4,
    marginBottom: 16,
    overflow: "hidden",
  },
  overallFill: { height: 8, borderRadius: 4 },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  rowLeft: { flexDirection: "row", alignItems: "center", gap: 10, flex: 1 },
  tabIcon: {
    width: 30,
    height: 30,
    borderRadius: 8,
    justifyContent: "center",
    alignItems: "center",
  },
  tabLabel: { fontSize: 14, fontWeight: "600" },
  tabDesc: { fontSize: 11, marginTop: 1 },
  rowRight: { flexDirection: "row", alignItems: "center", gap: 8 },
  miniBar: { width: 60, height: 6, borderRadius: 3, overflow: "hidden" },
  miniFill: { height: 6, borderRadius: 3 },
  actions: { flexDirection: "row", gap: 10, marginTop: 18 },
  reviewBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 13,
    borderRadius: BorderRadius.md,
  },
  reviewBtnText: { fontSize: 14, fontWeight: "600" },
  doneBtn: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 13,
    borderRadius: BorderRadius.md,
  },
  doneBtnText: { color: "#fff", fontSize: 14, fontWeight: "700" },
});
