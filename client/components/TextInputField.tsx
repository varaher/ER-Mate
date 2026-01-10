import React from "react";
import { View, Text, TextInput, StyleSheet, Pressable } from "react-native";
import { Feather } from "@expo/vector-icons";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, Typography, BorderRadius } from "@/constants/theme";

interface TextInputFieldProps {
  label: string;
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
  keyboardType?: "default" | "numeric" | "decimal-pad" | "number-pad";
  multiline?: boolean;
  numberOfLines?: number;
  showVoiceButton?: boolean;
  onVoicePress?: () => void;
  isRecording?: boolean;
  suffix?: string;
}

export function TextInputField({
  label,
  value,
  onChangeText,
  placeholder,
  keyboardType = "default",
  multiline = false,
  numberOfLines = 1,
  showVoiceButton = false,
  onVoicePress,
  isRecording = false,
  suffix,
}: TextInputFieldProps) {
  const { theme } = useTheme();

  return (
    <View style={styles.container}>
      <View style={styles.labelRow}>
        <Text style={[styles.label, { color: theme.textSecondary }]}>
          {label}
        </Text>
        {showVoiceButton && onVoicePress ? (
          <Pressable
            onPress={onVoicePress}
            style={[
              styles.voiceButton,
              {
                backgroundColor: isRecording ? theme.danger : theme.primaryLight,
              },
            ]}
          >
            <Feather
              name={isRecording ? "mic-off" : "mic"}
              size={14}
              color={isRecording ? "#FFFFFF" : theme.primary}
            />
          </Pressable>
        ) : null}
      </View>
      <View
        style={[
          styles.inputWrapper,
          {
            backgroundColor: theme.backgroundDefault,
            borderColor: theme.border,
            minHeight: multiline ? numberOfLines * 24 + 24 : Spacing.inputHeight,
          },
        ]}
      >
        <TextInput
          style={[
            styles.input,
            { color: theme.text },
            multiline && { textAlignVertical: "top", paddingTop: Spacing.sm },
          ]}
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={theme.textMuted}
          keyboardType={keyboardType}
          multiline={multiline}
          numberOfLines={numberOfLines}
        />
        {suffix ? (
          <Text style={[styles.suffix, { color: theme.textMuted }]}>
            {suffix}
          </Text>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: Spacing.md,
  },
  labelRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: Spacing.xs,
  },
  label: {
    ...Typography.label,
  },
  voiceButton: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  inputWrapper: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.md,
    borderWidth: 1,
    borderRadius: BorderRadius.md,
  },
  input: {
    flex: 1,
    ...Typography.body,
    paddingVertical: Spacing.sm,
  },
  suffix: {
    ...Typography.body,
    marginLeft: Spacing.xs,
  },
});
