import React from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import { Feather } from "@expo/vector-icons";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, Typography, BorderRadius } from "@/constants/theme";

interface CheckboxOption {
  label: string;
  value: string;
}

interface CheckboxGroupProps {
  label: string;
  options: CheckboxOption[];
  selectedValues: string[];
  onChange: (values: string[]) => void;
  columns?: number;
}

export function CheckboxGroup({
  label,
  options,
  selectedValues,
  onChange,
  columns = 3,
}: CheckboxGroupProps) {
  const { theme } = useTheme();

  const toggleValue = (value: string) => {
    if (selectedValues.includes(value)) {
      onChange(selectedValues.filter((v) => v !== value));
    } else {
      onChange([...selectedValues, value]);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={[styles.label, { color: theme.textSecondary }]}>{label}</Text>
      <View style={[styles.grid, { gap: Spacing.sm }]}>
        {options.map((option) => {
          const isSelected = selectedValues.includes(option.value);
          return (
            <Pressable
              key={option.value}
              style={({ pressed }) => [
                styles.checkboxItem,
                {
                  backgroundColor: isSelected
                    ? theme.primaryLight
                    : theme.backgroundDefault,
                  borderColor: isSelected ? theme.primary : theme.border,
                  opacity: pressed ? 0.8 : 1,
                  width: `${100 / columns - 2}%`,
                },
              ]}
              onPress={() => toggleValue(option.value)}
            >
              <View
                style={[
                  styles.checkbox,
                  {
                    backgroundColor: isSelected ? theme.primary : "transparent",
                    borderColor: isSelected ? theme.primary : theme.textMuted,
                  },
                ]}
              >
                {isSelected ? (
                  <Feather name="check" size={12} color="#FFFFFF" />
                ) : null}
              </View>
              <Text
                style={[
                  styles.checkboxLabel,
                  { color: isSelected ? theme.primary : theme.text },
                ]}
                numberOfLines={1}
              >
                {option.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: Spacing.md,
  },
  label: {
    ...Typography.label,
    marginBottom: Spacing.sm,
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
  },
  checkboxItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.sm,
    borderWidth: 1,
    borderRadius: BorderRadius.sm,
    gap: Spacing.xs,
  },
  checkbox: {
    width: 18,
    height: 18,
    borderRadius: 4,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
  },
  checkboxLabel: {
    ...Typography.small,
    flex: 1,
  },
});
