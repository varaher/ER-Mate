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
} from 'react-native';
import { useAudioRecorder, AudioModule, RecordingPresets } from 'expo-audio';
import { Audio } from 'expo-av';
import * as FileSystem from 'expo-file-system';
import { Feather } from '@expo/vector-icons';
import { useTheme } from '@/hooks/useTheme';
import { apiUpload, apiPost } from '@/lib/api';
import { getApiUrl } from '@/lib/query-client';

export interface ExtractedClinicalData {
  chiefComplaint?: string;
  historyOfPresentIllness?: string;
  pastMedicalHistory?: string;
  pastSurgicalHistory?: string;
  allergies?: string;
  medications?: string;
  familyHistory?: string;
  socialHistory?: string;
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
  reviewOfSystems?: {
    general?: string;
    constitutional?: string;
    skin?: string;
    heent?: string;
    respiratory?: string;
    cardiovascular?: string;
    gastrointestinal?: string;
    genitourinary?: string;
    musculoskeletal?: string;
    neurological?: string;
    psychiatric?: string;
  };
  examFindings?: {
    general?: string;
    cvs?: string;
    respiratory?: string;
    abdomen?: string;
    cns?: string;
    musculoskeletal?: string;
    skin?: string;
  };
  diagnosis?: string[];
  differentialDiagnosis?: string[];
  assessmentPlan?: string;
  treatmentNotes?: string;
  redFlags?: string[];
  triageData?: {
    chiefComplaint?: string;
    onset?: string;
    severity?: string;
    redFlags?: string[];
    suggestedTriageLevel?: string;
  };
  rawTranscription?: string;
}

interface VoiceRecorderProps {
  onExtractedData?: (data: ExtractedClinicalData) => void;
  onTranscriptionComplete?: (text: string) => void;
  onError?: (error: string) => void;
  patientContext?: {
    age?: number;
    sex?: string;
    chiefComplaint?: string;
  };
  mode?: 'full' | 'field';
  fieldName?: string;
  disabled?: boolean;
}

export default function VoiceRecorder({
  onExtractedData,
  onTranscriptionComplete,
  onError,
  patientContext,
  mode = 'full',
  fieldName,
  disabled = false,
}: VoiceRecorderProps) {
  const { theme } = useTheme();
  const colors = theme;

  const [isRecording, setIsRecording] = useState(false);
  const [hasRecording, setHasRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [recordingUri, setRecordingUri] = useState<string | null>(null);
  const [transcription, setTranscription] = useState<string>('');
  
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const durationInterval = useRef<ReturnType<typeof setInterval> | null>(null);
  
  const audioRecorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);

  useEffect(() => {
    if (isRecording) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.3,
            duration: 600,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 600,
            useNativeDriver: true,
          }),
        ])
      ).start();
      
      durationInterval.current = setInterval(() => {
        setRecordingDuration(prev => prev + 1);
      }, 1000);
    } else {
      pulseAnim.setValue(1);
      if (durationInterval.current) {
        clearInterval(durationInterval.current);
        durationInterval.current = null;
      }
    }
    
    return () => {
      if (durationInterval.current) {
        clearInterval(durationInterval.current);
      }
    };
  }, [isRecording]);

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const startRecording = async () => {
    try {
      const status = await AudioModule.requestRecordingPermissionsAsync();
      if (!status.granted) {
        Alert.alert('Permission Required', 'Microphone access is needed for voice recording');
        return;
      }

      if (Platform.OS !== 'web') {
        await Audio.setAudioModeAsync({
          allowsRecordingIOS: true,
          playsInSilentModeIOS: true,
          staysActiveInBackground: false,
          shouldDuckAndroid: true,
        });
      }

      setRecordingDuration(0);
      setTranscription('');
      setHasRecording(false);
      setRecordingUri(null);
      
      audioRecorder.record();
      setIsRecording(true);
    } catch (err) {
      console.error('Failed to start recording:', err);
      Alert.alert('Error', 'Failed to start recording. Please try again.');
      onError?.('Failed to start recording');
    }
  };

  const stopRecording = async () => {
    if (!isRecording) return;
    
    try {
      await audioRecorder.stop();
      setIsRecording(false);
      
      const uri = audioRecorder.uri;
      if (uri) {
        setRecordingUri(uri);
        setHasRecording(true);
      }
    } catch (err) {
      console.error('Failed to stop recording:', err);
      setIsRecording(false);
    }
  };

  const cleanupRecording = async (uri: string | null) => {
    if (uri && Platform.OS !== 'web') {
      try {
        await FileSystem.deleteAsync(uri, { idempotent: true });
      } catch (e) {
        // Ignore cleanup errors
      }
    }
  };

  const discardRecording = async () => {
    await cleanupRecording(recordingUri);
    setHasRecording(false);
    setRecordingUri(null);
    setTranscription('');
    setRecordingDuration(0);
  };

  const saveToCase = async () => {
    if (!recordingUri) {
      Alert.alert('Error', 'No recording available');
      return;
    }

    setIsProcessing(true);
    
    try {
      const formData = new FormData();
      
      if (Platform.OS === 'web') {
        const response = await fetch(recordingUri);
        const blob = await response.blob();
        formData.append('audio', blob, 'voice.m4a');
      } else {
        const file = new FileSystem.File(recordingUri);
        formData.append('audio', file as unknown as Blob, 'voice.m4a');
      }
      
      if (patientContext) {
        formData.append('patientContext', JSON.stringify(patientContext));
      }
      formData.append('mode', mode);

      const apiUrl = getApiUrl();
      const transcribeUrl = new URL('/api/voice/transcribe', apiUrl).toString();
      
      const response = await fetch(transcribeUrl, {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Transcription failed');
      }

      const result = await response.json();
      const { transcript, structured } = result;

      setTranscription(transcript || '');
      onTranscriptionComplete?.(transcript || '');

      if (mode === 'full' && structured) {
        const extracted: ExtractedClinicalData = {
          ...structured,
          rawTranscription: transcript,
        };
        onExtractedData?.(extracted);
        Alert.alert('Success', 'Voice note saved and clinical data extracted to case sheet');
      } else {
        onExtractedData?.({ rawTranscription: transcript });
        Alert.alert('Saved', 'Voice note transcribed and saved');
      }

      discardRecording();
    } catch (err) {
      console.error('Save error:', err);
      Alert.alert('Error', 'Failed to process voice recording. Please try again.');
      onError?.((err as Error).message);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleMicPress = () => {
    if (disabled) return;
    
    if (isRecording) {
      stopRecording();
    } else if (!hasRecording) {
      startRecording();
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.card }]}>
      <View style={styles.header}>
        <Feather name="mic" size={20} color={colors.primary} />
        <Text style={[styles.title, { color: colors.text }]}>
          {mode === 'field' && fieldName ? `Voice Input: ${fieldName}` : 'Voice Clinical Notes'}
        </Text>
      </View>

      <View style={styles.controlsRow}>
        <Animated.View style={[
          styles.micButtonWrapper,
          { transform: [{ scale: isRecording ? pulseAnim : 1 }] }
        ]}>
          <Pressable
            onPress={handleMicPress}
            disabled={disabled || isProcessing || hasRecording}
            style={[
              styles.micButton,
              {
                backgroundColor: isRecording ? colors.danger : colors.primary,
                opacity: disabled || isProcessing || hasRecording ? 0.5 : 1,
              },
            ]}
          >
            <Feather
              name={isRecording ? 'square' : 'mic'}
              size={28}
              color="#fff"
            />
          </Pressable>
        </Animated.View>

        <View style={styles.statusContainer}>
          {isRecording ? (
            <View style={styles.recordingStatus}>
              <View style={[styles.recordingDot, { backgroundColor: colors.danger }]} />
              <Text style={[styles.statusText, { color: colors.danger }]}>
                Recording... {formatDuration(recordingDuration)}
              </Text>
            </View>
          ) : hasRecording ? (
            <Text style={[styles.statusText, { color: colors.success }]}>
              Recording ready ({formatDuration(recordingDuration)})
            </Text>
          ) : (
            <Text style={[styles.statusText, { color: colors.textSecondary }]}>
              Tap to start recording
            </Text>
          )}
        </View>
      </View>

      {hasRecording && !isProcessing && (
        <View style={styles.actionButtons}>
          <Pressable
            onPress={discardRecording}
            style={[styles.actionButton, { backgroundColor: colors.backgroundSecondary }]}
          >
            <Feather name="trash-2" size={18} color={colors.danger} />
            <Text style={[styles.actionButtonText, { color: colors.danger }]}>Discard</Text>
          </Pressable>
          
          <Pressable
            onPress={saveToCase}
            style={[styles.actionButton, styles.saveButton, { backgroundColor: colors.success }]}
          >
            <Feather name="check" size={18} color="#fff" />
            <Text style={[styles.actionButtonText, { color: '#fff' }]}>Save to Case</Text>
          </Pressable>
        </View>
      )}

      {isProcessing && (
        <View style={styles.processingContainer}>
          <ActivityIndicator size="small" color={colors.primary} />
          <Text style={[styles.processingText, { color: colors.textSecondary }]}>
            Processing voice recording...
          </Text>
        </View>
      )}

      {transcription ? (
        <View style={[styles.transcriptionBox, { backgroundColor: colors.backgroundSecondary }]}>
          <Text style={[styles.transcriptionLabel, { color: colors.textSecondary }]}>
            Transcription:
          </Text>
          <Text style={[styles.transcriptionText, { color: colors.text }]}>
            {transcription}
          </Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: 12,
    padding: 16,
    marginVertical: 8,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 16,
  },
  title: {
    fontSize: 16,
    fontWeight: '600',
  },
  controlsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  micButtonWrapper: {
    width: 60,
    height: 60,
  },
  micButton: {
    width: 60,
    height: 60,
    borderRadius: 30,
    justifyContent: 'center',
    alignItems: 'center',
  },
  statusContainer: {
    flex: 1,
  },
  recordingStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  recordingDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  statusText: {
    fontSize: 14,
    fontWeight: '500',
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 16,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
  },
  saveButton: {
    flex: 2,
  },
  actionButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
  processingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    marginTop: 16,
    paddingVertical: 12,
  },
  processingText: {
    fontSize: 14,
  },
  transcriptionBox: {
    marginTop: 16,
    padding: 12,
    borderRadius: 8,
  },
  transcriptionLabel: {
    fontSize: 12,
    marginBottom: 4,
  },
  transcriptionText: {
    fontSize: 14,
    lineHeight: 20,
  },
});
