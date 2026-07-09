import React, { useCallback, useLayoutEffect, useState } from 'react';
import {
  View, Text, StyleSheet, ActivityIndicator,
  Pressable, Platform, Alert,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { WebView } from 'react-native-webview';
import { Feather } from '@expo/vector-icons';
import * as Sharing from 'expo-sharing';
import * as Print from 'expo-print';
import * as IntentLauncher from 'expo-intent-launcher';
import * as FileSystem from 'expo-file-system/legacy';

import { RootStackParamList } from '@/navigation/RootStackNavigator';
import { useTheme } from '@/hooks/useTheme';

type Props = NativeStackScreenProps<RootStackParamList, 'PdfPreview'>;

export default function PdfPreviewScreen({ route, navigation }: Props) {
  const { fileUri, filename, patientName } = route.params;
  const { theme, isDark } = useTheme();
  const insets = useSafeAreaInsets();

  const [sharing, setSharing] = useState(false);
  const [printing, setPrinting] = useState(false);
  const [webViewLoading, setWebViewLoading] = useState(true);
  const [webViewError, setWebViewError] = useState(false);

  const handleShare = useCallback(async () => {
    if (sharing) return;
    setSharing(true);
    try {
      const available = await Sharing.isAvailableAsync();
      if (available) {
        await Sharing.shareAsync(fileUri, {
          mimeType: 'application/pdf',
          dialogTitle: 'Share Handover PDF',
          UTI: 'com.adobe.pdf',
        });
      } else {
        Alert.alert('Not available', 'Sharing is not supported on this device.');
      }
    } catch (e: any) {
      Alert.alert('Share failed', e?.message || 'Please try again.');
    } finally {
      setSharing(false);
    }
  }, [fileUri, sharing]);

  const handlePrint = useCallback(async () => {
    if (printing) return;
    setPrinting(true);
    try {
      if (Platform.OS === 'android') {
        try {
          const contentUri = await FileSystem.getContentUriAsync(fileUri);
          await IntentLauncher.startActivityAsync('android.intent.action.VIEW', {
            data: contentUri,
            flags: 1,
            type: 'application/pdf',
          });
        } catch {
          await Print.printAsync({ uri: fileUri });
        }
      } else {
        await Print.printAsync({ uri: fileUri });
      }
    } catch (e: any) {
      Alert.alert('Print failed', e?.message || 'Please try again.');
    } finally {
      setPrinting(false);
    }
  }, [fileUri, printing]);

  useLayoutEffect(() => {
    navigation.setOptions({
      headerTitle: patientName ? `${patientName} — Handover` : 'Handover PDF',
    });
  }, [navigation, patientName]);

  const actionBar = (
    <View style={[
      styles.actionBar,
      {
        borderTopColor: theme.border,
        backgroundColor: theme.backgroundDefault,
        paddingBottom: insets.bottom + 8,
      },
    ]}>
      <Pressable
        style={[styles.actionBtn, { backgroundColor: theme.primary }, printing && styles.btnDisabled]}
        onPress={handlePrint}
        disabled={printing}
        accessibilityLabel={Platform.OS === 'android' ? 'Open in PDF viewer' : 'Print PDF'}
      >
        {printing
          ? <ActivityIndicator size="small" color="#fff" />
          : <Feather name={Platform.OS === 'android' ? 'external-link' : 'printer'} size={18} color="#fff" />
        }
        <Text style={styles.actionBtnText}>
          {Platform.OS === 'android' ? 'Open' : 'Print'}
        </Text>
      </Pressable>

      <Pressable
        style={[styles.actionBtn, styles.shareBtn, sharing && styles.btnDisabled]}
        onPress={handleShare}
        disabled={sharing}
        accessibilityLabel="Share PDF"
      >
        {sharing
          ? <ActivityIndicator size="small" color="#fff" />
          : <Feather name="share-2" size={18} color="#fff" />
        }
        <Text style={styles.actionBtnText}>Share</Text>
      </Pressable>
    </View>
  );

  if (Platform.OS === 'android') {
    return (
      <View style={[styles.root, { backgroundColor: theme.backgroundDefault }]}>
        <View style={[styles.androidCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
          <View style={[styles.pdfIconWrap, { backgroundColor: theme.primaryLight }]}>
            <Feather name="file-text" size={40} color={theme.primary} />
          </View>
          <Text style={[styles.androidTitle, { color: theme.text }]}>
            {patientName ? `${patientName} — Handover PDF` : filename}
          </Text>
          <Text style={[styles.androidSub, { color: theme.textSecondary }]}>
            PDF ready. Tap "Open" to view in your device's PDF reader, or "Share" to send it.
          </Text>
        </View>
        {actionBar}
      </View>
    );
  }

  return (
    <View style={[styles.root, { backgroundColor: isDark ? '#1e293b' : '#f1f5f9' }]}>
      <View style={styles.webViewContainer}>
        {webViewLoading && !webViewError && (
          <View style={styles.webViewOverlay}>
            <ActivityIndicator size="large" color={theme.primary} />
            <Text style={[styles.loadingText, { color: theme.textSecondary }]}>
              Loading preview...
            </Text>
          </View>
        )}
        {webViewError ? (
          <View style={styles.webViewOverlay}>
            <Feather name="alert-circle" size={48} color={theme.danger ?? '#dc2626'} />
            <Text style={[styles.errorText, { color: theme.text }]}>
              Could not render preview.
            </Text>
            <Text style={[styles.errorSub, { color: theme.textSecondary }]}>
              Use the Share or Print buttons below.
            </Text>
          </View>
        ) : (
          <WebView
            source={{ uri: fileUri }}
            style={styles.webview}
            originWhitelist={['file://*', 'blob:*', 'http://*', 'https://*']}
            allowFileAccess
            allowUniversalAccessFromFileURLs
            allowFileAccessFromFileURLs
            onLoadStart={() => { setWebViewLoading(true); setWebViewError(false); }}
            onLoad={() => setWebViewLoading(false)}
            onError={() => { setWebViewLoading(false); setWebViewError(true); }}
          />
        )}
      </View>
      {actionBar}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  webViewContainer: {
    flex: 1,
    position: 'relative',
  },
  webview: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  webViewOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
  },
  loadingText: {
    fontSize: 14,
  },
  errorText: {
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
  },
  errorSub: {
    fontSize: 13,
    textAlign: 'center',
    paddingHorizontal: 32,
  },
  androidCard: {
    flex: 1,
    margin: 24,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
    padding: 32,
  },
  pdfIconWrap: {
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  androidTitle: {
    fontSize: 17,
    fontWeight: '700',
    textAlign: 'center',
  },
  androidSub: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
  },
  actionBar: {
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 20,
    paddingTop: 14,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  actionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: 12,
  },
  shareBtn: {
    backgroundColor: '#334155',
  },
  btnDisabled: {
    opacity: 0.55,
  },
  actionBtnText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '700',
  },
});
