import React, { createContext, useContext, useState, useEffect, useCallback, useRef, ReactNode } from "react";
import { Alert } from "react-native";
import { getApiUrl } from "@/lib/query-client";
import { useAuth } from "@/context/AuthContext";

export interface Department {
  id: number;
  name: string;
  hospitalName: string | null;
  hodUserId: string;
  maxConcurrent: number;
  allowOverflow: boolean;
  billingActive: boolean;
}

export interface DepartmentMembership {
  id: number;
  departmentId: number;
  userId: string;
  role: string;
  status: string;
  name: string | null;
  email: string | null;
}

export interface Shift {
  id: number;
  departmentId: number;
  name: string;
  startTime: string;
  endTime: string;
  maxConsultants: number;
  maxResidents: number;
  consultantsActive?: number;
  residentsActive?: number;
}

export interface ShiftSession {
  id: number;
  shiftId: number;
  departmentId: number;
  userId: string;
  roleForShift: string;
  checkedInAt: string;
  checkedOutAt: string | null;
  status: string;
}

interface DepartmentContextType {
  department: Department | null;
  membership: DepartmentMembership | null;
  shifts: Shift[];
  shiftSession: ShiftSession | null;
  activeShift: Shift | null;
  isHOD: boolean;
  isInDepartment: boolean;
  incomingCount: number;
  pendingInvites: any[];
  isLoading: boolean;
  showShiftSelect: boolean;
  refresh: () => Promise<void>;
  checkIn: (shiftId: number, role: string) => Promise<{ success: boolean; error?: string }>;
  checkOut: (skipCheck?: boolean) => Promise<{ success: boolean; error?: string; pendingCases?: number }>;
  dismissShiftSelect: () => void;
  triggerShiftSelect: () => void;
}

const DepartmentContext = createContext<DepartmentContextType | undefined>(undefined);

export function DepartmentProvider({ children }: { children: ReactNode }) {
  const { user, token } = useAuth();
  const [department, setDepartment] = useState<Department | null>(null);
  const [membership, setMembership] = useState<DepartmentMembership | null>(null);
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [shiftSession, setShiftSession] = useState<ShiftSession | null>(null);
  const [activeShift, setActiveShift] = useState<Shift | null>(null);
  const [incomingCount, setIncomingCount] = useState(0);
  const [pendingInvites, setPendingInvites] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showShiftSelect, setShowShiftSelect] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  // Track previous session to detect auto-expiry
  const prevSessionIdRef = useRef<number | null>(null);
  const pollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const apiBase = () => getApiUrl();

  const authHeaders = useCallback(() => ({
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`,
  }), [token]);

  const refresh = useCallback(async () => {
    if (!user || !token) return;
    setIsLoading(true);
    try {
      const base = apiBase();

      const [myRes, sessionRes, invitesRes] = await Promise.all([
        fetch(`${base}/api/department/my`, { headers: authHeaders() }),
        fetch(`${base}/api/shifts/session/active`, { headers: authHeaders() }),
        fetch(`${base}/api/department/invites/pending`, { headers: authHeaders() }),
      ]);

      if (myRes.ok) {
        const data = await myRes.json();
        setDepartment(data.department);
        setMembership(data.membership);
        setShifts(data.shifts || []);
      }

      if (sessionRes.ok) {
        const data = await sessionRes.json();
        const newSession: ShiftSession | null = data.session;

        // Detect auto-expiry: we had a session, now we don't (and we didn't manually check out)
        if (prevSessionIdRef.current !== null && newSession === null) {
          Alert.alert(
            "Shift Ended",
            "Your shift session has expired automatically (1 hour after shift end time). Please check in again when your next shift starts.",
            [{ text: "OK" }]
          );
          setDismissed(false);
        }
        prevSessionIdRef.current = newSession?.id ?? null;

        setShiftSession(newSession);
        setActiveShift(data.shift);
      }

      if (invitesRes.ok) {
        const data = await invitesRes.json();
        setPendingInvites(data.invites || []);
      }
    } catch (e) {
      console.warn("[DepartmentContext] Refresh error:", e);
    } finally {
      setIsLoading(false);
    }
  }, [user, token, authHeaders]);

  // Initial load on login
  useEffect(() => {
    if (user && token) {
      setDismissed(false);
      prevSessionIdRef.current = null;
      refresh();
    } else {
      setDepartment(null);
      setMembership(null);
      setShifts([]);
      setShiftSession(null);
      setActiveShift(null);
      setIncomingCount(0);
      setPendingInvites([]);
      prevSessionIdRef.current = null;
    }
  }, [user?.id, token]);

  // Poll every 30 seconds when user is in a department to detect auto-expiry / force-logout
  useEffect(() => {
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current);
      pollIntervalRef.current = null;
    }
    if (user && token && department) {
      pollIntervalRef.current = setInterval(() => {
        refresh();
      }, 30000);
    }
    return () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
        pollIntervalRef.current = null;
      }
    };
  }, [user?.id, token, department?.id]);

  useEffect(() => {
    if (department && membership && !shiftSession && !dismissed && !isLoading) {
      setShowShiftSelect(true);
    } else {
      setShowShiftSelect(false);
    }
  }, [department, membership, shiftSession, dismissed, isLoading]);

  useEffect(() => {
    if (department && shiftSession) {
      const base = apiBase();
      fetch(`${base}/api/handover/incoming/${department.id}`, { headers: authHeaders() })
        .then((r) => r.json())
        .then((data) => setIncomingCount(data.incoming?.length || 0))
        .catch(() => {});
    } else {
      setIncomingCount(0);
    }
  }, [department?.id, shiftSession?.id]);

  const checkIn = useCallback(async (shiftId: number, role: string): Promise<{ success: boolean; error?: string }> => {
    if (!token) return { success: false, error: "Not authenticated" };
    try {
      const res = await fetch(`${apiBase()}/api/shifts/${shiftId}/checkin`, {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({ roleForShift: role }),
      });
      const data = await res.json();
      if (!res.ok) return { success: false, error: data.error || "Failed to check in" };
      prevSessionIdRef.current = data.session?.id ?? null;
      setShiftSession(data.session);
      setActiveShift(data.shift);
      setShowShiftSelect(false);
      return { success: true };
    } catch (e) {
      return { success: false, error: "Network error" };
    }
  }, [token, authHeaders]);

  const checkOut = useCallback(async (skipCheck = false): Promise<{ success: boolean; error?: string; pendingCases?: number }> => {
    if (!token || !shiftSession) return { success: false, error: "No active session" };
    try {
      const res = await fetch(`${apiBase()}/api/shifts/sessions/${shiftSession.id}/checkout`, {
        method: "POST",
        headers: authHeaders(),
      });
      const data = await res.json();
      if (!res.ok) return { success: false, error: data.error, pendingCases: data.pendingCases };
      prevSessionIdRef.current = null;
      setShiftSession(null);
      setActiveShift(null);
      setDismissed(false);
      return { success: true };
    } catch (e) {
      return { success: false, error: "Network error" };
    }
  }, [token, shiftSession, authHeaders]);

  const dismissShiftSelect = useCallback(() => {
    setDismissed(true);
    setShowShiftSelect(false);
  }, []);

  const triggerShiftSelect = useCallback(() => {
    setDismissed(false);
    setShowShiftSelect(true);
  }, []);

  const isHOD = membership?.role === "hod";
  const isInDepartment = !!department && !!membership;

  return (
    <DepartmentContext.Provider
      value={{
        department,
        membership,
        shifts,
        shiftSession,
        activeShift,
        isHOD,
        isInDepartment,
        incomingCount,
        pendingInvites,
        isLoading,
        showShiftSelect,
        refresh,
        checkIn,
        checkOut,
        dismissShiftSelect,
        triggerShiftSelect,
      }}
    >
      {children}
    </DepartmentContext.Provider>
  );
}

export function useDepartment() {
  const ctx = useContext(DepartmentContext);
  if (!ctx) throw new Error("useDepartment must be used within DepartmentProvider");
  return ctx;
}
