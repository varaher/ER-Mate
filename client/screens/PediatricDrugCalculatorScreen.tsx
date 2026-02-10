import React, { useState, useMemo, useCallback } from "react";
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  Pressable,
  FlatList,
  Modal,
  ScrollView,
  Linking,
} from "react-native";
import { useNavigation, useRoute, RouteProp } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useHeaderHeight } from "@react-navigation/elements";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius, Typography } from "@/constants/theme";
import type { RootStackParamList } from "@/navigation/RootStackNavigator";
import {
  DRUG_CATEGORIES,
  searchDrugs,
  type PediatricDrug,
  type DoseInfo,
  type DrugCategory,
} from "@/data/pediatricDrugs";

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

function calculateDoseValue(dosePerKg: string, weight: number): string {
  const rangeMatch = dosePerKg.match(/^([\d.]+)\s*-\s*([\d.]+)$/);
  if (rangeMatch) {
    const low = parseFloat(rangeMatch[1]);
    const high = parseFloat(rangeMatch[2]);
    const calcLow = low * weight;
    const calcHigh = high * weight;
    return `${calcLow % 1 === 0 ? calcLow : calcLow.toFixed(1)} - ${calcHigh % 1 === 0 ? calcHigh : calcHigh.toFixed(1)}`;
  }
  const singleMatch = dosePerKg.match(/^([\d.]+)$/);
  if (singleMatch) {
    const val = parseFloat(singleMatch[1]);
    const calc = val * weight;
    return `${calc % 1 === 0 ? calc : calc.toFixed(1)}`;
  }
  return dosePerKg;
}

function extractUnit(unit: string): string {
  return unit.replace(/\/kg.*$/, "").replace(/\/dose.*$/, "").trim();
}

export default function PediatricDrugCalculatorScreen() {
  const navigation = useNavigation<NavigationProp>();
  const route = useRoute<RouteProp<RootStackParamList, "PediatricDrugCalculator">>();
  const { theme } = useTheme();
  const headerHeight = useHeaderHeight();
  const insets = useSafeAreaInsets();

  const initialWeight = (route.params as any)?.weight || "";
  const [weight, setWeight] = useState<string>(initialWeight.toString());
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<DrugCategory | null>(null);
  const [selectedDrug, setSelectedDrug] = useState<PediatricDrug | null>(null);
  const [showDrugDetail, setShowDrugDetail] = useState(false);

  const weightNum = parseFloat(weight) || 0;

  const filteredResults = useMemo(() => {
    if (!searchQuery.trim()) return [];
    return searchDrugs(searchQuery);
  }, [searchQuery]);

  const openDrugDetail = useCallback((drug: PediatricDrug) => {
    setSelectedDrug(drug);
    setShowDrugDetail(true);
  }, []);

  const renderDoseRow = (dose: DoseInfo, index: number) => {
    const calculated = weightNum > 0 ? calculateDoseValue(dose.dosePerKg, weightNum) : null;
    const dispUnit = extractUnit(dose.unit);

    return (
      <View key={index} style={[styles.doseRow, { backgroundColor: theme.backgroundSecondary, borderColor: theme.border }]}>
        {dose.indication ? (
          <Text style={[styles.doseIndication, { color: theme.primary }]}>{dose.indication}</Text>
        ) : null}
        <View style={styles.doseMainRow}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.dosePerKg, { color: theme.text }]}>
              {dose.dosePerKg} {dose.unit}
            </Text>
            <View style={styles.doseMetaRow}>
              <View style={[styles.routeBadge, { backgroundColor: theme.primaryLight }]}>
                <Text style={[styles.routeBadgeText, { color: theme.primary }]}>{dose.route}</Text>
              </View>
              <Text style={[styles.doseFrequency, { color: theme.textSecondary }]}>{dose.frequency}</Text>
              {dose.isLoadingDose ? (
                <View style={[styles.loadingBadge, { backgroundColor: "#FEF3C7" }]}>
                  <Text style={[styles.loadingBadgeText, { color: "#92400E" }]}>Loading Dose</Text>
                </View>
              ) : null}
            </View>
            {dose.duration ? (
              <Text style={[styles.doseDuration, { color: theme.textMuted }]}>Duration: {dose.duration}</Text>
            ) : null}
            {dose.notes ? (
              <Text style={[styles.doseNotes, { color: theme.textMuted }]}>{dose.notes}</Text>
            ) : null}
          </View>
          {calculated ? (
            <View style={[styles.calculatedBox, { backgroundColor: "#DCFCE7" }]}>
              <Text style={styles.calculatedLabel}>Calculated</Text>
              <Text style={styles.calculatedValue}>{calculated}</Text>
              <Text style={styles.calculatedUnit}>{dispUnit}</Text>
            </View>
          ) : null}
        </View>
      </View>
    );
  };

  const renderDrugCard = (drug: PediatricDrug) => {
    const primaryDose = drug.doses[0];
    const calculated = weightNum > 0 ? calculateDoseValue(primaryDose.dosePerKg, weightNum) : null;
    const dispUnit = extractUnit(primaryDose.unit);

    return (
      <Pressable
        key={drug.name}
        style={[styles.drugCard, { backgroundColor: theme.card, borderColor: theme.border }]}
        onPress={() => openDrugDetail(drug)}
      >
        <View style={styles.drugCardHeader}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.drugName, { color: theme.text }]}>{drug.name}</Text>
            {drug.genericName ? (
              <Text style={[styles.drugGeneric, { color: theme.textMuted }]}>{drug.genericName}</Text>
            ) : null}
          </View>
          {calculated ? (
            <View style={[styles.calcBadge, { backgroundColor: "#DCFCE7" }]}>
              <Text style={styles.calcBadgeValue}>{calculated} {dispUnit}</Text>
            </View>
          ) : null}
        </View>
        <View style={styles.drugCardMeta}>
          <Text style={[styles.drugDoseText, { color: theme.textSecondary }]}>
            {primaryDose.dosePerKg} {primaryDose.unit} | {primaryDose.route} | {primaryDose.frequency}
          </Text>
          {drug.doses.length > 1 ? (
            <Text style={[styles.moreDoses, { color: theme.primary }]}>+{drug.doses.length - 1} more indications</Text>
          ) : null}
        </View>
        {drug.maxDose ? (
          <Text style={[styles.maxDoseText, { color: "#DC2626" }]}>Max: {drug.maxDose}</Text>
        ) : null}
        <View style={styles.drugCardFooter}>
          <Text style={[styles.referenceText, { color: theme.textMuted }]}>{drug.reference}</Text>
          <Feather name="chevron-right" size={16} color={theme.textMuted} />
        </View>
      </Pressable>
    );
  };

  const renderCategoryGrid = () => (
    <View style={styles.categoryGrid}>
      {DRUG_CATEGORIES.map((cat) => (
        <Pressable
          key={cat.id}
          style={[styles.categoryCard, { backgroundColor: theme.card, borderColor: theme.border }]}
          onPress={() => setSelectedCategory(cat)}
        >
          <View style={[styles.categoryIconCircle, { backgroundColor: cat.color + "20" }]}>
            <Feather name={cat.icon as any} size={22} color={cat.color} />
          </View>
          <Text style={[styles.categoryName, { color: theme.text }]} numberOfLines={2}>{cat.name}</Text>
          <Text style={[styles.categoryCount, { color: theme.textMuted }]}>{cat.drugs.length} drugs</Text>
        </Pressable>
      ))}
    </View>
  );

  return (
    <View style={[styles.container, { backgroundColor: theme.backgroundDefault }]}>
      <View style={[styles.weightBar, { backgroundColor: theme.card, borderColor: theme.border, marginTop: headerHeight + Spacing.sm }]}>
        <View style={styles.weightInputRow}>
          <Feather name="user" size={18} color={theme.primary} />
          <Text style={[styles.weightLabel, { color: theme.text }]}>Weight (kg)</Text>
          <TextInput
            style={[styles.weightInput, { backgroundColor: theme.backgroundSecondary, color: theme.text, borderColor: theme.border }]}
            placeholder="Enter weight"
            placeholderTextColor={theme.textMuted}
            value={weight}
            onChangeText={setWeight}
            keyboardType="decimal-pad"
            returnKeyType="done"
          />
          {weightNum > 0 ? (
            <View style={[styles.weightBadge, { backgroundColor: "#DCFCE7" }]}>
              <Text style={styles.weightBadgeText}>{weightNum} kg</Text>
            </View>
          ) : null}
        </View>
        {weightNum <= 0 ? (
          <Text style={[styles.weightHint, { color: theme.warning }]}>Enter patient weight for dose calculations</Text>
        ) : null}
      </View>

      <View style={[styles.searchBar, { backgroundColor: theme.card, borderColor: theme.border }]}>
        <Feather name="search" size={18} color={theme.textMuted} />
        <TextInput
          style={[styles.searchInput, { color: theme.text }]}
          placeholder="Search drugs by name..."
          placeholderTextColor={theme.textMuted}
          value={searchQuery}
          onChangeText={(text) => {
            setSearchQuery(text);
            if (text.trim()) setSelectedCategory(null);
          }}
          returnKeyType="search"
        />
        {searchQuery ? (
          <Pressable onPress={() => setSearchQuery("")} style={styles.clearBtn}>
            <Feather name="x-circle" size={18} color={theme.textMuted} />
          </Pressable>
        ) : null}
      </View>

      {searchQuery.trim() ? (
        <FlatList
          data={filteredResults}
          keyExtractor={(item) => item.name + item.category}
          renderItem={({ item }) => renderDrugCard(item)}
          contentContainerStyle={{ padding: Spacing.lg, paddingBottom: insets.bottom + Spacing.xl }}
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Feather name="search" size={40} color={theme.textMuted} />
              <Text style={[styles.emptyText, { color: theme.textMuted }]}>No drugs found for "{searchQuery}"</Text>
            </View>
          }
        />
      ) : selectedCategory ? (
        <View style={{ flex: 1 }}>
          <View style={[styles.categoryHeader, { borderColor: theme.border }]}>
            <Pressable onPress={() => setSelectedCategory(null)} style={styles.backCatBtn}>
              <Feather name="arrow-left" size={20} color={theme.primary} />
            </Pressable>
            <View style={[styles.categoryIconSmall, { backgroundColor: selectedCategory.color + "20" }]}>
              <Feather name={selectedCategory.icon as any} size={16} color={selectedCategory.color} />
            </View>
            <Text style={[styles.categoryHeaderTitle, { color: theme.text }]}>{selectedCategory.name}</Text>
            <Text style={[styles.categoryHeaderCount, { color: theme.textMuted }]}>{selectedCategory.drugs.length}</Text>
          </View>
          <FlatList
            data={selectedCategory.drugs}
            keyExtractor={(item) => item.name}
            renderItem={({ item }) => renderDrugCard(item)}
            contentContainerStyle={{ padding: Spacing.lg, paddingBottom: insets.bottom + Spacing.xl }}
          />
        </View>
      ) : (
        <ScrollView contentContainerStyle={{ padding: Spacing.lg, paddingBottom: insets.bottom + Spacing.xl }}>
          <Text style={[styles.sectionTitle, { color: theme.text }]}>Drug Categories</Text>
          <Text style={[styles.sectionSubtitle, { color: theme.textSecondary }]}>
            {DRUG_CATEGORIES.reduce((sum, c) => sum + c.drugs.length, 0)} drugs across {DRUG_CATEGORIES.length} categories
          </Text>
          {renderCategoryGrid()}
          <View style={[styles.disclaimerBox, { backgroundColor: theme.backgroundSecondary, borderColor: theme.border }]}>
            <Feather name="alert-circle" size={16} color={theme.warning} />
            <Text style={[styles.disclaimerText, { color: theme.textSecondary }]}>
              Dosages referenced from Harriet Lane Handbook, Nelson's Textbook of Pediatrics, and BNF for Children. Always verify doses before administration. This calculator is a clinical aid, not a substitute for clinical judgment.
            </Text>
          </View>
        </ScrollView>
      )}

      <Modal visible={showDrugDetail} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: theme.backgroundDefault }]}>
            <View style={[styles.modalHeader, { borderColor: theme.border }]}>
              <Pressable onPress={() => setShowDrugDetail(false)} style={styles.modalCloseBtn}>
                <Feather name="x" size={24} color={theme.text} />
              </Pressable>
              <Text style={[styles.modalTitle, { color: theme.text }]} numberOfLines={1}>
                {selectedDrug?.name}
              </Text>
              <View style={{ width: 40 }} />
            </View>

            {selectedDrug ? (
              <ScrollView contentContainerStyle={{ padding: Spacing.lg, paddingBottom: insets.bottom + Spacing["3xl"] }}>
                <View style={[styles.drugDetailHeader, { backgroundColor: theme.card, borderColor: theme.border }]}>
                  <Text style={[styles.detailDrugName, { color: theme.text }]}>{selectedDrug.name}</Text>
                  {selectedDrug.genericName ? (
                    <Text style={[styles.detailGeneric, { color: theme.textSecondary }]}>{selectedDrug.genericName}</Text>
                  ) : null}
                  <View style={styles.detailMetaRow}>
                    <View style={[styles.detailCategoryBadge, { backgroundColor: theme.primaryLight }]}>
                      <Text style={[styles.detailCategoryText, { color: theme.primary }]}>{selectedDrug.category}</Text>
                    </View>
                  </View>
                  {selectedDrug.ageRestriction ? (
                    <View style={[styles.ageRestrictionBox, { backgroundColor: "#FEF3C7" }]}>
                      <Feather name="alert-triangle" size={14} color="#92400E" />
                      <Text style={styles.ageRestrictionText}>Age: {selectedDrug.ageRestriction}</Text>
                    </View>
                  ) : null}
                  {selectedDrug.maxDose ? (
                    <View style={[styles.maxDoseBox, { backgroundColor: "#FEE2E2" }]}>
                      <Feather name="alert-circle" size={14} color="#DC2626" />
                      <Text style={styles.maxDoseDetailText}>Max Dose: {selectedDrug.maxDose}</Text>
                    </View>
                  ) : null}
                </View>

                {weightNum > 0 ? (
                  <View style={[styles.weightBanner, { backgroundColor: "#DCFCE7", borderColor: "#86EFAC" }]}>
                    <Feather name="check-circle" size={16} color="#166534" />
                    <Text style={styles.weightBannerText}>Calculating for {weightNum} kg</Text>
                  </View>
                ) : (
                  <View style={[styles.weightBanner, { backgroundColor: "#FEF3C7", borderColor: "#FDE68A" }]}>
                    <Feather name="info" size={16} color="#92400E" />
                    <Text style={[styles.weightBannerText, { color: "#92400E" }]}>Enter weight above to see calculated doses</Text>
                  </View>
                )}

                <Text style={[styles.dosingSectionTitle, { color: theme.text }]}>Dosing Information</Text>
                {selectedDrug.doses.map((dose, i) => renderDoseRow(dose, i))}

                <Text style={[styles.dosingSectionTitle, { color: theme.text, marginTop: Spacing.lg }]}>Routes</Text>
                <View style={styles.routesRow}>
                  {selectedDrug.routes.map((r) => (
                    <View key={r} style={[styles.routeChip, { backgroundColor: theme.primaryLight }]}>
                      <Text style={[styles.routeChipText, { color: theme.primary }]}>{r}</Text>
                    </View>
                  ))}
                </View>

                {selectedDrug.warnings && selectedDrug.warnings.length > 0 ? (
                  <>
                    <Text style={[styles.dosingSectionTitle, { color: theme.text, marginTop: Spacing.lg }]}>Warnings</Text>
                    {selectedDrug.warnings.map((w, i) => (
                      <View key={i} style={[styles.warningItem, { backgroundColor: "#FEF2F2" }]}>
                        <Feather name="alert-triangle" size={14} color="#DC2626" />
                        <Text style={styles.warningText}>{w}</Text>
                      </View>
                    ))}
                  </>
                ) : null}

                <View style={[styles.referenceBox, { backgroundColor: theme.backgroundSecondary, borderColor: theme.border }]}>
                  <Feather name="book-open" size={14} color={theme.textSecondary} />
                  <Text style={[styles.referenceBoxText, { color: theme.textSecondary }]}>
                    Reference: {selectedDrug.reference}
                  </Text>
                </View>
              </ScrollView>
            ) : null}
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  weightBar: {
    marginHorizontal: Spacing.lg,
    padding: Spacing.md,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    marginBottom: Spacing.sm,
  },
  weightInputRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
  },
  weightLabel: {
    ...Typography.bodyMedium,
    fontWeight: "600",
  },
  weightInput: {
    flex: 1,
    height: 40,
    paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    ...Typography.body,
    textAlign: "center",
  },
  weightBadge: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.full,
  },
  weightBadgeText: {
    color: "#166534",
    fontWeight: "700",
    fontSize: 14,
  },
  weightHint: {
    ...Typography.caption,
    marginTop: Spacing.xs,
    textAlign: "center",
  },
  searchBar: {
    flexDirection: "row",
    alignItems: "center",
    marginHorizontal: Spacing.lg,
    paddingHorizontal: Spacing.md,
    height: 44,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    gap: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  searchInput: {
    flex: 1,
    ...Typography.body,
    height: 44,
  },
  clearBtn: {
    padding: Spacing.xs,
  },
  sectionTitle: {
    ...Typography.h3,
    marginBottom: Spacing.xs,
  },
  sectionSubtitle: {
    ...Typography.small,
    marginBottom: Spacing.lg,
  },
  categoryGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.sm,
  },
  categoryCard: {
    width: "31%",
    padding: Spacing.md,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    alignItems: "center",
    minHeight: 110,
    justifyContent: "center",
  },
  categoryIconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: Spacing.sm,
  },
  categoryName: {
    ...Typography.caption,
    fontWeight: "600",
    textAlign: "center",
    lineHeight: 15,
  },
  categoryCount: {
    ...Typography.caption,
    marginTop: 2,
  },
  categoryHeader: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
    gap: Spacing.sm,
  },
  backCatBtn: {
    padding: Spacing.xs,
  },
  categoryIconSmall: {
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: "center",
    alignItems: "center",
  },
  categoryHeaderTitle: {
    ...Typography.bodyMedium,
    fontWeight: "700",
    flex: 1,
  },
  categoryHeaderCount: {
    ...Typography.small,
    fontWeight: "600",
  },
  drugCard: {
    padding: Spacing.lg,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    marginBottom: Spacing.md,
  },
  drugCardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: Spacing.sm,
  },
  drugName: {
    ...Typography.bodyMedium,
    fontWeight: "700",
  },
  drugGeneric: {
    ...Typography.caption,
    marginTop: 1,
  },
  calcBadge: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.full,
  },
  calcBadgeValue: {
    color: "#166534",
    fontWeight: "700",
    fontSize: 13,
  },
  drugCardMeta: {
    marginTop: Spacing.sm,
  },
  drugDoseText: {
    ...Typography.small,
  },
  moreDoses: {
    ...Typography.caption,
    fontWeight: "600",
    marginTop: 2,
  },
  maxDoseText: {
    ...Typography.caption,
    fontWeight: "600",
    marginTop: Spacing.xs,
  },
  drugCardFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: Spacing.sm,
    paddingTop: Spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "#e2e8f0",
  },
  referenceText: {
    ...Typography.caption,
    fontStyle: "italic",
  },
  emptyState: {
    alignItems: "center",
    paddingVertical: Spacing["5xl"],
    gap: Spacing.md,
  },
  emptyText: {
    ...Typography.body,
    textAlign: "center",
  },
  disclaimerBox: {
    flexDirection: "row",
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    gap: Spacing.sm,
    marginTop: Spacing["2xl"],
    alignItems: "flex-start",
  },
  disclaimerText: {
    ...Typography.caption,
    flex: 1,
    lineHeight: 18,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "flex-end",
  },
  modalContent: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: "92%",
    minHeight: "60%",
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
  },
  modalCloseBtn: {
    padding: Spacing.xs,
    width: 40,
  },
  modalTitle: {
    ...Typography.h4,
    flex: 1,
    textAlign: "center",
  },
  drugDetailHeader: {
    padding: Spacing.lg,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    marginBottom: Spacing.md,
  },
  detailDrugName: {
    ...Typography.h3,
  },
  detailGeneric: {
    ...Typography.small,
    marginTop: 2,
  },
  detailMetaRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.sm,
    marginTop: Spacing.sm,
  },
  detailCategoryBadge: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.full,
  },
  detailCategoryText: {
    ...Typography.caption,
    fontWeight: "600",
  },
  ageRestrictionBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    padding: Spacing.sm,
    borderRadius: BorderRadius.sm,
    marginTop: Spacing.sm,
  },
  ageRestrictionText: {
    color: "#92400E",
    ...Typography.small,
    fontWeight: "500",
  },
  maxDoseBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    padding: Spacing.sm,
    borderRadius: BorderRadius.sm,
    marginTop: Spacing.sm,
  },
  maxDoseDetailText: {
    color: "#DC2626",
    ...Typography.small,
    fontWeight: "600",
  },
  weightBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    marginBottom: Spacing.lg,
  },
  weightBannerText: {
    color: "#166534",
    ...Typography.small,
    fontWeight: "600",
  },
  dosingSectionTitle: {
    ...Typography.bodyMedium,
    fontWeight: "700",
    marginBottom: Spacing.sm,
  },
  doseRow: {
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    marginBottom: Spacing.sm,
    borderWidth: 1,
  },
  doseIndication: {
    ...Typography.small,
    fontWeight: "700",
    marginBottom: Spacing.xs,
  },
  doseMainRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: Spacing.md,
  },
  dosePerKg: {
    ...Typography.bodyMedium,
    fontWeight: "600",
  },
  doseMetaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    marginTop: Spacing.xs,
    flexWrap: "wrap",
  },
  routeBadge: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderRadius: BorderRadius.xs,
  },
  routeBadgeText: {
    fontSize: 11,
    fontWeight: "700",
  },
  doseFrequency: {
    ...Typography.caption,
  },
  loadingBadge: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderRadius: BorderRadius.xs,
  },
  loadingBadgeText: {
    fontSize: 11,
    fontWeight: "700",
  },
  doseDuration: {
    ...Typography.caption,
    marginTop: Spacing.xs,
  },
  doseNotes: {
    ...Typography.caption,
    marginTop: Spacing.xs,
    fontStyle: "italic",
  },
  calculatedBox: {
    alignItems: "center",
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.md,
    minWidth: 80,
  },
  calculatedLabel: {
    fontSize: 10,
    color: "#166534",
    fontWeight: "500",
  },
  calculatedValue: {
    fontSize: 18,
    fontWeight: "800",
    color: "#166534",
  },
  calculatedUnit: {
    fontSize: 11,
    color: "#166534",
    fontWeight: "500",
  },
  routesRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.sm,
  },
  routeChip: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.full,
  },
  routeChipText: {
    ...Typography.caption,
    fontWeight: "600",
  },
  warningItem: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: Spacing.sm,
    padding: Spacing.md,
    borderRadius: BorderRadius.sm,
    marginBottom: Spacing.xs,
  },
  warningText: {
    color: "#DC2626",
    ...Typography.small,
    flex: 1,
  },
  referenceBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    marginTop: Spacing["2xl"],
  },
  referenceBoxText: {
    ...Typography.small,
    flex: 1,
  },
});
