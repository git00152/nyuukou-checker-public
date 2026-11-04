import type { CheckResult } from "../types";
import type { ColorWorkflow } from "../profiles";

export interface DocumentForColorCheck {
  documentColorSpace: unknown;
}

export function checkDocumentColor(doc: DocumentForColorCheck, colorWorkflow?: ColorWorkflow): CheckResult[] {
  const cs = String(doc.documentColorSpace ?? "");
  if (colorWorkflow === "rgb") {
    // RGB 入稿: CMYK モードのまま入稿すると RGB 印刷の効果が得られない
    if (cs.indexOf("RGB") === -1) {
      return [
        {
          severity: "ERROR",
          messageKey: "COLOR_DOC_MODE_RGB_01",
          message: "ドキュメントのカラーモードが RGB ではありません（現在: " + (cs || "不明") + "）。RGB 入稿では RGB モードで作成してください。",
        },
      ];
    }
    return [];
  }
  if (cs.indexOf("CMYK") === -1) {
    return [
      {
        severity: "ERROR",
        messageKey: "COLOR_DOC_MODE_01",
        message: "ドキュメントのカラーモードが CMYK ではありません（現在: " + (cs || "不明") + "）。入稿前に CMYK に変換してください。",
      },
    ];
  }
  return [];
}
