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
  patientType: string;
  isMLC: boolean;
  userName: string;
  userRole: string;
  conditionAtDischarge: string;
  caseTime: string;
  patientTitle: string;
  bedNumber: string;
  erNumber: string;
  efast: string;
  psychological: {
    depression: boolean; anxiety: boolean; psychosis: boolean;
    agitation: boolean; suicidalIdeation: boolean; substanceUse: boolean;
  };
  vitals: {
    hr: string; bp: string; spo2: string;
    rr: string; temp: string; gcs: string; grbs: string;
    gcsE: string; gcsV: string; gcsM: string;
    crt: string; pupils: string; tempDisplay: string;
  };
  history: {
    symptoms: string; allergies: string; medications: string;
    pastHistory: string; lastMeal: string; events: string;
    pastSurgical: string; other: string; lmp: string;
  };
  primary: {
    airway: string; breathing: string; circulation: string;
    disability: string; exposure: string; ecg: string; abg: string;
  };
  examToggles: {
    pallor: boolean; icterus: boolean; cyanosis: boolean;
    clubbing: boolean; lymphadenopathy: boolean; edema: boolean;
  };
  exam: {
    general: string; cvs: string; respiratory: string;
    abdomen: string; neuro: string; extremities: string;
  };
  treatment: {
    medications: string; infusions: string; otherMedications: string;
    ivFluids: string; procedures: string; labsOrdered: string; imaging: string;
    resultsSummary: string;
  };
  notes: string;
  disposition: {
    diagnosis: string; differentials: string;
    decision: string; admitTo: string; referTo: string;
    followUp: string;
  };
}

// ── Document generators — pure functions of CaseData ─────────────────────────
// Returns true when the case has enough real clinical content to warrant showing exam defaults
function hasClinicalContent(c: CaseData): boolean {
  const v = c.vitals;
  return !!(c.history.symptoms || c.history.events || c.disposition.diagnosis ||
    v.hr || v.bp || v.spo2 || v.rr || v.temp);
}

const NOTE_SEP = '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━';

function buildGcsDisplay(c: CaseData): string {
  const { gcsE, gcsV, gcsM, gcs } = c.vitals;
  if (gcsE && gcsV && gcsM) {
    const total = (parseInt(gcsE) || 0) + (parseInt(gcsV) || 0) + (parseInt(gcsM) || 0);
    return `GCS: E${gcsE} V${gcsV} M${gcsM} (${total || gcs}/15)`;
  }
  return gcs ? `GCS: ${gcs}` : 'GCS: 15';
}

export function generateCaseNote(c: CaseData): string {
  const L: string[] = [];
  const h = c.history;
  const v = c.vitals;
  const p = c.primary;
  const e = c.exam;
  const t = c.treatment;
  const d = c.disposition;
  const hasContent = hasClinicalContent(c);

  // ── Title ──────────────────────────────────────────────────────────────────
  L.push('INITIAL ASSESSMENT AND EMERGENCY');
  L.push('DEPARTMENT CASE RECORD');
  L.push(NOTE_SEP);

  // ── Patient header ──────────────────────────────────────────────────────────
  const isFemale = c.sex?.toLowerCase().startsWith('f');
  const autoTitle = c.patientTitle || (isFemale ? 'Ms.' : c.sex?.toLowerCase().startsWith('m') ? 'Mr.' : '');
  L.push(`Patient: ${autoTitle ? autoTitle + ' ' : ''}${c.name || '—'}`);
  L.push(`Age: ${c.age ? c.age + 'Y' : '—'} / ${c.sex || '—'}`);
  const idParts = [
    c.erNumber ? `ER No: ${c.erNumber}` : '',
    c.bedNumber ? `Bed: ${c.bedNumber}` : '',
    c.caseNumber ? `Case: ${c.caseNumber}` : '',
  ].filter(Boolean);
  if (idParts.length) L.push(idParts.join('    '));
  L.push('');
  L.push(`CASE SEEN BY Dr. ${c.doctorName || '____'}${c.caseTime ? ' AT ' + c.caseTime : ''} on ${c.date || '____'}`);

  // ── Presenting Complaint ────────────────────────────────────────────────────
  L.push('');
  L.push(NOTE_SEP);
  L.push('PRESENTING COMPLAINT');
  L.push(h.symptoms || (h.events ? h.events.split('.')[0] : '') || 'Not documented');

  // ── Primary Assessment (ABCDE) ──────────────────────────────────────────────
  L.push('');
  L.push(NOTE_SEP);
  L.push('PRIMARY ASSESSMENT (ABCDE)');
  L.push('');

  // A — Airway
  L.push(`· Airway → ${p.airway || 'Patent'}`);

  // B — Breathing
  const bParts: string[] = [];
  if (v.rr) bParts.push(`RR: ${v.rr}/min`);
  if (v.spo2) bParts.push(`SpO₂: ${v.spo2}% on room air`);
  if (p.breathing) bParts.push(p.breathing);
  else bParts.push('Work of breathing normal, Air entry bilaterally equal');
  L.push(`· Breathing → ${bParts.join(', ')}`);

  // C — Circulation
  const cParts: string[] = [];
  if (v.crt) cParts.push(`CRT ${v.crt}`);
  if (v.hr) cParts.push(`HR: ${v.hr}/min`);
  if (v.bp) cParts.push(`BP: ${v.bp} mmHg`);
  if (p.circulation) cParts.push(p.circulation);
  else cParts.push('Peripheral pulses normal');
  L.push(`· Circulation → ${cParts.join(', ')}`);

  // D — Disability
  const gcsStr = buildGcsDisplay(c);
  const pupilStr = v.pupils ? `, ${v.pupils}` : ', Pupils bilaterally equal and reactive to light';
  L.push(`· Disability → ${gcsStr}${pupilStr}`);

  // E — Exposure
  const tempStr = v.tempDisplay || (v.temp ? `Temp: ${v.temp}` : '');
  L.push(`· Exposure → ${tempStr || 'Temperature normal'}`);

  // Adjuncts
  const adjuncts: string[] = [];
  if (p.ecg && p.ecg !== 'Not done') adjuncts.push(`· ECG: ${p.ecg}`);
  if (p.abg && p.abg !== 'Not done') adjuncts.push(`· ABG/VBG: ${p.abg}`);
  if (c.efast && c.efast !== 'Not done' && c.efast !== 'Not performed') adjuncts.push(`· EFAST: ${c.efast}`);
  if (adjuncts.length) {
    L.push('');
    L.push('Adjuncts to Primary:');
    adjuncts.forEach(a => L.push(a));
  }

  // ── History of Present Illness ──────────────────────────────────────────────
  L.push('');
  L.push(NOTE_SEP);
  L.push('HISTORY OF PRESENT ILLNESS');
  L.push(h.events || 'History to be documented.');

  // ── Secondary Survey ────────────────────────────────────────────────────────
  L.push('');
  L.push(NOTE_SEP);
  L.push('SECONDARY SURVEY');
  L.push('');
  L.push(`· Signs and Symptoms: ${h.symptoms || 'Not mentioned'}`);
  L.push(`· Past Medical History: ${h.pastHistory || 'Nil'}`);
  L.push(`· Surgical History: ${h.pastSurgical || 'Nil'}`);
  L.push(`· Family / Gynae History: ${h.other || 'Nil'}`);
  if (isFemale) L.push(`· LMP: ${h.lmp || 'Not mentioned'}`);
  L.push(`· Allergies: ${h.allergies || 'No known allergies'}`);

  // ── General Examination ─────────────────────────────────────────────────────
  L.push('');
  L.push(NOTE_SEP);
  L.push('GENERAL EXAMINATION');
  const et = c.examToggles;
  const present: string[] = [];
  if (et.pallor) present.push('pallor');
  if (et.icterus) present.push('icterus');
  if (et.cyanosis) present.push('cyanosis');
  if (et.clubbing) present.push('clubbing');
  if (et.lymphadenopathy) present.push('lymphadenopathy');
  if (et.edema) present.push('edema');
  if (present.length === 0) {
    L.push('No pallor, icterus, cyanosis, clubbing, lymphadenopathy, or edema.');
  } else {
    const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
    const absent = ['pallor','icterus','cyanosis','clubbing','lymphadenopathy','edema'].filter(f => !present.includes(f));
    L.push(`${present.map(cap).join(', ')} present.${absent.length ? ' No ' + absent.join(', ') + '.' : ''}`);
  }

  // ── Systemic Examination ────────────────────────────────────────────────────
  L.push('');
  L.push(NOTE_SEP);
  L.push('SYSTEMIC EXAMINATION');
  L.push('');
  L.push(`· CVS: ${e.cvs || (hasContent ? 'S1 and S2 heard and normal' : 'Not examined')}`);
  L.push(`· Chest: ${e.respiratory || (hasContent ? 'Normal expansion, Normal vesicular breath sounds present, no added sounds' : 'Not examined')}`);
  L.push(`· Abdomen: ${e.abdomen || (hasContent ? 'Soft, non-distended, bowel sounds present' : 'Not examined')}`);
  L.push(`· CNS: ${e.neuro || (hasContent ? 'Conscious, Oriented, No focal neurological deficit' : 'Not examined')}`);
  L.push(`· Extremities: ${e.extremities || 'No visible abnormalities noted'}`);

  // ── Psychological Assessment ────────────────────────────────────────────────
  L.push('');
  L.push(NOTE_SEP);
  L.push('PSYCHOLOGICAL ASSESSMENT');
  const psych = c.psychological;
  const psychPresent: string[] = [];
  if (psych.depression)        psychPresent.push('depression');
  if (psych.anxiety)           psychPresent.push('anxiety');
  if (psych.psychosis)         psychPresent.push('psychosis');
  if (psych.agitation)         psychPresent.push('agitation');
  if (psych.suicidalIdeation)  psychPresent.push('suicidal ideation');
  if (psych.substanceUse)      psychPresent.push('substance use');
  if (psychPresent.length === 0) {
    L.push('No features of depression, anxiety, psychosis, agitation, suicidal ideation, or substance use.');
  } else {
    L.push(`Features of ${psychPresent.join(', ')} noted.`);
  }

  // ── Investigations ──────────────────────────────────────────────────────────
  if (t.labsOrdered || t.imaging) {
    L.push('');
    L.push(NOTE_SEP);
    L.push('INVESTIGATIONS');
    if (t.labsOrdered) L.push(t.labsOrdered);
    if (t.imaging) L.push(t.imaging);
  }

  // ── Treatment Plan ──────────────────────────────────────────────────────────
  if (t.medications || t.infusions || t.ivFluids || t.procedures) {
    L.push('');
    L.push(NOTE_SEP);
    L.push('TREATMENT PLAN');
    if (t.medications)  L.push(t.medications);
    if (t.infusions)    L.push(t.infusions);
    if (t.ivFluids)     L.push(t.ivFluids);
    if (t.procedures)   L.push(t.procedures);
  }

  // ── Disposition ─────────────────────────────────────────────────────────────
  L.push('');
  L.push(NOTE_SEP);
  L.push('DISPOSITION');
  L.push([
    d.decision || 'ER observation',
    d.admitTo ? `— ${d.admitTo}` : '',
    d.referTo ? `| Referral to ${d.referTo}` : '',
  ].filter(Boolean).join(' '));

  // ── Differential Diagnosis ──────────────────────────────────────────────────
  if (d.differentials) {
    L.push('');
    L.push(NOTE_SEP);
    L.push('DIFFERENTIAL DIAGNOSIS');
    const diffs = d.differentials.split('\n').map((s: string) => s.trim()).filter(Boolean);
    diffs.forEach((diff: string) => {
      const clean = diff.replace(/^[•\-·\*]\s*/, '');
      L.push(`• ${clean}`);
    });
  }

  // ── Signatures ──────────────────────────────────────────────────────────────
  const isConsultant = c.userRole === 'consultant' || c.userRole === 'hod';
  const residentSig   = isConsultant ? (c.doctorName || '') : (c.userName || c.doctorName || '');
  const consultantSig = isConsultant ? c.userName : '';
  L.push('');
  L.push(NOTE_SEP);
  L.push(`EM Resident:   Dr. ${residentSig || '____________________'}`);
  L.push(`EM Consultant: Dr. ${consultantSig || '____________________'}`);

  return L.join('\n');
}

const SEP = '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━';
function tog(val: boolean) { return val ? 'Present' : 'Absent'; }

export function generateDischargeSummary(c: CaseData): string {
  const L: string[] = [];
  const today = c.date || new Date().toLocaleDateString('en-IN');

  // ── Header ──
  L.push('DISCHARGE SUMMARY');
  L.push(SEP);
  L.push(`Date: ${today}`);
  L.push(c.isMLC ? 'MLC' : 'Non-MLC');

  // ── Patient ──
  L.push('');
  L.push('PATIENT');
  const patientLine = [
    c.name || '—',
    c.age ? `${c.age} years` : '',
    c.sex || '',
    c.patientType || '',
  ].filter(Boolean).join(' · ');
  L.push(patientLine);

  // ── Section 1: Patient Information & Arrival ──
  L.push('');
  L.push(SEP);
  L.push('PATIENT INFORMATION & ARRIVAL');
  L.push('');
  L.push(`Allergies: ${c.history.allergies || 'No known allergies'}`);
  const v = c.vitals;
  const vArr = [
    v.hr   ? `HR: ${v.hr}` : 'HR: —',
    v.bp   ? `BP: ${v.bp}` : 'BP: —',
    v.rr   ? `RR: ${v.rr}` : 'RR: —',
    v.spo2 ? `SpO₂: ${v.spo2}%` : 'SpO₂: —',
  ];
  const vArr2 = [
    v.gcs  ? `GCS: ${v.gcs}` : 'GCS: —',
    v.grbs ? `GRBS: ${v.grbs}` : 'GRBS: —',
    v.temp ? `Temp: ${v.temp}` : 'Temp: —',
  ];
  L.push('');
  L.push('Vitals on Arrival:');
  L.push(vArr.join(' · '));
  L.push(vArr2.join(' · '));
  const complaint = c.history.symptoms || c.history.events?.split('.')[0] || 'Not documented';
  L.push('');
  L.push('Presenting Complaint:');
  L.push(complaint);
  if (c.history.events) {
    L.push('');
    L.push('History of Present Illness:');
    L.push(c.history.events);
  }
  const pmhLine = [c.history.pastHistory, c.history.pastSurgical].filter(Boolean).join(' · ');
  if (pmhLine) {
    L.push('');
    L.push('Past Medical & Surgical History:');
    L.push(pmhLine);
  }
  if (c.history.other) {
    L.push('');
    L.push('Family / Social History:');
    L.push(c.history.other);
  }

  // ── Section 2: Primary Assessment (ABCDE) ──
  L.push('');
  L.push(SEP);
  L.push('PRIMARY ASSESSMENT (ABCDE)');
  L.push('');
  const p = c.primary;
  L.push(`A (Airway):      ${p.airway || 'Patent, self-maintained'}`);
  L.push(`B (Breathing):   ${p.breathing || 'Equal bilateral air entry, no respiratory distress'}`);
  L.push(`C (Circulation): ${p.circulation || 'Adequate perfusion, no features of shock'}`);
  L.push(`D (Disability):  ${p.disability || 'GCS 15, alert and oriented'}`);
  L.push(`E (Exposure):    ${p.exposure || 'No significant findings'}`);
  if (p.ecg && p.ecg !== 'Not done') L.push(`ECG:             ${p.ecg}`);
  if (p.abg && p.abg !== 'Not done') L.push(`ABG/VBG:         ${p.abg}`);

  // ── Section 3: Secondary Assessment ──
  L.push('');
  L.push(SEP);
  L.push('SECONDARY ASSESSMENT');
  L.push('');
  const et = c.examToggles;
  const anyToggle = et.pallor || et.icterus || et.cyanosis || et.clubbing || et.lymphadenopathy || et.edema;
  if (anyToggle || c.exam.general) {
    L.push('General Examination:');
    L.push(`Pallor: ${tog(et.pallor)} · Icterus: ${tog(et.icterus)} · Cyanosis: ${tog(et.cyanosis)}`);
    L.push(`Clubbing: ${tog(et.clubbing)} · Lymphadenopathy: ${tog(et.lymphadenopathy)} · Edema: ${tog(et.edema)}`);
    L.push('');
  }
  const e = c.exam;
  L.push('Systemic Examination:');
  L.push(`Respiratory:  ${e.respiratory || 'Air entry bilaterally equal, no adventitious sounds'}`);
  L.push(`CVS:          ${e.cvs || 'S1S2 heard, no murmurs'}`);
  L.push(`Abdomen:      ${e.abdomen || 'Soft, non-tender, bowel sounds present'}`);
  L.push(`CNS:          ${e.neuro || 'No focal neurological deficit'}`);
  if (e.extremities) L.push(`Extremities:  ${e.extremities}`);

  // ── Section 4: Hospital Course & Treatment ──
  L.push('');
  L.push(SEP);
  L.push('HOSPITAL COURSE & TREATMENT');
  L.push('');
  // Build a brief clinical narrative from available data
  const age   = c.age ? `${c.age}-year-old` : '';
  const sex   = c.sex ? c.sex.toLowerCase() : 'patient';
  const pType = c.patientType === 'Pediatric' ? 'paediatric' : '';
  const cx    = complaint !== 'Not documented' ? complaint : (c.disposition.diagnosis || 'unspecified complaint');
  let narrative = `${age ? `A ${age} ${pType} ${sex}` : 'The patient'} named ${c.name || 'the patient'} presented to the emergency department with ${cx}.`;
  if (c.history.events) narrative += ` ${c.history.events}`;
  const pmh = c.history.pastHistory;
  if (pmh && pmh.toLowerCase() !== 'no significant past medical history') {
    narrative += ` Background includes: ${pmh}.`;
  }
  narrative += ` On examination, the patient was ${c.exam.general || 'conscious, alert, and oriented'}.`;
  const t = c.treatment;
  if (t.medications) narrative += ` Treatment administered included: ${t.medications}.`;
  if (t.infusions) narrative += ` IV fluids: ${t.infusions}.`;
  if (t.procedures) narrative += ` Procedures performed: ${t.procedures}.`;
  L.push(narrative);
  const invLines = [
    t.labsOrdered && `Labs Ordered: ${t.labsOrdered}`,
    t.imaging && `Imaging: ${t.imaging}`,
    t.resultsSummary && `Results: ${t.resultsSummary}`,
    p.ecg && p.ecg !== 'Not done' && `ECG: ${p.ecg}`,
    p.abg && p.abg !== 'Not done' && `ABG: ${p.abg}`,
  ].filter(Boolean);
  if (invLines.length) {
    L.push('');
    L.push('Investigations:');
    invLines.forEach(x => L.push(x as string));
  }
  const d = c.disposition;
  if (d.diagnosis) {
    L.push('');
    L.push('Diagnosis at Time of Discharge:');
    L.push(d.diagnosis);
  }
  if (d.differentials) {
    L.push('');
    L.push('Differentials:');
    L.push(d.differentials);
  }

  // ── Section 5: Discharge Information ──
  L.push('');
  L.push(SEP);
  L.push('DISCHARGE INFORMATION');
  L.push('');
  if (t.medications || t.otherMedications) {
    L.push('Discharge Medications:');
    if (t.medications) L.push(t.medications);
    if (t.otherMedications) L.push(t.otherMedications);
    L.push('');
  }
  if (d.decision) {
    L.push(`Disposition: ${d.decision}${d.admitTo ? ` — ${d.admitTo}` : ''}${d.referTo ? ` | Referral: ${d.referTo}` : ''}`);
  }
  if (c.conditionAtDischarge) {
    L.push(`Condition at Discharge: ${c.conditionAtDischarge.toUpperCase()}`);
  }
  if (d.followUp || c.notes) {
    L.push('');
    L.push('Follow-Up Advice:');
    L.push(d.followUp || c.notes);
  }

  // ── Section 6: Signatures ──
  const isConsultant = c.userRole === 'consultant' || c.userRole === 'hod';
  const residentName  = isConsultant ? (c.doctorName || '') : (c.userName || c.doctorName || '');
  const consultantName = isConsultant ? c.userName : '';
  L.push('');
  L.push(SEP);
  L.push('SIGNATURES');
  L.push('');
  L.push(`ED Resident:    ${residentName || '____________________'}     Time: ____`);
  L.push(`ED Consultant:  ${consultantName || '____________________'}     Time: ____`);
  L.push(`Date: ${today}`);

  // ── Legal disclaimer ──
  L.push('');
  L.push(SEP);
  L.push('This discharge summary provides clinical information to facilitate continuity of patient care.');
  L.push('For statutory purposes, a treatment/discharge certificate shall be issued on request.');

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

// ── Design tokens — Emerald Light Theme ──────────────────────────────────────
const C = {
  green:      '#1DB870',
  greenDark:  '#15924F',
  greenDeep:  '#0D6B3A',
  greenLight: '#E8F8EE',
  greenBd:    '#B8E8CB',
  chat:       '#F4FAF7',
  bubble:     '#E8F5EE',
  ink:        '#0D2B1A',
  muted:      '#6B9E80',
  faint:      '#9EC4AF',
  border:     '#D4E8DC',
  borderLight:'#E8F5EE',
  surface:    '#F9FEFC',
  white:      '#FFFFFF',
  orange:     '#F59E0B',
  red:        '#EF4444',
  docBg:      '#FFFFFF',
  docBorder:  '#D4E8DC',
  docHeader:  '#0D2B1A',
  headerMsg:  'rgba(255,255,255,0.50)',
  headerSub:  'rgba(255,255,255,0.65)',
};

// ── Types ─────────────────────────────────────────────────────────────────────
interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  type: 'text' | 'case_update' | 'addendum' | 'discharge_summary' | 'referral' | 'procedure_note' | 'note' | 'error';
  extracted?: SmartDictationExtracted;
  specialContent?: string;
  fieldCount?: number;
  isLoading?: boolean;
  durationSecs?: number;
  missingFields?: string[];
  feedbackState?: 'prompted' | 'positive' | 'correcting' | 'corrected';
  correctionText?: string;
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
  caseId?: string;
  userId?: string;
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
            <Feather name={icon as any} size={13} color={C.muted} />
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
      <View style={[s.confirmCheck, { backgroundColor: C.greenBd }]}>
        <Feather name="check" size={12} color={C.greenDark} />
      </View>
      <Text style={[s.confirmText, { color: C.ink }]}>{text}</Text>
    </View>
  );
}

// ── Missing fields banner ─────────────────────────────────────────────────────
function MissingFieldsBanner({ fields }: { fields: string[] }) {
  if (!fields.length) return null;
  return (
    <View style={fb.missingRow}>
      <Feather name="alert-triangle" size={11} color={C.orange} />
      <Text style={fb.missingText}>
        Not captured: <Text style={{ fontWeight: '700' }}>{fields.join(' · ')}</Text>
      </Text>
    </View>
  );
}

// ── Feedback prompt ───────────────────────────────────────────────────────────
function FeedbackPrompt({
  state,
  correctionText,
  onPositive,
  onNegative,
  onTextChange,
  onSubmit,
}: {
  state: ChatMessage['feedbackState'];
  correctionText?: string;
  onPositive: () => void;
  onNegative: () => void;
  onTextChange: (t: string) => void;
  onSubmit: () => void;
}) {
  if (state === 'positive') {
    return (
      <View style={fb.feedbackDone}>
        <Feather name="check-circle" size={12} color={C.green} />
        <Text style={[fb.feedbackDoneText, { color: C.green }]}>Noted — thank you</Text>
      </View>
    );
  }
  if (state === 'corrected') {
    return (
      <View style={fb.feedbackDone}>
        <Feather name="check-circle" size={12} color={C.green} />
        <Text style={[fb.feedbackDoneText, { color: C.green }]}>Correction applied</Text>
      </View>
    );
  }
  if (state === 'correcting') {
    return (
      <View style={fb.correctionBox}>
        <Text style={fb.correctionLabel}>What was wrong?</Text>
        <TextInput
          style={fb.correctionInput}
          value={correctionText || ''}
          onChangeText={onTextChange}
          placeholder="Describe the correction…"
          placeholderTextColor={C.faint}
          multiline
          maxLength={400}
        />
        <Pressable
          style={[fb.correctionSubmit, { opacity: (correctionText || '').trim() ? 1 : 0.4 }]}
          onPress={onSubmit}
          disabled={!(correctionText || '').trim()}
        >
          <Text style={fb.correctionSubmitText}>Submit correction</Text>
        </Pressable>
      </View>
    );
  }
  return (
    <View style={fb.feedbackRow}>
      <Text style={fb.feedbackLabel}>Was this accurate?</Text>
      <Pressable style={fb.thumbBtn} onPress={onPositive}>
        <Text style={fb.thumbText}>👍</Text>
      </Pressable>
      <Pressable style={fb.thumbBtn} onPress={onNegative}>
        <Text style={fb.thumbText}>👎</Text>
      </Pressable>
    </View>
  );
}

// ── Addendum body ─────────────────────────────────────────────────────────────
function AddendumBody({ content }: { content: string }) {
  return (
    <View style={{ padding: 2 }}>
      <Text style={{ fontSize: 12, color: C.ink, lineHeight: 20 }}>{content}</Text>
    </View>
  );
}

// ── computeMissingFields ──────────────────────────────────────────────────────
function computeMissingFields(ex: SmartDictationExtracted): string[] {
  const missing: string[] = [];
  if (!ex.patientName) missing.push('Name');
  const vs = ex.vitalsSuggested || {};
  if (!vs.hr) missing.push('HR');
  if (!vs.bp) missing.push('BP');
  if (!vs.spo2) missing.push('SpO₂');
  if (!ex.allergies) missing.push('Allergies');
  const pa = (ex as any).primarySurvey || {};
  if (!pa.airway && !ex.examFindings?.general) missing.push('Airway');
  return missing.slice(0, 6);
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
          ? { backgroundColor: C.greenDark, borderColor: 'transparent' }
          : { backgroundColor: C.white, borderColor: C.border },
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

  const bpAbn = (bp: string) => { const s = parseInt(bp.split('/')[0]); return s < 90 || s > 160; };
  const hrAbn = (hr: string) => { const v = parseInt(hr); return v > 100 || v < 60; };
  const spo2Abn = (s: string) => parseInt(s) < 94;
  const rrAbn  = (r: string)  => { const v = parseInt(r); return v > 20 || v < 12; };

  // Parse primarySurveyText into per-letter strings (AI returns "A: ... B: ... C: ...")
  const parseAbcde = (text: string | undefined) => {
    const out: Record<string, string> = {};
    if (!text) return out;
    const rx = /([ABCDE])\s*[:\-–]\s*([^ABCDE]*?)(?=\s*[ABCDE]\s*[:\-–]|$)/g;
    let m: RegExpExecArray | null;
    while ((m = rx.exec(text)) !== null) {
      out[m[1]] = m[2].trim().replace(/\.$/, '');
    }
    return out;
  };

  const abcde = parseAbcde(extracted.primarySurveyText);
  const A = abcde['A'] || 'Patent, self-maintained';
  const B = abcde['B'] || 'Equal bilateral air entry, no respiratory distress';
  const C = abcde['C'] || 'Adequate perfusion, no features of shock';
  const D = abcde['D'] || 'GCS 15, alert and oriented, pupils equal and reactive';
  const E = abcde['E'] || 'No significant findings on exposure';

  const pastHx = extracted.pastMedicalHistory
    ? (typeof extracted.pastMedicalHistory === 'string'
        ? extracted.pastMedicalHistory
        : (extracted.pastMedicalHistory as string[]).join(', '))
    : 'No significant past medical history';

  const medsText = extracted.prescribedMedications?.length
    ? extracted.prescribedMedications.map(m =>
        [m.name, m.dose, m.route, m.frequency].filter(Boolean).join(' ')
      ).join(' · ')
    : '';

  const infusionsText = extracted.prescribedInfusions?.length
    ? extracted.prescribedInfusions.map(i =>
        [i.name, i.dose, i.dilution ? `in ${i.dilution}` : '', i.rate ? `@ ${i.rate}` : ''].filter(Boolean).join(' ')
      ).join(' · ')
    : '';

  const dxText = extracted.diagnosis?.length ? extracted.diagnosis.join(', ') : 'Under assessment';
  const ddxText = extracted.differentialDiagnosis?.length ? extracted.differentialDiagnosis.join(', ') : '';
  const dispositionText = extracted.dispositionSuggested?.type
    ? [
        extracted.dispositionSuggested.type,
        extracted.dispositionSuggested.admitTo ? `\u2192 ${extracted.dispositionSuggested.admitTo}` : null,
        extracted.dispositionSuggested.referTo ? `Refer: ${extracted.dispositionSuggested.referTo}` : null,
      ].filter(Boolean).join(' ')
    : 'Pending clinical decision';

  return (
    <View>
      {/* Patient header */}
      <View style={s.docPatientHeader}>
        <Text style={s.docPatientName}>
          {name}{age ? `, ${age}` : ''}{sex ? ` ${sex[0].toUpperCase()}` : ''}
        </Text>
        {cc ? <Text style={[s.docFieldValue, { marginTop: 2, fontStyle: 'italic' }]}>{cc}</Text> : null}
      </View>

      {/* Vitals — always shown; recorded values or "Not recorded" */}
      <DocSection title="Vitals">
        {vs.hr   ? <DocField label="HR"   value={`${vs.hr} bpm`}  abnormal={hrAbn(vs.hr)} />   : <DocField label="HR"   value="Not recorded" />}
        {vs.bp   ? <DocField label="BP"   value={`${vs.bp} mmHg`} abnormal={bpAbn(vs.bp)} />   : <DocField label="BP"   value="Not recorded" />}
        {vs.spo2 ? <DocField label="SpO₂" value={`${vs.spo2}%`}   abnormal={spo2Abn(vs.spo2)} /> : <DocField label="SpO₂" value="Not recorded" />}
        {vs.rr   ? <DocField label="RR"   value={`${vs.rr}/min`}  abnormal={rrAbn(vs.rr)} />   : <DocField label="RR"   value="Not recorded" />}
        {vs.temperature ? <DocField label="Temp" value={vs.temperature} /> : <DocField label="Temp" value="Not recorded" />}
        {vs.grbs ? <DocField label="GRBS" value={`${vs.grbs} mg/dL`} /> : null}
      </DocSection>

      {/* History — always shown with defaults */}
      <DocSection title="History (SAMPLE)">
        {cc ? <DocField label="Complaint" value={cc} /> : null}
        {extracted.historyOfPresentIllness ? <DocField label="Events"   value={extracted.historyOfPresentIllness} /> : null}
        {extracted.associatedSymptoms      ? <DocField label="Symptoms" value={extracted.associatedSymptoms} /> : null}
        <DocField label="Past Hx"   value={pastHx} />
        <DocField label="Allergies" value={extracted.allergies || 'NKDA'} />
        <DocField label="Home meds" value={extracted.currentMedications || 'Nil'} />
      </DocSection>

      {/* Primary Survey — always shown; parsed from AI or full defaults */}
      <DocSection title="Primary Survey (ABCDE)">
        <DocField label="A \u2014 Airway"      value={A} />
        <DocField label="B \u2014 Breathing"   value={B} />
        <DocField label="C \u2014 Circulation" value={C} />
        <DocField label="D \u2014 Disability"  value={D} />
        <DocField label="E \u2014 Exposure"    value={E} />
        <DocField label="ECG" value={extracted.ecgInterpretation || 'Not done'} />
        <DocField label="ABG" value={extracted.abgSummary        || 'Not done'} />
      </DocSection>

      {/* Examination — always shown with defaults */}
      <DocSection title="Examination">
        <DocField label="General"  value={ex.general     || 'Conscious, alert, well-oriented, no acute distress'} />
        <DocField label="CVS"      value={ex.cvs         || 'S1S2 heard, no murmurs, no added heart sounds'} />
        <DocField label="Resp"     value={ex.respiratory || 'Air entry bilaterally equal and clear, no adventitious sounds'} />
        <DocField label="Abdomen"  value={ex.abdomen     || 'Soft, non-tender, bowel sounds present'} />
        <DocField label="CNS"      value={ex.cns         || 'No focal neurological deficit'} />
        {ex.skin ? <DocField label="Skin" value={ex.skin} /> : null}
      </DocSection>

      {/* Treatment — always shown */}
      <DocSection title="Treatment Given">
        <DocField label="Medications" value={medsText || 'None administered'} />
        {infusionsText ? <DocField label="IV Fluids"    value={infusionsText} /> : null}
        <DocField label="Labs"    value={extracted.investigationsOrdered || 'Not ordered'} />
        {extracted.imagingOrdered   ? <DocField label="Imaging" value={extracted.imagingOrdered} /> : null}
        {extracted.treatmentNotes   ? <DocField label="Notes"   value={extracted.treatmentNotes} /> : null}
      </DocSection>

      {/* Impression — always shown */}
      <DocSection title="Impression">
        <DocField label="Diagnosis"   value={dxText} />
        {ddxText ? <DocField label="Differentials" value={ddxText} /> : null}
        <DocField label="Disposition" value={dispositionText} />
      </DocSection>
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

// ── FlatCaseNote — card-free plain text layout ────────────────────────────────
function FlatCaseNote({ c, onCopy, onSave }: { c: CaseData; onCopy: () => void; onSave?: () => void }) {
  const [copied, setCopied] = useState(false);
  const v = c.vitals; const h = c.history; const p = c.primary;
  const e = c.exam;   const t = c.treatment; const d = c.disposition;

  const val = (x?: string | null, fallback = '—') => (x && x.trim() ? x.trim() : fallback);

  const handleCopy = () => { onCopy(); setCopied(true); setTimeout(() => setCopied(false), 2200); };

  const hasVitals  = !!(v.hr || v.bp || v.spo2 || v.rr || v.temp || v.gcs || v.grbs);
  const hasHistory = !!(h.symptoms || h.events || h.allergies || h.medications || h.pastHistory || h.lastMeal || h.pastSurgical || h.other);
  const hasPrimary = !!(p.airway || p.breathing || p.circulation || p.disability || p.exposure || p.ecg || p.abg);
  const hasExam    = !!(e.general || e.cvs || e.respiratory || e.abdomen || e.neuro || e.extremities);
  const hasTreat   = !!(t.medications || t.infusions || t.ivFluids || t.procedures || t.labsOrdered || t.imaging || t.otherMedications);
  const hasDx      = !!(d.diagnosis || d.differentials || d.decision);

  const missing: string[] = [];
  if (!c.name) missing.push('Name');
  if (!h.symptoms && !c.chiefComplaint) missing.push('Chief complaint');
  if (!d.diagnosis) missing.push('Impression');

  const fns = StyleSheet.create({
    wrap:    { paddingHorizontal: 4, paddingVertical: 8 },
    title:   { fontSize: 15, fontWeight: '700', color: '#0D2B1A', marginBottom: 14, letterSpacing: 0.3 },
    sec:     { fontSize: 11, fontWeight: '700', letterSpacing: 1.2, color: '#6B9E80', marginTop: 14, marginBottom: 4 },
    body:    { fontSize: 14, color: '#0D2B1A', lineHeight: 22 },
    missing: { fontSize: 12, color: '#D97706', marginTop: 12, lineHeight: 18 },
    actions: { flexDirection: 'row' as const, gap: 10, marginTop: 16, paddingTop: 14, borderTopWidth: 1, borderTopColor: '#D4E8DC' },
    copyBtn: { backgroundColor: copied ? '#0D8A46' : '#15924F', borderRadius: 9, paddingHorizontal: 16, paddingVertical: 9 },
    copyTxt: { fontSize: 13, fontWeight: '700' as const, color: '#fff' },
    saveBtn: { backgroundColor: '#fff', borderRadius: 9, borderWidth: 1, borderColor: '#D4E8DC', paddingHorizontal: 16, paddingVertical: 9 },
    saveTxt: { fontSize: 13, fontWeight: '600' as const, color: '#3D6B52' },
  });

  return (
    <View style={fns.wrap}>
      <Text style={fns.title}>EMERGENCY CASE NOTE</Text>

      {/* PATIENT */}
      <Text style={fns.sec}>PATIENT</Text>
      <Text style={fns.body}>
        {val(c.name, 'Unknown')}
        {c.age ? ` · ${c.age}` : ''}
        {c.sex ? ` ${c.sex[0]?.toUpperCase() ?? ''}` : ''}
        {c.priority ? ` · ${c.priority}` : ''}
        {c.chiefComplaint ? `\nComplaint: ${c.chiefComplaint}` : ''}
      </Text>

      {/* VITALS */}
      {hasVitals ? (
        <>
          <Text style={fns.sec}>VITALS</Text>
          <Text style={fns.body}>
            {[
              v.hr   ? `HR: ${v.hr} bpm` : null,
              v.bp   ? `BP: ${v.bp} mmHg` : null,
              v.spo2 ? `SpO₂: ${v.spo2}%` : null,
              v.rr   ? `RR: ${v.rr}/min` : null,
              v.temp ? `Temp: ${v.temp}°C` : null,
              v.gcs  ? `GCS: ${v.gcs}` : null,
              v.grbs ? `GRBS: ${v.grbs} mg/dL` : null,
            ].filter(Boolean).join(' · ')}
          </Text>
        </>
      ) : null}

      {/* HISTORY */}
      {hasHistory ? (
        <>
          <Text style={fns.sec}>HISTORY (SAMPLE)</Text>
          <Text style={fns.body}>
            {[
              h.symptoms     ? `Symptoms: ${h.symptoms}` : null,
              h.allergies    ? `Allergies: ${h.allergies}` : 'Allergies: NKDA',
              h.medications  ? `Medications: ${h.medications}` : 'Medications: None',
              h.pastHistory  ? `Past Hx: ${h.pastHistory}` : null,
              h.pastSurgical ? `Past surgery: ${h.pastSurgical}` : null,
              h.lastMeal     ? `Last meal: ${h.lastMeal}` : null,
              h.events       ? `Events: ${h.events}` : null,
              h.other        ? `Other: ${h.other}` : null,
            ].filter(Boolean).join('\n')}
          </Text>
        </>
      ) : null}

      {/* PRIMARY SURVEY */}
      {hasPrimary ? (
        <>
          <Text style={fns.sec}>PRIMARY SURVEY (ABCDE)</Text>
          <Text style={fns.body}>
            {[
              `A — Airway: ${val(p.airway, 'Patent')}`,
              p.breathing   ? `B — Breathing: ${p.breathing}` : null,
              p.circulation ? `C — Circulation: ${p.circulation}` : null,
              p.disability  ? `D — Disability: ${p.disability}` : null,
              p.exposure    ? `E — Exposure: ${p.exposure}` : null,
              p.ecg         ? `ECG: ${p.ecg}` : null,
              p.abg         ? `ABG/VBG: ${p.abg}` : null,
            ].filter(Boolean).join('\n')}
          </Text>
        </>
      ) : null}

      {/* EXAMINATION */}
      {hasExam ? (
        <>
          <Text style={fns.sec}>EXAMINATION</Text>
          <Text style={fns.body}>
            {[
              e.general     ? `General: ${e.general}` : null,
              e.cvs         ? `CVS: ${e.cvs}` : null,
              e.respiratory ? `Resp: ${e.respiratory}` : null,
              e.abdomen     ? `Abdomen: ${e.abdomen}` : null,
              e.neuro       ? `Neuro: ${e.neuro}` : null,
              e.extremities ? `Extremities: ${e.extremities}` : null,
            ].filter(Boolean).join('\n')}
          </Text>
        </>
      ) : null}

      {/* TREATMENT */}
      {hasTreat ? (
        <>
          <Text style={fns.sec}>TREATMENT GIVEN</Text>
          <Text style={fns.body}>
            {[
              t.medications      ? `Medications: ${t.medications}` : null,
              t.infusions        ? `Infusions: ${t.infusions}` : null,
              t.otherMedications ? `Other meds: ${t.otherMedications}` : null,
              t.ivFluids         ? `IV Fluids: ${t.ivFluids}` : null,
              t.procedures       ? `Procedures: ${t.procedures}` : null,
              t.labsOrdered      ? `Labs: ${t.labsOrdered}` : null,
              t.imaging          ? `Imaging: ${t.imaging}` : null,
            ].filter(Boolean).join('\n')}
          </Text>
        </>
      ) : null}

      {/* NOTES */}
      {c.notes ? (
        <>
          <Text style={fns.sec}>NOTES</Text>
          <Text style={fns.body}>{c.notes}</Text>
        </>
      ) : null}

      {/* IMPRESSION */}
      {hasDx ? (
        <>
          <Text style={fns.sec}>IMPRESSION & PLAN</Text>
          <Text style={fns.body}>
            {[
              d.diagnosis     ? `Diagnosis: ${d.diagnosis}` : null,
              d.differentials ? `Differentials: ${d.differentials}` : null,
              d.decision      ? `Disposition: ${d.decision}${d.admitTo ? ` — ${d.admitTo}` : ''}${d.referTo ? ` · Referral: ${d.referTo}` : ''}` : null,
            ].filter(Boolean).join('\n')}
          </Text>
        </>
      ) : null}

      {/* Missing fields */}
      {missing.length > 0 ? (
        <Text style={fns.missing}>Not captured: {missing.join(' · ')}</Text>
      ) : null}

      {/* Actions */}
      <View style={fns.actions}>
        <Pressable style={fns.copyBtn} onPress={handleCopy}>
          <Text style={fns.copyTxt}>{copied ? 'Copied!' : 'Copy all'}</Text>
        </Pressable>
        {onSave ? (
          <Pressable style={fns.saveBtn} onPress={onSave}>
            <Text style={fns.saveTxt}>Save</Text>
          </Pressable>
        ) : null}
      </View>
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
  const headerColors: [string, string] = [C.docHeader, C.docHeader];

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
const AFTER_CASE_CHIPS = ['Prepare discharge summary', 'RSI note', 'Referral letter', 'Show complete case sheet'];
const AFTER_DS_CHIPS   = ['Add allergy', 'Export PDF', 'Show differentials', 'Edit diagnosis'];

export default function CaseChat({ onDataExtracted, patientContext, liveCase, initialExtracted, disabled = false, caseId, userId }: CaseChatProps) {
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

  const sendToAI = async (text: string, durSecs?: number, isCorrection = false) => {
    if (!text.trim() || isThinking) return;

    if (!isCorrection) {
      push({ role: 'user', content: text, type: 'text', durationSecs: durSecs });
    }
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
          hasCaseNote,
        }),
      });

      if (!res.ok) throw new Error(`Chat failed (${res.status})`);
      const data = await res.json();
      const { reply, type, extracted, specialContent } = data;
      const fc = extracted ? countFields(extracted) : 0;
      // Only show missing fields on the first case note — addendum has sparse extracted data by design
      const missing = type === 'case_update' && extracted
        ? computeMissingFields(extracted) : [];
      const needsFeedback = ['case_update', 'addendum', 'discharge_summary', 'referral', 'procedure_note'].includes(type || '');

      replace(lid, {
        content: reply || '',
        type: type || 'text',
        extracted: extracted || undefined,
        specialContent: specialContent || undefined,
        fieldCount: fc,
        isLoading: false,
        missingFields: missing,
        feedbackState: needsFeedback ? 'prompted' : undefined,
      });

      historyRef.current.push({ role: 'assistant', content: reply || '' });

      if ((type === 'case_update' || type === 'addendum') && extracted && fc > 0) {
        onDataExtracted(extracted);
        if (type === 'case_update') setHasCaseNote(true);
      }
      if (type === 'discharge_summary') setHasDs(true);
    } catch (err) {
      replace(lid, { content: 'Something went wrong. Try again.', type: 'error', isLoading: false });
    } finally {
      setIsThinking(false);
    }
  };

  const handleFeedback = async (msgId: string, rating: 'positive' | 'negative') => {
    replace(msgId, { feedbackState: rating === 'positive' ? 'positive' : 'correcting' });
    if (rating === 'positive') {
      try {
        await fetch(new URL('/api/ai/feedback', getApiUrl()).toString(), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ suggestionId: msgId, caseId: caseId || '', feedbackType: 'positive', userId: userId || '' }),
        });
      } catch { /* silent */ }
    }
  };

  const handleCorrectionChange = (msgId: string, text: string) => {
    replace(msgId, { correctionText: text });
  };

  const handleCorrectionSubmit = async (msgId: string, correctionText: string) => {
    if (!correctionText.trim()) return;
    replace(msgId, { feedbackState: 'corrected' });
    try {
      await fetch(new URL('/api/ai/feedback', getApiUrl()).toString(), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ suggestionId: msgId, caseId: caseId || '', feedbackType: 'negative', userCorrection: correctionText, userId: userId || '' }),
      });
    } catch { /* silent */ }
    sendToAI(`Correction: ${correctionText}`, undefined, true);
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
    // Show complete case sheet locally (no AI call needed)
    const wantsFullNote = lower.includes('case sheet') || lower.includes('complete case') || lower.includes('full case') ||
      lower.includes('show case') || lower.includes('complete note') || lower.includes('full note') || lower.includes('case note');
    if (wantsFullNote && liveCase) {
      push({ role: 'user', content: chip, type: 'text' });
      push({ role: 'assistant', content: 'Here is the complete case note with all documented data.', type: 'case_update', extracted: undefined, fieldCount: 0 });
      setHasCaseNote(true);
      return;
    }
    // All other chips (RSI note, central line, etc.) → send to AI
    sendToAI(chip);
  };

  const handleSend = () => {
    const t = inputText.trim();
    if (!t) return;
    setInputText('');
    const lower = t.toLowerCase();
    // Intercept local document commands — no AI credits consumed
    if ((lower.includes('discharge summary') || lower.includes('discharge')) && liveCase) {
      handleChip(t);
      return;
    }
    if ((lower.includes('referral') || lower.includes('refer')) && liveCase) {
      handleChip(t);
      return;
    }
    // "Show complete case sheet / full note / case sheet" → render LiveCaseNoteBody without AI call
    const wantsFullNote = lower.includes('case sheet') || lower.includes('complete case') || lower.includes('full case') ||
      lower.includes('show case') || lower.includes('complete note') || lower.includes('full note') ||
      lower.includes('case note') || lower.includes('show note');
    if (wantsFullNote && liveCase) {
      push({ role: 'user', content: t, type: 'text' });
      push({ role: 'assistant', content: 'Here is the complete case note with all documented data.', type: 'case_update', extracted: undefined, fieldCount: 0 });
      setHasCaseNote(true);
      return;
    }
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
                  {useLive ? (
                    <FlatCaseNote
                      c={liveCase!}
                      onCopy={() => {
                        Clipboard.setStringAsync(generateCaseNote(liveCase!));
                        showToast('Case note copied to clipboard');
                      }}
                      onSave={() => showToast('Saved to dashboard')}
                    />
                  ) : msg.extracted ? (
                    <DocCard
                      type="case"
                      title="Emergency Case Note"
                      tag="CASE NOTE"
                      onCopy={() => {
                        Clipboard.setStringAsync(buildCopyText(msg.extracted!, patientContext));
                        showToast('Case note copied to clipboard');
                      }}
                    >
                      <CaseNoteBody extracted={msg.extracted} patientContext={patientContext} />
                    </DocCard>
                  ) : null}
                  {msg.missingFields && msg.missingFields.length > 0
                    ? <MissingFieldsBanner fields={msg.missingFields} /> : null}
                  {msg.feedbackState ? (
                    <FeedbackPrompt
                      state={msg.feedbackState}
                      correctionText={msg.correctionText}
                      onPositive={() => handleFeedback(msg.id, 'positive')}
                      onNegative={() => handleFeedback(msg.id, 'negative')}
                      onTextChange={t => handleCorrectionChange(msg.id, t)}
                      onSubmit={() => handleCorrectionSubmit(msg.id, msg.correctionText || '')}
                    />
                  ) : null}
                </ErMateResponse>
              </React.Fragment>
            );
          }

          if (msg.type === 'addendum') {
            const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            return (
              <React.Fragment key={msg.id}>
                <SystemLabel text={`Addendum · ${time}`} />
                <ErMateResponse subtitle={msg.content}>
                  <DocCard
                    type="case"
                    title={`Addendum · ${time}`}
                    tag="ADDENDUM"
                    onCopy={() => {
                      Clipboard.setStringAsync(msg.specialContent || msg.content);
                      showToast('Addendum copied');
                    }}
                  >
                    <AddendumBody content={msg.specialContent || msg.content} />
                  </DocCard>
                  {liveCase ? (
                    <Pressable
                      onPress={() => {
                        push({ role: 'assistant', content: 'Here is the complete case note with all documented data.', type: 'case_update', extracted: undefined, fieldCount: 0 });
                      }}
                      style={{ flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 6, alignSelf: 'flex-start', paddingVertical: 5, paddingHorizontal: 10, backgroundColor: C.greenLight, borderRadius: 8, borderWidth: 1, borderColor: C.greenBd }}
                    >
                      <Feather name="file-text" size={12} color={C.green} />
                      <Text style={{ fontSize: 11, color: C.green, fontWeight: '600' }}>View complete case note</Text>
                    </Pressable>
                  ) : null}
                  {msg.feedbackState ? (
                    <FeedbackPrompt
                      state={msg.feedbackState}
                      correctionText={msg.correctionText}
                      onPositive={() => handleFeedback(msg.id, 'positive')}
                      onNegative={() => handleFeedback(msg.id, 'negative')}
                      onTextChange={t => handleCorrectionChange(msg.id, t)}
                      onSubmit={() => handleCorrectionSubmit(msg.id, msg.correctionText || '')}
                    />
                  ) : null}
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
                  {msg.feedbackState ? (
                    <FeedbackPrompt
                      state={msg.feedbackState}
                      correctionText={msg.correctionText}
                      onPositive={() => handleFeedback(msg.id, 'positive')}
                      onNegative={() => handleFeedback(msg.id, 'negative')}
                      onTextChange={t => handleCorrectionChange(msg.id, t)}
                      onSubmit={() => handleCorrectionSubmit(msg.id, msg.correctionText || '')}
                    />
                  ) : null}
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
                  {msg.feedbackState ? (
                    <FeedbackPrompt
                      state={msg.feedbackState}
                      correctionText={msg.correctionText}
                      onPositive={() => handleFeedback(msg.id, 'positive')}
                      onNegative={() => handleFeedback(msg.id, 'negative')}
                      onTextChange={t => handleCorrectionChange(msg.id, t)}
                      onSubmit={() => handleCorrectionSubmit(msg.id, msg.correctionText || '')}
                    />
                  ) : null}
                </ErMateResponse>
              </React.Fragment>
            );
          }

          if (msg.type === 'procedure_note' && msg.specialContent) {
            return (
              <React.Fragment key={msg.id}>
                <ErMateResponse subtitle={msg.content}>
                  <DocCard
                    type="note"
                    title="Procedure Note"
                    tag="PROCEDURE"
                    onCopy={() => {
                      Clipboard.setStringAsync(msg.specialContent!);
                      showToast('Procedure note copied');
                    }}
                    onExport={() => showToast('Exporting PDF…')}
                  >
                    <View style={s.docFreeText}>
                      <Text style={s.docFreeTextContent}>{msg.specialContent}</Text>
                    </View>
                  </DocCard>
                  {msg.feedbackState ? (
                    <FeedbackPrompt
                      state={msg.feedbackState}
                      correctionText={msg.correctionText}
                      onPositive={() => handleFeedback(msg.id, 'positive')}
                      onNegative={() => handleFeedback(msg.id, 'negative')}
                      onTextChange={t => handleCorrectionChange(msg.id, t)}
                      onSubmit={() => handleCorrectionSubmit(msg.id, msg.correctionText || '')}
                    />
                  ) : null}
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
                <View style={[s.confirmBox, { backgroundColor: 'rgba(239,68,68,0.07)', borderColor: 'rgba(239,68,68,0.18)' }]}>
                  <Feather name="alert-circle" size={13} color={C.red} />
                  <Text style={[s.confirmText, { color: '#7A1E1E' }]}>{msg.content}</Text>
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
            placeholderTextColor={C.faint}
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
              ? { backgroundColor: 'rgba(239,68,68,0.10)', borderColor: 'rgba(239,68,68,0.25)', borderWidth: 1 }
              : !hasCaseNote
              ? { backgroundColor: C.greenDark }
              : { backgroundColor: C.greenLight, borderColor: C.greenBd, borderWidth: 1 },
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
            style={[s.sendBtn, { backgroundColor: inputText.trim() ? C.greenDark : C.greenLight }]}
          >
            <Text style={{ color: inputText.trim() ? '#fff' : C.greenDark, fontSize: 18, lineHeight: 20 }}>↑</Text>
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

// ── Styles — Emerald Light Theme ──────────────────────────────────────────────
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
  emptyTitle: { fontSize: 16, fontWeight: '700', color: C.ink, textAlign: 'center' },
  emptySub: { fontSize: 12.5, color: C.muted, lineHeight: 20, textAlign: 'center', maxWidth: 240 },

  // Recording full state
  recordingFullState: { alignItems: 'center', justifyContent: 'center', gap: 20, paddingVertical: 40, flex: 1 },
  recordingListening: { fontSize: 13, color: C.muted, fontWeight: '600' },
  recordingHint: { fontSize: 12, color: C.faint, textAlign: 'center', fontStyle: 'italic', maxWidth: 240 },

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
    borderColor: C.greenBd,
    borderRadius: 16,
    borderBottomRightRadius: 4,
    paddingHorizontal: 14,
    paddingVertical: 10,
    maxWidth: '75%',
  },
  doctorBubbleText: { fontSize: 13, color: C.ink, lineHeight: 20 },

  // System label
  sysLabelRow: { alignItems: 'center', marginVertical: 8 },
  sysLabelText: { fontSize: 10, color: C.faint, fontWeight: '600', letterSpacing: 0.5 },

  // ErMate response
  erRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, marginBottom: 4 },
  erAvatar: { width: 22, height: 22, borderRadius: 6, alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 2 },
  erName: { fontSize: 11, fontWeight: '700', color: C.greenDark, marginBottom: 2 },
  erSubtitle: { fontSize: 11.5, color: C.muted, marginBottom: 8, lineHeight: 16 },
  erTextMsg: { fontSize: 12.5, color: C.ink, lineHeight: 19 },

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
    shadowColor: C.docHeader,
    shadowOpacity: 0.10,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  docCardHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 11, paddingHorizontal: 14 },
  docCardTitle: { fontSize: 12, fontWeight: '800', color: '#FFFFFF', letterSpacing: 0.3, flex: 1 },
  docCardTag: { borderRadius: 4, paddingHorizontal: 7, paddingVertical: 2, borderWidth: 1 },
  docCardTagText: { fontSize: 9, fontWeight: '700', letterSpacing: 0.5 },
  docCardBody: { padding: 14 },
  docCardActions: {
    flexDirection: 'row', gap: 6, padding: 9, paddingHorizontal: 14,
    borderTopWidth: 1, flexWrap: 'wrap',
    borderTopColor: C.borderLight, backgroundColor: C.surface,
  },

  // DocCard action button
  docActionBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 11, paddingVertical: 6, borderRadius: 8, borderWidth: 1 },
  docActionLabel: { fontSize: 11, fontWeight: '700' },

  // DocField
  docFieldRow: { flexDirection: 'row', gap: 10, marginBottom: 5 },
  docFieldLabel: { fontSize: 11, color: C.muted, width: 88, flexShrink: 0, lineHeight: 18 },
  docFieldValue: { fontSize: 11.5, color: C.ink, flex: 1, lineHeight: 18, fontWeight: '500' },

  // DocSection
  docSection: { marginBottom: 12 },
  docSectionDivider: { height: 1, marginBottom: 7 },
  docSectionTitle: { fontSize: 9.5, fontWeight: '800', letterSpacing: 1.2, textTransform: 'uppercase', color: C.faint, marginBottom: 7 },

  // Patient header in doccard
  docPatientHeader: { marginBottom: 12, paddingBottom: 10, borderBottomWidth: 1, borderBottomColor: C.borderLight },
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
    backgroundColor: C.white,
    borderTopWidth: 1,
    borderTopColor: C.borderLight,
  },
  input: {
    flex: 1,
    backgroundColor: C.white,
    borderWidth: 1.5,
    borderColor: C.border,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 11,
    fontSize: 13,
    color: C.ink,
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
    flexShrink: 0,
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
    shadowColor: C.greenDeep, shadowOpacity: 0.3, shadowRadius: 10, shadowOffset: { width: 0, height: 3 },
  },
  toastText: { fontSize: 12, fontWeight: '700', color: '#fff' },
});

// Feedback + missing fields styles
const fb = StyleSheet.create({
  missingRow: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    marginTop: 6, paddingHorizontal: 4,
  },
  missingText: { fontSize: 11, color: C.orange, flex: 1, lineHeight: 16 },
  feedbackRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    marginTop: 10, paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: C.borderLight,
  },
  feedbackLabel: { fontSize: 11.5, color: C.muted, flex: 1 },
  thumbBtn: {
    paddingHorizontal: 12, paddingVertical: 6,
    backgroundColor: C.white,
    borderRadius: 8, borderWidth: 1,
    borderColor: C.border,
  },
  thumbText: { fontSize: 15 },
  feedbackDone: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    marginTop: 8, paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: C.borderLight,
  },
  feedbackDoneText: { fontSize: 11.5, fontWeight: '600' },
  correctionBox: {
    marginTop: 10, paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: C.borderLight,
    gap: 8,
  },
  correctionLabel: { fontSize: 12, color: C.ink, fontWeight: '600' },
  correctionInput: {
    backgroundColor: C.white,
    borderWidth: 1.5,
    borderColor: C.greenBd,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 12.5,
    color: C.ink,
    minHeight: 60,
  },
  correctionSubmit: {
    backgroundColor: C.greenDark,
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 16,
    alignSelf: 'flex-start',
  },
  correctionSubmitText: { fontSize: 12, fontWeight: '700', color: '#fff' },
});

// Chip styles in separate object (name clash with `s`)
const s2 = StyleSheet.create({
  chip: {
    backgroundColor: C.white,
    borderWidth: 1.5,
    borderColor: C.greenBd,
    borderRadius: 99,
    paddingHorizontal: 14,
    paddingVertical: 7,
  },
  chipText: { fontSize: 12, fontWeight: '600', color: C.greenDark },
});
