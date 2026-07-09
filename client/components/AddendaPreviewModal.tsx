import React from 'react';
import { View, Text, Modal, Pressable, ScrollView, StyleSheet } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useTheme } from '@/hooks/useTheme';
import { Spacing, BorderRadius, Typography } from '@/constants/theme';
import {
  CaseAddendum,
  ADDENDUM_LABELS,
  ADDENDUM_COLORS,
  ADDENDUM_ICONS,
} from './CaseChat';

function fmtTime(iso: string): string {
  try {
    const d = new Date(iso);
    const date = d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
    const time = d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });
    return `${date} · ${time}`;
  } catch {
    return iso;
  }
}

interface AddendaPreviewModalProps {
  visible: boolean;
  addenda: CaseAddendum[];
  onConfirm: () => void;
  onCancel: () => void;
  confirmLabel?: string;
}

export default function AddendaPreviewModal({
  visible,
  addenda,
  onConfirm,
  onCancel,
  confirmLabel = 'Generate Narrative',
}: AddendaPreviewModalProps) {
  const { theme } = useTheme();

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <View style={styles.overlay}>
        <View style={[styles.card, { backgroundColor: theme.card }]}>
          <View style={styles.header}>
            <Feather name="list" size={18} color={theme.primary} />
            <Text style={[styles.title, { color: theme.text }]}>Review before generating</Text>
          </View>
          <Text style={[styles.subtitle, { color: theme.textSecondary }]}>
            These {addenda.length} timeline {addenda.length === 1 ? 'entry' : 'entries'} will be used to write the Course in Hospital narrative. Check that nothing is missing or miscategorized before proceeding.
          </Text>

          <ScrollView style={styles.list} showsVerticalScrollIndicator={false}>
            {addenda.map((a) => {
              const color = ADDENDUM_COLORS[a.type] || '#6B7280';
              const label = ADDENDUM_LABELS[a.type] || a.type;
              const icon = ADDENDUM_ICONS[a.type] || 'file-text';
              return (
                <View key={a.id} style={[styles.row, { borderColor: theme.borderLight }]}>
                  <View style={[styles.badge, { backgroundColor: color + '1A', borderColor: color + '40' }]}>
                    <Feather name={icon as any} size={10} color={color} />
                  </View>
                  <View style={styles.rowText}>
                    <Text style={[styles.rowLabel, { color }]} numberOfLines={1}>{label}</Text>
                    <Text style={[styles.rowMeta, { color: theme.textSecondary }]} numberOfLines={1}>
                      {fmtTime(a.createdAt)}{a.doctorName ? ` · ${a.doctorName}` : ''}{a.doctorRole ? ` (${a.doctorRole})` : ''}
                    </Text>
                  </View>
                </View>
              );
            })}
          </ScrollView>

          <View style={styles.actions}>
            <Pressable
              style={({ pressed }) => [styles.btn, styles.secondaryBtn, { borderColor: theme.border, opacity: pressed ? 0.7 : 1 }]}
              onPress={onCancel}
            >
              <Text style={[styles.btnText, { color: theme.textSecondary }]}>Add / Fix an Entry First</Text>
            </Pressable>
            <Pressable
              style={({ pressed }) => [styles.btn, styles.primaryBtn, { backgroundColor: theme.primary, opacity: pressed ? 0.85 : 1 }]}
              onPress={onConfirm}
            >
              <Feather name="check" size={15} color="#FFFFFF" />
              <Text style={[styles.btnText, { color: '#FFFFFF' }]}>{confirmLabel}</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    padding: Spacing.lg,
  },
  card: {
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    maxHeight: '80%',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginBottom: Spacing.xs,
  },
  title: {
    fontSize: Typography.h2?.fontSize ?? 17,
    fontWeight: '700',
  },
  subtitle: {
    fontSize: Typography.small?.fontSize ?? 13,
    lineHeight: 18,
    marginBottom: Spacing.md,
  },
  list: {
    marginBottom: Spacing.md,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingVertical: Spacing.sm,
    borderBottomWidth: 1,
  },
  badge: {
    width: 26,
    height: 26,
    borderRadius: 13,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowText: {
    flex: 1,
  },
  rowLabel: {
    fontSize: Typography.small?.fontSize ?? 13,
    fontWeight: '700',
  },
  rowMeta: {
    fontSize: Typography.caption?.fontSize ?? 11,
    marginTop: 2,
  },
  actions: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  btn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.xs,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.md,
  },
  primaryBtn: {},
  secondaryBtn: {
    borderWidth: 1,
  },
  btnText: {
    fontSize: Typography.small?.fontSize ?? 13,
    fontWeight: '600',
  },
});
