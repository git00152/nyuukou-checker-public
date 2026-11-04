import React from "react";
import type { Severity } from "../data/severity";

/** 重要度は色だけでなく形でも区別する（要修正=●、要確認=▲、参考=○）。 */
export const SeverityMark: React.FC<{ severity: Severity }> = ({ severity }) => (
  <span aria-hidden="true" className={`sev-mark sev-mark--${severity}`} />
);
