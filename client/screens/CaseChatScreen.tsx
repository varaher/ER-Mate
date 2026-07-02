import React, { useEffect, useState, useCallback, useMemo } from 'react';
import {
  View, Text, StyleSheet, ActivityIndicator,
  Platform, StatusBar,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import AsyncStorage from '@react-native-async-storage/async-storage';
import { RootStackParamList } from '@/navigation/RootStackNavigator';
import { useAuth } from '@/context/AuthContext';
import { getApiUrl } from '@/lib/query-client';
import CaseChat, { CaseData } from '@/components/CaseChat';
import type { SmartDictationExtracted } from '@/components/SmartDictation';

type Props = NativeStackScreenProps<RootStackParamList, 'CaseChat'>;

const DARK_BG = '#0F1419';

export default function CaseChatScreen({ route, navigation }: Props) {
  const { caseId, patientName } = route.params;
  const { user } = useAuth();
  const insets = useSafeAreaInsets();

  const [caseData, setCaseData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch the case from the API
  const fetchCase = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const token = await AsyncStorage.getItem('token');
      const res = await fetch(`${getApiUrl()}/api/proxy/cases/${caseId}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setCaseData(data);
    } catch (e: any) {
      setError(e?.message || 'Failed to load case');
    } finally {
      setLoading(false);
    }
  }, [caseId, user?.token]);

  useEffect(() => {
    fetchCase();
  }, [fetchCase]);

  // Assemble liveCase from raw case data (mirrors CaseSheetScreen useMemo)
  const liveCase: CaseData | undefined = useMemo(() => {
    if (!caseData) return undefined;
    const p = caseData.patient || {};
    const pa = caseData.primary_assessment || {};
    const hist = caseData.history || {};
    const sample = hist.sample || {};
    const treat = caseData.treatment || {};
    const exam = caseData.examination || caseData.exam || {};
    const disp = caseData.disposition || {};

    const arrStr = (v: any) =>
      Array.isArray(v) ? v.join(', ') : typeof v === 'string' ? v : '';

    // Vitals
    const hr = caseData.presenting_vitals?.hr || pa.circulation_hr || '';
    const bpS = caseData.presenting_vitals?.bp_systolic || pa.circulation_bp_systolic || '';
    const bpD = caseData.presenting_vitals?.bp_diastolic || pa.circulation_bp_diastolic || '';
    const spo2 = caseData.presenting_vitals?.spo2 || pa.breathing_spo2 || '';
    const rr = caseData.presenting_vitals?.rr || pa.breathing_rr || '';
    const temp = caseData.presenting_vitals?.temperature || pa.exposure_temperature || '';
    const gcsE = parseInt(pa.disability_gcs_e) || 0;
    const gcsV = parseInt(pa.disability_gcs_v) || 0;
    const gcsM = parseInt(pa.disability_gcs_m) || 0;
    const gcsTotal = gcsE + gcsV + gcsM;
    const grbs = pa.disability_grbs || '';

    // History
    const symptoms = sample.signsSymptoms || hist.signs_and_symptoms || hist.chief_complaint || caseData.presenting_complaint?.text || '';
    const events = sample.eventsHopi || hist.history_of_present_illness || '';
    const allergies = arrStr(sample.allergies || hist.allergies);
    const medications = sample.medications || hist.current_medications || '';
    const pastHistory = arrStr(sample.pastMedicalHistory || hist.past_medical_history);
    const lastMeal = sample.lastMeal || '';
    const otherHist = hist.other_history || hist.social_history || '';
    const pastSurgical = hist.past_surgical_history || '';

    // Primary survey
    const airwayStatus = pa.airway_status || (caseData.airway?.status) || '';
    const breathingNotes = pa.breathing_effort ? `WOB: ${pa.breathing_effort}` : (caseData.breathing?.notes || '');
    const circulationNotes = pa.circulation_cap_refill ? `CRT: ${pa.circulation_cap_refill}` : (caseData.circulation?.notes || '');
    const disabilityNote = [
      gcsTotal > 0 ? `GCS ${gcsTotal}` : '',
      pa.disability_avpu || '',
    ].filter(Boolean).join(' · ');
    const exposureNote = temp ? `Temp ${temp}°C` : '';

    // Exam
    const examGeneral = exam.general?.notes || '';
    const examCvs = [exam.cvs?.status, exam.cvs?.notes].filter(Boolean).join(' — ');
    const examResp = [exam.respiratory?.status, exam.respiratory?.notes].filter(Boolean).join(' — ');
    const examAbdo = [exam.abdomen?.status, exam.abdomen?.notes].filter(Boolean).join(' — ');
    const examNeuro = pa.disability_notes || '';
    const examExtremities = exam.extremities?.notes || '';

    // Treatment
    const meds = Array.isArray(treat.medications)
      ? treat.medications.map((m: any) => [m.name, m.dose, m.route].filter(Boolean).join(' ')).filter(Boolean).join(', ')
      : (caseData.drugs_administered || []).map((m: any) => m.name || m).join(', ');
    const infusions = Array.isArray(treat.infusions)
      ? treat.infusions.map((i: any) => [i.name, i.dose, i.rate].filter(Boolean).join(' ')).filter(Boolean).join(', ')
      : '';
    const procedures = Array.isArray(caseData.procedures_performed)
      ? caseData.procedures_performed.join(', ')
      : '';
    const labsOrdered = treat.labsOrdered || treat.labs_ordered || '';
    const imaging = typeof treat.imaging === 'string'
      ? treat.imaging
      : Array.isArray(treat.imaging) ? treat.imaging.join(', ') : '';

    // Disposition
    const diagnosis = treat.primaryDiagnosis || treat.primary_diagnosis || disp.diagnosis || '';
    const differentials = treat.differentialDiagnoses || treat.differential_diagnoses || disp.differentials || '';

    return {
      name: p.name || patientName || '',
      age: p.age ? String(p.age) : '',
      sex: p.sex || '',
      priority: caseData.triage_priority ? `P${caseData.triage_priority}` : '',
      caseNumber: caseData.case_number || '',
      date: caseData.created_at
        ? new Date(caseData.created_at).toLocaleDateString()
        : new Date().toLocaleDateString(),
      doctorName: p.doctor_name || '',
      department: '',
      vitals: {
        hr, bp: bpS && bpD ? `${bpS}/${bpD}` : (bpS || ''),
        spo2, rr, temp, gcs: gcsTotal > 0 ? String(gcsTotal) : '', grbs,
      },
      history: {
        symptoms, allergies, medications, pastHistory,
        lastMeal, events, pastSurgical, other: otherHist,
      },
      primary: {
        airway: airwayStatus,
        breathing: breathingNotes,
        circulation: circulationNotes,
        disability: disabilityNote,
        exposure: exposureNote,
        ecg: pa.ecg_status || '',
        abg: pa.abg_interpretation || '',
      },
      exam: {
        general: examGeneral, cvs: examCvs,
        respiratory: examResp, abdomen: examAbdo,
        neuro: examNeuro, extremities: examExtremities,
      },
      treatment: {
        medications: meds, infusions,
        otherMedications: treat.otherMedications || '',
        ivFluids: treat.ivFluids || treat.iv_fluids || '',
        procedures, labsOrdered, imaging,
      },
      notes: treat.addendumNotes || caseData.clinical_notes || '',
      disposition: {
        diagnosis, differentials,
        decision: disp.dispositionType || disp.disposition_type || '',
        admitTo: disp.admitTo || disp.admit_to || '',
        referTo: disp.referTo || disp.refer_to || '',
      },
    };
  }, [caseData, patientName]);

  // When user dictates inside the chat, save extracted data back to the case
  const handleDataExtracted = useCallback(async (data: SmartDictationExtracted) => {
    try {
      const token = await AsyncStorage.getItem('token');
      await fetch(`${getApiUrl()}/api/proxy/cases/${caseId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ smartDictationData: data }),
      });
      fetchCase();
    } catch {
      // silent — chat still works even if save fails
    }
  }, [caseId, fetchCase]);

  const patientLabel = caseData?.patient?.name || patientName || 'Case';

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <StatusBar barStyle="light-content" backgroundColor={DARK_BG} />

      {/* Header */}
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>ErMate</Text>
          <Text style={styles.headerSub} numberOfLines={1}>
            {patientLabel}
          </Text>
        </View>
      </View>

      {/* Content */}
      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color="#7c3aed" size="large" />
          <Text style={styles.loadingText}>Loading case…</Text>
        </View>
      ) : error ? (
        <View style={styles.center}>
          <Text style={styles.errorText}>{error}</Text>
          <Text style={styles.retryText} onPress={fetchCase}>Tap to retry</Text>
        </View>
      ) : (
        <View style={{ flex: 1 }}>
          <CaseChat
            onDataExtracted={handleDataExtracted}
            patientContext={{
              name: caseData?.patient?.name || patientName,
              age: caseData?.patient?.age ? parseFloat(caseData.patient.age) : undefined,
              sex: caseData?.patient?.sex,
              chiefComplaint: caseData?.presenting_complaint?.text,
              caseType: 'adult',
            }}
            liveCase={liveCase}
            caseId={caseId}
            userId={user?.id}
          />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#0F1419',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(255,255,255,0.08)',
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: 0.2,
  },
  headerSub: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.45)',
    marginTop: 2,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
  },
  loadingText: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.45)',
  },
  errorText: {
    fontSize: 15,
    color: '#ef4444',
    textAlign: 'center',
    paddingHorizontal: 32,
  },
  retryText: {
    fontSize: 14,
    color: '#7c3aed',
    fontWeight: '600',
  },
});
