import AsyncStorage from "@react-native-async-storage/async-storage";

const CACHE_KEY = "@ermate_case_cache";

interface CaseCache {
  [caseId: string]: {
    treatment: any;
    investigations: any;
    procedures: any;
    updatedAt: string;
  };
}

async function loadCache(): Promise<CaseCache> {
  try {
    const stored = await AsyncStorage.getItem(CACHE_KEY);
    if (stored) return JSON.parse(stored);
  } catch (err) {
    console.error("Failed to load case cache:", err);
  }
  return {};
}

async function saveCache(cache: CaseCache): Promise<void> {
  try {
    await AsyncStorage.setItem(CACHE_KEY, JSON.stringify(cache));
  } catch (err) {
    console.error("Failed to save case cache:", err);
  }
}

export async function cacheCasePayload(caseId: string, payload: any): Promise<void> {
  const cache = await loadCache();
  cache[caseId] = {
    treatment: payload.treatment || {},
    investigations: payload.investigations || {},
    procedures: payload.procedures || {},
    updatedAt: new Date().toISOString(),
  };

  const keys = Object.keys(cache);
  if (keys.length > 50) {
    const sorted = keys.sort((a, b) => {
      return (cache[a].updatedAt || "").localeCompare(cache[b].updatedAt || "");
    });
    delete cache[sorted[0]];
  }

  await saveCache(cache);
}

export async function getCachedCaseData(caseId: string): Promise<{ treatment: any; investigations: any; procedures: any } | null> {
  const cache = await loadCache();
  return cache[caseId] || null;
}

export function mergeCaseWithCache(caseData: any, cached: { treatment: any; investigations: any; procedures: any }): any {
  const merged = { ...caseData };

  if (!merged.treatment) merged.treatment = {};

  if ((!merged.treatment.medications || merged.treatment.medications.length === 0) && cached.treatment.medications?.length > 0) {
    merged.treatment.medications = cached.treatment.medications;
  }
  if ((!merged.treatment.infusions || merged.treatment.infusions.length === 0) && cached.treatment.infusions?.length > 0) {
    merged.treatment.infusions = cached.treatment.infusions;
  }
  if (!merged.treatment.primary_diagnosis && cached.treatment.primary_diagnosis) {
    merged.treatment.primary_diagnosis = cached.treatment.primary_diagnosis;
  }
  if ((!merged.treatment.provisional_diagnoses || merged.treatment.provisional_diagnoses.length === 0) && cached.treatment.provisional_diagnoses?.length > 0) {
    merged.treatment.provisional_diagnoses = cached.treatment.provisional_diagnoses;
  }
  if ((!merged.treatment.differential_diagnoses || merged.treatment.differential_diagnoses.length === 0) && cached.treatment.differential_diagnoses?.length > 0) {
    merged.treatment.differential_diagnoses = cached.treatment.differential_diagnoses;
  }
  if (!merged.treatment.fluids && cached.treatment.fluids) {
    merged.treatment.fluids = cached.treatment.fluids;
  }
  if (!merged.treatment.other_medications && cached.treatment.other_medications) {
    merged.treatment.other_medications = cached.treatment.other_medications;
  }
  if (!merged.treatment.intervention_notes && cached.treatment.intervention_notes) {
    merged.treatment.intervention_notes = cached.treatment.intervention_notes;
  }

  if (!merged.investigations) merged.investigations = {};
  if ((!merged.investigations.panels_selected || merged.investigations.panels_selected.length === 0) && cached.investigations.panels_selected?.length > 0) {
    merged.investigations.panels_selected = cached.investigations.panels_selected;
  }
  if ((!merged.investigations.imaging || merged.investigations.imaging.length === 0) && cached.investigations.imaging?.length > 0) {
    merged.investigations.imaging = cached.investigations.imaging;
  }
  if (!merged.investigations.results_notes && cached.investigations.results_notes) {
    merged.investigations.results_notes = cached.investigations.results_notes;
  }

  if (!merged.procedures) merged.procedures = {};
  if ((!merged.procedures.procedures_performed || merged.procedures.procedures_performed.length === 0) && cached.procedures.procedures_performed?.length > 0) {
    merged.procedures.procedures_performed = cached.procedures.procedures_performed;
  }
  if (!merged.procedures.general_notes && cached.procedures.general_notes) {
    merged.procedures.general_notes = cached.procedures.general_notes;
  }

  return merged;
}
