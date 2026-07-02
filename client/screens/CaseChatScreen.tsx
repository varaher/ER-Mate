import React, { useEffect, useState, useCallback, useMemo, useRef } from 'react';
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
import { invalidateCases } from '@/lib/api';
import CaseChat, { CaseData } from '@/components/CaseChat';
import type { SmartDictationExtracted } from '@/components/SmartDictation';

type Props = NativeStackScreenProps<RootStackParamList, 'CaseChat'>;

const DARK_BG = '#0F1419';
const ACCENT  = '#7c3aed';

export default function CaseChatScreen({ route, navigation }: Props) {
  const { caseId: paramCaseId, patientName: paramPatientName } = route.params ?? {};
  const { user } = useAuth();
  const insets  = useSafeAreaInsets();

  const [activeCaseId, setActiveCaseId] = useState<string | undefined>(paramCaseId);
  const [caseData, setCaseData]         = useState<any>(null);
  const [phase, setPhase]               = useState<'init' | 'loading' | 'ready' | 'error'>(
    paramCaseId ? 'loading' : 'init'
  );
  const [errorMsg, setErrorMsg]         = useState<string | null>(null);

  // Tracks whether we already kicked off the silent create (so StrictMode doesn't double-fire)
  const creatingRef = useRef(false);

  // ── Fetch an existing case ─────────────────────────────────────────────────
  const fetchCase = useCallback(async (id: string) => {
    setPhase('loading');
    setErrorMsg(null);
    try {
      const token = await AsyncStorage.getItem('token');
      const res = await fetch(`${getApiUrl()}/api/proxy/cases/${id}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setCaseData(await res.json());
      setPhase('ready');
    } catch (e: any) {
      setErrorMsg(e?.message || 'Failed to load case');
      setPhase('error');
    }
  }, []);

  // ── Silently create an empty case (new-patient flow) ──────────────────────
  const createEmptyCase = useCallback(async () => {
    if (creatingRef.current) return;
    creatingRef.current = true;
    try {
      const token = await AsyncStorage.getItem('token');
      if (!token) {
        setErrorMsg('Session expired — please log in again.');
        setPhase('error');
        return;
      }
      const res = await fetch(new URL('/api/voice/save-case', getApiUrl()).toString(), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          patient: {
            name: 'New Patient', age: '', sex: 'Unknown', phone: '',
            weight: '', mode_of_arrival: 'Walk-in', address: 'Not provided',
            brought_by: 'Self', informant_name: 'New Patient',
            informant_reliability: 'Reliable', identification_mark: 'None noted',
            arrival_datetime: new Date().toISOString(),
          },
          extracted: {
            patientName: 'New Patient', patientAge: '', patientSex: 'Unknown',
            vitalsSuggested: {}, primarySurvey: {}, sampleHistory: {},
            examination: {}, treatment: {}, notes: '', disposition: {},
          },
          transcript: '',
          case_type: 'adult',
          userId: user?.id,
          userEmail: user?.email || '',
        }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error || 'Failed to create case');
      await invalidateCases();
      const newId = String(data.caseId);
      setActiveCaseId(newId);
      await fetchCase(newId);
    } catch (e: any) {
      setErrorMsg(e?.message || 'Failed to create case');
      setPhase('error');
    }
  }, [user, fetchCase]);

  // ── Kick off on mount ──────────────────────────────────────────────────────
  useEffect(() => {
    if (paramCaseId) {
      fetchCase(paramCaseId);
    } else {
      createEmptyCase();
    }
  }, []);

  // ── Live case assembly (mirrors CaseSheetScreen logic) ─────────────────────
  const effectiveName = caseData?.patient?.name && caseData.patient.name !== 'New Patient'
    ? caseData.patient.name
    : (paramPatientName || 'New Patient');

  const liveCase: CaseData | undefined = useMemo(() => {
    if (!caseData) return undefined;
    const p      = caseData.patient || {};
    const pa     = caseData.primary_assessment || {};
    const hist   = caseData.history || {};
    const sample = hist.sample || {};
    const treat  = caseData.treatment || {};
    const exam   = caseData.examination || caseData.exam || {};
    const disp   = caseData.disposition || {};

    const arrStr = (v: any) =>
      Array.isArray(v) ? v.join(', ') : typeof v === 'string' ? v : '';

    const hr   = caseData.presenting_vitals?.hr || pa.circulation_hr || '';
    const bpS  = caseData.presenting_vitals?.bp_systolic  || pa.circulation_bp_systolic  || '';
    const bpD  = caseData.presenting_vitals?.bp_diastolic || pa.circulation_bp_diastolic || '';
    const spo2 = caseData.presenting_vitals?.spo2 || pa.breathing_spo2 || '';
    const rr   = caseData.presenting_vitals?.rr   || pa.breathing_rr  || '';
    const temp = caseData.presenting_vitals?.temperature || pa.exposure_temperature || '';
    const gcsE = parseInt(pa.disability_gcs_e) || 0;
    const gcsV = parseInt(pa.disability_gcs_v) || 0;
    const gcsM = parseInt(pa.disability_gcs_m) || 0;
    const gcsTotal = gcsE + gcsV + gcsM;
    const grbs = pa.disability_grbs || '';

    const symptoms     = sample.signsSymptoms || hist.signs_and_symptoms || hist.chief_complaint || caseData.presenting_complaint?.text || '';
    const events       = sample.eventsHopi || hist.history_of_present_illness || '';
    const allergies    = arrStr(sample.allergies || hist.allergies);
    const medications  = sample.medications || hist.current_medications || '';
    const pastHistory  = arrStr(sample.pastMedicalHistory || hist.past_medical_history);
    const lastMeal     = sample.lastMeal || '';
    const otherHist    = hist.other_history || hist.social_history || '';
    const pastSurgical = hist.past_surgical_history || '';

    const airwayStatus = pa.airway_status || caseData.airway?.status || '';
    const breathingNotes = [
      spo2 ? `SpO₂: ${spo2}%` : '',
      rr   ? `RR: ${rr}/min` : '',
      pa.breathing_effort       ? `WOB: ${pa.breathing_effort}` : '',
      pa.breathing_auscultation ? pa.breathing_auscultation : '',
      pa.breathing_oxygen_device && pa.breathing_oxygen_device !== 'Room air'
        ? `O₂: ${pa.breathing_oxygen_device}` : '',
    ].filter(Boolean).join(' · ') || caseData.breathing?.notes || '';
    const circulationNotes = [
      hr            ? `HR: ${hr} bpm` : '',
      bpS && bpD    ? `BP: ${bpS}/${bpD} mmHg` : bpS ? `BP: ${bpS} mmHg` : '',
      pa.circulation_cap_refill ? `CRT: ${pa.circulation_cap_refill}` : '',
      pa.circulation_iv_access  ? `IV: ${pa.circulation_iv_access}` : '',
    ].filter(Boolean).join(' · ') || caseData.circulation?.notes || '';
    const disabilityNote = [gcsTotal > 0 ? `GCS ${gcsTotal}` : '', pa.disability_avpu || ''].filter(Boolean).join(' · ');
    const exposureNote     = temp ? `Temp ${temp}°C` : '';

    const examGeneral     = exam.general?.notes || '';
    const examCvs         = [exam.cvs?.status, exam.cvs?.notes].filter(Boolean).join(' — ');
    const examResp        = [exam.respiratory?.status, exam.respiratory?.notes].filter(Boolean).join(' — ');
    const examAbdo        = [exam.abdomen?.status, exam.abdomen?.notes].filter(Boolean).join(' — ');
    const examNeuro       = pa.disability_notes || '';
    const examExtremities = exam.extremities?.notes || '';

    const meds = Array.isArray(treat.medications)
      ? treat.medications.map((m: any) => [m.name, m.dose, m.route].filter(Boolean).join(' ')).filter(Boolean).join(', ')
      : (caseData.drugs_administered || []).map((m: any) => m.name || m).join(', ');
    const infusions    = Array.isArray(treat.infusions)
      ? treat.infusions.map((i: any) => [i.name, i.dose, i.rate].filter(Boolean).join(' ')).filter(Boolean).join(', ')
      : '';
    const procedures   = Array.isArray(caseData.procedures_performed)
      ? caseData.procedures_performed.join(', ') : '';
    const labsOrdered  = treat.labsOrdered || treat.labs_ordered || '';
    const imaging      = typeof treat.imaging === 'string'
      ? treat.imaging : Array.isArray(treat.imaging) ? treat.imaging.join(', ') : '';

    const diagnosis     = treat.primaryDiagnosis || treat.primary_diagnosis || disp.diagnosis || '';
    const differentials = treat.differentialDiagnoses || treat.differential_diagnoses || disp.differentials || '';

    return {
      name:       p.name || paramPatientName || '',
      age:        p.age ? String(p.age) : '',
      sex:        p.sex || '',
      priority:   caseData.triage_priority ? `P${caseData.triage_priority}` : '',
      caseNumber: caseData.case_number || '',
      date:       caseData.created_at ? new Date(caseData.created_at).toLocaleDateString() : new Date().toLocaleDateString(),
      doctorName: p.doctor_name || '',
      department: '',
      vitals: { hr, bp: bpS && bpD ? `${bpS}/${bpD}` : (bpS || ''), spo2, rr, temp, gcs: gcsTotal > 0 ? String(gcsTotal) : '', grbs },
      history: { symptoms, allergies, medications, pastHistory, lastMeal, events, pastSurgical, other: otherHist },
      primary: { airway: airwayStatus, breathing: breathingNotes, circulation: circulationNotes, disability: disabilityNote, exposure: exposureNote, ecg: pa.ecg_status || '', abg: pa.abg_interpretation || '' },
      exam: { general: examGeneral, cvs: examCvs, respiratory: examResp, abdomen: examAbdo, neuro: examNeuro, extremities: examExtremities },
      treatment: { medications: meds, infusions, otherMedications: treat.otherMedications || '', ivFluids: treat.ivFluids || treat.iv_fluids || '', procedures, labsOrdered, imaging },
      notes:       treat.addendumNotes || caseData.clinical_notes || '',
      disposition: { diagnosis, differentials, decision: disp.dispositionType || disp.disposition_type || '', admitTo: disp.admitTo || disp.admit_to || '', referTo: disp.referTo || disp.refer_to || '' },
    };
  }, [caseData, paramPatientName]);

  // ── Save dictated data back to the case ───────────────────────────────────
  const handleDataExtracted = useCallback(async (data: SmartDictationExtracted) => {
    if (!activeCaseId) return;
    try {
      const token = await AsyncStorage.getItem('token');
      await fetch(`${getApiUrl()}/api/proxy/cases/${activeCaseId}/chat-update`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ extracted: data }),
      });
    } catch {}
    // Merge extracted data into local caseData immediately so liveCase
    // (and therefore discharge summary / case note) reflects the latest dictation
    // without needing to re-fetch from the backend.
    setCaseData((prev: any) => {
      if (!prev) return prev;
      const next = { ...prev };
      // Patient demographics
      if (data.patientName && data.patientName !== 'New Patient') {
        next.patient = { ...(next.patient || {}), name: data.patientName };
      }
      if (data.patientAge) next.patient = { ...(next.patient || {}), age: data.patientAge };
      if (data.patientSex) next.patient = { ...(next.patient || {}), sex: data.patientSex };
      // Presenting complaint
      if (data.chiefComplaint) {
        next.presenting_complaint = { ...(next.presenting_complaint || {}), text: data.chiefComplaint };
      }
      // History — map to external backend shape that liveCase useMemo reads
      const hist = { ...(next.history || {}) };
      if (data.chiefComplaint) hist.signs_and_symptoms = data.chiefComplaint;
      if (data.historyOfPresentIllness) hist.history_of_present_illness = data.historyOfPresentIllness;
      if (data.associatedSymptoms) hist.associated_symptoms = data.associatedSymptoms;
      if (data.allergies) {
        hist.allergies = data.allergies.split(/[,;]+/).map((s: string) => s.trim()).filter(Boolean);
      }
      if (data.currentMedications) hist.current_medications = data.currentMedications;
      if (data.pastMedicalHistory) {
        hist.past_medical_history = Array.isArray(data.pastMedicalHistory)
          ? (data.pastMedicalHistory as string[]).join(', ')
          : String(data.pastMedicalHistory);
      }
      if (data.pastSurgicalHistory) hist.past_surgical_history = String(data.pastSurgicalHistory);
      if (data.familyHistory) hist.family_history = data.familyHistory;
      if (data.socialHistory) hist.social_history = data.socialHistory;
      next.history = hist;
      // Vitals — merge into presenting_vitals (first checked by liveCase useMemo)
      const vs = data.vitalsSuggested || {};
      if (vs.hr || vs.bp || vs.spo2 || vs.rr || vs.temperature || vs.grbs) {
        const pv = { ...(next.presenting_vitals || {}) };
        if (vs.hr) pv.hr = vs.hr;
        if (vs.bp) {
          const parts = String(vs.bp).split(/[/\\-]/);
          if (parts[0]) pv.bp_systolic = parts[0].trim();
          if (parts[1]) pv.bp_diastolic = parts[1].trim();
        }
        if (vs.spo2) pv.spo2 = vs.spo2;
        if (vs.rr) pv.rr = vs.rr;
        if (vs.temperature) pv.temperature = vs.temperature;
        if (vs.grbs) pv.grbs = vs.grbs;
        next.presenting_vitals = pv;
      }
      // Examination — structure matches what liveCase reads (exam.{section}.notes)
      const ef = data.examFindings || {};
      if (ef.general || ef.cvs || ef.respiratory || ef.abdomen || ef.cns) {
        const exam = { ...(next.examination || next.exam || {}) };
        if (ef.general) exam.general = { ...(exam.general || {}), notes: ef.general };
        if (ef.cvs) exam.cvs = { ...(exam.cvs || {}), notes: ef.cvs };
        if (ef.respiratory) exam.respiratory = { ...(exam.respiratory || {}), notes: ef.respiratory };
        if (ef.abdomen) exam.abdomen = { ...(exam.abdomen || {}), notes: ef.abdomen };
        if (ef.cns) exam.cns = { ...(exam.cns || {}), notes: ef.cns };
        next.examination = exam;
      }
      // Treatment — medications and diagnosis
      if (data.prescribedMedications?.length) {
        const treat = { ...(next.treatment || {}) };
        treat.medications = data.prescribedMedications.map((m: any) => ({
          name: m.name, dose: m.dose || '', route: m.route || '', frequency: m.frequency || '',
        }));
        next.treatment = treat;
      }
      if (data.diagnosis?.length) {
        const treat = { ...(next.treatment || {}) };
        treat.primary_diagnosis = Array.isArray(data.diagnosis) ? data.diagnosis[0] : String(data.diagnosis);
        if (data.differentialDiagnosis?.length) {
          treat.differential_diagnoses = data.differentialDiagnosis;
        }
        next.treatment = treat;
      }
      return next;
    });
  }, [activeCaseId]);

  // ── Render ─────────────────────────────────────────────────────────────────
  const header = (
    <View style={styles.header}>
      <Text style={styles.headerTitle}>ErMate</Text>
      <Text style={styles.headerSub} numberOfLines={1}>{effectiveName}</Text>
    </View>
  );

  if (phase === 'init' || phase === 'loading') {
    return (
      <View style={[styles.root, { paddingTop: insets.top }]}>
        <StatusBar barStyle="light-content" backgroundColor={DARK_BG} />
        {header}
        <View style={styles.center}>
          <ActivityIndicator color={ACCENT} size="large" />
          <Text style={styles.loadingText}>
            {phase === 'init' ? 'Preparing…' : 'Loading case…'}
          </Text>
        </View>
      </View>
    );
  }

  if (phase === 'error') {
    return (
      <View style={[styles.root, { paddingTop: insets.top }]}>
        <StatusBar barStyle="light-content" backgroundColor={DARK_BG} />
        {header}
        <View style={styles.center}>
          <Text style={styles.errorText}>{errorMsg}</Text>
          <Text
            style={styles.retryText}
            onPress={() => {
              if (activeCaseId) fetchCase(activeCaseId);
              else { creatingRef.current = false; setPhase('init'); createEmptyCase(); }
            }}
          >
            Tap to retry
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <StatusBar barStyle="light-content" backgroundColor={DARK_BG} />
      {header}
      <View style={{ flex: 1 }}>
        <CaseChat
          onDataExtracted={handleDataExtracted}
          patientContext={{
            name:           caseData?.patient?.name || paramPatientName,
            age:            caseData?.patient?.age ? parseFloat(caseData.patient.age) : undefined,
            sex:            caseData?.patient?.sex,
            chiefComplaint: caseData?.presenting_complaint?.text,
            caseType:       'adult',
          }}
          liveCase={liveCase}
          caseId={activeCaseId!}
          userId={user?.id}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: DARK_BG },
  header: {
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(255,255,255,0.08)',
  },
  headerTitle: { fontSize: 17, fontWeight: '700', color: '#FFFFFF', letterSpacing: 0.2 },
  headerSub:   { fontSize: 13, color: 'rgba(255,255,255,0.45)', marginTop: 2 },
  center:      { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12 },
  loadingText: { fontSize: 14, color: 'rgba(255,255,255,0.45)' },
  errorText:   { fontSize: 15, color: '#ef4444', textAlign: 'center', paddingHorizontal: 32 },
  retryText:   { fontSize: 14, color: '#7c3aed', fontWeight: '600' },
});
