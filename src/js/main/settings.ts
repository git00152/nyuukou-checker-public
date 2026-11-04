import type { ColorWorkflow } from "../../jsx/hostscript/profiles";

export type { ColorWorkflow };

export interface AppSettings {
  colorWorkflow: ColorWorkflow;
  largePrintMode: boolean;
  detectOpenPaths: boolean;
  detectFilledOpenPaths: boolean;
  includeGuides: boolean;
  includeTrimMarkLayers: boolean;
  autoPanToSelection: boolean;
  confirmBeforeDelete: boolean;
}

export type BooleanSettingKey = Exclude<keyof AppSettings, "colorWorkflow">;

export const DEFAULT_SETTINGS: AppSettings = {
  colorWorkflow: "cmyk",
  largePrintMode: false,
  detectOpenPaths: true,
  detectFilledOpenPaths: true,
  includeGuides: false,
  includeTrimMarkLayers: false,
  autoPanToSelection: true,
  confirmBeforeDelete: true,
};

export const SETTINGS_STORAGE_KEY = "nyuukou-checker.settings.v1";

/**
 * localStorage から設定を復元する。保存がない・壊れている・読めない場合は既定値。
 * 未知の値や型違いの値は既定値で補う（入稿プロファイルの誤復元で判定基準が変わるのを防ぐ）。
 */
export function loadSettings(): AppSettings {
  let raw: string | null = null;
  try {
    raw = window.localStorage.getItem(SETTINGS_STORAGE_KEY);
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
  if (!raw) return { ...DEFAULT_SETTINGS };

  let parsed: Record<string, unknown>;
  try {
    const value = JSON.parse(raw);
    if (!value || typeof value !== "object") return { ...DEFAULT_SETTINGS };
    parsed = value as Record<string, unknown>;
  } catch {
    return { ...DEFAULT_SETTINGS };
  }

  const next: AppSettings = { ...DEFAULT_SETTINGS };
  if (parsed.colorWorkflow === "cmyk" || parsed.colorWorkflow === "rgb") {
    next.colorWorkflow = parsed.colorWorkflow;
  }
  for (const key of Object.keys(DEFAULT_SETTINGS) as Array<keyof AppSettings>) {
    if (key === "colorWorkflow") continue;
    if (typeof parsed[key] === "boolean") {
      next[key] = parsed[key] as boolean;
    }
  }
  return next;
}

export function saveSettings(settings: AppSettings): void {
  try {
    window.localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(settings));
  } catch {
    // 保存できない環境（プライベートモード等）では保持しないだけで動作は継続する
  }
}
