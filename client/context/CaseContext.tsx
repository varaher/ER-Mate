import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from "react";
import {
  createDraft,
  updateDraft,
  getDraft,
  getAllDrafts,
  deleteDraft,
  setActiveDraft,
  getActiveDraft,
  saveCaseSheetToDraft,
  saveDischargeSummaryToDraft,
  markDraftAsCommitted,
  getOrCreateDraftForCase,
  type DraftCase,
} from "@/lib/draftManager";

export interface Patient {
  name: string;
  age: string;
  sex: string;
  phone?: string;
  address?: string;
  mode_of_arrival?: string;
  brought_by?: string;
  mlc?: boolean;
  uhid?: string;
}

export interface Vitals {
  hr?: number;
  bp_systolic?: number;
  bp_diastolic?: number;
  rr?: number;
  spo2?: number;
  temperature?: number;
  gcs_e?: number;
  gcs_v?: number;
  gcs_m?: number;
  grbs?: number;
}

export interface PresentingComplaint {
  text: string;
  duration?: string;
  onset_type?: string;
  course?: string;
}

export interface CaseData {
  id?: string;
  patient: Patient;
  vitals: Vitals;
  presenting_complaint: PresentingComplaint;
  triage_priority?: number;
  triage_color?: string;
  case_type?: string;
  abcde?: {
    airway?: Record<string, unknown>;
    breathing?: Record<string, unknown>;
    circulation?: Record<string, unknown>;
    disability?: Record<string, unknown>;
    exposure?: Record<string, unknown>;
  };
  history?: Record<string, unknown>;
  examination?: Record<string, unknown>;
  investigations?: Record<string, unknown>;
  treatment?: {
    drugs?: unknown[];
    procedures?: unknown[];
    notes?: string;
  };
  disposition?: {
    type?: string;
    destination?: string;
    notes?: string;
  };
  status?: string;
  voice_transcript?: string;
}

interface CaseContextType {
  currentCase: CaseData | null;
  setCurrentCase: (data: CaseData | null) => void;
  updateCase: (updates: Partial<CaseData>) => void;
  clearCase: () => void;
  currentDraftId: string | null;
  setCurrentDraftId: (id: string | null) => void;
  startNewDraft: (triageData: any) => Promise<string>;
  initDraftForCase: (backendCaseId: string) => Promise<string>;
  saveToDraft: (caseSheetData: any) => Promise<void>;
  saveDischargeToDraft: (summaryData: any) => Promise<void>;
  commitDraft: (backendCaseId: string) => Promise<void>;
  loadDraft: (draftId: string) => Promise<DraftCase | null>;
  getDrafts: () => Promise<DraftCase[]>;
  removeDraft: (draftId: string) => Promise<void>;
  isDraft: boolean;
}

const CaseContext = createContext<CaseContextType | undefined>(undefined);

const initialCase: CaseData = {
  patient: {
    name: "",
    age: "",
    sex: "Male",
    mode_of_arrival: "Walk-in",
  },
  vitals: {},
  presenting_complaint: {
    text: "",
  },
  triage_priority: 4,
  triage_color: "green",
  case_type: "adult",
};

export function CaseProvider({ children }: { children: ReactNode }) {
  const [currentCase, setCurrentCase] = useState<CaseData | null>(null);
  const [currentDraftId, setCurrentDraftId] = useState<string | null>(null);
  const [isDraft, setIsDraft] = useState<boolean>(false);

  useEffect(() => {
    const loadActiveDraft = async () => {
      const activeDraft = await getActiveDraft();
      if (activeDraft) {
        setCurrentDraftId(activeDraft.draftId);
        setIsDraft(activeDraft.status === "draft");
      }
    };
    loadActiveDraft();
  }, []);

  const updateCase = (updates: Partial<CaseData>) => {
    setCurrentCase((prev) => {
      if (!prev) return { ...initialCase, ...updates };
      return { ...prev, ...updates };
    });
  };

  const clearCase = () => {
    setCurrentCase(null);
    setCurrentDraftId(null);
    setIsDraft(false);
    setActiveDraft(null);
  };

  const startNewDraft = useCallback(async (triageData: any): Promise<string> => {
    const draftId = await createDraft(triageData);
    setCurrentDraftId(draftId);
    setIsDraft(true);
    await setActiveDraft(draftId);
    return draftId;
  }, []);

  const initDraftForCase = useCallback(async (backendCaseId: string): Promise<string> => {
    const draftId = await getOrCreateDraftForCase(backendCaseId);
    setCurrentDraftId(draftId);
    setIsDraft(true);
    await setActiveDraft(draftId);
    return draftId;
  }, []);

  const saveToDraft = useCallback(async (caseSheetData: any): Promise<void> => {
    if (!currentDraftId) {
      throw new Error("No draft initialized. Please wait for the case to load completely.");
    }
    await saveCaseSheetToDraft(currentDraftId, caseSheetData);
  }, [currentDraftId]);

  const saveDischargeToDraft = useCallback(async (summaryData: any): Promise<void> => {
    if (currentDraftId) {
      await saveDischargeSummaryToDraft(currentDraftId, summaryData);
    }
  }, [currentDraftId]);

  const commitDraft = useCallback(async (backendCaseId: string): Promise<void> => {
    if (currentDraftId) {
      await markDraftAsCommitted(currentDraftId, backendCaseId);
      setIsDraft(false);
    }
  }, [currentDraftId]);

  const loadDraft = useCallback(async (draftId: string): Promise<DraftCase | null> => {
    const draft = await getDraft(draftId);
    if (draft) {
      setCurrentDraftId(draftId);
      setIsDraft(draft.status === "draft");
      await setActiveDraft(draftId);
    }
    return draft;
  }, []);

  const getDrafts = useCallback(async (): Promise<DraftCase[]> => {
    return getAllDrafts();
  }, []);

  const removeDraft = useCallback(async (draftId: string): Promise<void> => {
    await deleteDraft(draftId);
    if (currentDraftId === draftId) {
      setCurrentDraftId(null);
      setIsDraft(false);
    }
  }, [currentDraftId]);

  return (
    <CaseContext.Provider
      value={{
        currentCase,
        setCurrentCase,
        updateCase,
        clearCase,
        currentDraftId,
        setCurrentDraftId,
        startNewDraft,
        initDraftForCase,
        saveToDraft,
        saveDischargeToDraft,
        commitDraft,
        loadDraft,
        getDrafts,
        removeDraft,
        isDraft,
      }}
    >
      {children}
    </CaseContext.Provider>
  );
}

export function useCase() {
  const context = useContext(CaseContext);
  if (context === undefined) {
    throw new Error("useCase must be used within a CaseProvider");
  }
  return context;
}
