import React, { useState, useCallback, useRef } from "react";
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
  ScrollView,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { useTheme } from "@/hooks/useTheme";
import * as ImagePicker from "expo-image-picker";
// @ts-ignore - expo-camera types may not be fully available
import { CameraView, useCameraPermissions } from "expo-camera";
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
}

export function DocumentScanner({ onDataExtracted, context }: DocumentScannerProps) {
  const { theme } = useTheme();
  const [showModal, setShowModal] = useState(false);
  const [showCamera, setShowCamera] = useState(false);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [extractedData, setExtractedData] = useState<ExtractedData | null>(null);
  const [permission, requestPermission] = useCameraPermissions();
  const cameraRef = useRef<CameraView>(null);

  const openScanner = useCallback(() => {
    setShowModal(true);
    setCapturedImage(null);
    setExtractedData(null);
  }, []);

  const closeModal = useCallback(() => {
    setShowModal(false);
    setShowCamera(false);
    setCapturedImage(null);
    setExtractedData(null);
  }, []);

  const takePicture = useCallback(async () => {
    if (cameraRef.current) {
      try {
        const photo = await cameraRef.current.takePictureAsync({
          quality: 0.8,
          base64: true,
        });
        if (photo) {
          setCapturedImage(photo.uri);
          setShowCamera(false);
          processImage(photo.base64 || "");
        }
      } catch (error) {
        console.error("Error taking picture:", error);
        Alert.alert("Error", "Failed to capture image");
      }
    }
  }, []);

  const pickImage = useCallback(async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        quality: 0.8,
        base64: true,
      });

      if (!result.canceled && result.assets[0]) {
        setCapturedImage(result.assets[0].uri);
        processImage(result.assets[0].base64 || "");
      }
    } catch (error) {
      console.error("Error picking image:", error);
      Alert.alert("Error", "Failed to select image");
    }
  }, []);

  const openCamera = useCallback(async () => {
    if (!permission?.granted) {
      const result = await requestPermission();
      if (!result.granted) {
        Alert.alert(
          "Camera Permission Required",
          "Please enable camera access in your device settings to scan documents."
        );
        return;
      }
    }
    setShowCamera(true);
  }, [permission, requestPermission]);

  const processImage = useCallback(async (base64Data: string) => {
    setIsProcessing(true);
    try {
      const apiUrl = getApiUrl();
      const response = await fetch(`${apiUrl}api/ai/extract-from-image`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          imageBase64: base64Data,
          patientContext: context,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        setExtractedData(data.extractedData);
      } else {
        const errorData = await response.json();
        Alert.alert("Extraction Failed", errorData.error || "Could not extract data from image");
      }
    } catch (error) {
      console.error("Error processing image:", error);
      Alert.alert("Error", "Failed to process image. Please try again.");
    } finally {
      setIsProcessing(false);
    }
  }, [context]);

  const applyExtractedData = useCallback(() => {
    if (extractedData) {
      onDataExtracted(extractedData);
      closeModal();
      Alert.alert("Success", "Data has been populated into the relevant fields.");
    }
  }, [extractedData, onDataExtracted, closeModal]);

  const retryCapture = useCallback(() => {
    setCapturedImage(null);
    setExtractedData(null);
  }, []);

  const renderExtractedDataPreview = () => {
    if (!extractedData) return null;

    const dataItems: { label: string; value: string }[] = [];
    
    if (extractedData.chiefComplaint) {
      dataItems.push({ label: "Chief Complaint", value: extractedData.chiefComplaint });
    }
    if (extractedData.hpiNotes) {
      dataItems.push({ label: "HPI Notes", value: extractedData.hpiNotes });
    }
    if (extractedData.vitals) {
      const vitalsStr = Object.entries(extractedData.vitals)
        .filter(([_, v]) => v)
        .map(([k, v]) => `${k.toUpperCase()}: ${v}`)
        .join(", ");
      if (vitalsStr) dataItems.push({ label: "Vitals", value: vitalsStr });
    }
    if (extractedData.abgValues) {
      const abgStr = Object.entries(extractedData.abgValues)
        .filter(([_, v]) => v)
        .map(([k, v]) => `${k}: ${v}`)
        .join(", ");
      if (abgStr) dataItems.push({ label: "ABG Values", value: abgStr });
    }
    if (extractedData.allergies) {
      dataItems.push({ label: "Allergies", value: extractedData.allergies });
    }
    if (extractedData.pastMedicalHistory) {
      dataItems.push({ label: "Past Medical History", value: extractedData.pastMedicalHistory });
    }
    if (extractedData.medications) {
      dataItems.push({ label: "Medications", value: extractedData.medications });
    }
    if (extractedData.labResults) {
      dataItems.push({ label: "Lab Results", value: extractedData.labResults });
    }
    if (extractedData.imagingResults) {
      dataItems.push({ label: "Imaging Results", value: extractedData.imagingResults });
    }
    if (extractedData.diagnosis) {
      dataItems.push({ label: "Diagnosis", value: extractedData.diagnosis });
    }
    if (extractedData.treatmentNotes) {
      dataItems.push({ label: "Treatment Notes", value: extractedData.treatmentNotes });
    }
    if (extractedData.generalNotes) {
      dataItems.push({ label: "General Notes", value: extractedData.generalNotes });
    }

    if (dataItems.length === 0) {
      return (
        <View style={[styles.noDataContainer, { backgroundColor: theme.backgroundSecondary }]}>
          <Feather name="alert-circle" size={24} color={theme.textMuted} />
          <Text style={[styles.noDataText, { color: theme.textMuted }]}>
            No clinical data could be extracted from this image.
          </Text>
        </View>
      );
    }

    return (
      <ScrollView style={styles.extractedDataContainer}>
        <Text style={[styles.extractedTitle, { color: theme.text }]}>
          Extracted Data Preview
        </Text>
        {dataItems.map((item, index) => (
          <View key={index} style={[styles.dataItem, { borderBottomColor: theme.border }]}>
            <Text style={[styles.dataLabel, { color: theme.primary }]}>{item.label}</Text>
            <Text style={[styles.dataValue, { color: theme.text }]} numberOfLines={3}>
              {item.value}
            </Text>
          </View>
        ))}
      </ScrollView>
    );
  };

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

          {showCamera ? (
            <View style={styles.cameraContainer}>
              <CameraView
                ref={cameraRef}
                style={styles.camera}
                facing="back"
              >
                <View style={styles.cameraOverlay}>
                  <View style={styles.scanFrame} />
                </View>
              </CameraView>
              <View style={[styles.cameraControls, { backgroundColor: theme.backgroundDefault }]}>
                <TouchableOpacity
                  style={styles.cancelCameraButton}
                  onPress={() => setShowCamera(false)}
                >
                  <Text style={[styles.cancelCameraText, { color: theme.text }]}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.captureButton, { backgroundColor: theme.primary }]}
                  onPress={takePicture}
                >
                  <View style={styles.captureButtonInner} />
                </TouchableOpacity>
                <View style={styles.cancelCameraButton} />
              </View>
            </View>
          ) : capturedImage ? (
            <View style={styles.previewContainer}>
              <Image source={{ uri: capturedImage }} style={styles.previewImage} />
              
              {isProcessing ? (
                <View style={[styles.processingContainer, { backgroundColor: theme.backgroundSecondary }]}>
                  <ActivityIndicator size="large" color={theme.primary} />
                  <Text style={[styles.processingText, { color: theme.text }]}>
                    Analyzing document with AI...
                  </Text>
                </View>
              ) : extractedData ? (
                <>
                  {renderExtractedDataPreview()}
                  <View style={styles.actionButtons}>
                    <TouchableOpacity
                      style={[styles.actionButton, { backgroundColor: theme.backgroundSecondary }]}
                      onPress={retryCapture}
                    >
                      <Feather name="refresh-cw" size={18} color={theme.text} />
                      <Text style={[styles.actionButtonText, { color: theme.text }]}>Retake</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.actionButton, styles.applyButton, { backgroundColor: theme.primary }]}
                      onPress={applyExtractedData}
                    >
                      <Feather name="check" size={18} color="#fff" />
                      <Text style={styles.applyButtonText}>Apply Data</Text>
                    </TouchableOpacity>
                  </View>
                </>
              ) : null}
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
    justifyContent: "center",
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    gap: 8,
  },
  scanButtonText: {
    color: "#fff",
    fontSize: 14,
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
  cameraContainer: {
    flex: 1,
  },
  camera: {
    flex: 1,
  },
  cameraOverlay: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  scanFrame: {
    width: "85%",
    aspectRatio: 0.7,
    borderWidth: 2,
    borderColor: "rgba(255, 255, 255, 0.6)",
    borderRadius: 12,
  },
  cameraControls: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 20,
    paddingHorizontal: 40,
  },
  cancelCameraButton: {
    width: 80,
    alignItems: "center",
  },
  cancelCameraText: {
    fontSize: 16,
  },
  captureButton: {
    width: 70,
    height: 70,
    borderRadius: 35,
    alignItems: "center",
    justifyContent: "center",
  },
  captureButtonInner: {
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: "#fff",
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
  extractedDataContainer: {
    flex: 1,
    padding: 16,
  },
  extractedTitle: {
    fontSize: 17,
    fontWeight: "600",
    marginBottom: 16,
  },
  dataItem: {
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  dataLabel: {
    fontSize: 12,
    fontWeight: "600",
    marginBottom: 4,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  dataValue: {
    fontSize: 14,
    lineHeight: 20,
  },
  noDataContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 40,
    margin: 16,
    borderRadius: 12,
    gap: 12,
  },
  noDataText: {
    fontSize: 14,
    textAlign: "center",
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
  applyButton: {},
  applyButtonText: {
    color: "#fff",
    fontSize: 15,
    fontWeight: "600",
  },
});
