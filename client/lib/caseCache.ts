import AsyncStorage from "@react-native-async-storage/async-storage";

const CACHE_KEY = "@ermate_case_cache";

interface CaseCacheEntry {
  treatment: any;
  investigations: any;
  procedures: any;
  addendum_notes: string[];
  discharge_summary: any;
  primary_assessment: any;
  history: any;
  examination: any;
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
    primary_assessment: payload.primary_assessment || existing.primary_assessment || {},
    history: payload.history || existing.history || {},
    examination: payload.examination || existing.examination || {},
    updatedAt: new Date().toISOString(),
  };
  await saveCache(cache);
}

export async function getCachedCaseData(caseId: string): Promise<CaseCacheEntry | null> {
  const cache = await loadCache();
  return cache[caseId] || null;
}

export async function cacheDischargeSummary(caseId: string, summary: any): Promise<void> {
  const cache = await loadCache();
  const existing = cache[caseId] || {};
  cache[caseId] = {
    treatment: existing.treatment || {},
    investigations: existing.investigations || {},
    procedures: existing.procedures || {},
    addendum_notes: existing.addendum_notes || [],
    primary_assessment: existing.primary_assessment || {},
    history: existing.history || {},
    examination: existing.examination || {},
    discharge_summary: summary || {},
    updatedAt: new Date().toISOString(),
  };
  await saveCache(cache);
}

function hasData(val: any): boolean {
  if (!val) return false;
  if (typeof val === "string") return val.trim().length > 0;
  if (Array.isArray(val)) return val.length > 0;
  if (typeof val === "object") return Object.keys(val).length > 0;
  return Boolean(val);
}

export async function cacheAddendumNotes(caseId: string, notes: string[]): Promise<void> {
  const cache = await loadCache();
  const existing = cache[caseId] || {};
  cache[caseId] = {
    treatment: existing.treatment || {},
    investigations: existing.investigations || {},
    procedures: existing.procedures || {},
    addendum_notes: notes,
    discharge_summary: existing.discharge_summary || {},
    primary_assessment: existing.primary_assessment || {},
    history: existing.history || {},
    examination: existing.examination || {},
    updatedAt: new Date().toISOString(),
  };
  await saveCache(cache);
}

export function mergeCaseWithCache(caseData: any, cached: CaseCacheEntry): any {
  const merged = { ...caseData };

  if (cached.history && hasData(cached.history)) {
    if (!merged.history) merged.history = {};
    const mergedHistory = { ...merged.history };
    for (const key of Object.keys(cached.history)) {
      if (hasData(cached.history[key])) {
        mergedHistory[key] = cached.history[key];
      }
    }
    merged.history = mergedHistory;
  }

  if (cached.primary_assessment && hasData(cached.primary_assessment)) {
    if (!merged.primary_assessment) merged.primary_assessment = {};
    const mergedPA = { ...merged.primary_assessment };
    for (const key of Object.keys(cached.primary_assessment)) {
      if (hasData(cached.primary_assessment[key])) {
        mergedPA[key] = cached.primary_assessment[key];
      }
    }
    merged.primary_assessment = mergedPA;
  }

  if (cached.examination && hasData(cached.examination)) {
    if (!merged.examination) merged.examination = {};
    const mergedExam = { ...merged.examination };
    for (const key of Object.keys(cached.examination)) {
      if (hasData(cached.examination[key])) {
        mergedExam[key] = cached.examination[key];
      }
    }
    merged.examination = mergedExam;
  }

  if (!merged.treatment) merged.treatment = {};
  if (cached.treatment && hasData(cached.treatment)) {
    const mergedTreatment = { ...merged.treatment };
    for (const key of Object.keys(cached.treatment)) {
      if (hasData(cached.treatment[key])) {
        mergedTreatment[key] = cached.treatment[key];
      }
    }
    merged.treatment = mergedTreatment;
  }

  if (!merged.investigations) merged.investigations = {};
  if (cached.investigations && hasData(cached.investigations)) {
    const mergedInv = { ...merged.investigations };
    for (const key of Object.keys(cached.investigations)) {
      if (hasData(cached.investigations[key])) {
        mergedInv[key] = cached.investigations[key];
      }
    }
    merged.investigations = mergedInv;
  }

  if (!merged.procedures) merged.procedures = {};
  if (cached.procedures && hasData(cached.procedures)) {
    const mergedProc = { ...merged.procedures };
    for (const key of Object.keys(cached.procedures)) {
      if (hasData(cached.procedures[key])) {
        mergedProc[key] = cached.procedures[key];
      }
    }
    merged.procedures = mergedProc;
  }

  const backendNotes = merged.treatment?.addendum_notes || merged.addendum_notes || [];
  const backendNotesList = Array.isArray(backendNotes) ? backendNotes : (backendNotes ? [backendNotes] : []);
  const cachedNotesList = cached.addendum_notes || [];
  if (cachedNotesList.length > backendNotesList.length) {
    merged.treatment.addendum_notes = cachedNotesList;
    merged.addendum_notes = cachedNotesList;
  }

  if (cached.discharge_summary && hasData(cached.discharge_summary)) {
    if (!merged.discharge_summary || !hasData(merged.discharge_summary)) {
      merged.discharge_summary = cached.discharge_summary;
    }
  }

  return merged;
}
