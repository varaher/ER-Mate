import React, { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import {
  View, Text, StyleSheet, ActivityIndicator,
  Platform, StatusBar, Pressable, TextInput,
  Animated, Alert,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Audio } from 'expo-av';
import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake';
import { Feather } from '@expo/vector-icons';

import AsyncStorage from '@react-native-async-storage/async-storage';
import { RootStackParamList } from '@/navigation/RootStackNavigator';
import { useAuth } from '@/context/AuthContext';
import { getApiUrl } from '@/lib/query-client';
import { invalidateCases } from '@/lib/api';
import CaseChat, { CaseData } from '@/components/CaseChat';
import type { SmartDictationExtracted } from '@/components/SmartDictation';
import { KeyboardAwareScrollViewCompat } from '@/components/KeyboardAwareScrollViewCompat';

type Props = NativeStackScreenProps<RootStackParamList, 'CaseChat'>;

const DARK_BG  = '#0F1419';
const ACCENT   = '#7c3aed';
const MIC_SIZE = 84;

type RecPhase = 'idle' | 'recording' | 'processing';

interface WebRec {
  mr: MediaRecorder | null;
  chunks: Blob[];
  stream: MediaStream | null;
}

const parseAgeToYears = (v: string | number): number => {
  if (!v) return 0;
  const s = String(v).toLowerCase().trim();
  if ((s.endsWith('m') || s.includes('mo') || s.includes('month')) &&
      !s.includes('yr') && !s.includes('year')) {
    return (parseFloat(s) || 0) / 12;
  }
  return parseFloat(s) || 0;
};

export default function CaseChatScreen({ route, navigation }: Props) {
  const { caseId: paramCaseId, patientName: paramPatientName } = route.params ?? {};
  const { user } = useAuth();
  const insets  = useSafeAreaInsets();

  // ── Case data ──────────────────────────────────────────────────────────────
  const [activeCaseId, setActiveCaseId]   = useState<string | undefined>(paramCaseId);
  const [caseData, setCaseData]           = useState<any>(null);
  const [loadingCase, setLoadingCase]     = useState(!!paramCaseId);
  const [caseError, setCaseError]         = useState<string | null>(null);

  // ── Voice-create state (only used when no paramCaseId) ────────────────────
  const [patientName, setPatientName] = useState('');
  const [recPhase, setRecPhase]       = useState<RecPhase>('idle');
  const [recSecs, setRecSecs]         = useState(0);
  const [statusMsg, setStatusMsg]     = useState('');

  const nativeRec = useRef<Audio.Recording | null>(null);
  const webRec    = useRef<WebRec>({ mr: null, chunks: [], stream: null });
  const timerRef  = useRef<ReturnType<typeof setInterval> | null>(null);
  const recStart  = useRef(0);

  // Animations
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const ring1     = useRef(new Animated.Value(0)).current;
  const ring2     = useRef(new Animated.Value(0)).current;
  const ring1Loop = useRef<Animated.CompositeAnimation | null>(null);
  const ring2Loop = useRef<Animated.CompositeAnimation | null>(null);
  const pulseLoop = useRef<Animated.CompositeAnimation | null>(null);

  // ── Fetch existing case ────────────────────────────────────────────────────
  const fetchCase = useCallback(async (id: string) => {
    setLoadingCase(true);
    setCaseError(null);
    try {
      const token = await AsyncStorage.getItem('token');
      const res = await fetch(`${getApiUrl()}/api/proxy/cases/${id}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setCaseData(await res.json());
    } catch (e: any) {
      setCaseError(e?.message || 'Failed to load case');
    } finally {
      setLoadingCase(false);
    }
  }, []);

  useEffect(() => {
    if (paramCaseId) fetchCase(paramCaseId);
  }, [paramCaseId]);

  // ── Recording animations ───────────────────────────────────────────────────
  useEffect(() => {
    if (recPhase === 'recording') {
      pulseLoop.current = Animated.loop(Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.12, duration: 650, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1,    duration: 650, useNativeDriver: true }),
      ]));
      pulseLoop.current.start();

      ring1Loop.current = Animated.loop(Animated.sequence([
        Animated.timing(ring1, { toValue: 1, duration: 1400, useNativeDriver: true }),
        Animated.delay(200),
        Animated.timing(ring1, { toValue: 0, duration: 0,    useNativeDriver: true }),
      ]));
      ring1Loop.current.start();

      setTimeout(() => {
        ring2Loop.current = Animated.loop(Animated.sequence([
          Animated.timing(ring2, { toValue: 1, duration: 1400, useNativeDriver: true }),
          Animated.delay(200),
          Animated.timing(ring2, { toValue: 0, duration: 0,    useNativeDriver: true }),
        ]));
        ring2Loop.current.start();
      }, 500);

      timerRef.current = setInterval(() => setRecSecs(s => s + 1), 1000);
    } else {
      ring1Loop.current?.stop(); ring2Loop.current?.stop(); pulseLoop.current?.stop();
      ring1.setValue(0); ring2.setValue(0); pulseAnim.setValue(1);
      if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [recPhase]);

  const fmtTime = (s: number) => `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, '0')}`;

  // ── Recording logic ────────────────────────────────────────────────────────
  const startRecording = async () => {
    setRecSecs(0);
    recStart.current = Date.now();
    try {
      if (Platform.OS === 'web') {
        if (!navigator.mediaDevices?.getUserMedia) {
          Alert.alert('Not supported', 'Voice recording is not available in this browser.');
          return;
        }
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        webRec.current = { mr: null, chunks: [], stream };
        const mimeType = MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm' : 'audio/mp4';
        const mr = new MediaRecorder(stream, { mimeType });
        mr.ondataavailable = e => { if (e.data.size > 0) webRec.current.chunks.push(e.data); };
        mr.onstop = () => {
          const blob = new Blob(webRec.current.chunks, { type: mimeType });
          stream.getTracks().forEach(t => t.stop());
          processAudio(blob, null);
        };
        webRec.current.mr = mr;
        mr.start(100);
      } else {
        const { granted } = await Audio.requestPermissionsAsync();
        if (!granted) {
          Alert.alert('Permission required', 'Microphone access is needed for voice recording.');
          return;
        }
        if (nativeRec.current) {
          try { await nativeRec.current.stopAndUnloadAsync(); } catch {}
          nativeRec.current = null;
        }
        await Audio.setAudioModeAsync({
          allowsRecordingIOS: true, playsInSilentModeIOS: true, staysActiveInBackground: true,
        });
        await activateKeepAwakeAsync('voice-case');
        const { recording } = await Audio.Recording.createAsync(Audio.RecordingOptionsPresets.HIGH_QUALITY);
        nativeRec.current = recording;
      }
      setRecPhase('recording');
    } catch {
      Alert.alert('Error', 'Could not start recording. Please try again.');
    }
  };

  const stopRecording = async () => {
    const elapsed = Math.floor((Date.now() - recStart.current) / 1000);
    if (elapsed < 2) {
      Alert.alert('Too short', 'Please hold and speak for at least 2 seconds.');
      return;
    }
    setRecPhase('processing');
    setStatusMsg('Transcribing your speech…');
    try {
      if (Platform.OS === 'web') {
        const mr = webRec.current.mr;
        if (mr && mr.state !== 'inactive') mr.stop();
      } else {
        const rec = nativeRec.current;
        if (!rec) { setRecPhase('idle'); return; }
        await rec.stopAndUnloadAsync();
        await Audio.setAudioModeAsync({ allowsRecordingIOS: false });
        deactivateKeepAwake('voice-case');
        const uri = rec.getURI();
        nativeRec.current = null;
        if (uri) processAudio(null, uri);
        else setRecPhase('idle');
      }
    } catch {
      nativeRec.current = null;
      setRecPhase('idle');
    }
  };

  const processAudio = async (blob: Blob | null, uri: string | null) => {
    try {
      setStatusMsg('Transcribing your speech…');
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
      }
      formData.append('mode', 'field');

      const txResp = await fetch(new URL('/api/voice/transcribe', getApiUrl()).toString(), {
        method: 'POST', body: formData,
      });
      if (!txResp.ok) throw new Error('Transcription failed — please try again.');
      const txData = await txResp.json();
      const transcript: string    = (txData.transcript || '').trim();
      const engTranscript: string = (txData.englishTranscript || txData.transcript || '').trim();
      const lang: string          = txData.detectedLanguage || 'en-IN';

      if (!transcript) throw new Error('No speech detected. Please try speaking clearly and try again.');

      const token = await AsyncStorage.getItem('token');
      if (!token) {
        Alert.alert('Session expired', 'Please log in again.');
        setRecPhase('idle');
        return;
      }

      let extractText = engTranscript || transcript;
      if (lang && !lang.startsWith('en') && engTranscript !== transcript) {
        try {
          const tResp = await fetch(new URL('/api/voice/translate', getApiUrl()).toString(), {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ text: transcript, sourceLanguage: lang }),
          });
          if (tResp.ok) {
            const tData = await tResp.json();
            if (tData.englishText?.trim()) extractText = tData.englishText.trim();
          }
        } catch {}
      }

      setStatusMsg('Extracting clinical data…');
      const exResp = await fetch(new URL('/api/voice/extract-clinical', getApiUrl()).toString(), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          transcript: extractText,
          patientContext: { age: 0, sex: 'Unknown', caseType: 'adult' },
        }),
      });
      if (!exResp.ok) throw new Error(`Extraction failed (${exResp.status}). Please try again.`);
      const exData  = await exResp.json();
      const extracted = exData.extracted;
      if (!extracted || typeof extracted !== 'object') {
        throw new Error('Could not extract clinical data. Please try again.');
      }

      const rawAge   = extracted.patientAge ?? extracted.age ?? '';
      const ageYears = parseAgeToYears(rawAge);
      const caseType: 'adult' | 'pediatric' = ageYears > 0 && ageYears <= 16 ? 'pediatric' : 'adult';

      const finalName = patientName.trim() || extracted.patientName || 'Unknown';
      const finalAge  = rawAge ? String(rawAge) : '';
      const finalSex  = extracted.patientSex || extracted.sex || 'Unknown';

      setStatusMsg('Saving case…');
      const svResp = await fetch(new URL('/api/voice/save-case', getApiUrl()).toString(), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          patient: {
            name: finalName, age: finalAge, sex: finalSex, phone: '',
            weight: extracted.patientWeight || extracted.weight || '',
            mode_of_arrival: 'Walk-in', address: 'Not provided',
            brought_by: 'Self', informant_name: finalName,
            informant_reliability: 'Reliable', identification_mark: 'None noted',
            arrival_datetime: new Date().toISOString(),
          },
          extracted, transcript, case_type: caseType,
          userId: user?.id, userEmail: user?.email || '',
        }),
      });

      if (svResp.status === 401) {
        await AsyncStorage.multiRemove(['token', 'user']);
        Alert.alert('Session expired', 'Please log in again.', [
          { text: 'Log In', onPress: () => navigation.navigate('Login') },
        ]);
        setRecPhase('idle');
        return;
      }

      const svData = await svResp.json();
      if (!svData.success) throw new Error(svData.error || svData.detail || 'Save failed. Please try again.');

      await invalidateCases();

      // Transition to chat mode in the same screen
      setActiveCaseId(String(svData.caseId));
      setRecPhase('idle');
      fetchCase(String(svData.caseId));
    } catch (err: any) {
      Alert.alert(
        'Something went wrong',
        err.message || 'Please try again.',
        [
          { text: 'Try again', onPress: () => setRecPhase('idle') },
          { text: 'Cancel',    style: 'cancel', onPress: () => { setRecPhase('idle'); navigation.goBack(); } },
        ]
      );
      setRecPhase('idle');
      setStatusMsg('');
    }
  };

  const handleMicPress = () => {
    if (recPhase === 'processing') return;
    if (recPhase === 'recording') stopRecording();
    else startRecording();
  };

  // ── Live case assembly ─────────────────────────────────────────────────────
  const effectiveName = caseData?.patient?.name || paramPatientName || patientName || 'Case';

  const liveCase: CaseData | undefined = useMemo(() => {
    if (!caseData) return undefined;
    const p    = caseData.patient || {};
    const pa   = caseData.primary_assessment || {};
    const hist = caseData.history || {};
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

    const symptoms    = sample.signsSymptoms || hist.signs_and_symptoms || hist.chief_complaint || caseData.presenting_complaint?.text || '';
    const events      = sample.eventsHopi || hist.history_of_present_illness || '';
    const allergies   = arrStr(sample.allergies || hist.allergies);
    const medications = sample.medications || hist.current_medications || '';
    const pastHistory = arrStr(sample.pastMedicalHistory || hist.past_medical_history);
    const lastMeal    = sample.lastMeal || '';
    const otherHist   = hist.other_history || hist.social_history || '';
    const pastSurgical = hist.past_surgical_history || '';

    const airwayStatus     = pa.airway_status || caseData.airway?.status || '';
    const breathingNotes   = pa.breathing_effort ? `WOB: ${pa.breathing_effort}` : caseData.breathing?.notes || '';
    const circulationNotes = pa.circulation_cap_refill ? `CRT: ${pa.circulation_cap_refill}` : caseData.circulation?.notes || '';
    const disabilityNote   = [gcsTotal > 0 ? `GCS ${gcsTotal}` : '', pa.disability_avpu || ''].filter(Boolean).join(' · ');
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
    const infusions  = Array.isArray(treat.infusions)
      ? treat.infusions.map((i: any) => [i.name, i.dose, i.rate].filter(Boolean).join(' ')).filter(Boolean).join(', ')
      : '';
    const procedures = Array.isArray(caseData.procedures_performed)
      ? caseData.procedures_performed.join(', ') : '';
    const labsOrdered = treat.labsOrdered || treat.labs_ordered || '';
    const imaging     = typeof treat.imaging === 'string'
      ? treat.imaging : Array.isArray(treat.imaging) ? treat.imaging.join(', ') : '';

    const diagnosis     = treat.primaryDiagnosis || treat.primary_diagnosis || disp.diagnosis || '';
    const differentials = treat.differentialDiagnoses || treat.differential_diagnoses || disp.differentials || '';

    return {
      name: p.name || paramPatientName || '',
      age:  p.age ? String(p.age) : '',
      sex:  p.sex || '',
      priority:   caseData.triage_priority ? `P${caseData.triage_priority}` : '',
      caseNumber: caseData.case_number || '',
      date: caseData.created_at ? new Date(caseData.created_at).toLocaleDateString() : new Date().toLocaleDateString(),
      doctorName: p.doctor_name || '',
      department: '',
      vitals: { hr, bp: bpS && bpD ? `${bpS}/${bpD}` : (bpS || ''), spo2, rr, temp, gcs: gcsTotal > 0 ? String(gcsTotal) : '', grbs },
      history: { symptoms, allergies, medications, pastHistory, lastMeal, events, pastSurgical, other: otherHist },
      primary: { airway: airwayStatus, breathing: breathingNotes, circulation: circulationNotes, disability: disabilityNote, exposure: exposureNote, ecg: pa.ecg_status || '', abg: pa.abg_interpretation || '' },
      exam: { general: examGeneral, cvs: examCvs, respiratory: examResp, abdomen: examAbdo, neuro: examNeuro, extremities: examExtremities },
      treatment: { medications: meds, infusions, otherMedications: treat.otherMedications || '', ivFluids: treat.ivFluids || treat.iv_fluids || '', procedures, labsOrdered, imaging },
      notes: treat.addendumNotes || caseData.clinical_notes || '',
      disposition: { diagnosis, differentials, decision: disp.dispositionType || disp.disposition_type || '', admitTo: disp.admitTo || disp.admit_to || '', referTo: disp.referTo || disp.refer_to || '' },
    };
  }, [caseData, paramPatientName]);

  // ── Chat save handler ──────────────────────────────────────────────────────
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
  }, [activeCaseId]);

  // ── Derived animation values ───────────────────────────────────────────────
  const ring1Scale   = ring1.interpolate({ inputRange: [0, 1], outputRange: [1, 2.0] });
  const ring1Opacity = ring1.interpolate({ inputRange: [0, 0.3, 1], outputRange: [0, 0.3, 0] });
  const ring2Scale   = ring2.interpolate({ inputRange: [0, 1], outputRange: [1, 2.4] });
  const ring2Opacity = ring2.interpolate({ inputRange: [0, 0.3, 1], outputRange: [0, 0.2, 0] });
  const micBg = recPhase === 'recording' ? '#ef4444' : recPhase === 'processing' ? '#374151' : ACCENT;

  // ── Render ─────────────────────────────────────────────────────────────────
  const isNewCase = !paramCaseId && !activeCaseId;

  // Creating mode (new case, before first dictation completes)
  if (isNewCase) {
    return (
      <View style={[styles.root, { backgroundColor: '#FFFFFF' }]}>
        <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />

        {/* Header */}
        <View style={[styles.createHeader, { paddingTop: insets.top + 8 }]}>
          <Pressable onPress={() => navigation.goBack()} style={styles.backBtn} hitSlop={12}>
            <Feather name="x" size={22} color="#6B7280" />
          </Pressable>
          <Text style={styles.createTitle}>New Patient</Text>
          <View style={{ width: 44 }} />
        </View>

        <KeyboardAwareScrollViewCompat
          contentContainerStyle={[styles.createScroll, { paddingBottom: insets.bottom + 40 }]}
          keyboardShouldPersistTaps="handled"
        >
          {/* Optional name input */}
          <View style={styles.nameSection}>
            <Text style={styles.nameLabel}>PATIENT NAME</Text>
            <TextInput
              style={styles.nameInput}
              value={patientName}
              onChangeText={setPatientName}
              placeholder="Optional — extracted from speech"
              placeholderTextColor="#9CA3AF"
              autoCapitalize="words"
              returnKeyType="done"
              editable={recPhase === 'idle'}
            />
          </View>

          {/* Mic area */}
          <View style={styles.micArea}>
            {recPhase !== 'processing' && (
              <>
                <Animated.View style={[styles.micRing, {
                  width: MIC_SIZE + 20, height: MIC_SIZE + 20,
                  borderRadius: (MIC_SIZE + 20) / 2,
                  backgroundColor: ACCENT,
                  transform: [{ scale: ring1Scale }],
                  opacity: ring1Opacity,
                }]} />
                <Animated.View style={[styles.micRing, {
                  width: MIC_SIZE + 20, height: MIC_SIZE + 20,
                  borderRadius: (MIC_SIZE + 20) / 2,
                  backgroundColor: ACCENT,
                  transform: [{ scale: ring2Scale }],
                  opacity: ring2Opacity,
                }]} />
              </>
            )}

            <Animated.View style={{ transform: [{ scale: pulseAnim }] }}>
              <Pressable
                onPress={handleMicPress}
                disabled={recPhase === 'processing'}
                style={[styles.micBtn, { width: MIC_SIZE, height: MIC_SIZE, borderRadius: MIC_SIZE / 2, backgroundColor: micBg }]}
              >
                {recPhase === 'processing' ? (
                  <ActivityIndicator size="large" color="#FFFFFF" />
                ) : recPhase === 'recording' ? (
                  <Feather name="square" size={30} color="#FFFFFF" />
                ) : (
                  <Feather name="mic" size={34} color="#FFFFFF" />
                )}
              </Pressable>
            </Animated.View>

            {recPhase === 'idle' && (
              <Text style={styles.phaseLabel}>Tap to speak your case</Text>
            )}
            {recPhase === 'recording' && (
              <>
                <Text style={[styles.phaseLabel, { color: '#ef4444' }]}>Listening… tap to stop</Text>
                <Text style={styles.recTimer}>{fmtTime(recSecs)}</Text>
              </>
            )}
            {recPhase === 'processing' && (
              <Text style={styles.phaseLabel}>{statusMsg}</Text>
            )}

            <Text style={styles.phaseHint}>
              {recPhase === 'idle'
                ? 'Speak in any language — Hindi, Tamil, English, or mixed'
                : recPhase === 'recording'
                ? 'Speak naturally — age, vitals, complaints, medications'
                : 'ErMate is filling your case sheet…'}
            </Text>
          </View>

          {recPhase === 'idle' && (
            <View style={styles.exampleBox}>
              <View style={styles.exampleHeader}>
                <Feather name="message-circle" size={14} color={ACCENT} />
                <Text style={styles.exampleTitle}>Example</Text>
              </View>
              <Text style={styles.exampleText}>
                "52 year old male with chest pain for 2 hours, BP 94 by 60, diabetic, gave aspirin and morphine, ECG shows ST elevation in V1 to V4"
              </Text>
            </View>
          )}
        </KeyboardAwareScrollViewCompat>
      </View>
    );
  }

  // Loading case
  if (loadingCase) {
    return (
      <View style={styles.root}>
        <StatusBar barStyle="light-content" backgroundColor={DARK_BG} />
        <View style={[styles.chatHeader, { paddingTop: insets.top }]}>
          <Text style={styles.headerTitle}>ErMate</Text>
          <Text style={styles.headerSub}>{effectiveName}</Text>
        </View>
        <View style={styles.center}>
          <ActivityIndicator color={ACCENT} size="large" />
          <Text style={styles.loadingText}>Loading case…</Text>
        </View>
      </View>
    );
  }

  // Error state
  if (caseError) {
    return (
      <View style={styles.root}>
        <StatusBar barStyle="light-content" backgroundColor={DARK_BG} />
        <View style={[styles.chatHeader, { paddingTop: insets.top }]}>
          <Text style={styles.headerTitle}>ErMate</Text>
          <Text style={styles.headerSub}>{effectiveName}</Text>
        </View>
        <View style={styles.center}>
          <Text style={styles.errorText}>{caseError}</Text>
          <Text style={styles.retryText} onPress={() => activeCaseId && fetchCase(activeCaseId)}>Tap to retry</Text>
        </View>
      </View>
    );
  }

  // Chat mode
  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <StatusBar barStyle="light-content" backgroundColor={DARK_BG} />
      <View style={styles.chatHeader}>
        <Text style={styles.headerTitle}>ErMate</Text>
        <Text style={styles.headerSub} numberOfLines={1}>{effectiveName}</Text>
      </View>
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

  // Create mode styles
  createHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#E5E7EB',
    backgroundColor: '#FFFFFF',
  },
  backBtn: { width: 44, height: 44, borderRadius: 22, justifyContent: 'center', alignItems: 'center' },
  createTitle: { fontSize: 17, fontWeight: '700', color: '#111827' },
  createScroll: { flexGrow: 1, paddingHorizontal: 24, paddingTop: 24 },
  nameSection: { marginBottom: 40 },
  nameLabel: { fontSize: 11, fontWeight: '700', letterSpacing: 0.8, color: '#6B7280', marginBottom: 8 },
  nameInput: {
    borderRadius: 10, borderWidth: 1.5, borderColor: '#E5E7EB',
    backgroundColor: '#F9FAFB',
    paddingHorizontal: 16, paddingVertical: 14, fontSize: 16, color: '#111827',
  },
  micArea: { alignItems: 'center', justifyContent: 'center', paddingVertical: 24, gap: 16, minHeight: 260 },
  micBtn: {
    justifyContent: 'center', alignItems: 'center',
    shadowColor: ACCENT, shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35, shadowRadius: 16, elevation: 10,
  },
  micRing: { position: 'absolute' },
  phaseLabel: { fontSize: 18, fontWeight: '700', color: '#111827', textAlign: 'center', marginTop: 4 },
  recTimer: { fontSize: 26, fontWeight: '700', letterSpacing: 2, color: '#374151', fontVariant: ['tabular-nums'] as any },
  phaseHint: { fontSize: 13, color: '#9CA3AF', textAlign: 'center', paddingHorizontal: 32, lineHeight: 20 },
  exampleBox: {
    borderRadius: 12, borderWidth: 1, borderColor: '#E5E7EB',
    backgroundColor: '#F9FAFB', padding: 16, marginTop: 8,
  },
  exampleHeader: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 },
  exampleTitle: { fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.8, color: ACCENT },
  exampleText: { fontSize: 14, lineHeight: 22, fontStyle: 'italic', color: '#6B7280' },

  // Chat mode styles
  chatHeader: {
    paddingHorizontal: 20, paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: 'rgba(255,255,255,0.08)',
  },
  headerTitle: { fontSize: 17, fontWeight: '700', color: '#FFFFFF', letterSpacing: 0.2 },
  headerSub:   { fontSize: 13, color: 'rgba(255,255,255,0.45)', marginTop: 2 },

  center:      { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12 },
  loadingText: { fontSize: 14, color: 'rgba(255,255,255,0.45)' },
  errorText:   { fontSize: 15, color: '#ef4444', textAlign: 'center', paddingHorizontal: 32 },
  retryText:   { fontSize: 14, color: ACCENT, fontWeight: '600' },
});
