import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  Animated,
  Alert,
  Platform,
  ActivityIndicator,
  ScrollView,
  Modal,
  TextInput,
} from 'react-native';
import { useAudioRecorder, AudioModule, RecordingPresets } from 'expo-audio';
import { Audio } from 'expo-av';
import * as FileSystem from 'expo-file-system';
import { Feather } from '@expo/vector-icons';
import { useTheme } from '@/hooks/useTheme';
import { getApiUrl } from '@/lib/query-client';
import { Spacing, BorderRadius, TriageColors } from '@/constants/theme';

interface WebRecorderState {
  mediaRecorder: MediaRecorder | null;
  audioChunks: Blob[];
  stream: MediaStream | null;
}

export interface SmartDictationExtracted {
  chiefComplaint?: string;
  historyOfPresentIllness?: string;
  onset?: string;
  duration?: string;
  progression?: string;
  associatedSymptoms?: string;
  negativeSymptoms?: string;
  pastMedicalHistory?: string;
  pastSurgicalHistory?: string;
  allergies?: string;
  currentMedications?: string;
  familyHistory?: string;
  socialHistory?: string;
  menstrualHistory?: string;
  immunizationHistory?: string;
  birthHistory?: string;
  feedingHistory?: string;
  developmentalHistory?: string;
  symptoms?: string[];
  painDetails?: {
    location?: string;
    severity?: string;
    character?: string;
    onset?: string;
    duration?: string;
    aggravatingFactors?: string;
    relievingFactors?: string;
    associatedSymptoms?: string;
  };
  vitalsSuggested?: {
    bp?: string;
    hr?: string;
    rr?: string;
    spo2?: string;
    temperature?: string;
    grbs?: string;
  };
  examFindings?: {
    general?: string;
    cvs?: string;
    respiratory?: string;
    abdomen?: string;
    cns?: string;
    musculoskeletal?: string;
    skin?: string;
    heent?: string;
  };
  diagnosis?: string[];
  differentialDiagnosis?: string[];
  treatmentNotes?: string;
  investigationsOrdered?: string;
  imagingOrdered?: string;
  rawTranscription?: string;
  fieldsPopulated?: string[];
}

interface SmartDictationProps {
  onDataExtracted: (data: SmartDictationExtracted) => void;
  patientContext?: {
    age?: number;
    sex?: string;
    chiefComplaint?: string;
    caseType?: string;
  };
  disabled?: boolean;
}

const FIELD_LABELS: Record<string, string> = {
  chiefComplaint: 'Chief Complaint',
  historyOfPresentIllness: 'History of Present Illness',
  onset: 'Onset',
  duration: 'Duration',
  progression: 'Progression',
  associatedSymptoms: 'Associated Symptoms',
  negativeSymptoms: 'Pertinent Negatives',
  pastMedicalHistory: 'Past Medical History',
  pastSurgicalHistory: 'Past Surgical History',
  allergies: 'Allergies',
  currentMedications: 'Current Medications',
  familyHistory: 'Family History',
  socialHistory: 'Social History',
  menstrualHistory: 'Menstrual History',
  immunizationHistory: 'Immunization History',
  birthHistory: 'Birth History',
  feedingHistory: 'Feeding History',
  developmentalHistory: 'Developmental History',
  symptoms: 'Symptoms',
  painDetails: 'Pain Details',
  vitalsSuggested: 'Vitals',
  examFindings: 'Examination Findings',
  diagnosis: 'Diagnosis',
  differentialDiagnosis: 'Differential Diagnosis',
  treatmentNotes: 'Treatment Notes',
  investigationsOrdered: 'Investigations',
  imagingOrdered: 'Imaging',
};

const FIELD_ICONS: Record<string, string> = {
  chiefComplaint: 'alert-circle',
  historyOfPresentIllness: 'file-text',
  pastMedicalHistory: 'clock',
  pastSurgicalHistory: 'scissors',
  allergies: 'alert-triangle',
  currentMedications: 'package',
  diagnosis: 'crosshair',
  examFindings: 'search',
  vitalsSuggested: 'activity',
  treatmentNotes: 'edit-3',
};

type FlowStep = 'idle' | 'recording' | 'transcribing' | 'transcript_ready' | 'extracting' | 'review';

export default function SmartDictation({
  onDataExtracted,
  patientContext,
  disabled = false,
}: SmartDictationProps) {
  const { theme } = useTheme();
  const [step, setStep] = useState<FlowStep>('idle');
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [recordingUri, setRecordingUri] = useState<string | null>(null);
  const [webRecordingBlob, setWebRecordingBlob] = useState<Blob | null>(null);
  const [transcript, setTranscript] = useState('');
  const [editedTranscript, setEditedTranscript] = useState('');
  const [extractedData, setExtractedData] = useState<SmartDictationExtracted | null>(null);
  const [showResults, setShowResults] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const pulseAnim = useRef(new Animated.Value(1)).current;
  const glowAnim = useRef(new Animated.Value(0)).current;
  const durationInterval = useRef<ReturnType<typeof setInterval> | null>(null);
  const webRecorderRef = useRef<WebRecorderState>({
    mediaRecorder: null,
    audioChunks: [],
    stream: null,
  });

  const audioRecorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);

  useEffect(() => {
    if (step === 'recording') {
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 1.2, duration: 800, useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 1, duration: 800, useNativeDriver: true }),
        ])
      ).start();
      Animated.loop(
        Animated.sequence([
          Animated.timing(glowAnim, { toValue: 1, duration: 1000, useNativeDriver: false }),
          Animated.timing(glowAnim, { toValue: 0.3, duration: 1000, useNativeDriver: false }),
        ])
      ).start();
      durationInterval.current = setInterval(() => {
        setRecordingDuration(prev => prev + 1);
      }, 1000);
    } else {
      pulseAnim.setValue(1);
      glowAnim.setValue(0);
      if (durationInterval.current) {
        clearInterval(durationInterval.current);
        durationInterval.current = null;
      }
    }
    return () => {
      if (durationInterval.current) clearInterval(durationInterval.current);
    };
  }, [step]);

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const resetAll = async () => {
    if (recordingUri && Platform.OS !== 'web') {
      try { await FileSystem.deleteAsync(recordingUri, { idempotent: true }); } catch {}
    }
    setStep('idle');
    setRecordingDuration(0);
    setRecordingUri(null);
    setWebRecordingBlob(null);
    setTranscript('');
    setEditedTranscript('');
    setExtractedData(null);
    setShowResults(false);
    setErrorMsg('');
    webRecorderRef.current.audioChunks = [];
  };

  const startRecording = async () => {
    try {
      setRecordingDuration(0);
      setTranscript('');
      setEditedTranscript('');
      setExtractedData(null);
      setErrorMsg('');

      if (Platform.OS === 'web') {
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
          Alert.alert('Not Supported', 'Voice recording is not supported in this browser');
          return;
        }
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        webRecorderRef.current.stream = stream;
        webRecorderRef.current.audioChunks = [];

        const mediaRecorder = new MediaRecorder(stream, {
          mimeType: MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm' : 'audio/mp4',
        });

        mediaRecorder.ondataavailable = (event) => {
          if (event.data.size > 0) {
            webRecorderRef.current.audioChunks.push(event.data);
          }
        };

        mediaRecorder.onstop = () => {
          const audioBlob = new Blob(webRecorderRef.current.audioChunks, { type: mediaRecorder.mimeType });
          setWebRecordingBlob(audioBlob);
          if (webRecorderRef.current.stream) {
            webRecorderRef.current.stream.getTracks().forEach(track => track.stop());
          }
          transcribeRecording(audioBlob, null);
        };

        webRecorderRef.current.mediaRecorder = mediaRecorder;
        mediaRecorder.start(100);
        setStep('recording');
      } else {
        const status = await AudioModule.requestRecordingPermissionsAsync();
        if (!status.granted) {
          Alert.alert('Permission Required', 'Microphone access is needed for voice recording');
          return;
        }
        await Audio.setAudioModeAsync({
          allowsRecordingIOS: true,
          playsInSilentModeIOS: true,
          staysActiveInBackground: false,
          shouldDuckAndroid: true,
        });
        audioRecorder?.record();
        setStep('recording');
      }
    } catch (err) {
      console.error('Failed to start recording:', err);
      Alert.alert('Error', 'Failed to start recording. Please try again.');
    }
  };

  const stopRecording = async () => {
    if (step !== 'recording') return;
    try {
      if (Platform.OS === 'web') {
        const mediaRecorder = webRecorderRef.current.mediaRecorder;
        if (mediaRecorder && mediaRecorder.state !== 'inactive') {
          mediaRecorder.stop();
        }
      } else {
        await audioRecorder?.stop();
        const uri = audioRecorder?.uri;
        if (uri) {
          setRecordingUri(uri);
          transcribeRecording(null, uri);
        } else {
          setStep('idle');
          Alert.alert('Error', 'Recording failed - no audio captured');
        }
      }
    } catch (err) {
      console.error('Failed to stop recording:', err);
      setStep('idle');
    }
  };

  const transcribeRecording = async (blob: Blob | null, uri: string | null) => {
    setStep('transcribing');

    try {
      const formData = new FormData();

      if (Platform.OS === 'web' && blob) {
        const extension = blob.type.includes('webm') ? 'webm' : 'm4a';
        formData.append('audio', blob, `voice.${extension}`);
      } else if (uri) {
        const extension = uri.split('.').pop() || 'm4a';
        formData.append('audio', {
          uri,
          name: `voice.${extension}`,
          type: `audio/${extension === 'caf' ? 'x-caf' : extension === 'm4a' ? 'mp4' : extension}`,
        } as any);
      } else {
        throw new Error('No audio data');
      }

      formData.append('mode', 'field');
      if (patientContext) {
        formData.append('patientContext', JSON.stringify(patientContext));
      }

      const apiUrl = getApiUrl();
      const url = new URL('/api/voice/transcribe', apiUrl).toString();

      const response = await fetch(url, {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `Transcription failed (${response.status})`);
      }

      const result = await response.json();
      const text = result.transcript || '';

      if (!text.trim()) {
        setErrorMsg('No speech detected. Please try recording again.');
        setStep('idle');
        return;
      }

      setTranscript(text);
      setEditedTranscript(text);
      setStep('transcript_ready');
    } catch (err) {
      const msg = (err as Error).message || 'Transcription failed';
      console.error('Transcription error:', msg);
      setErrorMsg(msg);
      setStep('idle');
    }
  };

  const copyToCaseSheet = async () => {
    const textToProcess = editedTranscript.trim();
    if (!textToProcess) return;

    setStep('extracting');

    try {
      const apiUrl = getApiUrl();
      const url = new URL('/api/voice/extract-clinical', apiUrl).toString();

      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          transcript: textToProcess,
          patientContext,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Extraction failed');
      }

      const result = await response.json();

      if (result.extracted) {
        setExtractedData(result.extracted);
        setShowResults(true);
        setStep('review');
      } else {
        Alert.alert('Notice', 'Could not identify specific clinical fields from the text. The raw text has been preserved.');
        onDataExtracted({ rawTranscription: textToProcess });
        resetAll();
      }
    } catch (err) {
      const msg = (err as Error).message || 'Extraction failed';
      console.error('Clinical extraction error:', msg);
      Alert.alert('Error', `Failed to process: ${msg}`);
      setStep('transcript_ready');
    }
  };

  const applyExtractedData = () => {
    if (extractedData) {
      onDataExtracted({ ...extractedData, rawTranscription: editedTranscript });
      setShowResults(false);
      resetAll();
    }
  };

  const getPopulatedFields = (): { key: string; label: string; value: string }[] => {
    if (!extractedData) return [];
    const fields: { key: string; label: string; value: string }[] = [];

    const simple = ['chiefComplaint', 'historyOfPresentIllness', 'onset', 'duration', 'progression',
      'associatedSymptoms', 'negativeSymptoms', 'pastMedicalHistory', 'pastSurgicalHistory',
      'allergies', 'currentMedications', 'familyHistory', 'socialHistory', 'menstrualHistory',
      'immunizationHistory', 'birthHistory', 'feedingHistory', 'developmentalHistory',
      'treatmentNotes', 'investigationsOrdered', 'imagingOrdered'];

    for (const key of simple) {
      const val = (extractedData as any)[key];
      if (val && typeof val === 'string' && val.trim()) {
        fields.push({ key, label: FIELD_LABELS[key] || key, value: val });
      }
    }

    if (extractedData.symptoms && extractedData.symptoms.length > 0) {
      fields.push({ key: 'symptoms', label: 'Symptoms', value: extractedData.symptoms.join(', ') });
    }
    if (extractedData.diagnosis && extractedData.diagnosis.length > 0) {
      fields.push({ key: 'diagnosis', label: 'Diagnosis', value: extractedData.diagnosis.join(', ') });
    }
    if (extractedData.differentialDiagnosis && extractedData.differentialDiagnosis.length > 0) {
      fields.push({ key: 'differentialDiagnosis', label: 'Differential Diagnosis', value: extractedData.differentialDiagnosis.join(', ') });
    }

    if (extractedData.painDetails) {
      const pd = extractedData.painDetails;
      const parts = [];
      if (pd.location) parts.push(`Location: ${pd.location}`);
      if (pd.severity) parts.push(`Severity: ${pd.severity}`);
      if (pd.character) parts.push(`Character: ${pd.character}`);
      if (pd.onset) parts.push(`Onset: ${pd.onset}`);
      if (pd.duration) parts.push(`Duration: ${pd.duration}`);
      if (pd.aggravatingFactors) parts.push(`Aggravating: ${pd.aggravatingFactors}`);
      if (pd.relievingFactors) parts.push(`Relieving: ${pd.relievingFactors}`);
      if (parts.length > 0) {
        fields.push({ key: 'painDetails', label: 'Pain Details', value: parts.join(' | ') });
      }
    }

    if (extractedData.examFindings) {
      const ef = extractedData.examFindings;
      const parts = [];
      if (ef.general) parts.push(`General: ${ef.general}`);
      if (ef.cvs) parts.push(`CVS: ${ef.cvs}`);
      if (ef.respiratory) parts.push(`Respiratory: ${ef.respiratory}`);
      if (ef.abdomen) parts.push(`Abdomen: ${ef.abdomen}`);
      if (ef.cns) parts.push(`CNS: ${ef.cns}`);
      if (ef.heent) parts.push(`HEENT: ${ef.heent}`);
      if (ef.musculoskeletal) parts.push(`MSK: ${ef.musculoskeletal}`);
      if (ef.skin) parts.push(`Skin: ${ef.skin}`);
      if (parts.length > 0) {
        fields.push({ key: 'examFindings', label: 'Examination Findings', value: parts.join(' | ') });
      }
    }

    if (extractedData.vitalsSuggested) {
      const vs = extractedData.vitalsSuggested;
      const parts = [];
      if (vs.bp) parts.push(`BP: ${vs.bp}`);
      if (vs.hr) parts.push(`HR: ${vs.hr}`);
      if (vs.rr) parts.push(`RR: ${vs.rr}`);
      if (vs.spo2) parts.push(`SpO2: ${vs.spo2}`);
      if (vs.temperature) parts.push(`Temp: ${vs.temperature}`);
      if (vs.grbs) parts.push(`GRBS: ${vs.grbs}`);
      if (parts.length > 0) {
        fields.push({ key: 'vitalsSuggested', label: 'Vitals Mentioned', value: parts.join(' | ') });
      }
    }

    return fields;
  };

  const handleMicPress = () => {
    if (disabled) return;
    if (step === 'recording') {
      stopRecording();
    } else if (step === 'idle') {
      startRecording();
    }
  };

  const populatedFields = getPopulatedFields();

  return (
    <>
      <View style={[styles.container, { backgroundColor: theme.card, borderColor: theme.border }]}>
        <View style={styles.header}>
          <View style={[styles.headerBadge, { backgroundColor: '#7c3aed' }]}>
            <Feather name="mic" size={14} color="#FFFFFF" />
            <Text style={styles.headerBadgeText}>Smart</Text>
          </View>
          <View style={styles.headerTextContainer}>
            <Text style={[styles.title, { color: theme.text }]}>
              Vibe Dictation
            </Text>
            <Text style={[styles.subtitle, { color: theme.textSecondary }]}>
              Just talk naturally - AI will fill the case sheet
            </Text>
          </View>
        </View>

        {step === 'idle' && (
          <View style={styles.mainArea}>
            <Pressable
              onPress={handleMicPress}
              disabled={disabled}
              style={[styles.bigMicButton, { backgroundColor: '#7c3aed', opacity: disabled ? 0.5 : 1 }]}
            >
              <Feather name="mic" size={36} color="#FFFFFF" />
            </Pressable>
            <Text style={[styles.idleText, { color: theme.textMuted }]}>
              Tap to start dictating
            </Text>
            {errorMsg ? (
              <View style={[styles.errorBox, { backgroundColor: `${TriageColors.red}15` }]}>
                <Feather name="alert-circle" size={14} color={TriageColors.red} />
                <Text style={[styles.errorText, { color: TriageColors.red }]}>{errorMsg}</Text>
              </View>
            ) : null}
          </View>
        )}

        {step === 'recording' && (
          <View style={styles.mainArea}>
            <Animated.View style={[
              styles.micButtonOuter,
              { transform: [{ scale: pulseAnim }], backgroundColor: 'rgba(239, 68, 68, 0.15)' }
            ]}>
              <Pressable
                onPress={handleMicPress}
                style={[styles.bigMicButton, { backgroundColor: TriageColors.red }]}
              >
                <Feather name="square" size={32} color="#FFFFFF" />
              </Pressable>
            </Animated.View>
            <View style={styles.recordingInfo}>
              <Animated.View style={[styles.recordingDot, { opacity: glowAnim }]} />
              <Text style={[styles.recordingText, { color: TriageColors.red }]}>
                Recording... {formatDuration(recordingDuration)}
              </Text>
            </View>
            <Text style={[styles.recordingHint, { color: theme.textMuted }]}>
              Speak the entire patient history naturally
            </Text>
          </View>
        )}

        {step === 'transcribing' && (
          <View style={styles.mainArea}>
            <View style={[styles.processingBox, { backgroundColor: theme.backgroundSecondary }]}>
              <ActivityIndicator size="large" color="#7c3aed" />
              <Text style={[styles.processingTitle, { color: theme.text }]}>
                Transcribing...
              </Text>
              <Text style={[styles.processingSubtitle, { color: theme.textMuted }]}>
                Converting speech to text
              </Text>
            </View>
          </View>
        )}

        {step === 'transcript_ready' && (
          <View style={styles.transcriptArea}>
            <View style={styles.transcriptHeader}>
              <Feather name="file-text" size={16} color={TriageColors.green} />
              <Text style={[styles.transcriptLabel, { color: TriageColors.green }]}>
                Transcription Complete
              </Text>
            </View>
            <View style={[styles.transcriptBox, { backgroundColor: theme.backgroundSecondary, borderColor: theme.border }]}>
              <TextInput
                style={[styles.transcriptInput, { color: theme.text }]}
                value={editedTranscript}
                onChangeText={setEditedTranscript}
                multiline
                textAlignVertical="top"
                placeholder="Transcribed text appears here..."
                placeholderTextColor={theme.textMuted}
              />
            </View>
            <Text style={[styles.editHint, { color: theme.textMuted }]}>
              You can edit the text above before copying
            </Text>

            <View style={styles.actionRow}>
              <Pressable onPress={resetAll} style={[styles.actionBtn, { backgroundColor: theme.backgroundSecondary }]}>
                <Feather name="rotate-ccw" size={16} color={theme.textSecondary} />
                <Text style={[styles.actionBtnText, { color: theme.textSecondary }]}>Re-record</Text>
              </Pressable>
              <Pressable onPress={copyToCaseSheet} style={[styles.actionBtn, styles.copyBtn]}>
                <Feather name="clipboard" size={16} color="#FFFFFF" />
                <Text style={[styles.actionBtnText, { color: '#FFFFFF' }]}>Copy to Case Sheet</Text>
              </Pressable>
            </View>
          </View>
        )}

        {step === 'extracting' && (
          <View style={styles.mainArea}>
            <View style={[styles.processingBox, { backgroundColor: theme.backgroundSecondary }]}>
              <ActivityIndicator size="large" color="#7c3aed" />
              <Text style={[styles.processingTitle, { color: theme.text }]}>
                Analyzing...
              </Text>
              <Text style={[styles.processingSubtitle, { color: theme.textMuted }]}>
                AI is mapping text to case sheet fields
              </Text>
            </View>
          </View>
        )}
      </View>

      <Modal visible={showResults} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: theme.backgroundDefault }]}>
            <View style={[styles.modalHeader, { borderBottomColor: theme.border }]}>
              <Text style={[styles.modalTitle, { color: theme.text }]}>Review Before Applying</Text>
              <Pressable onPress={() => { setShowResults(false); setStep('transcript_ready'); }} style={styles.modalClose}>
                <Feather name="x" size={24} color={theme.text} />
              </Pressable>
            </View>

            <Text style={[styles.fieldsHeader, { color: theme.textSecondary }]}>
              {populatedFields.length} field{populatedFields.length !== 1 ? 's' : ''} identified:
            </Text>

            <ScrollView style={styles.fieldsList} showsVerticalScrollIndicator={false}>
              {populatedFields.map((field) => (
                <View key={field.key} style={[styles.fieldItem, { backgroundColor: theme.card, borderColor: theme.border }]}>
                  <View style={styles.fieldItemHeader}>
                    <View style={[styles.fieldIconBg, { backgroundColor: '#7c3aed20' }]}>
                      <Feather
                        name={(FIELD_ICONS[field.key] || 'edit') as any}
                        size={14}
                        color="#7c3aed"
                      />
                    </View>
                    <Text style={[styles.fieldItemLabel, { color: '#7c3aed' }]}>
                      {field.label}
                    </Text>
                  </View>
                  <Text style={[styles.fieldItemValue, { color: theme.text }]}>
                    {field.value}
                  </Text>
                </View>
              ))}
            </ScrollView>

            <View style={styles.modalActions}>
              <Pressable
                onPress={() => { setShowResults(false); setStep('transcript_ready'); }}
                style={[styles.modalActionBtn, { backgroundColor: theme.backgroundSecondary }]}
              >
                <Text style={[styles.modalActionText, { color: theme.text }]}>Back</Text>
              </Pressable>
              <Pressable
                onPress={applyExtractedData}
                style={[styles.modalActionBtn, styles.applyBtn]}
              >
                <Feather name="check-circle" size={18} color="#FFFFFF" />
                <Text style={[styles.modalActionText, { color: '#FFFFFF' }]}>Apply to Case Sheet</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    marginVertical: Spacing.sm,
    borderWidth: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  headerBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 4,
  },
  headerBadgeText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  headerTextContainer: {
    flex: 1,
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
  },
  subtitle: {
    fontSize: 12,
    marginTop: 2,
  },
  mainArea: {
    alignItems: 'center',
    paddingVertical: Spacing.md,
    gap: Spacing.sm,
  },
  bigMicButton: {
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  micButtonOuter: {
    width: 100,
    height: 100,
    borderRadius: 50,
    justifyContent: 'center',
    alignItems: 'center',
  },
  idleText: {
    fontSize: 14,
    textAlign: 'center',
  },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    marginTop: 4,
  },
  errorText: {
    fontSize: 13,
    flex: 1,
  },
  recordingInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  recordingDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#ef4444',
  },
  recordingText: {
    fontSize: 18,
    fontWeight: '600',
  },
  recordingHint: {
    fontSize: 13,
    textAlign: 'center',
  },
  processingBox: {
    alignItems: 'center',
    padding: Spacing.lg,
    borderRadius: BorderRadius.md,
    gap: Spacing.sm,
    width: '100%',
  },
  processingTitle: {
    fontSize: 16,
    fontWeight: '600',
  },
  processingSubtitle: {
    fontSize: 13,
  },
  transcriptArea: {
    gap: Spacing.sm,
  },
  transcriptHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  transcriptLabel: {
    fontSize: 14,
    fontWeight: '600',
  },
  transcriptBox: {
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    minHeight: 120,
    maxHeight: 200,
  },
  transcriptInput: {
    padding: Spacing.sm,
    fontSize: 15,
    lineHeight: 22,
  },
  editHint: {
    fontSize: 12,
    textAlign: 'center',
  },
  actionRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginTop: Spacing.xs,
  },
  actionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: BorderRadius.md,
  },
  copyBtn: {
    flex: 2,
    backgroundColor: '#7c3aed',
  },
  actionBtnText: {
    fontSize: 14,
    fontWeight: '600',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingTop: Spacing.md,
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingBottom: Spacing.sm,
    borderBottomWidth: 1,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  modalClose: {
    padding: 4,
  },
  fieldsHeader: {
    fontSize: 13,
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.sm,
  },
  fieldsList: {
    paddingHorizontal: Spacing.md,
    marginTop: Spacing.xs,
  },
  fieldItem: {
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    padding: Spacing.sm,
    marginBottom: Spacing.xs,
  },
  fieldItemHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  fieldIconBg: {
    width: 26,
    height: 26,
    borderRadius: 13,
    justifyContent: 'center',
    alignItems: 'center',
  },
  fieldItemLabel: {
    fontSize: 13,
    fontWeight: '600',
  },
  fieldItemValue: {
    fontSize: 14,
    lineHeight: 20,
  },
  modalActions: {
    flexDirection: 'row',
    gap: Spacing.sm,
    padding: Spacing.md,
  },
  modalActionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: BorderRadius.md,
  },
  applyBtn: {
    flex: 2,
    backgroundColor: '#7c3aed',
  },
  modalActionText: {
    fontSize: 15,
    fontWeight: '600',
  },
});
