import { useState, useEffect, useCallback } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useColorScheme as useRNColorScheme } from "react-native";

export type NightShiftPref = "auto" | "dark" | "light";
const PREF_KEY = "theme_night_shift_pref";

function isNightHour(): boolean {
  const h = new Date().getHours();
  return h >= 21 || h < 6;
}

export function useNightShift() {
  const deviceScheme = useRNColorScheme();
  const [pref, setPrefState] = useState<NightShiftPref>("auto");
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(PREF_KEY)
      .then((val) => {
        if (val === "auto" || val === "dark" || val === "light") {
          setPrefState(val);
        }
        setLoaded(true);
      })
      .catch(() => setLoaded(true));
  }, []);

  const setPref = useCallback(async (p: NightShiftPref) => {
    setPrefState(p);
    try {
      await AsyncStorage.setItem(PREF_KEY, p);
    } catch {}
  }, []);

  let effectiveScheme: "light" | "dark";
  if (!loaded) {
    effectiveScheme = deviceScheme === "dark" ? "dark" : "light";
  } else if (pref === "dark") {
    effectiveScheme = "dark";
  } else if (pref === "light") {
    effectiveScheme = "light";
  } else {
    effectiveScheme =
      isNightHour() ? "dark" : deviceScheme === "dark" ? "dark" : "light";
  }

  return {
    pref,
    setPref,
    effectiveScheme,
    isNightTime: isNightHour(),
  };
}
