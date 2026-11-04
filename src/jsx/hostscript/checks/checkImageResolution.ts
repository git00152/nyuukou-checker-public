import type { CheckResult } from "../types";
import { createImageItemTargetRef } from "./targetRef";
import type { RunOptions } from "../runner";

export interface ImageItem {
  typename: "PlacedItem" | "RasterItem";
  name: string;
  file?: { fsName: string; exists?: boolean } | null;
  imageColorSpace?: unknown;
  matrix?: { mValueA: number; mValueB?: number; mValueC?: number; mValueD: number };
  resolution?: number | { horizontal: number; vertical: number };
  geometricBounds: [number, number, number, number];
  embedded?: boolean;
}

/**
 * アイテムの表示名を構築する。
 * item.name が空文字列の場合は file.fsName のベース名、
 * それも取得できない場合は "(不明)" をフォールバックとして使用する。
 *
 * NOTE: ExtendScript では PlacedItem.file が存在しない（リンク切れ）場合、
 * プロパティ参照自体が "There is no file associated with this item" 例外を投げる。
 * item.file へのアクセスは必ず try/catch で保護すること。
 */
function buildItemName(item: ImageItem): string {
  const label = item.typename === "PlacedItem" ? "\u30EA\u30F3\u30AF" : "\u57CB\u3081\u8FBC\u307F";
  let baseName = item.name;
  if (!baseName) {
    // ExtendScript では item.file アクセス自体が例外を投げる場合があるため try/catch で保護する
    try {
      var fileObj = item.file;
      if (fileObj && fileObj.fsName) {
        // fsName の最後のパス要素（ファイル名）を抽出する
        // ExtendScript の古い正規表現パーサは / を含む文字クラスを
        // 誤ってリテラル終端と解釈することがあるため、文字列APIだけで処理する。
        var fsName = fileObj.fsName;
        var separatorIndex = Math.max(fsName.lastIndexOf("/"), fsName.lastIndexOf("\\"));
        baseName = fsName.substring(separatorIndex + 1) || "";
      }
    } catch (e) {
      // item.file が例外を投げた場合（リンク切れ）は baseName を空のままにする
      baseName = "";
    }
  }
  if (!baseName) {
    baseName = "(\u4E0D\u660E)"; // (不明)
  }
  return baseName + " (" + label + ")";
}

const ALLOWED_COLOR_SPACES = [
  "ImageColorSpace.CMYK",
  "ImageColorSpace.Grayscale",
  "ImageColorSpace.GrayScale",
];

/**
 * バイナリヘッダ解析で取得したカラーモード文字列のうち印刷可として認めるもの。
 * (CMYK / Grayscale / Bitmap=1bit mono)
 */
const ALLOWED_FILE_COLOR_MODES = ["CMYK", "Grayscale", "Bitmap"];

/** RGB 入稿で認める imageColorSpace（埋め込み画像・取得できたリンク画像） */
const RGB_ALLOWED_COLOR_SPACES = [
  "ImageColorSpace.RGB",
  "ImageColorSpace.Grayscale",
  "ImageColorSpace.GrayScale",
];

/** RGB 入稿で認めるファイルのカラーモード (RGB / Grayscale / Bitmap=1bit mono) */
const RGB_ALLOWED_FILE_COLOR_MODES = ["RGB", "Grayscale", "Bitmap"];

function containsString(list: string[], value: string): boolean {
  for (let k = 0; k < list.length; k++) {
    if (list[k] === value) return true;
  }
  return false;
}

interface ColorModeIssue {
  severity: CheckResult["severity"];
  messageKey: string;
  message: string;
}

/**
 * カラーモードを入稿プロファイルに照らして判定する。問題がなければ null。
 *
 * @param mode       imageColorSpace の文字列（"ImageColorSpace.RGB" 等）またはファイル解析結果（"RGB" 等）
 * @param fromFile   true: ファイル解析結果 / false: imageColorSpace
 */
function evaluateColorMode(mode: string, fromFile: boolean, name: string, opts: RunOptions): ColorModeIssue | null {
  if (opts.colorWorkflow === "rgb") {
    if (containsString(fromFile ? RGB_ALLOWED_FILE_COLOR_MODES : RGB_ALLOWED_COLOR_SPACES, mode)) return null;
    if (mode === "CMYK" || mode === "ImageColorSpace.CMYK") {
      return {
        severity: "WARNING",
        messageKey: "IMG_COLOR_SPACE_CMYK_IN_RGB_01",
        message: "RGB \u5165\u7A3F\u306B CMYK \u753B\u50CF\u304C\u542B\u307E\u308C\u3066\u3044\u307E\u3059\uFF08RGB \u5370\u5237\u306E\u52B9\u679C\u304C\u5F97\u3089\u308C\u307E\u305B\u3093\uFF09: \"" + name + "\" (" + mode + ")",
      };
    }
    return {
      severity: "ERROR",
      messageKey: "IMG_COLOR_SPACE_RGB_01",
      message: "\u914D\u7F6E\u753B\u50CF\u306E\u30AB\u30E9\u30FC\u30E2\u30FC\u30C9\u304C RGB/\u30B0\u30EC\u30FC\u30B9\u30B1\u30FC\u30EB/\u30E2\u30CE\u30AF\u30ED\u4EE5\u5916\u3067\u3059: \"" + name + "\" (" + mode + ")",
    };
  }
  if (containsString(fromFile ? ALLOWED_FILE_COLOR_MODES : ALLOWED_COLOR_SPACES, mode)) return null;
  return {
    severity: "ERROR",
    messageKey: "IMG_COLOR_SPACE_01",
    message: "\u914D\u7F6E\u753B\u50CF\u306E\u30AB\u30E9\u30FC\u30E2\u30FC\u30C9\u304C CMYK/\u30B0\u30EC\u30FC\u30B9\u30B1\u30FC\u30EB/\u30E2\u30CE\u30AF\u30ED\u4EE5\u5916\u3067\u3059: \"" + name + "\" (" + mode + ")",
  };
}

const RESOLUTION_ERROR_THRESHOLD = 300;
const RESOLUTION_WARN_THRESHOLD = 350;
const RESOLUTION_LARGE_PRINT_THRESHOLD = 200;

/**
 * 画像アイテムから DPI を取得・推算する。
 *
 * 優先順位:
 * 1. _dpiMap（テスト専用注入）がある場合はそれを使用
 * 2. RasterItem: resolution.horizontal/vertical を使用（JSX版と同じ）
 * 3. PlacedItem: matrix.mValueA/mValueD から算出（JSX版と同じ: 72 / scale）
 * 4. いずれも取得できない場合は null を返す
 */
function validDpi(value: number): number | null {
  return isFinite(value) && value > 0 ? value : null;
}

function estimateDpi(
  item: ImageItem,
  dpiMap?: Record<string, number>
): number | null {
  if (dpiMap && Object.prototype.hasOwnProperty.call(dpiMap, item.name)) {
    return validDpi(dpiMap[item.name]);
  }
  // A placed vector container has no single raster DPI.
  if (item.typename === "PlacedItem") {
    try {
      var file = item.file;
      if (file && /\.(ai|pdf|eps|svg)$/i.test(file.fsName)) return null;
    } catch (_) { return null; }
  }
  // RasterItem（埋め込み）: resolution プロパティを直接使用
  // resolution が提供される場合だけ利用し、なければ matrix から推算する。
  if (item.typename === "RasterItem" && item.resolution != null) {
    var res = item.resolution;
    if (typeof res === "number") return validDpi(res);
    if (typeof res.horizontal === "number" && typeof res.vertical === "number") {
      return validDpi(Math.min(res.horizontal, res.vertical));
    }
  }
  // PlacedItem / RasterItem 共通: matrix のスケール値から実効 DPI を算出
  // Illustrator の座標単位は pt (1/72 inch) のため 72 / scale = DPI
  // RasterItem も matrix を持つため、resolution が取得できない場合のフォールバックとして使用
  if (item.matrix != null) {
    var a = item.matrix.mValueA;
    var b = item.matrix.mValueB == null ? 0 : item.matrix.mValueB;
    var c = item.matrix.mValueC == null ? 0 : item.matrix.mValueC;
    var d = item.matrix.mValueD;
    // 列ベクトルの大きさでスケールを計算（回転に対応）
    var scaleX = Math.sqrt(a * a + b * b);
    var scaleY = Math.sqrt(c * c + d * d);
    if (scaleX > 0 && scaleY > 0) {
      return validDpi(72 / Math.max(scaleX, scaleY));
    }
  }
  return null;
}

/**
 * PlacedItem / RasterItem のリストに対して解像度・リンク切れ・カラーモードをチェックする。
 *
 * @param items  チェック対象の画像アイテム一覧
 * @param options  実行オプション（largePrintMode 等）
 * @param _dpiMap  テスト専用: { [itemName]: dpi } でアイテム名ごとに DPI 値を直接注入する
 * @param _colorReader  リンク画像のカラーモードを取得する関数。
 *   本番では readLinkedImageColorMode を渡す。テストではモック関数を渡すこと。
 *   未指定時は従来どおり IMG_COLOR_SPACE_MANUAL_01 INFO を出力する。
 */
export function checkImageResolution(
  items: ImageItem[],
  options?: RunOptions,
  _dpiMap?: Record<string, number>,
  _colorReader?: (fsName: string) => string | null
): CheckResult[] {
  const opts = options ?? {};
  const results: CheckResult[] = [];
  var colorCache: { [key: string]: string | null } = {};

  // ExtendScript (ES3) 互換: for...of は使用不可。インデックスループを使用する。
  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    const name = buildItemName(item);
    const gb = item.geometricBounds;
    const bounds: [number, number, number, number] = [gb[0], gb[1], gb[2], gb[3]];
    const makeImageResult = (
      severity: CheckResult["severity"],
      messageKey: string,
      message: string,
    ): CheckResult => ({
      severity,
      messageKey,
      message,
      objectName: item.name,
      bounds,
      targetRef: createImageItemTargetRef(item, messageKey, i, bounds),
    });

    // IMG-04: リンク切れチェック (PlacedItem のみ)
    // NOTE: ExtendScript では item.file プロパティへの参照自体が
    // "There is no file associated with this item" 例外を投げる場合がある。
    // try/catch で保護し、例外が発生した場合もリンク切れとして扱う。
    if (item.typename === "PlacedItem") {
      var hasFile = false;
      try {
        var linkedFile = item.file;
        hasFile = !!linkedFile && linkedFile.exists !== false;
      } catch (e) {
        // item.file アクセスで例外 → リンク切れ
        hasFile = false;
      }
      if (!hasFile) {
        results.push(makeImageResult("ERROR", "IMG_LINK_BROKEN_01", "\u30EA\u30F3\u30AF\u5207\u308C: \"" + name + "\""));
        continue;
      }
    }

    // IMG-05: カラーモードチェック (RasterItem および PlacedItem)
    // PlacedItem (リンク画像) も imageColorSpace を持つ場合があるため typename を限定しない
    if (item.imageColorSpace != null) {
      const spaceIssue = evaluateColorMode(String(item.imageColorSpace), false, name, opts);
      if (spaceIssue) {
        results.push(makeImageResult(spaceIssue.severity, spaceIssue.messageKey, spaceIssue.message));
      }
    } else if (item.typename === "PlacedItem") {
      var fileColorMode: string | null = null;
      var fsNameForRead: string | null = null;
      try {
        var sourceFile = item.file;
        fsNameForRead = sourceFile ? sourceFile.fsName : null;
      } catch (_) { /* unavailable link */ }
      if (_colorReader && fsNameForRead) {
        var cacheKey = "$" + fsNameForRead;
        if (Object.prototype.hasOwnProperty.call(colorCache, cacheKey)) {
          fileColorMode = colorCache[cacheKey];
        } else {
          try { fileColorMode = _colorReader(fsNameForRead); } catch (_) { /* report unknown */ }
          colorCache[cacheKey] = fileColorMode;
        }
      }

      if (fileColorMode !== null) {
        // カラーモードを取得できた場合: 入稿プロファイルの許可リストと照合する
        var fileIssue = evaluateColorMode(fileColorMode, true, name, opts);
        if (fileIssue) {
          results.push(makeImageResult(fileIssue.severity, fileIssue.messageKey, fileIssue.message));
        }
      } else {
        // カラーモードを取得できない場合: ユーザーに手動確認を促す INFO
        results.push(makeImageResult("INFO", "IMG_COLOR_SPACE_MANUAL_01", "\u30EA\u30F3\u30AF\u753B\u50CF\u306E\u30AB\u30E9\u30FC\u30E2\u30FC\u30C9\u306F\u81EA\u52D5\u78BA\u8A8D\u3067\u304D\u307E\u305B\u3093 \u2014 Illustrator\u306E\u30EA\u30F3\u30AF\u30D1\u30CD\u30EB\u3067\u78BA\u8A8D\u3057\u3066\u304F\u3060\u3055\u3044: \"" + name + "\""));
      }
    }

    // IMG-01/02/03: 解像度チェック
    const dpi = estimateDpi(item, _dpiMap);
    var dpiLabel = dpi === null ? "" : String(Math.floor((dpi + 1e-7) * 10) / 10);
    // Ignore only floating-point noise at an exact threshold.
    if (dpi === null) {
      results.push(makeImageResult("INFO", "IMG_RESOLUTION_UNKNOWN_01", "\u89E3\u50CF\u5EA6\u306E\u53D6\u5F97\u304C\u3067\u304D\u307E\u305B\u3093\u3067\u3057\u305F \u2014 Illustrator \u30D1\u30CD\u30EB\u3067\u76F4\u63A5\u78BA\u8A8D\u3057\u3066\u304F\u3060\u3055\u3044: \"" + name + "\""));
    } else if (opts.largePrintMode) {
      if (dpi < RESOLUTION_LARGE_PRINT_THRESHOLD - 1e-7) {
        results.push(makeImageResult("ERROR", "IMG_RESOLUTION_LOW_01", "\u914D\u7F6E\u753B\u50CF\u306E\u89E3\u50CF\u5EA6\u304C " + dpiLabel + "dpi\uFF08\u5927\u5224\u30E2\u30FC\u30C9\u3067\u3082 " + RESOLUTION_LARGE_PRINT_THRESHOLD + "dpi \u672A\u6E80\u306E\u305F\u3081 ERROR\uFF09: \"" + name + "\""));
      } else if (dpi < RESOLUTION_ERROR_THRESHOLD - 1e-7) {
        results.push(makeImageResult("INFO", "IMG_RESOLUTION_LARGE_PRINT_01", "\u914D\u7F6E\u753B\u50CF\u306E\u89E3\u50CF\u5EA6\u304C " + dpiLabel + "dpi\uFF08\u5927\u5224\u5370\u5237\u30E2\u30FC\u30C9: " + RESOLUTION_LARGE_PRINT_THRESHOLD + "dpi \u4EE5\u4E0A\u306E\u305F\u3081 INFO\uFF09: \"" + name + "\""));
      }
    } else {
      if (dpi < RESOLUTION_ERROR_THRESHOLD - 1e-7) {
        results.push(makeImageResult("ERROR", "IMG_RESOLUTION_LOW_01", "\u914D\u7F6E\u753B\u50CF\u306E\u89E3\u50CF\u5EA6\u304C " + dpiLabel + "dpi\uFF08" + RESOLUTION_ERROR_THRESHOLD + "dpi \u672A\u6E80\uFF09: \"" + name + "\""));
      } else if (dpi < RESOLUTION_WARN_THRESHOLD - 1e-7) {
        results.push(makeImageResult("WARNING", "IMG_RESOLUTION_WARN_01", "\u914D\u7F6E\u753B\u50CF\u306E\u89E3\u50CF\u5EA6\u304C " + dpiLabel + "dpi\uFF08" + RESOLUTION_ERROR_THRESHOLD + "dpi \u4EE5\u4E0A " + RESOLUTION_WARN_THRESHOLD + "dpi \u672A\u6E80\uFF09: \"" + name + "\""));
      }
    }
  }

  return results;
}
