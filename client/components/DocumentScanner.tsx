import React, { useState, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  ActivityIndicator,
  Image,
  Alert,
  Platform,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { useTheme } from "@/hooks/useTheme";
import * as ImagePicker from "expo-image-picker";
import { getApiUrl } from "@/lib/query-client";

interface ExtractedData {
  chiefComplaint?: string;
  hpiNotes?: string;
  allergies?: string;
  pastMedicalHistory?: string;
  medications?: string;
  vitals?: {
    hr?: string;
    bp?: string;
    rr?: string;
    spo2?: string;
    temp?: string;
    grbs?: string;
  };
  abgValues?: {
    ph?: string;
    pco2?: string;
    po2?: string;
    hco3?: string;
    be?: string;
    lactate?: string;
    sao2?: string;
    fio2?: string;
    na?: string;
    k?: string;
    cl?: string;
    anionGap?: string;
    glucose?: string;
    hb?: string;
  };
  labResults?: string;
  imagingResults?: string;
  diagnosis?: string;
  treatmentNotes?: string;
  generalNotes?: string;
}

interface DocumentScannerProps {
  onDataExtracted: (data: ExtractedData) => void;
  context?: {
    patientAge?: number;
    patientSex?: string;
    presentingComplaint?: string;
  };
  userId?: string;
}

export function DocumentScanner({ onDataExtracted, context, userId }: DocumentScannerProps) {
  const { theme } = useTheme();
  const [showModal, setShowModal] = useState(false);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  const openScanner = useCallback(() => {
    setShowModal(true);
    setCapturedImage(null);
  }, []);

  const closeModal = useCallback(() => {
    setShowModal(false);
    setCapturedImage(null);
  }, []);

  const onDataExtractedRef = React.useRef(onDataExtracted);
  onDataExtractedRef.current = onDataExtracted;

  const processImage = useCallback(async (imageUri: string, assetMimeType?: string) => {
    setIsProcessing(true);
    try {
      const apiUrl = getApiUrl();
      const scanUrl = new URL("/api/scan/document", apiUrl).toString();
      const formData = new FormData();

      if (Platform.OS === "web") {
        const resp = await fetch(imageUri);
        const blob = await resp.blob();
        formData.append("document", blob, "scan.jpg");
      } else {
        const mimeType = assetMimeType || "image/jpeg";
        const ext = mimeType === "image/png" ? "png" : "jpg";
        formData.append("document", {
          uri: imageUri,
          name: `scan.${ext}`,
          type: mimeType,
        } as any);
      }

      if (context) {
        formData.append("patientContext", JSON.stringify({
          age: context.patientAge,
          sex: context.patientSex,
          chiefComplaint: context.presentingComplaint,
        }));
      }
      if (userId) formData.append("userId", userId);
      formData.append("mode", "clinical");

      const response = await fetch(scanUrl, {
        method: "POST",
        body: formData,
      });

      const responseText = await response.text();
      let data: any;
      try {
        data = JSON.parse(responseText);
      } catch {
        console.error("Non-JSON response:", responseText.substring(0, 200));
        Alert.alert("Scan Failed", "Server returned an unexpected response. Please try again.");
        return;
      }

      if (response.status === 402) {
        Alert.alert("No AI Credits", data?.error || "No AI credits remaining. Upgrade to Pro for unlimited access.");
        return;
      }
      if (!response.ok) {
        Alert.alert("Scan Failed", data?.error || "Could not extract data from image. Please try again.");
        return;
      }

      if (data.structured) {
        const mapped: ExtractedData = {
          chiefComplaint: data.structured.chiefComplaint,
          hpiNotes: data.structured.historyOfPresentIllness,
          allergies: data.structured.allergies,
          pastMedicalHistory: data.structured.pastMedicalHistory,
          medications: data.structured.medications,
          vitals: data.structured.vitalsSuggested ? {
            hr: data.structured.vitalsSuggested.hr,
            bp: data.structured.vitalsSuggested.bp,
            rr: data.structured.vitalsSuggested.rr,
            spo2: data.structured.vitalsSuggested.spo2,
            temp: data.structured.vitalsSuggested.temperature,
            grbs: data.structured.vitalsSuggested.grbs,
          } : undefined,
          labResults: data.structured.assessmentPlan,
          diagnosis: data.structured.diagnosis?.join(", "),
          treatmentNotes: data.structured.treatmentNotes,
          generalNotes: data.text ? `[Scanned Document] ${data.text.substring(0, 500)}` : undefined,
        };
        setIsProcessing(false);
        setShowModal(false);
        setCapturedImage(null);
        try {
          onDataExtractedRef.current(mapped);
        } catch (applyErr) {
          console.error("Error applying scan data:", applyErr);
        }
        return;
      } else if (data.text) {
        setIsProcessing(false);
        setShowModal(false);
        setCapturedImage(null);
        try {
          onDataExtractedRef.current({ generalNotes: data.text });
        } catch (applyErr) {
          console.error("Error applying scan data:", applyErr);
        }
        return;
      } else {
        Alert.alert("No Data Found", data.message || "Could not extract data from this document.");
      }
    } catch (error: any) {
      console.error("Error processing image:", error?.message || error);
      Alert.alert("Scan Error", "Failed to process image. Please check your connection and try again.");
    } finally {
      setIsProcessing(false);
    }
  }, [context]);

  const pickImage = useCallback(async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        quality: 0.5,
      });

      if (!result.canceled && result.assets[0]) {
        const asset = result.assets[0];
        setCapturedImage(asset.uri);
        processImage(asset.uri, asset.mimeType || undefined);
      }
    } catch (error) {
      console.error("Error picking image:", error);
      Alert.alert("Error", "Failed to select image");
    }
  }, [processImage]);

  const openCamera = useCallback(async () => {
    try {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== "granted") {
        Alert.alert(
          "Camera Permission Required",
          "Please enable camera access in your device settings to scan documents."
        );
        return;
      }
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        quality: 0.5,
      });
      if (!result.canceled && result.assets[0]) {
        const asset = result.assets[0];
        setCapturedImage(asset.uri);
        processImage(asset.uri, asset.mimeType || undefined);
      }
    } catch (error) {
      console.error("Error opening camera:", error);
      Alert.alert("Error", "Failed to open camera. Please try choosing from gallery instead.");
    }
  }, [processImage]);

  const retryCapture = useCallback(() => {
    setCapturedImage(null);
  }, []);

  return (
    <>
      <TouchableOpacity
        style={[styles.scanButton, { backgroundColor: theme.primary }]}
        onPress={openScanner}
      >
        <Feather name="camera" size={18} color="#fff" />
        <Text style={styles.scanButtonText}>Scan Document</Text>
      </TouchableOpacity>

      <Modal
        visible={showModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={closeModal}
      >
        <View style={[styles.modalContainer, { backgroundColor: theme.backgroundDefault }]}>
          <View style={[styles.modalHeader, { borderBottomColor: theme.border }]}>
            <TouchableOpacity onPress={closeModal} style={styles.closeButton}>
              <Feather name="x" size={24} color={theme.text} />
            </TouchableOpacity>
            <Text style={[styles.modalTitle, { color: theme.text }]}>
              Document Scanner
            </Text>
            <View style={styles.closeButton} />
          </View>

          {capturedImage ? (
            <View style={styles.previewContainer}>
              <Image source={{ uri: capturedImage }} style={styles.previewImage} />
              
              {isProcessing ? (
                <View style={[styles.processingContainer, { backgroundColor: theme.backgroundSecondary }]}>
                  <ActivityIndicator size="large" color={theme.primary} />
                  <Text style={[styles.processingText, { color: theme.text }]}>
                    Scanning document...
                  </Text>
                </View>
              ) : (
                <View style={styles.actionButtons}>
                  <TouchableOpacity
                    style={[styles.actionButton, { backgroundColor: theme.backgroundSecondary }]}
                    onPress={retryCapture}
                  >
                    <Feather name="refresh-cw" size={18} color={theme.text} />
                    <Text style={[styles.actionButtonText, { color: theme.text }]}>Retake</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          ) : (
            <View style={styles.optionsContainer}>
              <Text style={[styles.instructionText, { color: theme.textMuted }]}>
                Capture or upload a clinical document (lab report, referral note, prescription, etc.) 
                and AI will extract relevant data to auto-populate fields.
              </Text>
              
              <TouchableOpacity
                style={[styles.optionButton, { backgroundColor: theme.primary }]}
                onPress={openCamera}
              >
                <Feather name="camera" size={24} color="#fff" />
                <Text style={styles.optionButtonText}>Take Photo</Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={[styles.optionButton, { backgroundColor: theme.backgroundSecondary, borderColor: theme.border, borderWidth: 1 }]}
                onPress={pickImage}
              >
                <Feather name="image" size={24} color={theme.text} />
                <Text style={[styles.optionButtonTextSecondary, { color: theme.text }]}>
                  Choose from Gallery
                </Text>
              </TouchableOpacity>
              
              <View style={[styles.tipBox, { backgroundColor: theme.backgroundSecondary }]}>
                <Feather name="info" size={16} color={theme.primary} />
                <Text style={[styles.tipText, { color: theme.textMuted }]}>
                  Supported: Lab reports, ABG results, referral letters, prescriptions, 
                  handwritten notes, discharge summaries
                </Text>
              </View>
            </View>
          )}
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  scanButton: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 8,
    gap: 6,
  },
  scanButtonText: {
    color: "#fff",
    fontSize: 13,
    fontWeight: "600",
  },
  modalContainer: {
    flex: 1,
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: "600",
  },
  closeButton: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  optionsContainer: {
    flex: 1,
    padding: 24,
    alignItems: "center",
    justifyContent: "center",
    gap: 16,
  },
  instructionText: {
    fontSize: 15,
    textAlign: "center",
    lineHeight: 22,
    marginBottom: 24,
    paddingHorizontal: 20,
  },
  optionButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    width: "100%",
    paddingVertical: 16,
    borderRadius: 12,
    gap: 12,
  },
  optionButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
  optionButtonTextSecondary: {
    fontSize: 16,
    fontWeight: "600",
  },
  tipBox: {
    flexDirection: "row",
    alignItems: "flex-start",
    padding: 16,
    borderRadius: 12,
    gap: 12,
    marginTop: 24,
  },
  tipText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 18,
  },
  previewContainer: {
    flex: 1,
  },
  previewImage: {
    width: "100%",
    height: 200,
    resizeMode: "cover",
  },
  processingContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
    gap: 16,
  },
  processingText: {
    fontSize: 16,
    fontWeight: "500",
  },
  actionButtons: {
    flexDirection: "row",
    padding: 16,
    gap: 12,
  },
  actionButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 14,
    borderRadius: 10,
    gap: 8,
  },
  actionButtonText: {
    fontSize: 15,
    fontWeight: "600",
  },
});
