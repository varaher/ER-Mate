import { Colors } from "@/constants/theme";
import { useNightShift } from "@/hooks/useNightShift";

export function useTheme() {
  const { effectiveScheme, pref, setPref, isNightTime } = useNightShift();
  const isDark = effectiveScheme === "dark";
  const theme = Colors[effectiveScheme];

  return {
    theme,
    isDark,
    nightShift: { pref, setPref, isNightTime },
  };
}
