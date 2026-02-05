import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Pressable,
  TextInput,
  Alert,
} from "react-native";
import { useNavigation, useRoute, RouteProp } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { useTheme } from "@/hooks/useTheme";
import { apiGet, apiPut } from "@/lib/api";
import { isPediatric } from "@/lib/pediatricVitals";
import { Spacing, BorderRadius, Typography, TriageColors } from "@/constants/theme";
import type { RootStackParamList } from "@/navigation/RootStackNavigator";

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;
type RouteProps = RouteProp<RootStackParamList, "ViewCase">;

const getTriageColor = (color?: string) => {
  const colors: Record<string, string> = {
    red: TriageColors.red,
    orange: TriageColors.orange,
    yellow: TriageColors.yellow,
    green: TriageColors.green,
    blue: TriageColors.blue,
  };
  return colors[color?.toLowerCase() || ""] || TriageColors.gray;
};

const getPriorityLabel = (level: number) => {
  switch (level) {
    case 1: return "RED - Resuscitation";
    case 2: return "ORANGE - Emergent";
    case 3: return "YELLOW - Urgent";
    case 4: return "GREEN - Less Urgent";
    case 5: return "BLUE - Non-Urgent";
    default: return "Not Assigned";
  }
};

export default function ViewCaseScreen() {
  const navigation = useNavigation<NavigationProp>();
  const route = useRoute<RouteProps>();
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const { caseId } = route.params;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [caseData, setCaseData] = useState<any>(null);
  const [editMode, setEditMode] = useState(false);

  const editableFieldsRef = useRef<Record<string, string>>({});

  useEffect(() => {
    loadCaseData();
  }, [caseId]);

  const loadCaseData = async () => {
    try {
      setLoading(true);
      const res = await apiGet<any>(`/cases/${caseId}`);
      if (res.success && res.data) {
        console.log("ViewCaseScreen: full treatment object:", JSON.stringify(res.data.treatment, null, 2));
        console.log("ViewCaseScreen: checking all medication paths...");
        
        // Check for medications under ALL possible field paths (UI should be tolerant)
        const medications = res.data.treatment?.medications 
          || res.data.treatment?.medications_given 
          || res.data.treatment?.given_medications
          || res.data.treatment?.meds
          || res.data.medications
          || res.data.discharge?.medications
          || res.data.disposition?.discharge_medications
          || [];
        
        console.log("ViewCaseScreen: found medications:", JSON.stringify(medications, null, 2));
        
        // Ensure treatment object exists and has medications
        if (!res.data.treatment) {
          res.data.treatment = {};
        }
        if (medications.length > 0) {
          res.data.treatment.medications = medications;
        }
        
        setCaseData(res.data);
        editableFieldsRef.current = {
          presenting_complaint: res.data.presenting_complaint?.text || "",
          hopi: res.data.history?.hpi || res.data.history?.events_hopi || "",
          past_medical: Array.isArray(res.data.history?.past_medical) ? res.data.history.past_medical.join(", ") : (res.data.history?.past_medical || ""),
          past_surgical: res.data.history?.past_surgical || "",
          allergies: Array.isArray(res.data.history?.allergies) ? res.data.history.allergies.join(", ") : (res.data.history?.allergies || ""),
          medications: res.data.history?.medications || res.data.history?.drug_history || "",
          intervention_notes: res.data.treatment?.intervention_notes || "",
          differential_diagnoses: Array.isArray(res.data.treatment?.differential_diagnoses) ? res.data.treatment.differential_diagnoses.join(", ") : "",
          provisional_diagnoses: Array.isArray(res.data.treatment?.provisional_diagnoses) ? res.data.treatment.provisional_diagnoses.join(", ") : "",
        };
      }
    } catch (err) {
      console.error("Error loading case:", err);
      Alert.alert("Error", "Unable to load case data");
    } finally {
      setLoading(false);
    }
  };

  const updateEditableField = useCallback((field: string, value: string) => {
    editableFieldsRef.current[field] = value;
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      const updatePayload = {
        presenting_complaint: {
          ...(caseData.presenting_complaint || {}),
          text: editableFieldsRef.current.presenting_complaint,
        },
        history: {
          ...(caseData.history || {}),
          hpi: editableFieldsRef.current.hopi,
          events_hopi: editableFieldsRef.current.hopi,
          past_medical: editableFieldsRef.current.past_medical.split(",").map((s: string) => s.trim()).filter(Boolean),
          past_surgical: editableFieldsRef.current.past_surgical,
          allergies: editableFieldsRef.current.allergies.split(",").map((s: string) => s.trim()).filter(Boolean),
          medications: editableFieldsRef.current.medications,
        },
        treatment: {
          ...(caseData.treatment || {}),
          intervention_notes: editableFieldsRef.current.intervention_notes,
          differential_diagnoses: editableFieldsRef.current.differential_diagnoses.split(",").map((s: string) => s.trim()).filter(Boolean),
          provisional_diagnoses: editableFieldsRef.current.provisional_diagnoses.split(",").map((s: string) => s.trim()).filter(Boolean),
        },
      };

      const res = await apiPut(`/cases/${caseId}`, updatePayload);
      if (res.success) {
        Alert.alert("Saved", "Case sheet updated successfully");
        setEditMode(false);
        loadCaseData();
      } else {
        throw new Error((res.error as any)?.message || "Failed to save");
      }
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err || "Failed to save case sheet");
      Alert.alert("Error", errMsg);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: theme.backgroundDefault }]}>
        <ActivityIndicator size="large" color={theme.primary} />
        <Text style={[styles.loadingText, { color: theme.textSecondary }]}>Loading case sheet...</Text>
      </View>
    );
  }

  if (!caseData) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: theme.backgroundDefault }]}>
        <Text style={[styles.errorText, { color: theme.textSecondary }]}>Unable to load case data</Text>
        <Pressable style={[styles.retryBtn, { backgroundColor: theme.primary }]} onPress={loadCaseData}>
          <Text style={styles.retryBtnText}>Retry</Text>
        </Pressable>
      </View>
    );
  }

  const patient = caseData.patient || {};
  const vitals = caseData.vitals_at_arrival || {};
  const primary = caseData.primary_assessment || caseData.abcde || {};
  const adjuncts = caseData.adjuncts || {};
  const history = caseData.history || {};
  const examination = caseData.examination || {};
  const investigations = caseData.investigations || {};
  const treatment = caseData.treatment || {};
  const disposition = caseData.disposition || {};

  // Helper to filter out unwanted placeholder text from external backend
  const cleanText = (text: string | undefined | null): string => {
    if (!text) return "";
    return text
      .replace(/For more information,?\s*visit\s*www\.FEMA\.gov\.?/gi, "")
      .replace(/For further information regarding laboratory results,?\s*visit\s*www\.FEMA\.gov\.?/gi, "")
      .replace(/www\.FEMA\.gov/gi, "")
      .trim();
  };

  const gcsTotal = (vitals.gcs_e || 0) + (vitals.gcs_v || 0) + (vitals.gcs_m || 0);

  const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
    <View style={[styles.section, { backgroundColor: theme.card }]}>
      <Text style={[styles.sectionTitle, { color: theme.text }]}>{title}</Text>
      {children}
    </View>
  );

  const SubSection = ({ title, children }: { title: string; children: React.ReactNode }) => (
    <View style={styles.subSection}>
      <Text style={[styles.subSectionTitle, { color: theme.primary }]}>{title}</Text>
      {children}
    </View>
  );

  const InfoRow = ({ label, value }: { label: string; value?: string | number | null }) => (
    <View style={styles.infoRow}>
      <Text style={[styles.infoLabel, { color: theme.textSecondary }]}>{label}:</Text>
      <Text style={[styles.infoValue, { color: theme.text }]}>{value || "N/A"}</Text>
    </View>
  );

  const VitalBox = ({ label, value, unit }: { label: string; value?: string | number | null; unit: string }) => (
    <View style={[styles.vitalBox, { backgroundColor: theme.backgroundSecondary }]}>
      <Text style={[styles.vitalLabel, { color: theme.textSecondary }]}>{label}</Text>
      <Text style={[styles.vitalValue, { color: theme.text }]}>{value || "-"}</Text>
      <Text style={[styles.vitalUnit, { color: theme.textMuted }]}>{unit}</Text>
    </View>
  );

  const ExamSection = ({ title, status, notes }: { title: string; status?: string; notes?: string }) => (
    <View style={styles.examSection}>
      <Text style={[styles.examSectionTitle, { color: theme.text }]}>{title}: {status || "Normal"}</Text>
      <Text style={[styles.examDetail, { color: theme.textSecondary }]}>{notes || "No additional notes"}</Text>
    </View>
  );

  const airway = primary.airway || {};
  const breathing = primary.breathing || {};
  const circulation = primary.circulation || {};
  const disability = primary.disability || {};
  const exposure = primary.exposure || {};

  return (
    <View style={[styles.container, { backgroundColor: theme.backgroundDefault }]}>
      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + Spacing["4xl"] }]} showsVerticalScrollIndicator={false}>
        
        <Section title="Patient Information">
          <InfoRow label="Name" value={patient.name} />
          <InfoRow label="Age/Sex" value={`${patient.age || "N/A"} / ${patient.sex || "N/A"}`} />
          <InfoRow label="UHID" value={patient.uhid} />
          <InfoRow label="Phone" value={patient.phone} />
          <InfoRow label="Mode of Arrival" value={patient.mode_of_arrival || caseData.mode_of_arrival} />
          <InfoRow label="MLC" value={caseData.mlc ? "Yes" : "No"} />
          <InfoRow label="Arrival Time" value={patient.arrival_datetime ? new Date(patient.arrival_datetime).toLocaleString("en-IN") : "N/A"} />
        </Section>

        {caseData.triage_priority && (
          <Section title="Triage">
            <View style={[styles.triageBadge, { backgroundColor: getTriageColor(caseData.triage_color) }]}>
              <Text style={styles.triageBadgeText}>Priority {caseData.triage_priority} - {caseData.triage_color?.toUpperCase() || "N/A"}</Text>
            </View>
            <View style={styles.vitalsGrid}>
              <VitalBox label="HR" value={vitals.hr} unit="bpm" />
              <VitalBox label="BP" value={`${vitals.bp_systolic || "-"}/${vitals.bp_diastolic || "-"}`} unit="mmHg" />
              <VitalBox label="RR" value={vitals.rr} unit="/min" />
              <VitalBox label="SpO2" value={vitals.spo2} unit="%" />
              <VitalBox label="Temp" value={vitals.temperature} unit="C" />
              <VitalBox label="GCS" value={gcsTotal || "-"} unit={`E${vitals.gcs_e || "-"}V${vitals.gcs_v || "-"}M${vitals.gcs_m || "-"}`} />
              <VitalBox label="GRBS" value={vitals.grbs} unit="mg/dL" />
              <VitalBox label="Pain" value={vitals.pain_score} unit="/10" />
            </View>
          </Section>
        )}

        {!caseData.triage_priority && (
          <Section title="Vitals at Arrival">
            <View style={styles.vitalsGrid}>
              <VitalBox label="HR" value={vitals.hr} unit="bpm" />
              <VitalBox label="BP" value={`${vitals.bp_systolic || "-"}/${vitals.bp_diastolic || "-"}`} unit="mmHg" />
              <VitalBox label="RR" value={vitals.rr} unit="/min" />
              <VitalBox label="SpO2" value={vitals.spo2} unit="%" />
              <VitalBox label="Temp" value={vitals.temperature} unit="C" />
              <VitalBox label="GCS" value={gcsTotal || "-"} unit={`E${vitals.gcs_e || "-"}V${vitals.gcs_v || "-"}M${vitals.gcs_m || "-"}`} />
              <VitalBox label="GRBS" value={vitals.grbs} unit="mg/dL" />
            </View>
          </Section>
        )}

        <Section title="Presenting Complaint">
          {editMode ? (
            <TextInput style={[styles.editableTextArea, { backgroundColor: "#FEF9C3", color: theme.text }]} multiline numberOfLines={3} defaultValue={editableFieldsRef.current.presenting_complaint} onChangeText={(text) => updateEditableField("presenting_complaint", text)} placeholder="Chief complaint..." placeholderTextColor={theme.textMuted} />
          ) : (
            <Text style={[styles.text, { color: theme.text }]}>{caseData.presenting_complaint?.text || "N/A"}</Text>
          )}
          <InfoRow label="Duration" value={caseData.presenting_complaint?.duration} />
          <InfoRow label="Onset" value={caseData.presenting_complaint?.onset_type} />
        </Section>

        <Section title="Primary Assessment (ABCDE)">
          <SubSection title="A - Airway">
            <InfoRow label="Status" value={airway.status || primary.airway_status || "Patent"} />
            {(airway.interventions?.length > 0 || primary.airway_interventions?.length > 0) && (
              <InfoRow label="Interventions" value={(airway.interventions || primary.airway_interventions || []).join(", ")} />
            )}
            {(airway.notes || primary.airway_additional_notes) && <InfoRow label="Notes" value={airway.notes || primary.airway_additional_notes} />}
          </SubSection>

          <SubSection title="B - Breathing">
            <InfoRow label="RR" value={breathing.rr || primary.breathing_rr || "-"} />
            <InfoRow label="SpO2" value={`${breathing.spo2 || primary.breathing_spo2 || "-"}%`} />
            <InfoRow label="Work of Breathing" value={breathing.effort || primary.breathing_work || "Normal"} />
            {(breathing.o2Device || primary.breathing_oxygen_device) && (
              <InfoRow label="O2 Device" value={`${breathing.o2Device || primary.breathing_oxygen_device} @ ${breathing.o2Flow || primary.breathing_oxygen_flow || "-"} L/min`} />
            )}
          </SubSection>

          <SubSection title="C - Circulation">
            <InfoRow label="HR" value={circulation.hr || primary.circulation_hr || "-"} />
            <InfoRow label="BP" value={`${circulation.bpSystolic || primary.circulation_bp_systolic || "-"}/${circulation.bpDiastolic || primary.circulation_bp_diastolic || "-"}`} />
            <InfoRow label="CRT" value={`${circulation.capillaryRefill || primary.circulation_crt || "-"} sec`} />
            {(circulation.interventions?.length > 0 || primary.circulation_adjuncts?.length > 0) && (
              <InfoRow label="IV Access" value={(circulation.interventions || primary.circulation_adjuncts || []).join(", ")} />
            )}
          </SubSection>

          <SubSection title="D - Disability">
            <InfoRow label="AVPU" value={disability.motorResponse || primary.disability_avpu || "Alert"} />
            <InfoRow label="GCS" value={`E${disability.gcsE || primary.disability_gcs_e || "-"}V${disability.gcsV || primary.disability_gcs_v || "-"}M${disability.gcsM || primary.disability_gcs_m || "-"}`} />
            <InfoRow label="Pupils" value={`${disability.pupilSize || primary.disability_pupils_size || "Normal"} - ${disability.pupilReaction || primary.disability_pupils_reaction || "Reactive"}`} />
            <InfoRow label="GRBS" value={`${disability.glucose || primary.disability_grbs || "-"} mg/dL`} />
          </SubSection>

          <SubSection title="E - Exposure">
            <InfoRow label="Temperature" value={`${exposure.temperature || primary.exposure_temperature || "-"}C`} />
            {(exposure.notes || primary.exposure_additional_notes) && <InfoRow label="Notes" value={exposure.notes || primary.exposure_additional_notes} />}
          </SubSection>
        </Section>

        {(adjuncts.ecg_findings || adjuncts.bedside_echo || adjuncts.additional_notes || adjuncts.efast_status || adjuncts.efast_notes) && (
          <Section title="Adjuncts to Primary Survey">
            {(adjuncts.additional_notes) && (
              <SubSection title="ABG / VBG">
                <Text style={[styles.text, { color: theme.text }]}>{adjuncts.additional_notes}</Text>
              </SubSection>
            )}
            {(adjuncts.ecg_findings) && (
              <SubSection title="ECG">
                <Text style={[styles.text, { color: theme.text }]}>{adjuncts.ecg_findings}</Text>
              </SubSection>
            )}
            {(adjuncts.efast_status || adjuncts.efast_notes) && (
              <SubSection title="EFAST">
                <InfoRow label="Status" value={adjuncts.efast_status} />
                {adjuncts.efast_notes && <Text style={[styles.text, { color: theme.text }]}>{adjuncts.efast_notes}</Text>}
              </SubSection>
            )}
            {(adjuncts.bedside_echo) && (
              <SubSection title="Bedside Echo">
                <Text style={[styles.text, { color: theme.text }]}>{adjuncts.bedside_echo}</Text>
              </SubSection>
            )}
          </Section>
        )}

        <Section title="History">
          <SubSection title="Events / HOPI">
            {editMode ? (
              <TextInput style={[styles.editableTextArea, { backgroundColor: "#FEF9C3", color: theme.text }]} multiline numberOfLines={4} defaultValue={editableFieldsRef.current.hopi} onChangeText={(text) => updateEditableField("hopi", text)} placeholder="History of present illness..." placeholderTextColor={theme.textMuted} />
            ) : (
              <Text style={[styles.text, { color: theme.text }]}>{history.hpi || history.events_hopi || caseData.sample?.eventsHopi || "N/A"}</Text>
            )}
          </SubSection>

          <SubSection title="Past Medical History">
            {editMode ? (
              <TextInput style={[styles.editableInput, { backgroundColor: "#FEF9C3", color: theme.text }]} defaultValue={editableFieldsRef.current.past_medical} onChangeText={(text) => updateEditableField("past_medical", text)} placeholder="e.g., DM, HTN, CAD (comma separated)" placeholderTextColor={theme.textMuted} />
            ) : (
              <Text style={[styles.text, { color: theme.text }]}>{Array.isArray(history.past_medical) ? history.past_medical.join(", ") : (history.past_medical || "None")}</Text>
            )}
          </SubSection>

          <SubSection title="Past Surgical History">
            {editMode ? (
              <TextInput style={[styles.editableInput, { backgroundColor: "#FEF9C3", color: theme.text }]} defaultValue={editableFieldsRef.current.past_surgical} onChangeText={(text) => updateEditableField("past_surgical", text)} placeholder="Surgical history..." placeholderTextColor={theme.textMuted} />
            ) : (
              <Text style={[styles.text, { color: theme.text }]}>{history.past_surgical || "None"}</Text>
            )}
          </SubSection>

          <SubSection title="Allergies">
            {editMode ? (
              <TextInput style={[styles.editableInput, { backgroundColor: "#FEF9C3", color: theme.text }]} defaultValue={editableFieldsRef.current.allergies} onChangeText={(text) => updateEditableField("allergies", text)} placeholder="Allergies (comma separated)" placeholderTextColor={theme.textMuted} />
            ) : (
              <Text style={[styles.text, { color: theme.text }]}>{Array.isArray(history.allergies) ? history.allergies.join(", ") : (history.allergies || "NKDA")}</Text>
            )}
          </SubSection>

          <SubSection title="Current Medications">
            {editMode ? (
              <TextInput style={[styles.editableInput, { backgroundColor: "#FEF9C3", color: theme.text }]} defaultValue={editableFieldsRef.current.medications} onChangeText={(text) => updateEditableField("medications", text)} placeholder="Current medications..." placeholderTextColor={theme.textMuted} />
            ) : (
              <Text style={[styles.text, { color: theme.text }]}>{history.medications || history.drug_history || "None"}</Text>
            )}
          </SubSection>

          {(history.last_meal || history.last_meal_lmp) && (
            <SubSection title="Last Meal">
              <Text style={[styles.text, { color: theme.text }]}>{history.last_meal || history.last_meal_lmp || "N/A"}</Text>
            </SubSection>
          )}

          {history.lmp && (
            <SubSection title="LMP (Last Menstrual Period)">
              <Text style={[styles.text, { color: theme.text }]}>{history.lmp}</Text>
            </SubSection>
          )}
        </Section>

        <Section title="Physical Examination">
          <ExamSection 
            title="General Examination" 
            status={(() => {
              const hasAbnormal = examination.general_pallor || examination.general_icterus || examination.general_cyanosis || examination.general_clubbing || examination.general_lymphadenopathy || examination.general_edema;
              return hasAbnormal ? "Abnormal" : (examination.general_appearance || "Normal");
            })()}
            notes={(() => {
              const hasAbnormal = examination.general_pallor || examination.general_icterus || examination.general_cyanosis || examination.general_clubbing || examination.general_lymphadenopathy || examination.general_edema;
              if (hasAbnormal) {
                const findings = [];
                if (examination.general_pallor) findings.push("Pallor present");
                if (examination.general_icterus) findings.push("Icterus present");
                if (examination.general_cyanosis) findings.push("Cyanosis present");
                if (examination.general_clubbing) findings.push("Clubbing present");
                if (examination.general_lymphadenopathy) findings.push("Lymphadenopathy present");
                if (examination.general_edema) findings.push("Edema present");
                return findings.join(". ") + (examination.general_additional_notes ? `. ${examination.general_additional_notes}` : "");
              }
              return examination.general_additional_notes || "Patient is conscious, alert, and oriented. No pallor, icterus, cyanosis, clubbing, lymphadenopathy, or edema noted.";
            })()}
          />
          <ExamSection 
            title="Cardiovascular System (CVS)" 
            status={examination.cvs_status || "Normal"} 
            notes={examination.cvs_status !== "Normal" 
              ? `S1/S2: ${examination.cvs_s1_s2 || "-"}, Pulse: ${examination.cvs_pulse || "-"} @ ${examination.cvs_pulse_rate || "-"}bpm, Apex: ${examination.cvs_apexBeat || "-"}${examination.cvs_murmurs ? `, Murmurs: ${examination.cvs_murmurs}` : ""}${examination.cvs_added_sounds ? `, Added sounds: ${examination.cvs_added_sounds}` : ""}${examination.cvs_additional_notes ? `. ${examination.cvs_additional_notes}` : ""}`
              : (examination.cvs_additional_notes || "S1 S2 heard, normal intensity. No murmurs, gallops, or rubs. JVP not elevated. Peripheral pulses well felt bilaterally.")
            } 
          />
          <ExamSection 
            title="Respiratory System" 
            status={examination.respiratory_status || "Normal"} 
            notes={examination.respiratory_status !== "Normal"
              ? `Expansion: ${examination.respiratory_expansion || "-"}, Breath sounds: ${examination.respiratory_breath_sounds || "-"}, Percussion: ${examination.respiratory_percussion || "-"}${examination.respiratory_added_sounds ? `, Added sounds: ${examination.respiratory_added_sounds}` : ""}${examination.respiratory_additional_notes ? `. ${examination.respiratory_additional_notes}` : ""}`
              : (examination.respiratory_additional_notes || "Bilateral equal air entry. Vesicular breath sounds. No wheeze, crackles, or rhonchi. Normal percussion notes.")
            }
          />
          <ExamSection 
            title="Abdomen" 
            status={examination.abdomen_status || "Normal"} 
            notes={examination.abdomen_status !== "Normal"
              ? `Bowel sounds: ${examination.abdomen_bowel_sounds || "-"}, Percussion: ${examination.abdomen_percussion || "-"}${examination.abdomen_organomegaly ? `, Organomegaly: ${examination.abdomen_organomegaly}` : ""}${examination.abdomen_additional_notes ? `. ${examination.abdomen_additional_notes}` : ""}`
              : (examination.abdomen_additional_notes || "Soft, non-distended, non-tender. No guarding or rigidity. No organomegaly. Bowel sounds present and normal.")
            }
          />
          <ExamSection 
            title="Central Nervous System" 
            status={examination.cns_status || "Normal"} 
            notes={examination.cns_status !== "Normal"
              ? `Higher mental: ${examination.cns_higher_mental_functions || "-"}, Cranial nerves: ${examination.cns_cranial_nerves || "-"}, Motor: ${examination.cns_motor_system || "-"}, Sensory: ${examination.cns_sensory_system || "-"}, Reflexes: ${examination.cns_reflexes || "-"}${examination.cns_additional_notes ? `. ${examination.cns_additional_notes}` : ""}`
              : (examination.cns_additional_notes || "Conscious, oriented to time, place, and person. GCS 15/15. Cranial nerves intact. Pupils BERL. Motor power 5/5 in all limbs. Reflexes normal.")
            }
          />
          <ExamSection 
            title="Extremities" 
            status={examination.extremities_status || "Normal"} 
            notes={examination.extremities_status !== "Normal"
              ? (examination.extremities_findings || examination.extremities_additional_notes || "Abnormal findings documented")
              : (examination.extremities_additional_notes || "No edema, cyanosis, or clubbing. Peripheral pulses well felt. Full range of motion. No deformity or swelling.")
            }
          />
        </Section>

        <Section title="Investigations">
          {investigations.panels_selected?.length > 0 && <InfoRow label="Ordered" value={investigations.panels_selected.join(", ")} />}
          {investigations.individual_tests?.length > 0 && <InfoRow label="Tests" value={investigations.individual_tests.join(", ")} />}
          {investigations.imaging?.length > 0 && <InfoRow label="Imaging" value={Array.isArray(investigations.imaging) ? investigations.imaging.join(", ") : investigations.imaging} />}
          {cleanText(investigations.results_notes) ? (
            <Text style={[styles.text, { color: theme.text }]}>{cleanText(investigations.results_notes)}</Text>
          ) : null}
        </Section>

        <Section title="Treatment">
          {treatment.interventions?.length > 0 && <InfoRow label="Interventions" value={treatment.interventions.join(", ")} />}
          
          <SubSection title="Primary Diagnosis">
            <Text style={[styles.text, { color: theme.text }]}>{treatment.primary_diagnosis || treatment.provisional_diagnoses?.[0] || "N/A"}</Text>
          </SubSection>
          
          <SubSection title="Differential Diagnoses">
            {editMode ? (
              <TextInput style={[styles.editableInput, { backgroundColor: "#FEF9C3", color: theme.text }]} defaultValue={editableFieldsRef.current.differential_diagnoses} onChangeText={(text) => updateEditableField("differential_diagnoses", text)} placeholder="Differential diagnoses (comma separated)" placeholderTextColor={theme.textMuted} />
            ) : (
              <Text style={[styles.text, { color: theme.text }]}>{treatment.differential_diagnoses?.join(", ") || "N/A"}</Text>
            )}
          </SubSection>

          {treatment.medications?.length > 0 && (
            <SubSection title="Medications">
              {treatment.medications.map((med: any, idx: number) => (
                <View key={idx} style={styles.medicationItem}>
                  <Text style={[styles.medicationName, { color: theme.text }]}>• {med.name || med.drug_name}</Text>
                  <Text style={[styles.medicationDetails, { color: theme.textSecondary }]}>
                    {med.dose} - {med.route} - {med.frequency}
                  </Text>
                </View>
              ))}
            </SubSection>
          )}

          {treatment.infusions?.length > 0 && (
            <SubSection title="Infusions">
              {treatment.infusions.map((inf: any, idx: number) => (
                <View key={idx} style={styles.medicationItem}>
                  <Text style={[styles.medicationName, { color: theme.text }]}>• {inf.name || inf.drug_name}</Text>
                  <Text style={[styles.medicationDetails, { color: theme.textSecondary }]}>
                    {inf.dose} in {inf.dilution} - Rate: {inf.rate}
                  </Text>
                </View>
              ))}
            </SubSection>
          )}

          {treatment.fluids && (
            <SubSection title="IV Fluids">
              <Text style={[styles.text, { color: theme.text }]}>{treatment.fluids}</Text>
            </SubSection>
          )}

          <SubSection title="Notes">
            {editMode ? (
              <TextInput style={[styles.editableTextArea, { backgroundColor: "#FEF9C3", color: theme.text }]} multiline numberOfLines={3} defaultValue={editableFieldsRef.current.intervention_notes} onChangeText={(text) => updateEditableField("intervention_notes", text)} placeholder="Treatment notes..." placeholderTextColor={theme.textMuted} />
            ) : (
              <Text style={[styles.text, { color: theme.text }]}>{treatment.intervention_notes || treatment.other_medications || "N/A"}</Text>
            )}
          </SubSection>
        </Section>

        {(caseData.procedures_performed?.length > 0 || caseData.procedures?.procedures_performed?.length > 0) && (
          <Section title="Procedures Performed">
            {(caseData.procedures_performed || caseData.procedures?.procedures_performed || []).map((proc: any, idx: number) => (
              <View key={idx} style={styles.procedureItem}>
                <Text style={[styles.procedureName, { color: theme.text }]}>• {proc.name}</Text>
                {proc.notes && <Text style={[styles.procedureNotes, { color: theme.textSecondary }]}>{proc.notes}</Text>}
              </View>
            ))}
          </Section>
        )}

        {caseData.er_observation?.notes && (
          <Section title="ER Observation">
            <Text style={[styles.text, { color: theme.text }]}>{caseData.er_observation.notes}</Text>
            {caseData.er_observation.duration && <InfoRow label="Duration" value={caseData.er_observation.duration} />}
          </Section>
        )}

        {disposition.type && (
          <Section title="Disposition">
            <InfoRow label="Type" value={disposition.type} />
            {(disposition.admit_to || disposition.destination) && <InfoRow label="Destination" value={disposition.admit_to || disposition.destination} />}
            {disposition.admit_to_room && <InfoRow label="Room/Bed" value={disposition.admit_to_room} />}
            {disposition.refer_to && <InfoRow label="Referred To" value={disposition.refer_to} />}
            <InfoRow label="Condition" value={disposition.condition_at_discharge || disposition.condition} />
          </Section>
        )}

        {(() => {
          const addendumNotes = caseData.treatment?.addendum_notes || caseData.addendum_notes || [];
          const notesList = Array.isArray(addendumNotes) ? addendumNotes : (addendumNotes ? [addendumNotes] : []);
          return notesList.length > 0 ? (
            <Section title="Addendum Notes">
              {notesList.map((note: string, idx: number) => (
                <View key={idx} style={{ marginBottom: Spacing.sm }}>
                  <Text style={[styles.text, { color: theme.text }]}>{note}</Text>
                </View>
              ))}
            </Section>
          ) : null;
        })()}

        <Section title="Case Information">
          <InfoRow label="EM Resident" value={caseData.em_resident} />
          <InfoRow label="EM Consultant" value={caseData.em_consultant} />
          <InfoRow label="Status" value={caseData.status || "Draft"} />
          <InfoRow label="Created" value={caseData.created_at ? new Date(caseData.created_at).toLocaleString("en-IN") : "N/A"} />
          <InfoRow label="Last Updated" value={caseData.updated_at ? new Date(caseData.updated_at).toLocaleString("en-IN") : "N/A"} />
        </Section>

        <View style={styles.editSection}>
          <Pressable style={[styles.editToggleBtn, editMode && { backgroundColor: theme.success }]} onPress={() => setEditMode(!editMode)}>
            <Text style={[styles.editToggleBtnText, { color: editMode ? "#FFFFFF" : theme.primary }]}>{editMode ? "Done Editing" : "Edit Case Sheet"}</Text>
          </Pressable>
          {editMode && <Text style={[styles.editHint, { color: theme.textMuted }]}>Yellow fields are editable. Tap "Done Editing" when finished.</Text>}
        </View>

        <View style={styles.buttonRow}>
          {editMode && (
            <Pressable style={[styles.saveBtn, { backgroundColor: theme.primary }]} onPress={handleSave} disabled={saving}>
              <Text style={styles.saveBtnText}>{saving ? "Saving..." : "Save Changes"}</Text>
            </Pressable>
          )}
          <Pressable style={[styles.editBtn, { backgroundColor: theme.primary }]} onPress={() => {
            const patientAge = parseFloat(caseData?.patient?.age) || 0;
            const screenName = isPediatric(patientAge) ? "PediatricCaseSheet" : "CaseSheet";
            navigation.navigate(screenName, { caseId });
          }}>
            <Feather name="edit-2" size={18} color="#FFFFFF" />
            <Text style={styles.editBtnText}>Full Edit</Text>
          </Pressable>
          <Pressable style={[styles.dischargeBtn, { backgroundColor: theme.success }]} onPress={() => navigation.navigate("DischargeSummary", { caseId })}>
            <Feather name="file-text" size={18} color="#FFFFFF" />
            <Text style={styles.editBtnText}>Discharge</Text>
          </Pressable>
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  loadingContainer: { flex: 1, justifyContent: "center", alignItems: "center" },
  loadingText: { marginTop: Spacing.md, ...Typography.body },
  errorText: { ...Typography.body, marginBottom: Spacing.md },
  retryBtn: { paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md, borderRadius: BorderRadius.md },
  retryBtnText: { color: "#FFFFFF", ...Typography.bodyMedium },
  content: { padding: Spacing.lg },
  section: { borderRadius: BorderRadius.lg, padding: Spacing.lg, marginBottom: Spacing.lg },
  sectionTitle: { ...Typography.h4, marginBottom: Spacing.md },
  subSection: { marginBottom: Spacing.md, paddingLeft: Spacing.sm },
  subSectionTitle: { ...Typography.bodyMedium, marginBottom: Spacing.xs },
  infoRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: Spacing.xs, borderBottomWidth: 1, borderBottomColor: "rgba(0,0,0,0.05)" },
  infoLabel: { ...Typography.body, flex: 1 },
  infoValue: { ...Typography.bodyMedium, flex: 2, textAlign: "right" },
  triageBadge: { alignSelf: "flex-start", paddingHorizontal: Spacing.md, paddingVertical: Spacing.xs, borderRadius: BorderRadius.sm, marginBottom: Spacing.md },
  triageBadgeText: { color: "#FFFFFF", ...Typography.caption, fontWeight: "700" },
  vitalsGrid: { flexDirection: "row", flexWrap: "wrap", gap: Spacing.sm },
  vitalBox: { width: "23%", padding: Spacing.sm, borderRadius: BorderRadius.sm, alignItems: "center" },
  vitalLabel: { ...Typography.caption, marginBottom: 2 },
  vitalValue: { ...Typography.bodyMedium },
  vitalUnit: { ...Typography.caption, fontSize: 10 },
  text: { ...Typography.body, marginVertical: Spacing.xs },
  examSection: { marginBottom: Spacing.md },
  examSectionTitle: { ...Typography.bodyMedium, marginBottom: Spacing.xs },
  examDetail: { ...Typography.body },
  procedureItem: { marginBottom: Spacing.sm },
  procedureName: { ...Typography.bodyMedium },
  procedureNotes: { ...Typography.body, marginLeft: Spacing.md },
  medicationItem: { marginBottom: Spacing.sm },
  medicationName: { ...Typography.bodyMedium },
  medicationDetails: { ...Typography.body, marginLeft: Spacing.md, fontSize: 13 },
  editableTextArea: { borderWidth: 1, borderColor: "#D1D5DB", borderRadius: BorderRadius.sm, padding: Spacing.md, minHeight: 80, textAlignVertical: "top", ...Typography.body },
  editableInput: { borderWidth: 1, borderColor: "#D1D5DB", borderRadius: BorderRadius.sm, padding: Spacing.md, ...Typography.body },
  editSection: { marginVertical: Spacing.lg, alignItems: "center" },
  editToggleBtn: { paddingHorizontal: Spacing.xl, paddingVertical: Spacing.md, borderRadius: BorderRadius.md, borderWidth: 1, borderColor: "#2563EB" },
  editToggleBtnText: { ...Typography.bodyMedium },
  editHint: { marginTop: Spacing.sm, ...Typography.caption },
  buttonRow: { flexDirection: "row", gap: Spacing.md, flexWrap: "wrap" },
  saveBtn: { flex: 1, minWidth: 100, height: Spacing.buttonHeight, borderRadius: BorderRadius.md, justifyContent: "center", alignItems: "center" },
  saveBtnText: { color: "#FFFFFF", ...Typography.bodyMedium },
  editBtn: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", height: Spacing.buttonHeight, borderRadius: BorderRadius.md, gap: Spacing.sm },
  dischargeBtn: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", height: Spacing.buttonHeight, borderRadius: BorderRadius.md, gap: Spacing.sm },
  editBtnText: { color: "#FFFFFF", ...Typography.bodyMedium },
});
