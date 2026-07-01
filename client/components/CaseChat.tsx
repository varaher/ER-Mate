import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  ScrollView,
  Animated,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { Audio } from 'expo-av';
import * as Clipboard from 'expo-clipboard';
import { Feather } from '@expo/vector-icons';
import { getApiUrl } from '@/lib/query-client';
import { SmartDictationExtracted } from './SmartDictation';

// ── CaseData — single source of truth for all documents ──────────────────────
export interface CaseData {
  name: string;
  age: string;
  sex: string;
  priority: string;
  caseNumber: string;
  date: string;
  doctorName: string;
  department: string;
  vitals: {
    hr: string; bp: string; spo2: string;
    rr: string; temp: string; gcs: string; grbs: string;
  };
  history: {
    symptoms: string; allergies: string; medications: string;
    pastHistory: string; lastMeal: string; events: string;
    pastSurgical: string; other: string;
  };
  primary: {
    airway: string; breathing: string; circulation: string;
    disability: string; exposure: string; ecg: string; abg: string;
  };
  exam: {
    general: string; cvs: string; respiratory: string;
    abdomen: string; neuro: string; extremities: string;
  };
  treatment: {
    medications: string; infusions: string; otherMedications: string;
    ivFluids: string; procedures: string; labsOrdered: string; imaging: string;
  };
  notes: string;
  disposition: {
    diagnosis: string; differentials: string;
    decision: string; admitTo: string; referTo: string;
  };
}

// ── Document generators — pure functions of CaseData ─────────────────────────
export function generateCaseNote(c: CaseData): string {
  const L: string[] = ['EMERGENCY CASE NOTE'];
  if (c.caseNumber) L.push(`Case #${c.caseNumber} · ${c.date}`);
  if (c.doctorName) L.push(`Doctor: ${c.doctorName}${c.department ? ` · ${c.department}` : ''}`);
  L.push('');
  L.push('PATIENT');
  L.push(`${c.name || '—'}${c.age ? `, ${c.age}` : ''}${c.sex ? ` ${c.sex}` : ''}${c.priority ? ` · ${c.priority}` : ''}`);
  const v = c.vitals;
  const vp = [v.hr && `HR: ${v.hr}`, v.bp && `BP: ${v.bp}`, v.spo2 && `SpO₂: ${v.spo2}`, v.rr && `RR: ${v.rr}`, v.temp && `Temp: ${v.temp}`, v.gcs && `GCS: ${v.gcs}`, v.grbs && `GRBS: ${v.grbs}`].filter(Boolean);
  if (vp.length) { L.push(''); L.push('VITALS'); L.push(vp.join(' · ')); }
  const h = c.history;
  const hp = [h.symptoms && `Symptoms: ${h.symptoms}`, h.events && `Events: ${h.events}`, h.allergies && `Allergies: ${h.allergies}`, h.medications && `Medications: ${h.medications}`, h.pastHistory && `Past Hx: ${h.pastHistory}`, h.lastMeal && `Last meal: ${h.lastMeal}`, h.pastSurgical && `Past surgical: ${h.pastSurgical}`, h.other && `Other: ${h.other}`].filter(Boolean);
  if (hp.length) { L.push(''); L.push('HISTORY (SAMPLE)'); hp.forEach(x => L.push(x!)); }
  const p = c.primary;
  const pp = [p.airway && `A: ${p.airway}`, p.breathing && `B: ${p.breathing}`, p.circulation && `C: ${p.circulation}`, p.disability && `D: ${p.disability}`, p.exposure && `E: ${p.exposure}`, p.ecg && `ECG: ${p.ecg}`, p.abg && `ABG: ${p.abg}`].filter(Boolean);
  if (pp.length) { L.push(''); L.push('PRIMARY SURVEY (ABCDE)'); pp.forEach(x => L.push(x!)); }
  const e = c.exam;
  const ep = [e.general && `General: ${e.general}`, e.cvs && `CVS: ${e.cvs}`, e.respiratory && `Resp: ${e.respiratory}`, e.abdomen && `Abdomen: ${e.abdomen}`, e.neuro && `Neuro: ${e.neuro}`, e.extremities && `Extremities: ${e.extremities}`].filter(Boolean);
  if (ep.length) { L.push(''); L.push('EXAMINATION'); ep.forEach(x => L.push(x!)); }
  const t = c.treatment;
  const tp = [t.medications && `Medications: ${t.medications}`, t.infusions && `Infusions: ${t.infusions}`, t.ivFluids && `IV Fluids: ${t.ivFluids}`, t.procedures && `Procedures: ${t.procedures}`, t.labsOrdered && `Labs: ${t.labsOrdered}`, t.imaging && `Imaging: ${t.imaging}`].filter(Boolean);
  if (tp.length) { L.push(''); L.push('TREATMENT GIVEN'); tp.forEach(x => L.push(x!)); }
  if (c.notes) { L.push(''); L.push('NOTES'); L.push(c.notes); }
  const d = c.disposition;
  if (d.diagnosis) { L.push(''); L.push('IMPRESSION'); L.push(d.diagnosis); }
  if (d.differentials) { L.push(''); L.push('DIFFERENTIALS'); L.push(d.differentials); }
  if (d.decision) { L.push(''); L.push('DISPOSITION'); L.push(`${d.decision}${d.admitTo ? ` — ${d.admitTo}` : ''}${d.referTo ? ` | Referral: ${d.referTo}` : ''}`); }
  return L.join('\n');
}

export function generateDischargeSummary(c: CaseData): string {
  const L: string[] = ['DISCHARGE SUMMARY'];
  L.push(`${c.name || '—'}${c.age ? `, ${c.age}` : ''}${c.sex ? ` ${c.sex}` : ''}`);
  if (c.date) L.push(`Date: ${c.date}${c.department ? ` · ${c.department}` : ''}`);
  if (c.doctorName) L.push(`Doctor: ${c.doctorName}`);
  L.push('');
  L.push('PRESENTING COMPLAINT');
  L.push([c.history.symptoms, c.history.events].filter(Boolean).join('\n') || 'Not documented');
  L.push('');
  L.push('BACKGROUND');
  const bg = [c.history.pastHistory && `Past history: ${c.history.pastHistory}`, c.history.medications && `Home medications: ${c.history.medications}`, c.history.allergies && `Allergies: ${c.history.allergies}`, c.history.pastSurgical && `Past surgical: ${c.history.pastSurgical}`].filter(Boolean);
  L.push(bg.join('\n') || 'Nil significant');
  const v = c.vitals;
  const vp = [v.hr && `HR ${v.hr}`, v.bp && `BP ${v.bp}`, v.spo2 && `SpO₂ ${v.spo2}`, v.rr && `RR ${v.rr}`, v.temp && `Temp ${v.temp}`, v.gcs && `GCS ${v.gcs}`].filter(Boolean);
  if (vp.length) { L.push(''); L.push('VITALS ON ARRIVAL'); L.push(vp.join(' · ')); }
  const inv = [c.primary.ecg && `ECG: ${c.primary.ecg}`, c.primary.abg && `ABG: ${c.primary.abg}`, c.treatment.labsOrdered && `Labs: ${c.treatment.labsOrdered}`, c.treatment.imaging && `Imaging: ${c.treatment.imaging}`].filter(Boolean);
  if (inv.length) { L.push(''); L.push('INVESTIGATIONS'); inv.forEach(x => L.push(x!)); }
  if (c.disposition.diagnosis) { L.push(''); L.push('DIAGNOSIS'); L.push(c.disposition.diagnosis); }
  if (c.disposition.differentials) { L.push(''); L.push('DIFFERENTIALS'); L.push(c.disposition.differentials); }
  const t = c.treatment;
  const tp = [t.medications, t.infusions, t.ivFluids, t.procedures].filter(Boolean);
  if (tp.length) { L.push(''); L.push('TREATMENT GIVEN'); tp.forEach(x => L.push(x!)); }
  const d = c.disposition;
  if (d.decision) { L.push(''); L.push('DISPOSITION'); L.push(`${d.decision}${d.admitTo ? ` — ${d.admitTo}` : ''}${d.referTo ? ` · Referral: ${d.referTo}` : ''}`); }
  if (c.notes) { L.push(''); L.push('ADDITIONAL NOTES'); L.push(c.notes); }
  return L.join('\n');
}

export function generateReferralLetter(c: CaseData): string {
  const specialty = c.disposition.referTo || 'Relevant Specialty';
  const L: string[] = ['REFERRAL LETTER'];
  if (c.date) L.push(`Date: ${c.date}`);
  if (c.doctorName) L.push(`From: ${c.doctorName}${c.department ? `, ${c.department}` : ''}`);
  L.push(`To: Consultant ${specialty}`);
  L.push('');
  L.push(`Re: ${c.name || '—'}${c.age ? `, ${c.age}` : ''}${c.sex ? ` ${c.sex}` : ''}`);
  if (c.history.allergies) L.push(`Allergies: ${c.history.allergies}`);
  L.push('');
  L.push('Dear Dr.,');
  L.push('');
  L.push('We are referring the above patient presenting with:');
  L.push(c.history.symptoms || c.history.events || 'See attached case note');
  if (c.history.pastHistory) { L.push(''); L.push(`Background: ${c.history.pastHistory}`); }
  const v = c.vitals;
  const vp = [v.hr && `HR ${v.hr}`, v.bp && `BP ${v.bp}`, v.spo2 && `SpO₂ ${v.spo2}`].filter(Boolean);
  if (vp.length) { L.push(''); L.push(`Vitals on arrival: ${vp.join(' · ')}`); }
  if (c.treatment.medications) { L.push(''); L.push(`Treatment given: ${c.treatment.medications}`); }
  if (c.disposition.diagnosis) { L.push(''); L.push(`Diagnosis: ${c.disposition.diagnosis}`); }
  L.push('');
  L.push('Kindly review and manage accordingly.');
  L.push('');
  if (c.doctorName) { L.push(`Dr. ${c.doctorName}`); }
  if (c.department) L.push(c.department);
  return L.join('\n');
}

// ── Design tokens ────────────────────────────────────────────────────────────
const C = {
  green:      '#1DB870',
  greenDark:  '#15924F',
  greenLight: 'rgba(29,184,112,0.10)',
  greenBd:    'rgba(29,184,112,0.22)',
  chat:       '#0F1419',
  bubble:     '#1A2332',
  ink:        '#0B0F14',
  muted:      '#6B7280',
  faint:      '#9CA3AF',
  border:     '#E8EAED',
  surface:    '#F7F8FA',
  white:      '#FFFFFF',
  orange:     '#F59E0B',
  red:        '#EF4444',
  docBg:      '#FFFFFF',
  docBorder:  '#E0E4EA',
  headerMsg:  'rgba(255,255,255,0.50)',
  headerSub:  'rgba(255,255,255,0.30)',
};

// ── Types ─────────────────────────────────────────────────────────────────────
interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  type: 'text' | 'case_update' | 'discharge_summary' | 'referral' | 'note' | 'error';
  extracted?: SmartDictationExtracted;
  specialContent?: string;
  fieldCount?: number;
  isLoading?: boolean;
  durationSecs?: number;
}

export interface CaseChatProps {
  onDataExtracted: (data: SmartDictationExtracted) => void;
  patientContext?: {
    name?: string;
    age?: number;
    sex?: string;
    chiefComplaint?: string;
    caseType?: string;
  };
  liveCase?: CaseData;
  /** If set on mount, automatically renders a case note DocCard in the chat */
  initialExtracted?: SmartDictationExtracted | null;
  disabled?: boolean;
}

// ── Wave bar (recording animation) ───────────────────────────────────────────
const WAVE_HEIGHTS = [20, 32, 16, 40, 24, 36, 12, 28];

function WaveBar({ index }: { index: number }) {
  const anim = useRef(new Animated.Value(0.4)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(anim, { toValue: 1, duration: 380 + index * 60, useNativeDriver: true }),
        Animated.timing(anim, { toValue: 0.4, duration: 380 + index * 60, useNativeDriver: true }),
      ])
    );
    const tid = setTimeout(() => loop.start(), index * 80);
    return () => { clearTimeout(tid); loop.stop(); };
  }, []);
  return (
    <Animated.View style={{
      width: 3,
      height: WAVE_HEIGHTS[index],
      borderRadius: 2,
      backgroundColor: C.red,
      opacity: 0.85,
      transform: [{ scaleY: anim }],
    }} />
  );
}

function RecordingWave() {
  return (
    <View style={s.wave}>
      <View style={[s.waveDot, { backgroundColor: C.red }]} />
      <View style={s.waveBars}>
        {WAVE_HEIGHTS.map((_, i) => <WaveBar key={i} index={i} />)}
      </View>
      <Text style={[s.waveLabel, { color: C.red }]}>Recording…</Text>
    </View>
  );
}

// ── Empty state ──────────────────────────────────────────────────────────────
function EmptyState() {
  return (
    <View style={s.emptyState}>
      <View style={[s.emptyIcon, { backgroundColor: C.greenLight, borderColor: C.greenBd }]}>
        <Feather name="mic" size={26} color={C.green} />
      </View>
      <Text style={s.emptyTitle}>Start by dictating</Text>
      <Text style={s.emptySub}>
        Tap the mic and speak the case.{'\n'}The formatted case note appears here.
      </Text>
    </View>
  );
}

// ── Doctor bubble ─────────────────────────────────────────────────────────────
function DoctorBubble({ text, icon }: { text: string; icon?: string }) {
  return (
    <View style={s.doctorRow}>
      <View style={s.doctorBubble}>
        {icon ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Feather name={icon as any} size={13} color="rgba(255,255,255,0.5)" />
            <Text style={s.doctorBubbleText}>{text}</Text>
          </View>
        ) : (
          <Text style={s.doctorBubbleText}>{text}</Text>
        )}
      </View>
    </View>
  );
}

// ── System label ──────────────────────────────────────────────────────────────
function SystemLabel({ text }: { text: string }) {
  return (
    <View style={s.sysLabelRow}>
      <Text style={s.sysLabelText}>{text}</Text>
    </View>
  );
}

// ── ErMate response wrapper ───────────────────────────────────────────────────
function ErMateResponse({ children, subtitle }: { children: React.ReactNode; subtitle?: string }) {
  return (
    <View style={s.erRow}>
      <View style={[s.erAvatar, { backgroundColor: C.green }]}>
        <Feather name="zap" size={11} color="#fff" />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={s.erName}>ErMate</Text>
        {subtitle ? <Text style={s.erSubtitle}>{subtitle}</Text> : null}
        {children}
      </View>
    </View>
  );
}

// ── Update confirmation ───────────────────────────────────────────────────────
function UpdateConfirmation({ text }: { text: string }) {
  return (
    <View style={[s.confirmBox, { backgroundColor: C.greenLight, borderColor: C.greenBd }]}>
      <View style={[s.confirmCheck, { backgroundColor: C.greenLight }]}>
        <Feather name="check" size={12} color={C.green} />
      </View>
      <Text style={[s.confirmText, { color: 'rgba(255,255,255,0.85)' }]}>{text}</Text>
    </View>
  );
}

// ── DocCard action button ─────────────────────────────────────────────────────
function DocAction({
  icon, label, onPress, primary, done,
}: {
  icon: string; label: string; onPress: () => void; primary?: boolean; done?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={[
        s.docActionBtn,
        done
          ? { backgroundColor: C.greenLight, borderColor: C.greenBd }
          : primary
          ? { backgroundColor: C.ink, borderColor: 'transparent' }
          : { backgroundColor: '#fff', borderColor: C.border },
      ]}
    >
      <Feather
        name={icon as any}
        size={11}
        color={done ? C.green : primary ? '#fff' : C.muted}
      />
      <Text style={[
        s.docActionLabel,
        { color: done ? C.green : primary ? '#fff' : C.muted },
      ]}>
        {label}
      </Text>
    </Pressable>
  );
}

// ── DocField (label + value row) ──────────────────────────────────────────────
function DocField({ label, value, abnormal }: { label: string; value: string; abnormal?: boolean }) {
  if (!value) return null;
  return (
    <View style={s.docFieldRow}>
      <Text style={s.docFieldLabel}>{label}</Text>
      <Text style={[s.docFieldValue, abnormal && { color: C.red, fontWeight: '600' }]} numberOfLines={3}>
        {value}
      </Text>
    </View>
  );
}

// ── DocSection ────────────────────────────────────────────────────────────────
function DocSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={s.docSection}>
      <View style={[s.docSectionDivider, { backgroundColor: C.border }]} />
      <Text style={s.docSectionTitle}>{title}</Text>
      {children}
    </View>
  );
}

// ── CaseNote body ─────────────────────────────────────────────────────────────
function CaseNoteBody({
  extracted,
  patientContext,
}: {
  extracted: SmartDictationExtracted;
  patientContext?: CaseChatProps['patientContext'];
}) {
  const name = extracted.patientName || patientContext?.name || 'Unknown';
  const age  = extracted.patientAge  || (patientContext?.age ? String(patientContext.age) : '');
  const sex  = extracted.patientSex  || patientContext?.sex || '';
  const cc   = extracted.chiefComplaint || patientContext?.chiefComplaint || '';
  const vs   = extracted.vitalsSuggested || {};
  const ex   = extracted.examFindings || {};

  const bpAbnormal = (bp: string) => {
    const parts = bp.split('/');
    if (parts.length === 2) {
      const sys = parseInt(parts[0]);
      return sys < 90 || sys > 160;
    }
    return false;
  };
  const hrAbnormal = (hr: string) => {
    const v = parseInt(hr);
    return v > 100 || v < 60;
  };
  const spo2Abnormal = (s: string) => parseInt(s) < 94;
  const rrAbnormal  = (r: string) => { const v = parseInt(r); return v > 20 || v < 12; };

  const hasVitals = vs.hr || vs.bp || vs.spo2 || vs.rr || vs.temperature || vs.grbs;
  const hasHistory = cc || extracted.historyOfPresentIllness || extracted.allergies ||
    extracted.currentMedications || extracted.pastMedicalHistory || extracted.associatedSymptoms;
  const hasExam = ex.general || ex.cvs || ex.respiratory || ex.abdomen || ex.cns;
  const hasTreatment = extracted.treatmentNotes ||
    (extracted.prescribedMedications?.length) ||
    (extracted.prescribedInfusions?.length) ||
    extracted.investigationsOrdered;
  const hasDx = extracted.diagnosis?.length || extracted.differentialDiagnosis?.length;

  return (
    <View>
      {/* Patient header */}
      <View style={s.docPatientHeader}>
        <Text style={s.docPatientName}>
          {name}{age ? `, ${age}` : ''}{sex ? sex[0].toUpperCase() : ''}
        </Text>
      </View>

      {hasVitals ? (
        <DocSection title="Vitals">
          {vs.hr  ? <DocField label="HR"    value={`${vs.hr} bpm`}  abnormal={hrAbnormal(vs.hr)} /> : null}
          {vs.bp  ? <DocField label="BP"    value={`${vs.bp} mmHg`} abnormal={bpAbnormal(vs.bp)} /> : null}
          {vs.spo2? <DocField label="SpO₂"  value={`${vs.spo2}%`}   abnormal={spo2Abnormal(vs.spo2)} /> : null}
          {vs.rr  ? <DocField label="RR"    value={`${vs.rr}/min`}  abnormal={rrAbnormal(vs.rr)} /> : null}
          {vs.temperature ? <DocField label="Temp"  value={vs.temperature} /> : null}
          {vs.grbs ? <DocField label="GRBS" value={`${vs.grbs} mg/dL`} /> : null}
        </DocSection>
      ) : null}

      {hasHistory ? (
        <DocSection title="History">
          {cc  ? <DocField label="Complaint" value={cc} /> : null}
          {extracted.historyOfPresentIllness ? <DocField label="Events"    value={extracted.historyOfPresentIllness} /> : null}
          {extracted.associatedSymptoms      ? <DocField label="Symptoms"  value={extracted.associatedSymptoms} /> : null}
          {extracted.allergies               ? <DocField label="Allergies" value={extracted.allergies} /> : null}
          {extracted.currentMedications      ? <DocField label="Medications" value={extracted.currentMedications} /> : null}
          {extracted.pastMedicalHistory      ? <DocField label="Past Hx"   value={extracted.pastMedicalHistory} /> : null}
        </DocSection>
      ) : null}

      {hasExam ? (
        <DocSection title="Examination">
          {ex.general      ? <DocField label="General"    value={ex.general} /> : null}
          {ex.cvs          ? <DocField label="CVS"        value={ex.cvs} /> : null}
          {ex.respiratory  ? <DocField label="Resp"       value={ex.respiratory} /> : null}
          {ex.abdomen      ? <DocField label="Abdomen"    value={ex.abdomen} /> : null}
          {ex.cns          ? <DocField label="CNS"        value={ex.cns} /> : null}
        </DocSection>
      ) : null}

      {hasTreatment ? (
        <DocSection title="Treatment Given">
          {extracted.prescribedMedications?.length ? (
            <DocField label="Medications"
              value={extracted.prescribedMedications.map(m =>
                [m.name, m.dose, m.route, m.frequency].filter(Boolean).join(' ')
              ).join(', ')} />
          ) : null}
          {extracted.prescribedInfusions?.length ? (
            <DocField label="IV Fluids"
              value={extracted.prescribedInfusions.map(i =>
                [i.name, i.dose, i.dilution ? `in ${i.dilution}` : '', i.rate ? `@ ${i.rate}` : ''].filter(Boolean).join(' ')
              ).join(', ')} />
          ) : null}
          {extracted.treatmentNotes     ? <DocField label="Notes"  value={extracted.treatmentNotes} /> : null}
          {extracted.investigationsOrdered ? <DocField label="Investigations" value={extracted.investigationsOrdered} /> : null}
          {extracted.imagingOrdered        ? <DocField label="Imaging"        value={extracted.imagingOrdered} /> : null}
        </DocSection>
      ) : null}

      {hasDx ? (
        <DocSection title="Impression">
          {extracted.diagnosis?.length ? (
            <DocField label="Diagnosis"     value={extracted.diagnosis.join(', ')} />
          ) : null}
          {extracted.differentialDiagnosis?.length ? (
            <DocField label="Differentials" value={extracted.differentialDiagnosis.join(', ')} />
          ) : null}
        </DocSection>
      ) : null}
    </View>
  );
}

// ── LiveCaseNoteBody — renders CaseData (all tabs) in DocCard ─────────────────
function LiveCaseNoteBody({ c }: { c: CaseData }) {
  const v = c.vitals; const h = c.history; const p = c.primary;
  const e = c.exam;   const t = c.treatment; const d = c.disposition;

  const bpAbn  = (bp: string) => { const s = parseInt(bp.split('/')[0]); return s < 90 || s > 160; };
  const hrAbn  = (hr: string) => { const n = parseInt(hr); return n > 100 || n < 60; };
  const spo2Abn = (s: string) => parseInt(s) < 94;
  const rrAbn  = (r: string)  => { const n = parseInt(r);  return n > 20  || n < 12; };

  const hasVitals   = !!(v.hr || v.bp || v.spo2 || v.rr || v.temp || v.gcs || v.grbs);
  const hasHistory  = !!(h.symptoms || h.events || h.allergies || h.medications || h.pastHistory || h.lastMeal || h.pastSurgical || h.other);
  const hasPrimary  = !!(p.airway || p.breathing || p.circulation || p.disability || p.exposure || p.ecg || p.abg);
  const hasExam     = !!(e.general || e.cvs || e.respiratory || e.abdomen || e.neuro || e.extremities);
  const hasTreat    = !!(t.medications || t.infusions || t.ivFluids || t.procedures || t.labsOrdered || t.imaging || t.otherMedications);
  const hasDx       = !!(d.diagnosis || d.differentials);

  return (
    <View>
      <View style={s.docPatientHeader}>
        <Text style={s.docPatientName}>
          {c.name || 'Unknown'}{c.age ? `, ${c.age}` : ''}{c.sex ? ` ${c.sex[0]?.toUpperCase() || ''}` : ''}
        </Text>
        {c.priority ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 4 }}>
            <View style={{ backgroundColor: 'rgba(239,68,68,0.09)', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 5 }}>
              <Text style={{ fontSize: 10, fontWeight: '700', color: C.red }}>{c.priority}</Text>
            </View>
          </View>
        ) : null}
      </View>

      {hasVitals ? (
        <DocSection title="Vitals">
          {v.hr   ? <DocField label="HR"    value={`${v.hr} bpm`}   abnormal={hrAbn(v.hr)} /> : null}
          {v.bp   ? <DocField label="BP"    value={`${v.bp} mmHg`}  abnormal={bpAbn(v.bp)} /> : null}
          {v.spo2 ? <DocField label="SpO₂"  value={`${v.spo2}%`}    abnormal={spo2Abn(v.spo2)} /> : null}
          {v.rr   ? <DocField label="RR"    value={`${v.rr}/min`}   abnormal={rrAbn(v.rr)} /> : null}
          {v.temp ? <DocField label="Temp"  value={`${v.temp}\u00b0C`} /> : null}
          {v.gcs  ? <DocField label="GCS"   value={v.gcs} /> : null}
          {v.grbs ? <DocField label="GRBS"  value={`${v.grbs} mg/dL`} /> : null}
        </DocSection>
      ) : null}

      {hasHistory ? (
        <DocSection title="History (SAMPLE)">
          {h.symptoms    ? <DocField label="Symptoms"    value={h.symptoms} /> : null}
          {h.events      ? <DocField label="Events"      value={h.events} /> : null}
          {h.allergies   ? <DocField label="Allergies"   value={h.allergies} /> : null}
          {h.medications ? <DocField label="Medications" value={h.medications} /> : null}
          {h.pastHistory ? <DocField label="Past Hx"     value={h.pastHistory} /> : null}
          {h.lastMeal    ? <DocField label="Last meal"   value={h.lastMeal} /> : null}
          {h.pastSurgical? <DocField label="Past surgery" value={h.pastSurgical} /> : null}
          {h.other       ? <DocField label="Other"       value={h.other} /> : null}
        </DocSection>
      ) : null}

      {hasPrimary ? (
        <DocSection title="Primary Survey (ABCDE)">
          {p.airway      ? <DocField label="Airway"      value={p.airway} /> : null}
          {p.breathing   ? <DocField label="Breathing"   value={p.breathing} /> : null}
          {p.circulation ? <DocField label="Circulation" value={p.circulation} /> : null}
          {p.disability  ? <DocField label="Disability"  value={p.disability} /> : null}
          {p.exposure    ? <DocField label="Exposure"    value={p.exposure} /> : null}
          {p.ecg         ? <DocField label="ECG"         value={p.ecg} /> : null}
          {p.abg         ? <DocField label="ABG"         value={p.abg} /> : null}
        </DocSection>
      ) : null}

      {hasExam ? (
        <DocSection title="Examination">
          {e.general     ? <DocField label="General"     value={e.general} /> : null}
          {e.cvs         ? <DocField label="CVS"         value={e.cvs} /> : null}
          {e.respiratory ? <DocField label="Resp"        value={e.respiratory} /> : null}
          {e.abdomen     ? <DocField label="Abdomen"     value={e.abdomen} /> : null}
          {e.neuro       ? <DocField label="Neuro"       value={e.neuro} /> : null}
          {e.extremities ? <DocField label="Extremities" value={e.extremities} /> : null}
        </DocSection>
      ) : null}

      {hasTreat ? (
        <DocSection title="Treatment Given">
          {t.medications      ? <DocField label="Medications" value={t.medications} /> : null}
          {t.infusions        ? <DocField label="Infusions"   value={t.infusions} /> : null}
          {t.otherMedications ? <DocField label="Other meds"  value={t.otherMedications} /> : null}
          {t.ivFluids         ? <DocField label="IV Fluids"   value={t.ivFluids} /> : null}
          {t.procedures       ? <DocField label="Procedures"  value={t.procedures} /> : null}
          {t.labsOrdered      ? <DocField label="Labs"        value={t.labsOrdered} /> : null}
          {t.imaging          ? <DocField label="Imaging"     value={t.imaging} /> : null}
        </DocSection>
      ) : null}

      {c.notes ? (
        <DocSection title="Notes">
          <DocField label="" value={c.notes} />
        </DocSection>
      ) : null}

      {hasDx ? (
        <DocSection title="Impression">
          {d.diagnosis     ? <DocField label="Diagnosis"     value={d.diagnosis} /> : null}
          {d.differentials ? <DocField label="Differentials" value={d.differentials} /> : null}
          {d.decision      ? <DocField label="Disposition"   value={`${d.decision}${d.admitTo ? ` — ${d.admitTo}` : ''}${d.referTo ? ` · Referral: ${d.referTo}` : ''}`} /> : null}
        </DocSection>
      ) : null}
    </View>
  );
}

// ── DocCard ───────────────────────────────────────────────────────────────────
function DocCard({
  type,
  title,
  tag,
  children,
  onCopy,
  onExport,
  onSave,
}: {
  type: 'case' | 'discharge' | 'note';
  title: string;
  tag: string;
  children: React.ReactNode;
  onCopy?: () => void;
  onExport?: () => void;
  onSave?: () => void;
}) {
  const [copied, setCopied] = useState(false);
  const headerColors: [string, string] =
    type === 'discharge' ? ['#1E2530', '#252E3D'] : ['#0B0F14', '#1A2332'];

  const handleCopy = () => {
    onCopy?.();
    setCopied(true);
    setTimeout(() => setCopied(false), 2200);
  };

  return (
    <View style={s.docCard}>
      <View style={[s.docCardHeader, { backgroundColor: headerColors[0] }]}>
        <Feather
          name={type === 'discharge' ? 'file-text' : 'clipboard'}
          size={14}
          color="rgba(255,255,255,0.8)"
        />
        <Text style={s.docCardTitle}>{title}</Text>
        <View style={[s.docCardTag, { backgroundColor: C.greenLight, borderColor: C.greenBd }]}>
          <Text style={[s.docCardTagText, { color: C.green }]}>{tag}</Text>
        </View>
      </View>

      <ScrollView
        style={{ maxHeight: 320 }}
        showsVerticalScrollIndicator={false}
        nestedScrollEnabled
      >
        <View style={s.docCardBody}>{children}</View>
      </ScrollView>

      <View style={[s.docCardActions, { backgroundColor: C.surface, borderTopColor: C.docBorder }]}>
        <DocAction icon="copy" label={copied ? 'Copied' : 'Copy all'} onPress={handleCopy} primary={!copied} done={copied} />
        {onExport ? <DocAction icon="download" label="Export PDF" onPress={onExport} /> : null}
        {onSave   ? <DocAction icon="save"     label="Save"       onPress={onSave} /> : null}
      </View>
    </View>
  );
}

// ── Suggestion chips ──────────────────────────────────────────────────────────
function SuggestionChips({ suggestions, onTap }: { suggestions: string[]; onTap: (s: string) => void }) {
  if (!suggestions.length) return null;
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.chipsScroll} contentContainerStyle={s.chipsRow}>
      {suggestions.map(s => (
        <Pressable key={s} onPress={() => onTap(s)} style={s2.chip}>
          <Text style={s2.chipText}>{s}</Text>
        </Pressable>
      ))}
    </ScrollView>
  );
}

// ── Typing dots ───────────────────────────────────────────────────────────────
function TypingDots() {
  const dots = [useRef(new Animated.Value(0.3)).current, useRef(new Animated.Value(0.3)).current, useRef(new Animated.Value(0.3)).current];
  useEffect(() => {
    dots.forEach((d, i) => {
      Animated.loop(
        Animated.sequence([
          Animated.delay(i * 180),
          Animated.timing(d, { toValue: 1, duration: 300, useNativeDriver: true }),
          Animated.timing(d, { toValue: 0.3, duration: 300, useNativeDriver: true }),
          Animated.delay(500),
        ])
      ).start();
    });
  }, []);
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, paddingVertical: 6 }}>
      {dots.map((d, i) => (
        <Animated.View key={i} style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: C.faint, opacity: d }} />
      ))}
    </View>
  );
}

// ── Field counter ─────────────────────────────────────────────────────────────
function countFields(extracted: SmartDictationExtracted): number {
  let n = 0;
  const keys = ['patientName','patientAge','patientSex','chiefComplaint','historyOfPresentIllness',
    'onset','duration','progression','associatedSymptoms','negativeSymptoms','pastMedicalHistory',
    'pastSurgicalHistory','allergies','currentMedications','treatmentNotes','investigationsOrdered','imagingOrdered'];
  keys.forEach(k => { if ((extracted as any)[k]) n++; });
  const vs = extracted.vitalsSuggested;
  if (vs) { ['hr','bp','rr','spo2','temperature','grbs'].forEach(k => { if ((vs as any)[k]) n++; }); }
  const ex = extracted.examFindings;
  if (ex) { ['general','cvs','respiratory','abdomen','cns','heent','musculoskeletal','skin'].forEach(k => { if ((ex as any)[k]) n++; }); }
  if (extracted.diagnosis?.length) n++;
  if (extracted.differentialDiagnosis?.length) n++;
  if (extracted.prescribedMedications?.length) n++;
  if (extracted.prescribedInfusions?.length) n++;
  return n;
}

// ── Main CaseChat ─────────────────────────────────────────────────────────────
const AFTER_CASE_CHIPS = ['Prepare discharge summary', 'Add to treatment', 'Change priority', 'Referral letter'];
const AFTER_DS_CHIPS   = ['Add allergy', 'Export PDF', 'Show differentials', 'Edit diagnosis'];

export default function CaseChat({ onDataExtracted, patientContext, liveCase, initialExtracted, disabled = false }: CaseChatProps) {
  const [messages, setMessages]         = useState<ChatMessage[]>([]);
  const [inputText, setInputText]       = useState('');
  const [isRecording, setIsRecording]   = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [isThinking, setIsThinking]     = useState(false);
  const [toast, setToast]               = useState<string | null>(null);
  const [recSecs, setRecSecs]           = useState(0);
  const [hasCaseNote, setHasCaseNote]   = useState(false);
  const [hasDs, setHasDs]               = useState(false);

  const scrollRef           = useRef<ScrollView>(null);
  const nativeRecRef        = useRef<Audio.Recording | null>(null);
  const webRecRef           = useRef<{ mr: MediaRecorder | null; chunks: Blob[]; stream: MediaStream | null }>({ mr: null, chunks: [], stream: null });
  const historyRef          = useRef<{ role: 'user' | 'assistant'; content: string }[]>([]);
  const recTimerRef         = useRef<ReturnType<typeof setInterval> | null>(null);
  const idRef               = useRef(0);
  const recStartRef         = useRef(0);
  const initialPushedRef    = useRef(false);

  // Auto-show case note when opened post-dictation (VoiceRecorder path)
  useEffect(() => {
    if (initialExtracted && !initialPushedRef.current) {
      initialPushedRef.current = true;
      const fc = countFields(initialExtracted);
      push({
        role: 'assistant',
        content: `Case note ready — ${fc} field${fc !== 1 ? 's' : ''} captured from your dictation.`,
        type: 'case_update',
        extracted: initialExtracted,
        fieldCount: fc,
      });
      setHasCaseNote(true);
    }
  }, [initialExtracted]);

  const genId = () => `m${Date.now()}_${++idRef.current}`;

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2200);
  };

  useEffect(() => {
    const t = setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 80);
    return () => clearTimeout(t);
  }, [messages]);

  const push = (msg: Omit<ChatMessage, 'id'>): string => {
    const id = genId();
    setMessages(p => [...p, { ...msg, id }]);
    return id;
  };

  const replace = (id: string, update: Partial<ChatMessage>) => {
    setMessages(p => p.map(m => m.id === id ? { ...m, ...update } : m));
  };

  const sendToAI = async (text: string, durSecs?: number) => {
    if (!text.trim() || isThinking) return;

    push({ role: 'user', content: text, type: 'text', durationSecs: durSecs });
    const prev = [...historyRef.current];
    historyRef.current.push({ role: 'user', content: text });

    setIsThinking(true);
    const lid = push({ role: 'assistant', content: '', type: 'text', isLoading: true });

    try {
      const apiUrl = getApiUrl();
      const res = await fetch(new URL('/api/voice/chat', apiUrl).toString(), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: prev,
          currentMessage: text,
          patientContext,
        }),
      });

      if (!res.ok) throw new Error(`Chat failed (${res.status})`);
      const data = await res.json();
      const { reply, type, extracted, specialContent } = data;
      const fc = extracted ? countFields(extracted) : 0;

      replace(lid, {
        content: reply || '',
        type: type || 'general',
        extracted: extracted || undefined,
        specialContent: specialContent || undefined,
        fieldCount: fc,
        isLoading: false,
      });

      historyRef.current.push({ role: 'assistant', content: reply || '' });

      if (type === 'case_update' && extracted && fc > 0) {
        onDataExtracted(extracted);
        setHasCaseNote(true);
      }
      if (type === 'discharge_summary') setHasDs(true);
    } catch (err) {
      replace(lid, { content: 'Something went wrong. Try again.', type: 'error', isLoading: false });
    } finally {
      setIsThinking(false);
    }
  };

  const handleChip = (chip: string) => {
    setInputText('');
    const lower = chip.toLowerCase();
    if ((lower.includes('discharge summary') || lower.includes('discharge')) && liveCase) {
      const dsText = generateDischargeSummary(liveCase);
      push({ role: 'user', content: chip, type: 'text' });
      push({ role: 'assistant', content: 'Discharge summary generated from your case data.', type: 'discharge_summary', specialContent: dsText });
      setHasDs(true);
      return;
    }
    if ((lower.includes('referral') || lower.includes('refer')) && liveCase) {
      const refText = generateReferralLetter(liveCase);
      push({ role: 'user', content: chip, type: 'text' });
      push({ role: 'assistant', content: `Referral letter prepared${liveCase.disposition.referTo ? ` for ${liveCase.disposition.referTo}` : ''}.`, type: 'referral', specialContent: refText });
      return;
    }
    sendToAI(chip);
  };

  const handleSend = () => {
    const t = inputText.trim();
    if (!t) return;
    setInputText('');
    sendToAI(t);
  };

  const startRecording = async () => {
    try {
      recStartRef.current = Date.now();
      setRecSecs(0);
      recTimerRef.current = setInterval(() => {
        setRecSecs(Math.floor((Date.now() - recStartRef.current) / 1000));
      }, 1000);

      if (Platform.OS === 'web') {
        if (!navigator.mediaDevices?.getUserMedia) return;
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        webRecRef.current.stream = stream;
        webRecRef.current.chunks = [];
        const mimeType = MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm' : 'audio/mp4';
        const mr = new MediaRecorder(stream, { mimeType });
        mr.ondataavailable = e => { if (e.data.size > 0) webRecRef.current.chunks.push(e.data); };
        mr.onstop = () => {
          const blob = new Blob(webRecRef.current.chunks, { type: mimeType });
          webRecRef.current.stream?.getTracks().forEach(t => t.stop());
          transcribeAudio(blob, null);
        };
        webRecRef.current.mr = mr;
        mr.start(100);
      } else {
        const perm = await Audio.requestPermissionsAsync();
        if (!perm.granted) return;
        await Audio.setAudioModeAsync({ allowsRecordingIOS: true, playsInSilentModeIOS: true });
        const { recording } = await Audio.Recording.createAsync(Audio.RecordingOptionsPresets.HIGH_QUALITY);
        nativeRecRef.current = recording;
      }
      setIsRecording(true);
    } catch (err) {
      if (recTimerRef.current) { clearInterval(recTimerRef.current); recTimerRef.current = null; }
      console.error('[CaseChat] startRecording:', err);
    }
  };

  const stopRecording = async () => {
    if (recTimerRef.current) { clearInterval(recTimerRef.current); recTimerRef.current = null; }
    const elapsed = Math.floor((Date.now() - recStartRef.current) / 1000);
    setIsRecording(false);
    try {
      if (Platform.OS === 'web') {
        const mr = webRecRef.current.mr;
        if (mr && mr.state !== 'inactive') mr.stop();
      } else {
        const rec = nativeRecRef.current;
        if (!rec) return;
        await rec.stopAndUnloadAsync();
        await Audio.setAudioModeAsync({ allowsRecordingIOS: false });
        const uri = rec.getURI();
        nativeRecRef.current = null;
        if (uri) transcribeAudio(null, uri, elapsed);
      }
    } catch (err) {
      console.error('[CaseChat] stopRecording:', err);
    }
  };

  const transcribeAudio = async (blob: Blob | null, uri: string | null, durSecs?: number) => {
    setIsTranscribing(true);
    try {
      const formData = new FormData();
      if (Platform.OS === 'web' && blob) {
        const ext = blob.type.includes('webm') ? 'webm' : 'm4a';
        formData.append('audio', blob, `voice.${ext}`);
      } else if (uri) {
        const ext = uri.split('.').pop() || 'm4a';
        formData.append('audio', {
          uri, name: `voice.${ext}`,
          type: `audio/${ext === 'caf' ? 'x-caf' : ext === 'm4a' ? 'mp4' : ext}`,
        } as any);
      } else { return; }
      formData.append('mode', 'field');
      if (patientContext) formData.append('patientContext', JSON.stringify(patientContext));

      const apiUrl = getApiUrl();
      const res = await fetch(new URL('/api/voice/transcribe', apiUrl).toString(), {
        method: 'POST', body: formData,
      });
      if (!res.ok) throw new Error('Transcription failed');
      const data = await res.json();
      const txt: string = data.transcript || '';
      if (txt.trim()) sendToAI(txt, durSecs);
    } catch (err) {
      console.error('[CaseChat] transcribe:', err);
    } finally {
      setIsTranscribing(false);
    }
  };

  const handleMic = () => {
    if (disabled || isThinking || isTranscribing) return;
    if (isRecording) stopRecording();
    else startRecording();
  };

  const hasMessages = messages.length > 0;
  const suggestions = hasDs ? AFTER_DS_CHIPS : hasCaseNote ? AFTER_CASE_CHIPS : [];
  const busy = isThinking || isTranscribing;

  return (
    <View style={s.container}>
      {/* Chat area */}
      <ScrollView
        ref={scrollRef}
        style={s.msgList}
        contentContainerStyle={[s.msgContent, !hasMessages && s.msgContentEmpty]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Empty / recording states */}
        {!hasMessages && !isRecording ? <EmptyState /> : null}
        {isRecording ? (
          <View style={s.recordingFullState}>
            <Text style={s.recordingListening}>Listening…</Text>
            <RecordingWave />
            <Text style={s.recordingHint}>Speak the case naturally in any language</Text>
          </View>
        ) : null}

        {/* Messages */}
        {messages.map(msg => {
          if (msg.role === 'user') {
            const isVoice = msg.durationSecs !== undefined;
            return (
              <DoctorBubble
                key={msg.id}
                icon={isVoice ? 'mic' : undefined}
                text={isVoice
                  ? `Voice dictation · ${msg.durationSecs}s`
                  : msg.content}
              />
            );
          }

          if (msg.isLoading) {
            return (
              <ErMateResponse key={msg.id}>
                <TypingDots />
              </ErMateResponse>
            );
          }

          if (msg.type === 'case_update') {
            const fc = msg.fieldCount ?? 0;
            const useLive = !!liveCase;
            return (
              <React.Fragment key={msg.id}>
                <SystemLabel text="ErMate processed your dictation" />
                <ErMateResponse
                  subtitle={useLive
                    ? 'Case note — live from all tabs'
                    : `Case note ready · ${fc} field${fc !== 1 ? 's' : ''} captured`}
                >
                  <DocCard
                    type="case"
                    title="Emergency Case Note"
                    tag="CASE NOTE"
                    onCopy={() => {
                      const txt = useLive
                        ? generateCaseNote(liveCase!)
                        : buildCopyText(msg.extracted!, patientContext);
                      Clipboard.setStringAsync(txt);
                      showToast('Case note copied to clipboard');
                    }}
                    onSave={() => showToast('Saved to dashboard')}
                  >
                    {useLive
                      ? <LiveCaseNoteBody c={liveCase!} />
                      : msg.extracted
                        ? <CaseNoteBody extracted={msg.extracted} patientContext={patientContext} />
                        : null}
                  </DocCard>
                </ErMateResponse>
              </React.Fragment>
            );
          }

          if (msg.type === 'discharge_summary' && msg.specialContent) {
            const dsText = liveCase ? generateDischargeSummary(liveCase) : msg.specialContent;
            return (
              <React.Fragment key={msg.id}>
                <ErMateResponse subtitle="Discharge summary generated from your case data.">
                  <DocCard
                    type="discharge"
                    title="Discharge Summary"
                    tag="DISCHARGE"
                    onCopy={() => {
                      Clipboard.setStringAsync(dsText);
                      showToast('Discharge summary copied');
                    }}
                    onExport={() => showToast('Exporting PDF…')}
                  >
                    <View style={s.docFreeText}>
                      <Text style={s.docFreeTextContent}>{dsText}</Text>
                    </View>
                  </DocCard>
                </ErMateResponse>
              </React.Fragment>
            );
          }

          if (msg.type === 'referral' && msg.specialContent) {
            const refText = liveCase ? generateReferralLetter(liveCase) : msg.specialContent;
            return (
              <React.Fragment key={msg.id}>
                <ErMateResponse subtitle={`Referral letter${liveCase?.disposition.referTo ? ` — ${liveCase.disposition.referTo}` : ''}`}>
                  <DocCard
                    type="discharge"
                    title="Referral Letter"
                    tag="REFERRAL"
                    onCopy={() => {
                      Clipboard.setStringAsync(refText);
                      showToast('Referral letter copied');
                    }}
                    onExport={() => showToast('Exporting PDF…')}
                  >
                    <View style={s.docFreeText}>
                      <Text style={s.docFreeTextContent}>{refText}</Text>
                    </View>
                  </DocCard>
                </ErMateResponse>
              </React.Fragment>
            );
          }

          if (msg.type === 'note' && msg.specialContent) {
            return (
              <ErMateResponse key={msg.id}>
                <UpdateConfirmation text={`Note added: ${msg.specialContent}`} />
              </ErMateResponse>
            );
          }

          if (msg.type === 'error') {
            return (
              <ErMateResponse key={msg.id}>
                <View style={[s.confirmBox, { backgroundColor: 'rgba(239,68,68,0.08)', borderColor: 'rgba(239,68,68,0.2)' }]}>
                  <Feather name="alert-circle" size={13} color={C.red} />
                  <Text style={[s.confirmText, { color: 'rgba(255,255,255,0.7)' }]}>{msg.content}</Text>
                </View>
              </ErMateResponse>
            );
          }

          if (msg.content) {
            return (
              <ErMateResponse key={msg.id}>
                <Text style={s.erTextMsg}>{msg.content}</Text>
              </ErMateResponse>
            );
          }

          return null;
        })}

        {/* Suggestion chips after last AI message */}
        {!isThinking && suggestions.length > 0 ? (
          <SuggestionChips suggestions={suggestions} onTap={handleChip} />
        ) : null}
      </ScrollView>

      {/* Input bar */}
      <View style={s.inputBar}>
        {/* Text input area */}
        {isRecording || isTranscribing ? (
          <View style={s.inputRecordingState}>
            {isRecording ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <View style={[s.recDot, { backgroundColor: C.red }]} />
                <Text style={[s.recLabel, { color: C.red }]}>Recording… {recSecs}s  —  tap to stop</Text>
              </View>
            ) : (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <ActivityIndicator size="small" color={C.orange} />
                <Text style={[s.recLabel, { color: C.orange }]}>Transcribing…</Text>
              </View>
            )}
          </View>
        ) : (
          <TextInput
            style={s.input}
            value={inputText}
            onChangeText={setInputText}
            placeholder={hasCaseNote
              ? 'Try: discharge summary, add allergy…'
              : 'Or type your case note…'}
            placeholderTextColor="rgba(255,255,255,0.22)"
            multiline
            maxLength={1500}
            editable={!disabled && !busy}
          />
        )}

        {/* Mic */}
        <Pressable
          onPress={handleMic}
          disabled={disabled || busy && !isRecording}
          style={[
            s.micBtn,
            isRecording
              ? { backgroundColor: 'rgba(239,68,68,0.15)', borderColor: 'rgba(239,68,68,0.3)' }
              : !hasCaseNote
              ? { backgroundColor: C.green }
              : { backgroundColor: 'rgba(29,184,112,0.12)', borderColor: C.greenBd },
          ]}
        >
          <Feather
            name={isRecording ? 'square' : 'mic'}
            size={18}
            color={isRecording ? C.red : !hasCaseNote ? '#fff' : C.green}
          />
        </Pressable>

        {/* Send */}
        {inputText.trim().length > 0 && !isRecording ? (
          <Pressable
            onPress={handleSend}
            disabled={busy}
            style={[s.sendBtn, { backgroundColor: inputText.trim() ? C.green : 'rgba(255,255,255,0.06)' }]}
          >
            <Text style={{ color: inputText.trim() ? '#fff' : 'rgba(255,255,255,0.25)', fontSize: 18, lineHeight: 20 }}>↑</Text>
          </Pressable>
        ) : null}
      </View>

      {/* Toast */}
      {toast ? (
        <View style={s.toast}>
          <Feather name="check" size={12} color="#fff" />
          <Text style={s.toastText}>{toast}</Text>
        </View>
      ) : null}
    </View>
  );
}

// ── Copy helper ───────────────────────────────────────────────────────────────
function buildCopyText(ex: SmartDictationExtracted, ctx?: CaseChatProps['patientContext']): string {
  const lines: string[] = [];
  const name = ex.patientName || ctx?.name || 'Unknown';
  const age  = ex.patientAge  || (ctx?.age ? String(ctx.age) : '');
  const sex  = ex.patientSex  || ctx?.sex || '';
  lines.push(`EMERGENCY CASE NOTE`);
  lines.push(`Patient: ${name}${age ? `, ${age}` : ''}${sex ? ` ${sex}` : ''}`);
  if (ex.chiefComplaint || ctx?.chiefComplaint) lines.push(`Chief Complaint: ${ex.chiefComplaint || ctx?.chiefComplaint}`);
  const vs = ex.vitalsSuggested;
  if (vs) {
    const vl = [vs.hr && `HR ${vs.hr}`, vs.bp && `BP ${vs.bp}`, vs.spo2 && `SpO2 ${vs.spo2}%`, vs.rr && `RR ${vs.rr}`].filter(Boolean);
    if (vl.length) lines.push(`Vitals: ${vl.join(' | ')}`);
  }
  if (ex.historyOfPresentIllness) lines.push(`HPI: ${ex.historyOfPresentIllness}`);
  if (ex.diagnosis?.length) lines.push(`Diagnosis: ${ex.diagnosis.join(', ')}`);
  return lines.join('\n');
}

// ── Styles ────────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  container: {
    backgroundColor: C.chat,
    borderRadius: 16,
    overflow: 'hidden',
    minHeight: 460,
  },
  msgList: { flex: 1, minHeight: 340 },
  msgContent: { padding: 14, gap: 6, paddingBottom: 10 },
  msgContentEmpty: { flex: 1, justifyContent: 'center' },

  // Empty
  emptyState: { alignItems: 'center', justifyContent: 'center', gap: 14, paddingVertical: 30 },
  emptyIcon: { width: 56, height: 56, borderRadius: 16, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  emptyTitle: { fontSize: 16, fontWeight: '700', color: C.white, textAlign: 'center' },
  emptySub: { fontSize: 12.5, color: 'rgba(255,255,255,0.35)', lineHeight: 20, textAlign: 'center', maxWidth: 240 },

  // Recording full state
  recordingFullState: { alignItems: 'center', justifyContent: 'center', gap: 20, paddingVertical: 40, flex: 1 },
  recordingListening: { fontSize: 13, color: 'rgba(255,255,255,0.4)', fontWeight: '600' },
  recordingHint: { fontSize: 12, color: 'rgba(255,255,255,0.25)', textAlign: 'center', fontStyle: 'italic', maxWidth: 240 },

  // Wave
  wave: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  waveDot: { width: 8, height: 8, borderRadius: 4 },
  waveBars: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  waveLabel: { fontSize: 12, fontWeight: '700' },

  // Doctor bubble
  doctorRow: { flexDirection: 'row', justifyContent: 'flex-end', marginBottom: 2 },
  doctorBubble: {
    backgroundColor: C.bubble,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    borderRadius: 16,
    borderBottomRightRadius: 4,
    paddingHorizontal: 14,
    paddingVertical: 10,
    maxWidth: '75%',
  },
  doctorBubbleText: { fontSize: 13, color: 'rgba(255,255,255,0.85)', lineHeight: 20 },

  // System label
  sysLabelRow: { alignItems: 'center', marginVertical: 8 },
  sysLabelText: { fontSize: 10, color: 'rgba(255,255,255,0.25)', fontWeight: '600', letterSpacing: 0.5 },

  // ErMate response
  erRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, marginBottom: 4 },
  erAvatar: { width: 22, height: 22, borderRadius: 6, alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 2 },
  erName: { fontSize: 11, fontWeight: '700', color: C.green, marginBottom: 2 },
  erSubtitle: { fontSize: 11.5, color: 'rgba(255,255,255,0.45)', marginBottom: 8, lineHeight: 16 },
  erTextMsg: { fontSize: 12.5, color: 'rgba(255,255,255,0.75)', lineHeight: 19 },

  // Update confirmation
  confirmBox: { borderRadius: 12, padding: 10, flexDirection: 'row', alignItems: 'flex-start', gap: 9, borderWidth: 1 },
  confirmCheck: { width: 22, height: 22, borderRadius: 11, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  confirmText: { fontSize: 12.5, lineHeight: 18, flex: 1 },

  // DocCard
  docCard: {
    backgroundColor: C.docBg,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: C.docBorder,
    overflow: 'hidden',
    marginBottom: 4,
    shadowColor: '#000',
    shadowOpacity: 0.18,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  docCardHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 11, paddingHorizontal: 14 },
  docCardTitle: { fontSize: 12, fontWeight: '800', color: 'rgba(255,255,255,0.9)', letterSpacing: 0.3, flex: 1 },
  docCardTag: { borderRadius: 4, paddingHorizontal: 7, paddingVertical: 2, borderWidth: 1 },
  docCardTagText: { fontSize: 9, fontWeight: '700', letterSpacing: 0.5 },
  docCardBody: { padding: 14 },
  docCardActions: {
    flexDirection: 'row', gap: 6, padding: 9, paddingHorizontal: 14,
    borderTopWidth: 1, flexWrap: 'wrap',
  },

  // DocCard action button
  docActionBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 11, paddingVertical: 6, borderRadius: 8, borderWidth: 1 },
  docActionLabel: { fontSize: 11, fontWeight: '700' },

  // DocField
  docFieldRow: { flexDirection: 'row', gap: 10, marginBottom: 5 },
  docFieldLabel: { fontSize: 11, color: C.faint, width: 88, flexShrink: 0, lineHeight: 18 },
  docFieldValue: { fontSize: 11.5, color: C.ink, flex: 1, lineHeight: 18 },

  // DocSection
  docSection: { marginBottom: 12 },
  docSectionDivider: { height: 1, marginBottom: 7 },
  docSectionTitle: { fontSize: 9.5, fontWeight: '800', letterSpacing: 1.2, textTransform: 'uppercase', color: C.faint, marginBottom: 7 },

  // Patient header in doccard
  docPatientHeader: { marginBottom: 12, paddingBottom: 10, borderBottomWidth: 1, borderBottomColor: C.border },
  docPatientName: { fontSize: 15, fontWeight: '700', color: C.ink, marginBottom: 4 },

  // Free text (discharge summary)
  docFreeText: { padding: 2 },
  docFreeTextContent: { fontSize: 12, color: C.ink, lineHeight: 20 },

  // Suggestion chips
  chipsScroll: { marginTop: 4, marginBottom: 2 },
  chipsRow: { flexDirection: 'row', gap: 7, paddingHorizontal: 4, paddingVertical: 6 },

  // Input bar
  inputBar: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 10,
    padding: 10,
    paddingHorizontal: 14,
    paddingBottom: 14,
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.07)',
  },
  input: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 11,
    fontSize: 13,
    color: 'rgba(255,255,255,0.85)',
    maxHeight: 80,
    minHeight: 42,
  },
  inputRecordingState: {
    flex: 1,
    justifyContent: 'center',
    paddingVertical: 12,
  },
  micBtn: {
    width: 42, height: 42, borderRadius: 12,
    alignItems: 'center', justifyContent: 'center',
    flexShrink: 0, borderWidth: 1, borderColor: 'transparent',
  },
  sendBtn: {
    width: 42, height: 42, borderRadius: 12,
    alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
  recDot: { width: 8, height: 8, borderRadius: 4 },
  recLabel: { fontSize: 12.5, fontWeight: '600' },

  // Toast
  toast: {
    position: 'absolute', top: 12, alignSelf: 'center',
    backgroundColor: C.greenDark, flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 16, paddingVertical: 8, borderRadius: 99,
    shadowColor: '#000', shadowOpacity: 0.3, shadowRadius: 8, shadowOffset: { width: 0, height: 4 },
  },
  toastText: { fontSize: 12, fontWeight: '700', color: '#fff' },
});

// Chip styles in separate object (name clash with `s`)
const s2 = StyleSheet.create({
  chip: {
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    borderRadius: 99,
    paddingHorizontal: 14,
    paddingVertical: 7,
  },
  chipText: { fontSize: 12, fontWeight: '500', color: 'rgba(255,255,255,0.7)' },
});
