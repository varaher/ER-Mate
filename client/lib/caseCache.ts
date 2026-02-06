import AsyncStorage from "@react-native-async-storage/async-storage";

const CACHE_KEY = "@ermate_case_cache";

interface CaseCacheEntry {
  treatment: any;
  investigations: any;
  procedures: any;
  addendum_notes: string[];
  discharge_summary: any;
  updatedAt: string;
}

interface CaseCache {
  [caseId: string]: CaseCacheEntry;
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
  const existing = cache[caseId] || {};
  cache[caseId] = {
    treatment: payload.treatment || existing.treatment || {},
    investigations: payload.investigations || existing.investigations || {},
    procedures: payload.procedures || existing.procedures || {},
    addendum_notes: payload.addendum_notes || existing.addendum_notes || [],
    discharge_summary: payload.discharge_summary || existing.discharge_summary || {},
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

export async function cacheAddendumNotes(caseId: string, notes: string[]): Promise<void> {
  const cache = await loadCache();
  if (!cache[caseId]) {
    cache[caseId] = {
      treatment: {},
      investigations: {},
      procedures: {},
      addendum_notes: [],
      discharge_summary: {},
      updatedAt: new Date().toISOString(),
    };
  }
  cache[caseId].addendum_notes = notes;
  cache[caseId].updatedAt = new Date().toISOString();
  await saveCache(cache);
}

export async function cacheDischargeSummary(caseId: string, summary: any): Promise<void> {
  const cache = await loadCache();
  if (!cache[caseId]) {
    cache[caseId] = {
      treatment: {},
      investigations: {},
      procedures: {},
      addendum_notes: [],
      discharge_summary: {},
      updatedAt: new Date().toISOString(),
    };
  }
  cache[caseId].discharge_summary = summary;
  cache[caseId].updatedAt = new Date().toISOString();
  await saveCache(cache);
}

export async function getCachedCaseData(caseId: string): Promise<CaseCacheEntry | null> {
  const cache = await loadCache();
  return cache[caseId] || null;
}

export function mergeCaseWithCache(caseData: any, cached: CaseCacheEntry): any {
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

  const backendNotes = merged.treatment?.addendum_notes || merged.addendum_notes || [];
  const backendNotesList = Array.isArray(backendNotes) ? backendNotes : (backendNotes ? [backendNotes] : []);
  const cachedNotesList = cached.addendum_notes || [];
  if (cachedNotesList.length > backendNotesList.length) {
    merged.treatment.addendum_notes = cachedNotesList;
    merged.addendum_notes = cachedNotesList;
  }

  if (cached.discharge_summary && Object.keys(cached.discharge_summary).length > 0) {
    if (!merged.discharge_summary || Object.keys(merged.discharge_summary).length === 0) {
      merged.discharge_summary = cached.discharge_summary;
    }
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
