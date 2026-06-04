import { CheckResult } from "../types";
import { createPathItemTargetRef, SELECT_ACTION, toBounds } from "./targetRef";

export interface CheckOpenPathsOptions {
  detectOpenPaths?: boolean;
  detectFilledOpenPaths?: boolean;
}

export function checkOpenPaths(pathItems: PathItem[], options?: CheckOpenPathsOptions): CheckResult[] {
  const opts = options || {};
  const detectOpenPaths = opts.detectOpenPaths !== false;
  const detectFilledOpenPaths = opts.detectFilledOpenPaths !== false;
  const results: CheckResult[] = [];

  for (let i = 0; i < pathItems.length; i++) {
    const item = pathItems[i];
    const p = item as unknown as {
      closed?: boolean;
      filled?: boolean;
      name: string;
      layer?: { name: string };
      geometricBounds: [number, number, number, number];
    };

    let isOpen = false;
    let isFilled = false;
    try {
      isOpen = p.closed === false;
      isFilled = p.filled === true;
    } catch (e) {
      continue;
    }
    if (!isOpen) continue;

    const gb = toBounds(p.geometricBounds);
    if (isFilled && detectFilledOpenPaths) {
      results.push({
        id: "PATH_OPEN_FILLED_01:" + i,
        severity: "WARNING",
        messageKey: "PATH_OPEN_FILLED_01",
        message: "\u5857\u308A\u304C\u8A2D\u5B9A\u3055\u308C\u305F\u30AA\u30FC\u30D7\u30F3\u30D1\u30B9\u304C\u5B58\u5728\u3057\u307E\u3059",
        objectName: p.name,
        layerName: p.layer?.name,
        bounds: gb,
        targetRef: createPathItemTargetRef(p, "PATH_OPEN_FILLED_01", i, gb),
        actions: [SELECT_ACTION],
      });
      continue;
    }

    if (detectOpenPaths) {
      results.push({
        id: "PATH_OPEN_01:" + i,
        severity: "WARNING",
        messageKey: "PATH_OPEN_01",
        message: "\u30AA\u30FC\u30D7\u30F3\u30D1\u30B9\u304C\u5B58\u5728\u3057\u307E\u3059",
        objectName: p.name,
        layerName: p.layer?.name,
        bounds: gb,
        targetRef: createPathItemTargetRef(p, "PATH_OPEN_01", i, gb),
        actions: [SELECT_ACTION],
      });
    }
  }

  return results;
}
