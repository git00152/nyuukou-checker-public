import type React from "react";
import type { CheckResult } from "../../../jsx/hostscript/types";

export const colors = {
  appBg: "#0f1117",
  panelBg: "#13151f",
  panelBgStrong: "#0d1018",
  panelBgRaised: "rgba(255,255,255,0.05)",
  panelBorder: "#1e2332",
  panelBorderSoft: "rgba(226,232,240,0.12)",
  text: "#e2e8f0",
  textMuted: "#8892a4",
  textSubtle: "#94a3b8",
  previewBg: "#f8f9fa",
  previewToolbarBg: "#eef2f7",
  previewBorder: "#d7dde8",
  artboardBg: "#ffffff",
  focus: "#93c5fd",
  primary: "#3b82f6",
  primaryStrong: "#2563eb",
  success: "#4ade80",
  successText: "#86efac",
  error: "#f87171",
  errorStrong: "#e53e3e",
  warning: "#fbbf24",
  warningStrong: "#d69e2e",
  info: "#60a5fa",
  infoStrong: "#3182ce",
};

export const severityColors: Record<CheckResult["severity"], string> = {
  ERROR: colors.error,
  WARNING: colors.warning,
  INFO: colors.info,
};

export const svgSeverityColors: Record<CheckResult["severity"], string> = {
  ERROR: colors.errorStrong,
  WARNING: colors.warningStrong,
  INFO: colors.infoStrong,
};

export const spacing = {
  xs: 4,
  sm: 6,
  md: 8,
  lg: 12,
  xl: 16,
  xxl: 32,
};

export const radii = {
  sm: 6,
  md: 8,
  lg: 12,
  pill: 999,
};

export const shadows = {
  card: "0 2px 8px rgba(0,0,0,0.28)",
  cardActive: "0 4px 16px rgba(0,0,0,0.40)",
  artboard: "0 8px 24px rgba(15, 23, 42, 0.16)",
  primary: "0 2px 8px rgba(59, 130, 246, 0.4)",
};

export const fontSizes = {
  xs: 10,
  sm: 11,
  md: 12,
  lg: 13,
};

export const panelSectionStyle: React.CSSProperties = {
  padding: `${spacing.md}px ${spacing.lg - 2}px`,
  borderBottom: `1px solid ${colors.panelBorder}`,
  flexShrink: 0,
};
