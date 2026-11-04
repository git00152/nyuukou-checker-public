import type { CheckResult, ScopeInfo } from "../types";
import { createPathItemTargetRef, SELECT_ACTION } from "./targetRef";

interface ColorLike {
  typename?: string;
  spot?: { name?: string };
}

export interface RegistrationCheckItem {
  typename?: string;
  name: string;
  filled?: boolean;
  stroked?: boolean;
  fillColor?: unknown;
  strokeColor?: unknown;
  geometricBounds: [number, number, number, number];
}

const REGISTRATION_JA = "レジストレーション";

export function isRegistrationColor(color: unknown): boolean {
  const c = color as ColorLike | null | undefined;
  if (!c) return false;
  try {
    if (c.typename === "RegistrationColor") return true;
    if (c.typename === "SpotColor" && c.spot) {
      const name = c.spot.name || "";
      if (name.toLowerCase().indexOf("registration") !== -1) return true;
      if (name.indexOf(REGISTRATION_JA) !== -1) return true;
    }
  } catch (e) {
    return false;
  }
  return false;
}

/** 断裁範囲の内側（境界線上を除く）に掛かっているか */
function entersTrimArea(b: [number, number, number, number], trim: [number, number, number, number]): boolean {
  const EPS = 0.5;
  return b[0] < trim[2] - EPS && b[2] > trim[0] + EPS && b[3] < trim[1] - EPS && b[1] > trim[3] + EPS;
}

/**
 * デザイン要素へのレジストレーションカラーの誤用を検出する。
 * レジストレーションは全版 100%（総インキ 400%）で出力されるため、トンボ以外での使用は事故になる。
 * - 塗りに使われている → ERROR
 * - 線に使われ、断裁範囲の内側に掛かっている → ERROR（断裁範囲外の線はトンボとみなす）
 */
export function checkRegistrationColor(items: RegistrationCheckItem[], scope: ScopeInfo): CheckResult[] {
  const results: CheckResult[] = [];
  const trim = scope.bounds;
  const hasTrim = trim[2] > trim[0] && trim[1] > trim[3];
  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    let kind = "";
    try {
      if (item.filled !== false && isRegistrationColor(item.fillColor)) {
        kind = "塗り";
      } else if (item.stroked === true && isRegistrationColor(item.strokeColor)) {
        const gb0 = item.geometricBounds;
        if (!hasTrim || entersTrimArea([gb0[0], gb0[1], gb0[2], gb0[3]], trim)) kind = "線";
      }
    } catch (e) {
      kind = "";
    }
    if (!kind) continue;
    const gb = item.geometricBounds;
    const bounds = [gb[0], gb[1], gb[2], gb[3]] as [number, number, number, number];
    const displayName = item.name || "（名称なし）";
    results.push({
      severity: "ERROR",
      messageKey: "COLOR_REGISTRATION_01",
      message: "トンボ以外でレジストレーションが使われています: \"" + displayName + "\" の" + kind,
      objectName: displayName,
      bounds,
      targetRef: createPathItemTargetRef(item, "COLOR_REGISTRATION_01", i, bounds),
      actions: [SELECT_ACTION],
    });
  }
  return results;
}
