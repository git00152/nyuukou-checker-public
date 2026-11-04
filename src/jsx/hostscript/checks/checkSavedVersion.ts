import type { CheckResult } from "../types";

export interface SavedVersionInfo {
  year?: number;
  source: "document-metadata" | "file-header" | "unknown";
  reason?: string;
}

// Supply only an adapter validated against real saved AI files. No production
// adapter is installed until a reliable compatibility-version source is verified.
export type SavedVersionReader = (doc: Document) => SavedVersionInfo;

export function readSavedVersion(doc: Document, reader?: SavedVersionReader): SavedVersionInfo {
  if (reader) {
    try {
      var info = reader(doc);
      if (info && info.source !== "unknown" && typeof info.year === "number" && isFinite(info.year) && Math.floor(info.year) === info.year && info.year >= 1900 && info.year <= 2100) return info;
    } catch (_) { /* An unavailable adapter must not fail the board scan. */ }
  }
  return { source: "unknown", reason: "保存互換バージョンの検証済み取得経路がありません。最終保存ファイルの形式を確認してください。" };
}

export function checkSavedVersion(doc: Document, latestYear = 2020, reader?: SavedVersionReader): CheckResult[] {
  var info = readSavedVersion(doc, reader);
  if (info.year === latestYear) return [];
  if (info.year !== undefined) {
    return [{ severity: "INFO", messageKey: "DOCUMENT_SAVE_VERSION_01",
      message: "Illustrator保存バージョン " + info.year + "。基準バージョン（" + latestYear + "）より" + (info.year < latestYear ? "古い" : "新しい") + "ため、互換性を確認してください。" }];
  }
  return [{ severity: "INFO", messageKey: "DOCUMENT_SAVE_VERSION_UNKNOWN", message: "Illustrator保存バージョンを取得できません。" + info.reason }];
}
