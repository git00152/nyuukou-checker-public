import type { CheckResult } from "../types";

export interface DocumentForColorCheck {
  documentColorSpace: unknown;
}

export function checkDocumentColor(doc: DocumentForColorCheck): CheckResult[] {
  const cs = String(doc.documentColorSpace ?? "");
  if (cs.indexOf("CMYK") === -1) {
    return [
      {
        severity: "ERROR",
        messageKey: "COLOR_DOC_MODE_01",
        message: "\u30C9\u30AD\u30E5\u30E1\u30F3\u30C8\u306E\u30AB\u30E9\u30FC\u30E2\u30FC\u30C9\u304C CMYK \u3067\u306F\u3042\u308A\u307E\u305B\u3093\uFF08\u73FE\u5728: " + (cs || "\u4E0D\u660E") + "\uFF09\u3002\u5165\u7A3F\u524D\u306B CMYK \u306B\u5909\u63DB\u3057\u3066\u304F\u3060\u3055\u3044\u3002",
      },
    ];
  }
  return [];
}
