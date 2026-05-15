import { useState, useEffect, useCallback } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";

function getWeekKey(): string {
  const now = new Date();
  const year = now.getFullYear();
  const weekStart = new Date(now);
  weekStart.setDate(now.getDate() - now.getDay());
  const week = Math.floor(
    (weekStart.getTime() - new Date(year, 0, 1).getTime()) /
      (7 * 24 * 3600 * 1000)
  );
  return `trivia_weekly_${year}_w${week}`;
}

export function useTriviaStreak() {
  const [weeklyCount, setWeeklyCount] = useState(0);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const key = getWeekKey();
      const raw = await AsyncStorage.getItem(key);
      setWeeklyCount(raw ? parseInt(raw, 10) : 0);
    } catch {}
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const increment = useCallback(async (): Promise<number> => {
    try {
      const key = getWeekKey();
      const raw = await AsyncStorage.getItem(key);
      const current = raw ? parseInt(raw, 10) : 0;
      const next = current + 1;
      await AsyncStorage.setItem(key, String(next));
      setWeeklyCount(next);
      return next;
    } catch {
      return weeklyCount;
    }
  }, [weeklyCount]);

  return { weeklyCount, loading, increment, reload: load };
}
