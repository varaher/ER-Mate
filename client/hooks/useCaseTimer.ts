import AsyncStorage from "@react-native-async-storage/async-storage";

const CASE_LOG_KEY = "case_time_log_v2";
const AVG_PAPER_MINUTES = 18;

export interface CaseTimeEntry {
  caseId: string;
  durationMinutes: number;
  date: string;
  complaint?: string;
}

export async function recordCaseTime(
  caseId: string,
  durationMinutes: number,
  complaint?: string
): Promise<void> {
  try {
    const raw = await AsyncStorage.getItem(CASE_LOG_KEY);
    const log: CaseTimeEntry[] = raw ? JSON.parse(raw) : [];
    const existing = log.findIndex((e) => e.caseId === caseId);
    const entry: CaseTimeEntry = {
      caseId,
      durationMinutes: Math.max(1, Math.round(durationMinutes)),
      date: new Date().toISOString(),
      complaint,
    };
    if (existing >= 0) {
      log[existing] = entry;
    } else {
      log.push(entry);
    }
    if (log.length > 300) log.splice(0, log.length - 300);
    await AsyncStorage.setItem(CASE_LOG_KEY, JSON.stringify(log));
  } catch {}
}

export async function getCaseTimeLog(): Promise<CaseTimeEntry[]> {
  try {
    const raw = await AsyncStorage.getItem(CASE_LOG_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function getTimeSavedMinutes(durationMinutes: number): number {
  return Math.max(0, AVG_PAPER_MINUTES - durationMinutes);
}

export async function getWeeklyStats(): Promise<{
  count: number;
  totalSavedMinutes: number;
  avgDurationMinutes: number;
  topComplaints: { complaint: string; count: number }[];
}> {
  try {
    const log = await getCaseTimeLog();
    const weekStart = new Date();
    weekStart.setDate(weekStart.getDate() - weekStart.getDay());
    weekStart.setHours(0, 0, 0, 0);
    const thisWeek = log.filter((e) => new Date(e.date) >= weekStart);
    const count = thisWeek.length;
    const totalDuration = thisWeek.reduce((sum, e) => sum + e.durationMinutes, 0);
    const avgDurationMinutes = count > 0 ? Math.round(totalDuration / count) : 0;
    const totalSavedMinutes = thisWeek.reduce(
      (sum, e) => sum + getTimeSavedMinutes(e.durationMinutes),
      0
    );
    const complaintMap: Record<string, number> = {};
    thisWeek.forEach((e) => {
      if (e.complaint) {
        const key = e.complaint.trim().toLowerCase().slice(0, 40);
        complaintMap[key] = (complaintMap[key] || 0) + 1;
      }
    });
    const topComplaints = Object.entries(complaintMap)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([complaint, count]) => ({
        complaint: complaint.charAt(0).toUpperCase() + complaint.slice(1),
        count,
      }));
    return { count, totalSavedMinutes, avgDurationMinutes, topComplaints };
  } catch {
    return { count: 0, totalSavedMinutes: 0, avgDurationMinutes: 0, topComplaints: [] };
  }
}

export async function getAllTimeStats(): Promise<{
  totalCases: number;
  totalSavedMinutes: number;
}> {
  try {
    const log = await getCaseTimeLog();
    const totalCases = log.length;
    const totalSavedMinutes = log.reduce(
      (sum, e) => sum + getTimeSavedMinutes(e.durationMinutes),
      0
    );
    return { totalCases, totalSavedMinutes };
  } catch {
    return { totalCases: 0, totalSavedMinutes: 0 };
  }
}
