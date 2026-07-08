import React, { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import {
  View, Text, StyleSheet, ActivityIndicator,
  Platform, StatusBar, Pressable,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';

import AsyncStorage from '@react-native-async-storage/async-storage';
import { RootStackParamList } from '@/navigation/RootStackNavigator';
import { useAuth } from '@/context/AuthContext';
import { useDepartment } from '@/context/DepartmentContext';
import { getApiUrl } from '@/lib/query-client';
import { invalidateCases } from '@/lib/api';
import CaseChat, { CaseData, CaseAddendum } from '@/components/CaseChat';
import type { SmartDictationExtracted } from '@/components/SmartDictation';

type Props = NativeStackScreenProps<RootStackParamList, 'CaseChat'>;

const LIGHT_BG    = '#F4FAF7';
const HEADER_BG   = '#15924F';
const ACCENT      = '#1DB870';

export default function CaseChatScreen({ route, navigation }: Props) {
  const { caseId: paramCaseId, patientName: paramPatientName } = route.params ?? {};
  const { user } = useAuth();
  const { shiftSession, activeShift, department } = useDepartment();
  const insets  = useSafeAreaInsets();

  const [activeCaseId, setActiveCaseId] = useState<string | undefined>(paramCaseId);
  const [caseData, setCaseData]         = useState<any>(null);
  const [phase, setPhase]               = useState<'init' | 'loading' | 'ready' | 'error'>(
    paramCaseId ? 'loading' : 'init'
  );
  const [errorMsg, setErrorMsg]         = useState<string | null>(null);
  const [addenda, setAddenda]           = useState<CaseAddendum[]>([]);

  // Tracks whether we already kicked off the silent create (so StrictMode doesn't double-fire)
  const creatingRef = useRef(false);
  // Stable ref to latest caseData so handleDataExtracted closure stays fresh
  const caseDataRef = useRef<any>(null);
  useEffect(() => { caseDataRef.current = caseData; }, [caseData]);

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

  // ── Fetch addenda for existing cases ──────────────────────────────────────
  const fetchAddenda = useCallback(async (id: string) => {
    try {
      const token = await AsyncStorage.getItem('token');
      const res = await fetch(`${getApiUrl()}/api/cases/${id}/addenda`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) return;
      const data = await res.json();
      if (Array.isArray(data)) setAddenda(data);
    } catch {}
  }, []);

  const handleAddAddendum = useCallback(async (payload: {
    type: string; content: string; specialty?: string;
    handoverFromDoctor?: string; handoverToDoctor?: string;
  }): Promise<CaseAddendum> => {
    if (!activeCaseId) throw new Error('No case ID');
    const token = await AsyncStorage.getItem('token');
    const res = await fetch(`${getApiUrl()}/api/cases/${activeCaseId}/addenda`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({
        ...payload,
        doctorId: user?.id,
        doctorName: user?.name,
        doctorRole: shiftSession?.roleForShift || '',
      }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Failed to save addendum');
    }
    const created: CaseAddendum = await res.json();
    setAddenda(prev => [...prev, created]);
    return created;
  }, [activeCaseId, user, shiftSession]);

  // ── Kick off on mount ──────────────────────────────────────────────────────
  useEffect(() => {
    if (paramCaseId) {
      fetchCase(paramCaseId);
      fetchAddenda(paramCaseId);
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

    const ageNum  = p.age ? parseInt(String(p.age)) : null;
    const examGen = exam.general || {};

    // ── GCS components ──
    const gcsEStr  = String(pa.disability_gcs_e || '');
    const gcsVStr  = String(pa.disability_gcs_v || '');
    const gcsMStr  = String(pa.disability_gcs_m || '');

    // ── CRT & pupils ──
    const crt    = pa.circulation_cap_refill || pa.circulation_crt || '';
    const pupils = pa.disability_pupils || '';

    // ── Temperature display ──
    function buildTempDisplay(raw: any): string {
      if (raw === null || raw === undefined || raw === '') return '';
      const str = String(raw);
      const isFahr = str.includes('°F') || (str.includes('F') && !str.includes('°C'));
      const isCels = str.includes('°C') || str.includes('C');
      const num = parseFloat(str.replace(/[^0-9.]/g, ''));
      if (!num) return str;
      if (isFahr || (!isCels && num > 41)) {
        const cel = ((num - 32) * 5 / 9).toFixed(1);
        return `${num}°F (${cel}°C)`;
      }
      const fah = (num * 9 / 5 + 32).toFixed(1);
      return `${num}°C (${fah}°F)`;
    }
    const tempDisplay = buildTempDisplay(temp);

    // ── Case time — HH:MM 24h so generateCaseNote's timeStr IIFE converts to 12h AM/PM without double-suffix ──
    const caseTime = caseData.created_at
      ? (() => {
          const d = new Date(caseData.created_at);
          return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
        })()
      : '';

    // ── Differentials — array → newline string ──
    function formatDifferentials(raw: any): string {
      if (!raw) return '';
      if (Array.isArray(raw)) return raw.join('\n');
      return String(raw);
    }
    const differentialsStr = formatDifferentials(
      treat.differentialDiagnoses || treat.differential_diagnoses ||
      (Array.isArray(disp.differentials) ? disp.differentials : null) ||
      differentials
    );

    // ── LMP ──
    const lmp = hist.lmp || sample.lmp || hist.menstrual_history || '';

    // ── Psychological toggles ──
    const psych = caseData.psychological || {};
    const psychToggles = {
      depression:      !!(psych.depression        || psych.features_of_depression),
      anxiety:         !!(psych.anxiety            || psych.anxiety_present),
      psychosis:       !!(psych.psychosis          || psych.psychiatricHistory || psych.psychiatric_history),
      agitation:       !!(psych.agitation),
      suicidalIdeation:!!(psych.suicidalIdeation   || psych.suicidal_ideation),
      substanceUse:    !!(psych.substanceAbuse     || psych.substance_abuse || psych.substanceUse),
    };

    return {
      name:                p.name || paramPatientName || '',
      age:                 p.age ? String(p.age) : '',
      sex:                 p.sex || '',
      priority:            caseData.triage_priority ? `P${caseData.triage_priority}` : '',
      caseNumber:          caseData.case_number || '',
      date:                caseData.created_at ? new Date(caseData.created_at).toLocaleDateString('en-IN') : new Date().toLocaleDateString('en-IN'),
      doctorName:          p.doctor_name || caseData.created_by_name || '',
      department:          '',
      patientType:         ageNum !== null && ageNum <= 16 ? 'Pediatric' : 'Adult',
      isMLC:               !!(caseData.mlc || caseData.is_mlc),
      userName:            user?.name || '',
      userRole:            shiftSession?.roleForShift || '',
      conditionAtDischarge: disp.conditionAtShift || disp.condition_at_shift || '',
      caseTime,
      patientTitle:        p.title || '',
      bedNumber:           caseData.bed_number || caseData.bed || '',
      erNumber:            caseData.er_number || caseData.case_number || '',
      efast:               pa.efast_findings || caseData.efast_findings || '',
      psychological:       psychToggles,
      vitals: {
        hr, spo2, rr, temp, grbs,
        bp:          bpS && bpD ? `${bpS}/${bpD}` : (bpS || ''),
        gcs:         gcsTotal > 0 ? String(gcsTotal) : '',
        gcsE:        gcsEStr,
        gcsV:        gcsVStr,
        gcsM:        gcsMStr,
        crt,
        pupils,
        tempDisplay,
      },
      history: { symptoms, allergies, medications, pastHistory, lastMeal, events, pastSurgical, other: otherHist, lmp },
      primary: {
        airway:      airwayStatus,
        breathing:   breathingNotes,
        circulation: circulationNotes,
        disability:  disabilityNote,
        exposure:    exposureNote,
        ecg:         pa.ecg_status || '',
        abg:         pa.abg_interpretation || '',
      },
      examToggles: {
        pallor:          examGen.pallor === true,
        icterus:         examGen.icterus === true,
        cyanosis:        examGen.cyanosis === true,
        clubbing:        examGen.clubbing === true,
        lymphadenopathy: examGen.lymphadenopathy === true,
        edema:           examGen.edema === true,
      },
      exam: { general: examGeneral, cvs: examCvs, respiratory: examResp, abdomen: examAbdo, neuro: examNeuro, extremities: examExtremities },
      treatment: {
        medications:      meds,
        infusions,
        otherMedications: treat.otherMedications || '',
        ivFluids:         treat.ivFluids || treat.iv_fluids || '',
        procedures,
        labsOrdered,
        imaging,
        resultsSummary:   treat.resultsSummary || treat.results_summary || caseData.results_summary || '',
      },
      notes:       treat.addendumNotes || caseData.clinical_notes || '',
      disposition: {
        diagnosis,
        differentials: differentialsStr,
        decision:  disp.dispositionType || disp.disposition_type || '',
        admitTo:   disp.admitTo || disp.admit_to || '',
        referTo:   disp.referTo || disp.refer_to || '',
        followUp:  disp.observationNotes || disp.observation_notes || disp.followUpAdvice || '',
      },
    };
  }, [caseData, paramPatientName, user, shiftSession]);

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
      // Register case in shift system so consultants can see it in their shift view
      if (shiftSession && activeShift && department) {
        const current = caseDataRef.current;
        await fetch(`${getApiUrl()}/api/cases/${activeCaseId}/register-shift`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify({
            shiftSessionId: shiftSession.id,
            shiftId: activeShift.id,
            departmentId: department.id,
            patientName: data.patientName || current?.patient?.name || '',
            patientAge: data.patientAge || current?.patient?.age || '',
            chiefComplaint: data.chiefComplaint || current?.presenting_complaint?.text || '',
            triagePriority: current?.triage_priority || null,
            doctorName: user?.name || '',
            doctorUserId: user?.id || '',
            roleForShift: shiftSession.roleForShift,
          }),
        });
      }
    } catch {}
    // Invalidate cases list so Cases tab reflects any patient name / complaint updates
    invalidateCases().catch(() => {});
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
      if ((data as any).patientWeight) next.patient = { ...(next.patient || {}), weight: (data as any).patientWeight };
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
      if (ef.general || ef.cvs || ef.respiratory || ef.abdomen || ef.cns || ef.heent || (ef as any).back) {
        const exam = { ...(next.examination || next.exam || {}) };
        if (ef.general) exam.general = { ...(exam.general || {}), notes: ef.general };
        if (ef.cvs) exam.cvs = { ...(exam.cvs || {}), notes: ef.cvs };
        if (ef.respiratory) exam.respiratory = { ...(exam.respiratory || {}), notes: ef.respiratory };
        if (ef.abdomen) exam.abdomen = { ...(exam.abdomen || {}), notes: ef.abdomen };
        if (ef.cns) exam.cns = { ...(exam.cns || {}), notes: ef.cns };
        if (ef.heent) exam.heent = { ...(exam.heent || {}), notes: ef.heent };
        if ((ef as any).back) exam.back = { ...(exam.back || {}), notes: (ef as any).back };
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
      if (data.prescribedInfusions?.length) {
        const treat = { ...(next.treatment || {}) };
        treat.infusions = (data.prescribedInfusions as any[]).map((i: any) =>
          [i.name, i.dose, i.rate ? `@ ${i.rate}` : ''].filter(Boolean).join(' ')
        ).join('; ');
        next.treatment = treat;
      }
      if (data.investigationsOrdered) {
        const treat = { ...(next.treatment || {}) };
        treat.labsOrdered = data.investigationsOrdered;
        next.treatment = treat;
      }
      if (data.imagingOrdered) {
        const treat = { ...(next.treatment || {}) };
        treat.imaging = data.imagingOrdered;
        next.treatment = treat;
      }
      if (data.diagnosis?.length || (data as any).differentialDiagnosis?.length) {
        const treat = { ...(next.treatment || {}) };
        if (data.diagnosis?.length) {
          treat.primary_diagnosis = Array.isArray(data.diagnosis) ? data.diagnosis[0] : String(data.diagnosis);
        }
        if ((data as any).differentialDiagnosis?.length) {
          treat.differential_diagnoses = (data as any).differentialDiagnosis;
        }
        next.treatment = treat;
      }
      // Primary Survey — ECG, ABG, ABCDE summary + structured
      {
        const pa = { ...(next.primary_assessment || {}) };
        if (data.ecgInterpretation) pa.ecg_status = data.ecgInterpretation;
        if (data.ecgStructured?.findings) pa.ecg_status = data.ecgStructured.findings;
        if (data.ecgStructured?.performed !== undefined) pa.ecg_performed = data.ecgStructured.performed;
        if (data.ecgStructured?.rhythm) pa.ecg_rhythm = data.ecgStructured.rhythm;
        if (data.ecgStructured?.stChanges) pa.ecg_st_changes = data.ecgStructured.stChanges;
        if (data.abgSummary) pa.abg_interpretation = data.abgSummary;
        if (data.abgStructured?.ph) pa.abg_ph = data.abgStructured.ph;
        if (data.abgStructured?.pco2) pa.abg_pco2 = data.abgStructured.pco2;
        if ((data.abgStructured as any)?.po2) pa.abg_po2 = (data.abgStructured as any).po2;
        if (data.abgStructured?.hco3) pa.abg_hco3 = data.abgStructured.hco3;
        if ((data.abgStructured as any)?.be) pa.abg_be = (data.abgStructured as any).be;
        if (data.abgStructured?.lactate) pa.abg_lactate = data.abgStructured.lactate;
        if ((data.abgStructured as any)?.sao2) pa.abg_sao2 = (data.abgStructured as any).sao2;
        if ((data.abgStructured as any)?.fio2) pa.abg_fio2 = (data.abgStructured as any).fio2;
        if ((data.abgStructured as any)?.na) pa.abg_na = (data.abgStructured as any).na;
        if ((data.abgStructured as any)?.k) pa.abg_k = (data.abgStructured as any).k;
        if ((data.abgStructured as any)?.cl) pa.abg_cl = (data.abgStructured as any).cl;
        if ((data.abgStructured as any)?.ag) pa.abg_ag = (data.abgStructured as any).ag;
        if ((data.abgStructured as any)?.glucose) pa.abg_glucose = (data.abgStructured as any).glucose;
        if ((data.abgStructured as any)?.hb) pa.abg_hb = (data.abgStructured as any).hb;
        if ((data.abgStructured as any)?.aaGradient) pa.abg_aa_gradient = (data.abgStructured as any).aaGradient;
        if ((data.abgStructured as any)?.finalAbgDiagnosis) pa.abg_interpretation = (data.abgStructured as any).finalAbgDiagnosis;
        if (data.abgStructured?.performed !== undefined) pa.abg_performed = data.abgStructured.performed;
        // ABCDE structured findings → primary_assessment sub-fields
        const abcde = data.abcdeFindings || {};
        if (abcde.airway?.status) pa.airway_status = abcde.airway.status;
        if (abcde.airway?.patency) pa.airway_patency = abcde.airway.patency;
        if (abcde.airway?.position) pa.airway_position = abcde.airway.position;
        if (abcde.airway?.cause) pa.airway_cause = abcde.airway.cause;
        if (abcde.airway?.notes) pa.airway_notes = abcde.airway.notes;
        if (abcde.breathing?.status) pa.breathing_status = abcde.breathing.status;
        if (abcde.breathing?.notes) pa.breathing_rr = abcde.breathing.notes;
        if (abcde.circulation?.status) pa.circulation_status = abcde.circulation.status;
        if (abcde.circulation?.notes) pa.circulation_hr = abcde.circulation.notes;
        if (abcde.disability?.status) pa.disability_status = abcde.disability.status;
        if (abcde.disability?.notes) pa.disability_gcs_total = abcde.disability.notes;
        if (abcde.exposure?.status) pa.exposure_status = abcde.exposure.status;
        if (abcde.exposure?.notes) pa.exposure_temperature = abcde.exposure.notes;
        next.primary_assessment = pa;
      }
      // Examination structured toggles (pallor, icterus, etc.)
      if (data.examStructured?.general) {
        const eg = data.examStructured.general;
        const exam = { ...(next.examination || next.exam || {}) };
        const gen = { ...(exam.general || {}) };
        if (eg.pallor !== undefined) gen.pallor = eg.pallor;
        if (eg.icterus !== undefined) gen.icterus = eg.icterus;
        if (eg.cyanosis !== undefined) gen.cyanosis = eg.cyanosis;
        if (eg.clubbing !== undefined) gen.clubbing = eg.clubbing;
        if (eg.lymphadenopathy !== undefined) gen.lymphadenopathy = eg.lymphadenopathy;
        if (eg.edema !== undefined) gen.edema = eg.edema;
        exam.general = gen;
        next.examination = exam;
      }
      // LMP — always capture for female patients
      if (data.menstrualHistory) {
        const h2 = { ...(next.history || {}) };
        h2.lmp = data.menstrualHistory;
        next.history = h2;
      }
      // EFAST
      if ((data as any).efastFindings) {
        next.efast_findings = (data as any).efastFindings;
      }
      // GCS components from abcdeFindings.disability
      {
        const abcde = data.abcdeFindings || {};
        const disa = abcde.disability || {};
        const pa2 = { ...(next.primary_assessment || {}) };
        let pa2Changed = false;
        if ((disa as any).gcsE) { pa2.disability_gcs_e = (disa as any).gcsE; pa2Changed = true; }
        if ((disa as any).gcsV) { pa2.disability_gcs_v = (disa as any).gcsV; pa2Changed = true; }
        if ((disa as any).gcsM) { pa2.disability_gcs_m = (disa as any).gcsM; pa2Changed = true; }
        if ((disa as any).pupils) { pa2.disability_pupils = (disa as any).pupils; pa2Changed = true; }
        if ((abcde.circulation as any)?.crt) { pa2.circulation_cap_refill = (abcde.circulation as any).crt; pa2Changed = true; }
        if (pa2Changed) next.primary_assessment = pa2;
      }
      // Psychological assessment flags — write to top-level next.psychological so liveCase reads it
      if (data.psychological) {
        const psych = data.psychological;
        const py = { ...(next.psychological || {}) };
        if (psych.suicidalIdeation !== undefined) py.suicidalIdeation = psych.suicidalIdeation;
        if (psych.selfHarmHistory !== undefined)  py.selfHarmHistory  = psych.selfHarmHistory;
        if (psych.substanceAbuse !== undefined)   py.substanceAbuse   = psych.substanceAbuse;
        if (psych.psychiatricHistory !== undefined) py.psychiatricHistory = psych.psychiatricHistory;
        next.psychological = py;
        // Also write to hist.psychological for backward compat
        const h3 = { ...(next.history || {}) };
        h3.psychological = py;
        next.history = h3;
      }
      // Procedures performed
      if (data.procedures) {
        const pr = data.procedures;
        const notes = { ...(next.notes || {}) };
        const proc = { ...(notes.procedures_performed || {}) };
        if (pr.resuscitation?.cpr !== undefined) proc.cpr = pr.resuscitation.cpr;
        const aw = pr.airway || {};
        if (aw.endotrachealIntubation !== undefined) proc.ett_intubation = aw.endotrachealIntubation;
        if (aw.lmaInsertion !== undefined) proc.lma_insertion = aw.lmaInsertion;
        if (aw.cricothyrotomy !== undefined) proc.cricothyrotomy = aw.cricothyrotomy;
        if (aw.bvmVentilation !== undefined) proc.bvm_ventilation = aw.bvmVentilation;
        if (aw.niv !== undefined) proc.niv = aw.niv;
        const va = pr.vascular || {};
        if (va.centralLine !== undefined) proc.central_line = va.centralLine;
        if (va.peripheralIV !== undefined) proc.peripheral_iv = va.peripheralIV;
        if (va.intraosseousAccess !== undefined) proc.io_access = va.intraosseousAccess;
        if (va.arterialLine !== undefined) proc.arterial_line = va.arterialLine;
        const ch = pr.chest || {};
        if (ch.chestTube !== undefined) proc.chest_tube = ch.chestTube;
        if (ch.needleDecompression !== undefined) proc.needle_decompression = ch.needleDecompression;
        if (ch.pericardiocentesis !== undefined) proc.pericardiocentesis = ch.pericardiocentesis;
        if (ch.thoracentesis !== undefined) proc.thoracentesis = ch.thoracentesis;
        if (pr.neuro?.lumbarPuncture !== undefined) proc.lumbar_puncture = pr.neuro.lumbarPuncture;
        if (pr.gu?.foleyCatheter !== undefined) proc.foley_catheter = pr.gu.foleyCatheter;
        const gi = pr.gi || {};
        if (gi.ngTube !== undefined) proc.ng_tube = gi.ngTube;
        if (gi.gastricLavage !== undefined) proc.gastric_lavage = gi.gastricLavage;
        const wo = pr.wound || {};
        if (wo.woundClosure !== undefined) proc.wound_closure = wo.woundClosure;
        if (wo.woundIrrigation !== undefined) proc.wound_irrigation = wo.woundIrrigation;
        const or = pr.ortho || {};
        if (or.fractureSplinting !== undefined) proc.fracture_splinting = or.fractureSplinting;
        if (or.jointReduction !== undefined) proc.joint_reduction = or.jointReduction;
        notes.procedures_performed = proc;
        next.notes = notes;
      }
      // Disposition
      if (data.dispositionSuggested) {
        const ds = data.dispositionSuggested;
        const disp = { ...(next.disposition || {}) };
        if (ds.type) disp.dispositionType = ds.type;
        if (ds.admitTo) disp.admitTo = ds.admitTo;
        if (ds.referTo) disp.referTo = ds.referTo;
        if (ds.durationInER) disp.durationInER = ds.durationInER;
        if (ds.conditionAtShift) disp.conditionAtShift = ds.conditionAtShift;
        next.disposition = disp;
      }
      return next;
    });
  }, [activeCaseId, shiftSession, activeShift, department, user]);

  const goToDashboard = useCallback(() => {
    (navigation as any).navigate('Main', { screen: 'DashboardTab' });
  }, [navigation]);

  // ── Render ─────────────────────────────────────────────────────────────────
  const header = (
    <View style={styles.header}>
      <Pressable
        onPress={() => navigation.goBack()}
        style={({ pressed }) => [styles.backBtn, { opacity: pressed ? 0.6 : 1 }]}
        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
      >
        <Feather name="arrow-left" size={22} color="#FFFFFF" />
      </Pressable>
      <View style={styles.headerTextGroup}>
        <Text style={styles.headerTitle}>ErMate</Text>
        <Text style={styles.headerSub} numberOfLines={1}>{effectiveName}</Text>
      </View>
      <Pressable
        onPress={goToDashboard}
        style={({ pressed }) => [styles.headerDashBtn, { opacity: pressed ? 0.7 : 1 }]}
        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
      >
        <Feather name="home" size={16} color="#FFFFFF" />
        <Text style={styles.headerDashBtnText}>Dashboard</Text>
      </Pressable>
    </View>
  );

  if (phase === 'init' || phase === 'loading') {
    return (
      <View style={[styles.root, { paddingTop: insets.top }]}>
        <StatusBar barStyle="light-content" backgroundColor={HEADER_BG} />
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
        <StatusBar barStyle="light-content" backgroundColor={HEADER_BG} />
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
      <StatusBar barStyle="light-content" backgroundColor={HEADER_BG} />
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
          onNavigateDashboard={goToDashboard}
          addenda={addenda}
          onAddAddendum={handleAddAddendum}
          erArrivalTime={caseData?.created_at || caseData?.createdAt || undefined}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: LIGHT_BG },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: HEADER_BG,
  },
  backBtn: {
    width: 36,
    height: 36,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 18,
  },
  headerTextGroup: { flex: 1 },
  headerTitle: { fontSize: 17, fontWeight: '700', color: '#FFFFFF', letterSpacing: 0.2 },
  headerSub:   { fontSize: 13, color: 'rgba(255,255,255,0.70)', marginTop: 2 },
  headerDashBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(255,255,255,0.18)',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 20,
  },
  headerDashBtnText: { fontSize: 13, fontWeight: '700', color: '#FFFFFF' },
  center:      { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12 },
  loadingText: { fontSize: 14, color: '#6B9E80' },
  errorText:   { fontSize: 15, color: '#ef4444', textAlign: 'center', paddingHorizontal: 32 },
  retryText:   { fontSize: 14, color: '#1DB870', fontWeight: '600' },
});
