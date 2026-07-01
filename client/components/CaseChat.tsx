import React, { useState, useRef, useEffect } from 'react';
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
import { Feather } from '@expo/vector-icons';
import { useTheme } from '@/hooks/useTheme';
import { getApiUrl } from '@/lib/query-client';
import { Spacing, BorderRadius } from '@/constants/theme';
import { SmartDictationExtracted } from './SmartDictation';

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  type: 'text' | 'case_update' | 'discharge_summary' | 'note' | 'error';
  fieldCount?: number;
  specialContent?: string;
  isLoading?: boolean;
}

interface CaseChatProps {
  onDataExtracted: (data: SmartDictationExtracted) => void;
  patientContext?: {
    name?: string;
    age?: number;
    sex?: string;
    chiefComplaint?: string;
    caseType?: string;
  };
  disabled?: boolean;
}

const GREETING =
  "Ready. Speak or type the case — I'll fill the sheet automatically.\n\nTry: \"discharge summary\" or \"add a note\" too.";

function countFields(extracted: SmartDictationExtracted): number {
  let n = 0;
  const simpleKeys = [
    'patientName', 'patientAge', 'patientSex', 'chiefComplaint',
    'historyOfPresentIllness', 'onset', 'duration', 'progression',
    'associatedSymptoms', 'negativeSymptoms', 'pastMedicalHistory',
    'pastSurgicalHistory', 'allergies', 'currentMedications',
    'treatmentNotes', 'investigationsOrdered', 'imagingOrdered',
  ];
  for (const k of simpleKeys) {
    if ((extracted as any)[k]) n++;
  }
  if (extracted.vitalsSuggested) {
    const v = extracted.vitalsSuggested;
    if (v.bp) n++; if (v.hr) n++; if (v.rr) n++;
    if (v.spo2) n++; if (v.temperature) n++; if (v.grbs) n++;
  }
  if (extracted.examFindings) {
    const e = extracted.examFindings;
    [e.general, e.cvs, e.respiratory, e.abdomen, e.cns, e.heent, e.musculoskeletal, e.skin]
      .forEach(v => { if (v) n++; });
  }
  if (extracted.diagnosis?.length) n++;
  if (extracted.differentialDiagnosis?.length) n++;
  if (extracted.prescribedMedications?.length) n++;
  if (extracted.prescribedInfusions?.length) n++;
  return n;
}

function TypingDots({ color }: { color: string }) {
  const dot1 = useRef(new Animated.Value(0.3)).current;
  const dot2 = useRef(new Animated.Value(0.3)).current;
  const dot3 = useRef(new Animated.Value(0.3)).current;

  useEffect(() => {
    const anim = (d: Animated.Value, delay: number) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(delay),
          Animated.timing(d, { toValue: 1, duration: 300, useNativeDriver: true }),
          Animated.timing(d, { toValue: 0.3, duration: 300, useNativeDriver: true }),
          Animated.delay(600),
        ])
      );
    const a1 = anim(dot1, 0);
    const a2 = anim(dot2, 200);
    const a3 = anim(dot3, 400);
    a1.start(); a2.start(); a3.start();
    return () => { a1.stop(); a2.stop(); a3.stop(); };
  }, []);

  const dotStyle = (opacity: Animated.Value) => ({
    width: 7, height: 7, borderRadius: 4,
    backgroundColor: color, marginHorizontal: 2, opacity,
  });

  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 4 }}>
      <Animated.View style={dotStyle(dot1)} />
      <Animated.View style={dotStyle(dot2)} />
      <Animated.View style={dotStyle(dot3)} />
    </View>
  );
}

function MessageBubble({ msg, theme }: { msg: ChatMessage; theme: any }) {
  const isUser = msg.role === 'user';

  if (msg.isLoading) {
    return (
      <View style={[styles.bubbleRow, { justifyContent: 'flex-start' }]}>
        <View style={[styles.bubble, styles.aiBubble, { backgroundColor: theme.backgroundSecondary, borderColor: theme.border }]}>
          <TypingDots color={theme.textSecondary} />
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.bubbleRow, { justifyContent: isUser ? 'flex-end' : 'flex-start' }]}>
      {!isUser ? (
        <View style={[styles.aiAvatar, { backgroundColor: '#7c3aed20' }]}>
          <Feather name="cpu" size={13} color="#7c3aed" />
        </View>
      ) : null}
      <View style={{ maxWidth: '78%' }}>
        {msg.type === 'discharge_summary' && msg.specialContent ? (
          <View style={[styles.specialCard, { backgroundColor: theme.backgroundSecondary, borderColor: '#3b82f6', borderLeftWidth: 3 }]}>
            <View style={styles.specialCardHeader}>
              <Feather name="file-text" size={14} color="#3b82f6" />
              <Text style={[styles.specialCardTitle, { color: '#3b82f6' }]}>Discharge Summary</Text>
            </View>
            <Text style={[styles.specialCardContent, { color: theme.text }]}>{msg.specialContent}</Text>
          </View>
        ) : msg.type === 'note' && msg.specialContent ? (
          <View style={[styles.specialCard, { backgroundColor: theme.backgroundSecondary, borderColor: '#10b981', borderLeftWidth: 3 }]}>
            <View style={styles.specialCardHeader}>
              <Feather name="edit-3" size={14} color="#10b981" />
              <Text style={[styles.specialCardTitle, { color: '#10b981' }]}>Note Added</Text>
            </View>
            <Text style={[styles.specialCardContent, { color: theme.text }]}>{msg.specialContent}</Text>
          </View>
        ) : (
          <View style={[
            styles.bubble,
            isUser ? [styles.userBubble, { backgroundColor: '#7c3aed' }]
                   : [styles.aiBubble, { backgroundColor: theme.backgroundSecondary, borderColor: theme.border }],
          ]}>
            <Text style={[
              styles.bubbleText,
              { color: isUser ? '#fff' : theme.text }
            ]}>
              {msg.content}
            </Text>
          </View>
        )}

        {msg.type === 'case_update' && (msg.fieldCount ?? 0) > 0 ? (
          <View style={[styles.fieldBadge, { backgroundColor: '#10b98115', borderColor: '#10b98140' }]}>
            <Feather name="check-circle" size={12} color="#10b981" />
            <Text style={[styles.fieldBadgeText, { color: '#10b981' }]}>
              {msg.fieldCount} {msg.fieldCount === 1 ? 'field' : 'fields'} updated in case sheet
            </Text>
          </View>
        ) : null}
      </View>
    </View>
  );
}

export default function CaseChat({
  onDataExtracted,
  patientContext,
  disabled = false,
}: CaseChatProps) {
  const { theme } = useTheme();
  const [messages, setMessages] = useState<ChatMessage[]>([
    { id: 'greeting', role: 'assistant', content: GREETING, type: 'text' },
  ]);
  const [inputText, setInputText] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [isThinking, setIsThinking] = useState(false);

  const scrollRef = useRef<ScrollView>(null);
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const pulseAnimRef = useRef<Animated.CompositeAnimation | null>(null);
  const nativeRecordingRef = useRef<Audio.Recording | null>(null);
  const webRecorderRef = useRef<{
    mediaRecorder: MediaRecorder | null;
    audioChunks: Blob[];
    stream: MediaStream | null;
  }>({ mediaRecorder: null, audioChunks: [], stream: null });
  const historyRef = useRef<{ role: 'user' | 'assistant'; content: string }[]>([]);
  const msgIdCounter = useRef(0);

  const genId = () => `msg_${Date.now()}_${++msgIdCounter.current}`;

  useEffect(() => {
    if (isRecording) {
      pulseAnimRef.current = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 1.25, duration: 500, useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 1, duration: 500, useNativeDriver: true }),
        ])
      );
      pulseAnimRef.current.start();
    } else {
      if (pulseAnimRef.current) {
        pulseAnimRef.current.stop();
        pulseAnimRef.current = null;
      }
      pulseAnim.setValue(1);
    }
  }, [isRecording]);

  useEffect(() => {
    const timer = setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 80);
    return () => clearTimeout(timer);
  }, [messages]);

  const pushMessage = (msg: Omit<ChatMessage, 'id'>): string => {
    const id = genId();
    setMessages(prev => [...prev, { ...msg, id }]);
    return id;
  };

  const replaceMessage = (id: string, update: Partial<ChatMessage>) => {
    setMessages(prev => prev.map(m => m.id === id ? { ...m, ...update } : m));
  };

  const sendToAI = async (text: string) => {
    if (!text.trim() || isThinking) return;

    pushMessage({ role: 'user', content: text, type: 'text' });
    const prevHistory = [...historyRef.current];
    historyRef.current.push({ role: 'user', content: text });

    setIsThinking(true);
    const loadingId = pushMessage({ role: 'assistant', content: '', type: 'text', isLoading: true });

    try {
      const apiUrl = getApiUrl();
      const url = new URL('/api/voice/chat', apiUrl).toString();

      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: prevHistory,
          currentMessage: text,
          patientContext,
        }),
      });

      if (!res.ok) throw new Error(`Chat failed (${res.status})`);
      const data = await res.json();
      const { reply, type, extracted, specialContent } = data;

      const fieldCount = extracted ? countFields(extracted) : 0;

      replaceMessage(loadingId, {
        content: reply || '',
        type: type || 'text',
        fieldCount,
        specialContent: specialContent || undefined,
        isLoading: false,
      });

      historyRef.current.push({ role: 'assistant', content: reply || '' });

      if (extracted && fieldCount > 0) {
        onDataExtracted(extracted);
      }
    } catch (err) {
      replaceMessage(loadingId, {
        content: 'Something went wrong. Please try again.',
        type: 'error',
        isLoading: false,
      });
    } finally {
      setIsThinking(false);
    }
  };

  const handleSend = () => {
    const text = inputText.trim();
    if (!text) return;
    setInputText('');
    sendToAI(text);
  };

  const startRecording = async () => {
    try {
      if (Platform.OS === 'web') {
        if (!navigator.mediaDevices?.getUserMedia) return;
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        webRecorderRef.current.stream = stream;
        webRecorderRef.current.audioChunks = [];
        const mimeType = MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm' : 'audio/mp4';
        const mr = new MediaRecorder(stream, { mimeType });
        mr.ondataavailable = (e) => {
          if (e.data.size > 0) webRecorderRef.current.audioChunks.push(e.data);
        };
        mr.onstop = () => {
          const blob = new Blob(webRecorderRef.current.audioChunks, { type: mimeType });
          webRecorderRef.current.stream?.getTracks().forEach(t => t.stop());
          transcribeAudio(blob, null);
        };
        webRecorderRef.current.mediaRecorder = mr;
        mr.start(100);
      } else {
        const perm = await Audio.requestPermissionsAsync();
        if (!perm.granted) return;
        await Audio.setAudioModeAsync({ allowsRecordingIOS: true, playsInSilentModeIOS: true });
        const { recording } = await Audio.Recording.createAsync(Audio.RecordingOptionsPresets.HIGH_QUALITY);
        nativeRecordingRef.current = recording;
      }
      setIsRecording(true);
    } catch (err) {
      console.error('[CaseChat] startRecording error:', err);
    }
  };

  const stopRecording = async () => {
    setIsRecording(false);
    try {
      if (Platform.OS === 'web') {
        const mr = webRecorderRef.current.mediaRecorder;
        if (mr && mr.state !== 'inactive') mr.stop();
      } else {
        const rec = nativeRecordingRef.current;
        if (!rec) return;
        await rec.stopAndUnloadAsync();
        await Audio.setAudioModeAsync({ allowsRecordingIOS: false });
        const uri = rec.getURI();
        nativeRecordingRef.current = null;
        if (uri) transcribeAudio(null, uri);
      }
    } catch (err) {
      console.error('[CaseChat] stopRecording error:', err);
    }
  };

  const transcribeAudio = async (blob: Blob | null, uri: string | null) => {
    setIsTranscribing(true);
    try {
      const formData = new FormData();
      if (Platform.OS === 'web' && blob) {
        const ext = blob.type.includes('webm') ? 'webm' : 'm4a';
        formData.append('audio', blob, `voice.${ext}`);
      } else if (uri) {
        const ext = uri.split('.').pop() || 'm4a';
        formData.append('audio', {
          uri,
          name: `voice.${ext}`,
          type: `audio/${ext === 'caf' ? 'x-caf' : ext === 'm4a' ? 'mp4' : ext}`,
        } as any);
      } else {
        return;
      }
      formData.append('mode', 'field');
      if (patientContext) formData.append('patientContext', JSON.stringify(patientContext));

      const apiUrl = getApiUrl();
      const res = await fetch(new URL('/api/voice/transcribe', apiUrl).toString(), {
        method: 'POST',
        body: formData,
      });
      if (!res.ok) throw new Error('Transcription failed');
      const data = await res.json();
      const text: string = data.transcript || '';
      if (text.trim()) sendToAI(text);
    } catch (err) {
      console.error('[CaseChat] transcribeAudio error:', err);
    } finally {
      setIsTranscribing(false);
    }
  };

  const handleMicPress = () => {
    if (disabled || isThinking || isTranscribing) return;
    if (isRecording) stopRecording();
    else startRecording();
  };

  const micDisabled = disabled || isThinking || isTranscribing;
  const micColor = isRecording ? '#ef4444' : '#7c3aed';

  return (
    <View style={[styles.container, { backgroundColor: theme.card, borderColor: theme.border }]}>
      <View style={[styles.header, { borderBottomColor: theme.border }]}>
        <View style={[styles.headerBadge, { backgroundColor: '#7c3aed' }]}>
          <Feather name="message-circle" size={13} color="#fff" />
          <Text style={styles.headerBadgeText}>AI Scribe</Text>
        </View>
        <Text style={[styles.headerHint, { color: theme.textSecondary }]}>
          Speak or type — fields fill automatically
        </Text>
      </View>

      <ScrollView
        ref={scrollRef}
        style={styles.messageList}
        contentContainerStyle={styles.messageListContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {messages.map(msg => (
          <MessageBubble key={msg.id} msg={msg} theme={theme} />
        ))}
      </ScrollView>

      <View style={[styles.inputBar, { borderTopColor: theme.border, backgroundColor: theme.background }]}>
        {isRecording || isTranscribing ? (
          <View style={styles.recordingStatus}>
            <View style={[styles.recordingDot, {
              backgroundColor: isRecording ? '#ef4444' : '#f59e0b',
            }]} />
            <Text style={[styles.recordingLabel, { color: theme.textSecondary }]}>
              {isRecording ? 'Recording… tap to stop' : 'Transcribing…'}
            </Text>
          </View>
        ) : (
          <TextInput
            style={[styles.textInput, {
              color: theme.text,
              backgroundColor: theme.backgroundSecondary,
              borderColor: theme.border,
            }]}
            value={inputText}
            onChangeText={setInputText}
            placeholder="Type or use mic…"
            placeholderTextColor={theme.textMuted}
            multiline
            maxLength={1500}
            editable={!disabled && !isThinking}
          />
        )}

        <Animated.View style={{ transform: [{ scale: pulseAnim }] }}>
          <Pressable
            onPress={handleMicPress}
            disabled={micDisabled}
            style={[styles.micBtn, { backgroundColor: micColor, opacity: micDisabled ? 0.45 : 1 }]}
          >
            <Feather name={isRecording ? 'square' : 'mic'} size={18} color="#fff" />
          </Pressable>
        </Animated.View>

        {inputText.trim().length > 0 && !isRecording ? (
          <Pressable
            onPress={handleSend}
            disabled={isThinking}
            style={[styles.sendBtn, { backgroundColor: '#7c3aed', opacity: isThinking ? 0.5 : 1 }]}
          >
            <Feather name="send" size={16} color="#fff" />
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 20,
  },
  headerBadgeText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  headerHint: {
    fontSize: 12,
    flex: 1,
  },
  messageList: {
    height: 320,
  },
  messageListContent: {
    padding: Spacing.md,
    gap: Spacing.sm,
    paddingBottom: Spacing.md,
  },
  bubbleRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 6,
    marginBottom: 2,
  },
  aiAvatar: {
    width: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 2,
  },
  bubble: {
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
  },
  userBubble: {
    borderBottomRightRadius: 4,
  },
  aiBubble: {
    borderWidth: StyleSheet.hairlineWidth,
    borderBottomLeftRadius: 4,
  },
  bubbleText: {
    fontSize: 14,
    lineHeight: 20,
  },
  fieldBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
    marginTop: 4,
    alignSelf: 'flex-start',
  },
  fieldBadgeText: {
    fontSize: 11,
    fontWeight: '600',
  },
  specialCard: {
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
  },
  specialCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: Spacing.sm,
  },
  specialCardTitle: {
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  specialCardContent: {
    fontSize: 13,
    lineHeight: 20,
  },
  inputBar: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  textInput: {
    flex: 1,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    paddingHorizontal: Spacing.md,
    paddingVertical: 9,
    fontSize: 14,
    maxHeight: 90,
    minHeight: 40,
  },
  recordingStatus: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 10,
  },
  recordingDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  recordingLabel: {
    fontSize: 13,
  },
  micBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
