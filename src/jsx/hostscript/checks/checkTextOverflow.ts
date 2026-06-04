import { CheckResult } from "../types";
import { createTextFrameTargetRef } from "./targetRef";

type TextLineLike = { contents?: string };

function getCollectionLength(collection: unknown): number {
  try {
    return typeof (collection as { length?: unknown }).length === "number"
      ? (collection as { length: number }).length
      : 0;
  } catch (e) {
    return 0;
  }
}

function getLineAt(collection: unknown, index: number): TextLineLike | null {
  try {
    return (collection as { [key: number]: TextLineLike })[index] || null;
  } catch (e) {
    return null;
  }
}

function visibleTextLengthFromLines(lines: unknown): number | null {
  const lineCount = getCollectionLength(lines);
  if (lineCount === 0) return null;

  let visibleLength = 0;
  for (let i = 0; i < lineCount; i++) {
    const line = getLineAt(lines, i);
    if (!line || typeof line.contents !== "string") return null;
    visibleLength += line.contents.length;
  }

  // TextFrame.contents includes line breaks, while line.contents does not.
  return visibleLength + Math.max(0, lineCount - 1);
}

function isTextOverflowing(frame: {
  overflows?: unknown;
  contents?: unknown;
  lines?: unknown;
}): boolean {
  if (frame.overflows === true) return true;

  const contents = typeof frame.contents === "string" ? frame.contents : "";
  if (contents.length === 0) return false;

  const visibleLength = visibleTextLengthFromLines(frame.lines);
  if (visibleLength === null) return false;

  return contents.length > visibleLength;
}

export function checkTextOverflow(textFrames: TextFrame[]): CheckResult[] {
  const results: CheckResult[] = [];

  // ExtendScript (ES3) 互換: for...of は使用不可。インデックスループを使用する。
  for (let i = 0; i < textFrames.length; i++) {
    const tf = textFrames[i];
    const frame = tf as unknown as {
      overflows: unknown;
      contents: unknown;
      lines: unknown;
      name: string;
      layer?: { name: string };
      geometricBounds: [number, number, number, number];
    };

    if (isTextOverflowing(frame)) {
      // ExtendScript 互換: geometricBounds は Illustrator ネイティブ配列のため
      // json2.js でシリアライズすると {"0":x,...} になる場合がある。
      // プレーン JS 配列に変換して確実に JSON 配列形式でシリアライズされるようにする。
      const gb = frame.geometricBounds;
      const bounds = [gb[0], gb[1], gb[2], gb[3]] as [number, number, number, number];
      results.push({
        severity: "ERROR",
        messageKey: "PATH_OVERFLOW_01",
        message: "\u30C6\u30AD\u30B9\u30C8\u30DC\u30C3\u30AF\u30B9\u304B\u3089\u30C6\u30AD\u30B9\u30C8\u304C\u3042\u3075\u308C\u3066\u3044\u307E\u3059\uFF08\u6EA2\u308C\u6587\u5B57\uFF09",
        objectName: frame.name,
        layerName: frame.layer?.name,
        bounds,
        targetRef: createTextFrameTargetRef(frame, "PATH_OVERFLOW_01", i, bounds),
      });
    }
  }

  return results;
}
