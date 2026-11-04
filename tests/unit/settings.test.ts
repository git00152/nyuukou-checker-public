import { describe, it, expect, vi, afterEach } from "vitest";
import { DEFAULT_SETTINGS, SETTINGS_STORAGE_KEY, loadSettings, saveSettings } from "../../src/js/main/settings";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("settings の保存と復元", () => {
  it("既定の入稿プロファイルは cmyk", () => {
    expect(DEFAULT_SETTINGS.colorWorkflow).toBe("cmyk");
  });

  it("保存がない場合は既定値を返す", () => {
    expect(loadSettings()).toEqual(DEFAULT_SETTINGS);
  });

  it("保存した設定を復元できる", () => {
    const next = { ...DEFAULT_SETTINGS, colorWorkflow: "rgb" as const, largePrintMode: true };
    saveSettings(next);
    expect(loadSettings()).toEqual(next);
  });

  it("壊れた JSON は既定値にフォールバックする", () => {
    window.localStorage.setItem(SETTINGS_STORAGE_KEY, "{broken");
    expect(loadSettings()).toEqual(DEFAULT_SETTINGS);
  });

  it("不明な値・型違いの値は既定値で補う", () => {
    window.localStorage.setItem(
      SETTINGS_STORAGE_KEY,
      JSON.stringify({ colorWorkflow: "lab", largePrintMode: "yes", includeGuides: true, extra: 1 })
    );
    expect(loadSettings()).toEqual({ ...DEFAULT_SETTINGS, includeGuides: true });
  });

  it("localStorage が例外を投げても既定値を返し、保存は失敗しても例外を投げない", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => { throw new Error("blocked"); });
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => { throw new Error("blocked"); });
    expect(loadSettings()).toEqual(DEFAULT_SETTINGS);
    expect(() => saveSettings(DEFAULT_SETTINGS)).not.toThrow();
  });
});
