import AsyncStorage from "@react-native-async-storage/async-storage";

const DRAFTS_KEY = "@ermate_case_drafts";

export interface DraftCase {
  draftId: string;
  backendCaseId?: string;
  status: "draft" | "committed";
  createdAt: string;
  updatedAt: string;
  data: any;
  triageData?: any;
  caseSheetData?: any;
  dischargeSummaryData?: any;
}

export interface DraftStore {
  drafts: Record<string, DraftCase>;
  activeDraftId: string | null;
}

async function loadStore(): Promise<DraftStore> {
  try {
    const stored = await AsyncStorage.getItem(DRAFTS_KEY);
    if (stored) {
      return JSON.parse(stored);
    }
  } catch (err) {
    console.error("Failed to load draft store:", err);
  }
  return { drafts: {}, activeDraftId: null };
}

async function saveStore(store: DraftStore): Promise<void> {
  try {
    await AsyncStorage.setItem(DRAFTS_KEY, JSON.stringify(store));
  } catch (err) {
    console.error("Failed to save draft store:", err);
  }
}

export async function createDraft(triageData: any): Promise<string> {
  const store = await loadStore();
  const draftId = `draft_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
  
  store.drafts[draftId] = {
    draftId,
    status: "draft",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    data: triageData,
    triageData,
  };
  store.activeDraftId = draftId;
  
  await saveStore(store);
  return draftId;
}

export async function updateDraft(draftId: string, updates: Partial<DraftCase>): Promise<void> {
  const store = await loadStore();
  
  if (store.drafts[draftId]) {
    store.drafts[draftId] = {
      ...store.drafts[draftId],
      ...updates,
      updatedAt: new Date().toISOString(),
    };
    await saveStore(store);
  }
}

export async function saveCaseSheetToDraft(draftId: string, caseSheetData: any): Promise<void> {
  const store = await loadStore();
  
  if (!store.drafts[draftId]) {
    throw new Error(`Draft not found: ${draftId}`);
  }
  
  store.drafts[draftId].caseSheetData = caseSheetData;
  store.drafts[draftId].updatedAt = new Date().toISOString();
  await saveStore(store);
}

export async function saveDischargeSummaryToDraft(draftId: string, summaryData: any): Promise<void> {
  const store = await loadStore();
  
  if (store.drafts[draftId]) {
    store.drafts[draftId].dischargeSummaryData = summaryData;
    store.drafts[draftId].updatedAt = new Date().toISOString();
    await saveStore(store);
  }
}

export async function getDraft(draftId: string): Promise<DraftCase | null> {
  const store = await loadStore();
  return store.drafts[draftId] || null;
}

export async function getDraftByBackendId(backendCaseId: string): Promise<DraftCase | null> {
  const store = await loadStore();
  const draft = Object.values(store.drafts).find(d => d.backendCaseId === backendCaseId);
  return draft || null;
}

export async function getAllDrafts(): Promise<DraftCase[]> {
  const store = await loadStore();
  return Object.values(store.drafts).filter(d => d.status === "draft");
}

export async function markDraftAsCommitted(draftId: string, backendCaseId: string): Promise<void> {
  const store = await loadStore();
  
  if (store.drafts[draftId]) {
    store.drafts[draftId].status = "committed";
    store.drafts[draftId].backendCaseId = backendCaseId;
    store.drafts[draftId].updatedAt = new Date().toISOString();
    await saveStore(store);
  }
}

export async function linkDraftToBackendCase(draftId: string, backendCaseId: string): Promise<void> {
  const store = await loadStore();
  
  if (store.drafts[draftId]) {
    store.drafts[draftId].backendCaseId = backendCaseId;
    store.drafts[draftId].updatedAt = new Date().toISOString();
    await saveStore(store);
  }
}

export async function getOrCreateDraftForCase(backendCaseId: string, initialData?: any): Promise<string> {
  const store = await loadStore();
  const existingDraft = Object.values(store.drafts).find(d => d.backendCaseId === backendCaseId && d.status === "draft");
  
  if (existingDraft) {
    store.activeDraftId = existingDraft.draftId;
    await saveStore(store);
    return existingDraft.draftId;
  }
  
  const draftId = `draft_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
  store.drafts[draftId] = {
    draftId,
    backendCaseId,
    status: "draft",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    data: initialData || {},
  };
  store.activeDraftId = draftId;
  await saveStore(store);
  return draftId;
}

export async function deleteDraft(draftId: string): Promise<void> {
  const store = await loadStore();
  delete store.drafts[draftId];
  
  if (store.activeDraftId === draftId) {
    store.activeDraftId = null;
  }
  
  await saveStore(store);
}

export async function setActiveDraft(draftId: string | null): Promise<void> {
  const store = await loadStore();
  store.activeDraftId = draftId;
  await saveStore(store);
}

export async function getActiveDraft(): Promise<DraftCase | null> {
  const store = await loadStore();
  if (store.activeDraftId && store.drafts[store.activeDraftId]) {
    return store.drafts[store.activeDraftId];
  }
  return null;
}

export async function cleanupOldDrafts(maxAgeDays: number = 7): Promise<void> {
  const store = await loadStore();
  const cutoff = Date.now() - maxAgeDays * 24 * 60 * 60 * 1000;
  
  for (const draftId of Object.keys(store.drafts)) {
    const draft = store.drafts[draftId];
    if (draft.status === "committed" && new Date(draft.updatedAt).getTime() < cutoff) {
      delete store.drafts[draftId];
    }
  }
  
  await saveStore(store);
}
