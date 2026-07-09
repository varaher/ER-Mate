import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
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

const PDFJS_URL        = 'https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.min.js';
const PDFJS_WORKER_URL = 'https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.worker.min.js';

function buildPdfJsHtml(pdfBase64: string, isDark: boolean): string {
  const bg           = isDark ? '#1e293b' : '#f1f5f9';
  const textColor    = isDark ? '#94a3b8' : '#64748b';
  const spinnerBorder = isDark ? '#334155' : '#e2e8f0';

  return `<!DOCTYPE html>
<html>
<head>
  <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=3">
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { background: ${bg}; font-family: -apple-system, sans-serif; }
    #spinner {
      display: flex; flex-direction: column; align-items: center;
      justify-content: center; height: 100vh; gap: 14px;
      color: ${textColor}; font-size: 14px;
    }
    .spin {
      width: 36px; height: 36px; border-radius: 50%;
      border: 3px solid ${spinnerBorder};
      border-top-color: #3b82f6;
      animation: spin 0.8s linear infinite;
    }
    @keyframes spin { to { transform: rotate(360deg); } }
    #error-msg {
      display: none; flex-direction: column; align-items: center;
      justify-content: center; height: 100vh; gap: 10px; padding: 32px;
      text-align: center; color: ${textColor}; font-size: 14px;
    }
    #container { padding: 8px; }
    canvas {
      display: block; width: 100%; margin-bottom: 8px;
      box-shadow: 0 2px 8px rgba(0,0,0,0.18);
    }
  </style>
</head>
<body>
  <div id="spinner"><div class="spin"></div><span>Loading PDF...</span></div>
  <div id="error-msg"><p>Could not render this PDF.<br>Use Share or Open below.</p></div>
  <div id="container"></div>
  <script src="${PDFJS_URL}"></script>
  <script>
    (function () {
      function showError() {
        document.getElementById('spinner').style.display = 'none';
        document.getElementById('error-msg').style.display = 'flex';
      }
      try {
        if (typeof pdfjsLib === 'undefined') { showError(); return; }
        pdfjsLib.GlobalWorkerOptions.workerSrc = '${PDFJS_WORKER_URL}';
        var base64 = '${pdfBase64}';
        var binary = atob(base64);
        var bytes = new Uint8Array(binary.length);
        for (var i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
        pdfjsLib.getDocument({ data: bytes }).promise.then(function (pdf) {
          document.getElementById('spinner').style.display = 'none';
          var container = document.getElementById('container');
          var deviceWidth = window.innerWidth - 16;
          var total = pdf.numPages;
          function renderPage(num) {
            pdf.getPage(num).then(function (page) {
              var vp0 = page.getViewport({ scale: 1 });
              var scale = deviceWidth / vp0.width;
              var viewport = page.getViewport({ scale: scale });
              var canvas = document.createElement('canvas');
              canvas.width = viewport.width;
              canvas.height = viewport.height;
              container.appendChild(canvas);
              page.render({ canvasContext: canvas.getContext('2d'), viewport: viewport });
            }).catch(showError);
          }
          for (var p = 1; p <= total; p++) renderPage(p);
        }).catch(showError);
      } catch (e) { showError(); }
    })();
  </script>
</body>
</html>`;
}

export default function PdfPreviewScreen({ route, navigation }: Props) {
  const { fileUri, filename, patientName } = route.params;
  const { theme, isDark } = useTheme();
  const insets = useSafeAreaInsets();

  const [sharing, setSharing] = useState(false);
  const [printing, setPrinting] = useState(false);
  const [webViewLoading, setWebViewLoading] = useState(true);
  const [webViewError, setWebViewError] = useState(false);

  const [androidHtml, setAndroidHtml] = useState<string | null>(null);
  const [androidLoadError, setAndroidLoadError] = useState(false);

  const isMounted = useRef(true);
  useEffect(() => { return () => { isMounted.current = false; }; }, []);

  useEffect(() => {
    if (Platform.OS !== 'android') return;
    (async () => {
      try {
        const pdfBase64 = await FileSystem.readAsStringAsync(fileUri, {
          encoding: FileSystem.EncodingType.Base64,
        });
        if (!isMounted.current) return;
        setAndroidHtml(buildPdfJsHtml(pdfBase64, isDark));
      } catch {
        if (isMounted.current) setAndroidLoadError(true);
      }
    })();
  }, [fileUri, isDark]);

  const handleShare = useCallback(async () => {
    if (sharing) return;
    setSharing(true);
    try {
      const available = await Sharing.isAvailableAsync();
      if (available) {
        await Sharing.shareAsync(fileUri, {
          mimeType: 'application/pdf',
          dialogTitle: 'Share PDF',
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
      Alert.alert('Open failed', e?.message || 'Please try again.');
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
    if (androidLoadError) {
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

    if (androidHtml === null) {
      return (
        <View style={[styles.root, { backgroundColor: theme.backgroundDefault }]}>
          <View style={styles.centeredFill}>
            <ActivityIndicator size="large" color={theme.primary} />
            <Text style={[styles.loadingText, { color: theme.textSecondary, marginTop: 12 }]}>
              Loading PDF...
            </Text>
          </View>
          {actionBar}
        </View>
      );
    }

    return (
      <View style={[styles.root, { backgroundColor: isDark ? '#1e293b' : '#f1f5f9' }]}>
        <View style={styles.webViewContainer}>
          <WebView
            source={{ html: androidHtml, baseUrl: 'https://cdn.jsdelivr.net' }}
            style={styles.webview}
            originWhitelist={['*']}
            javaScriptEnabled
            domStorageEnabled
            mixedContentMode="always"
            scalesPageToFit={false}
            onLoadStart={() => setWebViewLoading(true)}
            onLoad={() => setWebViewLoading(false)}
            onError={() => setWebViewLoading(false)}
          />
          {webViewLoading && (
            <View style={[styles.webViewOverlay, { backgroundColor: isDark ? '#1e293b' : '#f1f5f9' }]}>
              <ActivityIndicator size="large" color={theme.primary} />
              <Text style={[styles.loadingText, { color: theme.textSecondary }]}>
                Loading preview...
              </Text>
            </View>
          )}
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
  centeredFill: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
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
