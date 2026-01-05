import React, { createContext, useContext, useState, ReactNode } from "react";

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

  const updateCase = (updates: Partial<CaseData>) => {
    setCurrentCase((prev) => {
      if (!prev) return { ...initialCase, ...updates };
      return { ...prev, ...updates };
    });
  };

  const clearCase = () => {
    setCurrentCase(null);
  };

  return (
    <CaseContext.Provider
      value={{
        currentCase,
        setCurrentCase,
        updateCase,
        clearCase,
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
