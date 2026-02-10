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

export default function SmartDictation({
  onDataExtracted,
  patientContext,
  disabled = false,
}: SmartDictationProps) {
  const { theme } = useTheme();
  const [isRecording, setIsRecording] = useState(false);
  const [hasRecording, setHasRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingStep, setProcessingStep] = useState('');
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [recordingUri, setRecordingUri] = useState<string | null>(null);
  const [webRecordingBlob, setWebRecordingBlob] = useState<Blob | null>(null);
  const [showResults, setShowResults] = useState(false);
  const [extractedData, setExtractedData] = useState<SmartDictationExtracted | null>(null);
  const [transcript, setTranscript] = useState('');

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
    if (isRecording) {
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
  }, [isRecording]);

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const startRecording = async () => {
    try {
      setRecordingDuration(0);
      setTranscript('');
      setExtractedData(null);
      setHasRecording(false);
      setRecordingUri(null);
      setWebRecordingBlob(null);

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
          setHasRecording(true);
          if (webRecorderRef.current.stream) {
            webRecorderRef.current.stream.getTracks().forEach(track => track.stop());
          }
        };

        webRecorderRef.current.mediaRecorder = mediaRecorder;
        mediaRecorder.start(100);
        setIsRecording(true);
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
        setIsRecording(true);
      }
    } catch (err) {
      console.error('Failed to start recording:', err);
      Alert.alert('Error', 'Failed to start recording. Please try again.');
    }
  };

  const stopRecording = async () => {
    if (!isRecording) return;
    try {
      setIsRecording(false);
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
          setHasRecording(true);
        }
      }
    } catch (err) {
      console.error('Failed to stop recording:', err);
      setIsRecording(false);
    }
  };

  const discardRecording = async () => {
    if (recordingUri && Platform.OS !== 'web') {
      try {
        await FileSystem.deleteAsync(recordingUri, { idempotent: true });
      } catch {}
    }
    setHasRecording(false);
    setRecordingUri(null);
    setWebRecordingBlob(null);
    setTranscript('');
    setRecordingDuration(0);
    setExtractedData(null);
    webRecorderRef.current.audioChunks = [];
  };

  const processRecording = async () => {
    if (Platform.OS === 'web' && !webRecordingBlob) return;
    if (Platform.OS !== 'web' && !recordingUri) return;

    setIsProcessing(true);
    setProcessingStep('Transcribing speech...');

    try {
      const formData = new FormData();

      if (Platform.OS === 'web') {
        const extension = webRecordingBlob!.type.includes('webm') ? 'webm' : 'm4a';
        formData.append('audio', webRecordingBlob!, `voice.${extension}`);
      } else {
        const file = new FileSystem.File(recordingUri!);
        formData.append('audio', file as unknown as Blob, 'voice.m4a');
      }

      if (patientContext) {
        formData.append('patientContext', JSON.stringify(patientContext));
      }

      setProcessingStep('Analyzing clinical content...');

      const apiUrl = getApiUrl();
      const url = new URL('/api/voice/smart-dictation', apiUrl).toString();

      const response = await fetch(url, {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Processing failed');
      }

      const result = await response.json();

      if (result.error && !result.transcript) {
        throw new Error(result.error);
      }

      setTranscript(result.transcript || '');
      setProcessingStep('Mapping to case sheet fields...');

      if (result.extracted) {
        setExtractedData(result.extracted);
        setShowResults(true);
      } else {
        Alert.alert('Notice', 'Speech was transcribed but no clinical data could be extracted.');
      }
    } catch (err) {
      console.error('Smart dictation error:', err);
      Alert.alert('Error', 'Failed to process recording. Please try again.');
    } finally {
      setIsProcessing(false);
      setProcessingStep('');
    }
  };

  const applyExtractedData = () => {
    if (extractedData) {
      onDataExtracted(extractedData);
      setShowResults(false);
      discardRecording();
      Alert.alert('Applied', 'Clinical data has been populated across relevant sections of the case sheet.');
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
    if (isRecording) {
      stopRecording();
    } else if (!hasRecording) {
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
              Dictate Full History
            </Text>
            <Text style={[styles.subtitle, { color: theme.textSecondary }]}>
              Speak the entire patient history and it will be auto-filled across all sections
            </Text>
          </View>
        </View>

        <View style={styles.mainArea}>
          <Animated.View style={[
            styles.micButtonOuter,
            {
              transform: [{ scale: isRecording ? pulseAnim : 1 }],
              backgroundColor: isRecording ? 'rgba(239, 68, 68, 0.15)' : 'transparent',
            }
          ]}>
            <Pressable
              onPress={handleMicPress}
              disabled={disabled || isProcessing || hasRecording}
              style={[
                styles.micButton,
                {
                  backgroundColor: isRecording ? TriageColors.red : '#7c3aed',
                  opacity: disabled || isProcessing || hasRecording ? 0.5 : 1,
                },
              ]}
            >
              <Feather name={isRecording ? 'square' : 'mic'} size={32} color="#FFFFFF" />
            </Pressable>
          </Animated.View>

          <View style={styles.statusArea}>
            {isProcessing ? (
              <View style={styles.processingStatus}>
                <ActivityIndicator size="small" color="#7c3aed" />
                <Text style={[styles.processingText, { color: '#7c3aed' }]}>
                  {processingStep}
                </Text>
              </View>
            ) : isRecording ? (
              <View style={styles.recordingStatus}>
                <Animated.View style={[styles.recordingDot, { opacity: glowAnim }]} />
                <Text style={[styles.recordingText, { color: TriageColors.red }]}>
                  Recording... {formatDuration(recordingDuration)}
                </Text>
                <Text style={[styles.recordingHint, { color: theme.textMuted }]}>
                  Dictate the full history naturally
                </Text>
              </View>
            ) : hasRecording ? (
              <Text style={[styles.readyText, { color: TriageColors.green }]}>
                Recording ready ({formatDuration(recordingDuration)})
              </Text>
            ) : (
              <Text style={[styles.idleText, { color: theme.textMuted }]}>
                Tap the mic and dictate the patient's full history
              </Text>
            )}
          </View>
        </View>

        {hasRecording && !isProcessing && (
          <View style={styles.actionRow}>
            <Pressable
              onPress={discardRecording}
              style={[styles.actionBtn, { backgroundColor: theme.backgroundSecondary }]}
            >
              <Feather name="trash-2" size={16} color={TriageColors.red} />
              <Text style={[styles.actionBtnText, { color: TriageColors.red }]}>Discard</Text>
            </Pressable>
            <Pressable
              onPress={processRecording}
              style={[styles.actionBtn, styles.processBtn]}
            >
              <Feather name="zap" size={16} color="#FFFFFF" />
              <Text style={[styles.actionBtnText, { color: '#FFFFFF' }]}>Process & Auto-fill</Text>
            </Pressable>
          </View>
        )}

        {isProcessing && (
          <View style={[styles.processingBar, { backgroundColor: theme.backgroundSecondary }]}>
            <View style={[styles.processingBarFill, { backgroundColor: '#7c3aed' }]} />
          </View>
        )}
      </View>

      <Modal visible={showResults} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: theme.backgroundDefault }]}>
            <View style={[styles.modalHeader, { borderBottomColor: theme.border }]}>
              <Text style={[styles.modalTitle, { color: theme.text }]}>Extracted Clinical Data</Text>
              <Pressable onPress={() => setShowResults(false)} style={styles.modalClose}>
                <Feather name="x" size={24} color={theme.text} />
              </Pressable>
            </View>

            {transcript ? (
              <View style={[styles.transcriptBox, { backgroundColor: theme.backgroundSecondary }]}>
                <Text style={[styles.transcriptLabel, { color: theme.textSecondary }]}>Transcript</Text>
                <Text style={[styles.transcriptText, { color: theme.text }]} numberOfLines={3}>
                  "{transcript}"
                </Text>
              </View>
            ) : null}

            <Text style={[styles.fieldsHeader, { color: theme.textSecondary }]}>
              {populatedFields.length} field{populatedFields.length !== 1 ? 's' : ''} will be populated:
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
                  <Text style={[styles.fieldItemValue, { color: theme.text }]} numberOfLines={3}>
                    {field.value}
                  </Text>
                </View>
              ))}
            </ScrollView>

            <View style={styles.modalActions}>
              <Pressable
                onPress={() => setShowResults(false)}
                style={[styles.modalActionBtn, { backgroundColor: theme.backgroundSecondary }]}
              >
                <Text style={[styles.modalActionText, { color: theme.text }]}>Cancel</Text>
              </Pressable>
              <Pressable
                onPress={applyExtractedData}
                style={[styles.modalActionBtn, styles.applyBtn]}
              >
                <Feather name="check-circle" size={18} color="#FFFFFF" />
                <Text style={[styles.modalActionText, { color: '#FFFFFF' }]}>Apply All</Text>
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
    borderWidth: 1,
    borderStyle: 'dashed',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
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
    marginTop: 2,
  },
  headerBadgeText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
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
    lineHeight: 16,
  },
  mainArea: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  micButtonOuter: {
    borderRadius: 40,
    padding: 8,
  },
  micButton: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statusArea: {
    flex: 1,
  },
  processingStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  processingText: {
    fontSize: 14,
    fontWeight: '500',
  },
  recordingStatus: {
    gap: 2,
  },
  recordingDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#EF4444',
    position: 'absolute',
    right: 0,
    top: 0,
  },
  recordingText: {
    fontSize: 16,
    fontWeight: '600',
  },
  recordingHint: {
    fontSize: 12,
    marginTop: 2,
  },
  readyText: {
    fontSize: 15,
    fontWeight: '600',
  },
  idleText: {
    fontSize: 13,
    lineHeight: 18,
  },
  actionRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginTop: Spacing.md,
  },
  actionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: BorderRadius.md,
    gap: 6,
  },
  processBtn: {
    backgroundColor: '#7c3aed',
    flex: 2,
  },
  actionBtnText: {
    fontSize: 14,
    fontWeight: '600',
  },
  processingBar: {
    height: 3,
    borderRadius: 2,
    marginTop: Spacing.md,
    overflow: 'hidden',
  },
  processingBarFill: {
    height: '100%',
    width: '30%',
    borderRadius: 2,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    maxHeight: '85%',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingBottom: 34,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: Spacing.md,
    borderBottomWidth: 1,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  modalClose: {
    padding: 4,
  },
  transcriptBox: {
    marginHorizontal: Spacing.md,
    marginTop: Spacing.sm,
    padding: Spacing.sm,
    borderRadius: BorderRadius.md,
  },
  transcriptLabel: {
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  transcriptText: {
    fontSize: 13,
    fontStyle: 'italic',
    lineHeight: 18,
  },
  fieldsHeader: {
    fontSize: 13,
    fontWeight: '600',
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.xs,
  },
  fieldsList: {
    paddingHorizontal: Spacing.md,
  },
  fieldItem: {
    padding: Spacing.sm,
    borderRadius: BorderRadius.md,
    marginBottom: Spacing.xs,
    borderWidth: 1,
  },
  fieldItemHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  fieldIconBg: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fieldItemLabel: {
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  fieldItemValue: {
    fontSize: 14,
    lineHeight: 20,
    paddingLeft: 30,
  },
  modalActions: {
    flexDirection: 'row',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.md,
  },
  modalActionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: BorderRadius.md,
    gap: 8,
  },
  applyBtn: {
    backgroundColor: '#7c3aed',
    flex: 2,
  },
  modalActionText: {
    fontSize: 16,
    fontWeight: '600',
  },
});
