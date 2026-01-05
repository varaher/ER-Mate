import { Platform } from "react-native";

// ErMate Medical Theme - Emergency Room EMR
const tintColorLight = "#2563eb";
const tintColorDark = "#3b82f6";

export const Colors = {
  light: {
    text: "#1e293b",
    textSecondary: "#64748b",
    textMuted: "#94a3b8",
    buttonText: "#FFFFFF",
    tabIconDefault: "#64748b",
    tabIconSelected: tintColorLight,
    link: "#2563eb",
    backgroundRoot: "#FFFFFF",
    backgroundDefault: "#f8fafc",
    backgroundSecondary: "#f1f5f9",
    backgroundTertiary: "#e2e8f0",
    primary: "#2563eb",
    primaryDark: "#1e40af",
    primaryLight: "#eff6ff",
    success: "#22c55e",
    successLight: "#f0fdf4",
    warning: "#f97316",
    warningLight: "#fff7ed",
    danger: "#dc2626",
    dangerLight: "#fef2f2",
    info: "#3b82f6",
    infoLight: "#eff6ff",
    border: "#e2e8f0",
    borderLight: "#f1f5f9",
    card: "#FFFFFF",
    cardElevated: "#FFFFFF",
  },
  dark: {
    text: "#f1f5f9",
    textSecondary: "#94a3b8",
    textMuted: "#64748b",
    buttonText: "#FFFFFF",
    tabIconDefault: "#64748b",
    tabIconSelected: tintColorDark,
    link: "#3b82f6",
    backgroundRoot: "#0f172a",
    backgroundDefault: "#1e293b",
    backgroundSecondary: "#334155",
    backgroundTertiary: "#475569",
    primary: "#3b82f6",
    primaryDark: "#2563eb",
    primaryLight: "#1e3a5f",
    success: "#22c55e",
    successLight: "#14532d",
    warning: "#f97316",
    warningLight: "#7c2d12",
    danger: "#ef4444",
    dangerLight: "#7f1d1d",
    info: "#3b82f6",
    infoLight: "#1e3a5f",
    border: "#334155",
    borderLight: "#1e293b",
    card: "#1e293b",
    cardElevated: "#334155",
  },
};

// Triage Priority Colors
export const TriageColors = {
  red: "#ef4444",
  orange: "#f97316",
  yellow: "#eab308",
  green: "#22c55e",
  blue: "#3b82f6",
  gray: "#6b7280",
};

export const Spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  "2xl": 24,
  "3xl": 32,
  "4xl": 40,
  "5xl": 48,
  inputHeight: 48,
  buttonHeight: 52,
};

export const BorderRadius = {
  xs: 6,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  "2xl": 24,
  "3xl": 32,
  full: 9999,
};

export const Typography = {
  h1: {
    fontSize: 28,
    fontWeight: "800" as const,
  },
  h2: {
    fontSize: 24,
    fontWeight: "700" as const,
  },
  h3: {
    fontSize: 20,
    fontWeight: "700" as const,
  },
  h4: {
    fontSize: 18,
    fontWeight: "600" as const,
  },
  body: {
    fontSize: 16,
    fontWeight: "400" as const,
  },
  bodyMedium: {
    fontSize: 15,
    fontWeight: "500" as const,
  },
  small: {
    fontSize: 14,
    fontWeight: "400" as const,
  },
  label: {
    fontSize: 13,
    fontWeight: "600" as const,
  },
  caption: {
    fontSize: 12,
    fontWeight: "400" as const,
  },
  link: {
    fontSize: 16,
    fontWeight: "500" as const,
  },
};

export const Shadows = {
  sm: Platform.select({
    ios: {
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.05,
      shadowRadius: 2,
    },
    android: {
      elevation: 1,
    },
    default: {},
  }),
  md: Platform.select({
    ios: {
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 4,
    },
    android: {
      elevation: 3,
    },
    default: {},
  }),
  lg: Platform.select({
    ios: {
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.15,
      shadowRadius: 8,
    },
    android: {
      elevation: 6,
    },
    default: {},
  }),
};

export const Fonts = Platform.select({
  ios: {
    sans: "system-ui",
    serif: "ui-serif",
    rounded: "ui-rounded",
    mono: "ui-monospace",
  },
  default: {
    sans: "normal",
    serif: "serif",
    rounded: "normal",
    mono: "monospace",
  },
  web: {
    sans: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
    serif: "Georgia, 'Times New Roman', serif",
    rounded: "'SF Pro Rounded', 'Hiragino Maru Gothic ProN', Meiryo, 'MS PGothic', sans-serif",
    mono: "SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace",
  },
});
