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
  TextInput,
  ScrollView,
} from 'react-native';
import { Audio } from 'expo-av';
import * as FileSystem from 'expo-file-system';
import { Feather } from '@expo/vector-icons';
import { useTheme } from '@/hooks/useTheme';
import { getApiUrl } from '@/lib/query-client';

interface WebRecorderState {
  mediaRecorder: MediaRecorder | null;
  audioChunks: Blob[];
  stream: MediaStream | null;
}

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

type FlowStep = 'idle' | 'recording' | 'transcribing' | 'transcript_ready';

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

  const [step, setStep] = useState<FlowStep>('idle');
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [recordingUri, setRecordingUri] = useState<string | null>(null);
  const [webRecordingBlob, setWebRecordingBlob] = useState<Blob | null>(null);
  const [segments, setSegments] = useState<string[]>([]);
  const [currentSegmentText, setCurrentSegmentText] = useState('');
  const [editedTranscript, setEditedTranscript] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  const pulseAnim = useRef(new Animated.Value(1)).current;
  const durationInterval = useRef<ReturnType<typeof setInterval> | null>(null);
  const webRecorderRef = useRef<WebRecorderState>({
    mediaRecorder: null,
    audioChunks: [],
    stream: null,
  });
  const nativeRecordingRef = useRef<Audio.Recording | null>(null);

  const fullTranscript = [...segments, currentSegmentText].filter(Boolean).join(' ');

  useEffect(() => {
    const combined = [...segments, currentSegmentText].filter(Boolean).join(' ');
    setEditedTranscript(combined);
  }, [segments, currentSegmentText]);

  useEffect(() => {
    if (step === 'recording') {
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 1.3, duration: 600, useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 1, duration: 600, useNativeDriver: true }),
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
    setSegments([]);
    setCurrentSegmentText('');
    setEditedTranscript('');
    setErrorMsg('');
    webRecorderRef.current.audioChunks = [];
  };

  const startRecording = async () => {
    try {
      setRecordingDuration(0);
      setCurrentSegmentText('');
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
          transcribeSegment(audioBlob, null);
        };

        webRecorderRef.current.mediaRecorder = mediaRecorder;
        mediaRecorder.start(100);
        setStep('recording');
      } else {
        const permission = await Audio.requestPermissionsAsync();
        if (!permission.granted) {
          Alert.alert('Permission Required', 'Microphone access is needed for voice recording');
          return;
        }

        if (nativeRecordingRef.current) {
          try {
            await nativeRecordingRef.current.stopAndUnloadAsync();
          } catch {}
          nativeRecordingRef.current = null;
        }

        await Audio.setAudioModeAsync({
          allowsRecordingIOS: true,
          playsInSilentModeIOS: true,
          staysActiveInBackground: false,
          shouldDuckAndroid: true,
        });
        const { recording } = await Audio.Recording.createAsync(
          Audio.RecordingOptionsPresets.HIGH_QUALITY
        );
        nativeRecordingRef.current = recording;
        setStep('recording');
      }
    } catch (err) {
      console.error('Failed to start recording:', err);
      Alert.alert('Error', 'Failed to start recording. Please try again.');
      onError?.('Failed to start recording');
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
        const recording = nativeRecordingRef.current;
        if (!recording) {
          setStep('transcript_ready');
          setErrorMsg('No active recording found');
          return;
        }
        await recording.stopAndUnloadAsync();
        await Audio.setAudioModeAsync({ allowsRecordingIOS: false });
        const uri = recording.getURI();
        nativeRecordingRef.current = null;
        if (uri) {
          setRecordingUri(uri);
          transcribeSegment(null, uri);
        } else {
          setStep(segments.length > 0 ? 'transcript_ready' : 'idle');
          setErrorMsg('Recording failed - no audio file created');
        }
      }
    } catch (err) {
      console.error('Failed to stop recording:', err);
      nativeRecordingRef.current = null;
      setStep(segments.length > 0 ? 'transcript_ready' : 'idle');
    }
  };

  const transcribeSegment = async (blob: Blob | null, uri: string | null) => {
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
        setErrorMsg('No speech detected in this segment. Try again or use what you have.');
        setStep('transcript_ready');
        return;
      }

      setCurrentSegmentText(text);
      setSegments(prev => [...prev, text]);
      setCurrentSegmentText('');
      setStep('transcript_ready');
    } catch (err) {
      const msg = (err as Error).message || 'Transcription failed';
      console.error('Transcription error:', msg);
      setErrorMsg(msg);
      setStep(segments.length > 0 ? 'transcript_ready' : 'idle');
      onError?.(msg);
    }
  };

  const copyToField = async () => {
    const text = editedTranscript.trim();
    if (!text) return;

    let finalText = text;
    try {
      const apiUrl = getApiUrl();
      const translateUrl = new URL('/api/voice/translate', apiUrl).toString();
      const translateRes = await fetch(translateUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
      });
      if (translateRes.ok) {
        const translateData = await translateRes.json();
        if (translateData.translated_text && !translateData.skipped) {
          finalText = translateData.translated_text;
        }
      }
    } catch (translateErr) {
      console.warn('[VoiceRecorder] Translation skipped:', translateErr);
    }

    onTranscriptionComplete?.(finalText);
    onExtractedData?.({ rawTranscription: finalText });
    resetAll();
  };

  const handleMicPress = () => {
    if (disabled) return;
    if (step === 'recording') {
      stopRecording();
    } else if (step === 'idle' || step === 'transcript_ready') {
      if (step === 'transcript_ready') {
        setErrorMsg('');
      }
      startRecording();
    }
  };

  const hasSegments = segments.length > 0;

  return (
    <View style={[styles.container, { backgroundColor: colors.card }]}>
      <View style={styles.header}>
        <Feather name="mic" size={18} color={colors.primary} />
        <Text style={[styles.title, { color: colors.text }]}>
          {mode === 'field' && fieldName ? `Voice: ${fieldName}` : 'Voice Input'}
        </Text>
        {hasSegments ? (
          <View style={[styles.segmentBadge, { backgroundColor: `${colors.primary}20` }]}>
            <Text style={[styles.segmentBadgeText, { color: colors.primary }]}>
              {segments.length} {segments.length === 1 ? 'segment' : 'segments'}
            </Text>
          </View>
        ) : null}
      </View>

      {step === 'idle' && !hasSegments ? (
        <View style={styles.centerArea}>
          <Pressable
            onPress={handleMicPress}
            disabled={disabled}
            style={[styles.micButton, { backgroundColor: colors.primary, opacity: disabled ? 0.5 : 1 }]}
          >
            <Feather name="mic" size={28} color="#fff" />
          </Pressable>
          <Text style={[styles.hintText, { color: colors.textSecondary }]}>
            Tap to start dictating
          </Text>
          {errorMsg ? (
            <View style={[styles.errorBox, { backgroundColor: `${colors.danger}15` }]}>
              <Feather name="alert-circle" size={14} color={colors.danger} />
              <Text style={[styles.errorText, { color: colors.danger }]}>{errorMsg}</Text>
            </View>
          ) : null}
        </View>
      ) : null}

      {step === 'recording' && (
        <View style={styles.centerArea}>
          {hasSegments ? (
            <View style={[styles.previousSegments, { backgroundColor: colors.backgroundSecondary, borderColor: colors.border }]}>
              <ScrollView style={{ maxHeight: 60 }} nestedScrollEnabled>
                <Text style={[styles.previousText, { color: colors.textSecondary }]}>
                  {segments.join(' ')}
                </Text>
              </ScrollView>
            </View>
          ) : null}
          <Animated.View style={{ transform: [{ scale: pulseAnim }] }}>
            <Pressable
              onPress={handleMicPress}
              style={[styles.micButton, { backgroundColor: colors.danger }]}
            >
              <Feather name="square" size={24} color="#fff" />
            </Pressable>
          </Animated.View>
          <View style={styles.recordingRow}>
            <View style={[styles.recordingDot, { backgroundColor: colors.danger }]} />
            <Text style={[styles.recordingText, { color: colors.danger }]}>
              Recording {formatDuration(recordingDuration)}
            </Text>
          </View>
          <Text style={[styles.hintText, { color: colors.textSecondary }]}>
            Tap to pause and save this segment
          </Text>
        </View>
      )}

      {step === 'transcribing' && (
        <View style={styles.centerArea}>
          {hasSegments ? (
            <View style={[styles.previousSegments, { backgroundColor: colors.backgroundSecondary, borderColor: colors.border }]}>
              <ScrollView style={{ maxHeight: 60 }} nestedScrollEnabled>
                <Text style={[styles.previousText, { color: colors.textSecondary }]}>
                  {segments.join(' ')}
                </Text>
              </ScrollView>
            </View>
          ) : null}
          <ActivityIndicator size="small" color={colors.primary} />
          <Text style={[styles.processingText, { color: colors.textSecondary }]}>
            Transcribing segment...
          </Text>
        </View>
      )}

      {step === 'transcript_ready' && (
        <View style={styles.transcriptArea}>
          <View style={[styles.transcriptBox, { backgroundColor: colors.backgroundSecondary, borderColor: colors.border }]}>
            <TextInput
              style={[styles.transcriptInput, { color: colors.text }]}
              value={editedTranscript}
              onChangeText={setEditedTranscript}
              multiline
              textAlignVertical="top"
              placeholderTextColor={colors.textMuted}
              placeholder="Your dictation will appear here..."
            />
          </View>

          {errorMsg ? (
            <View style={[styles.errorBox, { backgroundColor: `${colors.danger}15` }]}>
              <Feather name="alert-circle" size={14} color={colors.danger} />
              <Text style={[styles.errorText, { color: colors.danger }]}>{errorMsg}</Text>
            </View>
          ) : null}

          <View style={styles.actionRow}>
            <Pressable onPress={handleMicPress} style={[styles.actionBtn, { backgroundColor: `${colors.primary}15` }]}>
              <Feather name="mic" size={16} color={colors.primary} />
              <Text style={[styles.actionBtnText, { color: colors.primary }]}>Continue</Text>
            </Pressable>
            <Pressable onPress={copyToField} style={[styles.actionBtn, styles.copyBtn, { backgroundColor: colors.success }]}>
              <Feather name="clipboard" size={16} color="#fff" />
              <Text style={[styles.actionBtnText, { color: '#fff' }]}>Copy to Field</Text>
            </Pressable>
          </View>

          <Pressable onPress={resetAll} style={styles.clearRow}>
            <Feather name="trash-2" size={14} color={colors.textMuted} />
            <Text style={[styles.clearText, { color: colors.textMuted }]}>Clear all and start over</Text>
          </Pressable>
        </View>
      )}
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
    marginBottom: 12,
  },
  title: {
    fontSize: 15,
    fontWeight: '600',
    flex: 1,
  },
  segmentBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
  },
  segmentBadgeText: {
    fontSize: 11,
    fontWeight: '600',
  },
  centerArea: {
    alignItems: 'center',
    gap: 10,
    paddingVertical: 8,
  },
  micButton: {
    width: 60,
    height: 60,
    borderRadius: 30,
    justifyContent: 'center',
    alignItems: 'center',
  },
  hintText: {
    fontSize: 13,
  },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    marginTop: 4,
    alignSelf: 'stretch',
  },
  errorText: {
    fontSize: 13,
    flex: 1,
  },
  recordingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  recordingDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  recordingText: {
    fontSize: 16,
    fontWeight: '600',
  },
  processingText: {
    fontSize: 14,
  },
  previousSegments: {
    alignSelf: 'stretch',
    borderRadius: 8,
    borderWidth: 1,
    padding: 10,
    marginBottom: 4,
  },
  previousText: {
    fontSize: 13,
    lineHeight: 18,
  },
  transcriptArea: {
    gap: 10,
  },
  transcriptBox: {
    borderRadius: 8,
    borderWidth: 1,
    minHeight: 80,
    maxHeight: 160,
  },
  transcriptInput: {
    padding: 10,
    fontSize: 14,
    lineHeight: 20,
  },
  actionRow: {
    flexDirection: 'row',
    gap: 10,
  },
  actionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    borderRadius: 8,
  },
  copyBtn: {
    flex: 2,
  },
  actionBtnText: {
    fontSize: 14,
    fontWeight: '600',
  },
  clearRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 6,
  },
  clearText: {
    fontSize: 12,
  },
});
