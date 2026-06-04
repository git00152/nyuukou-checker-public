export interface DiagnosticLogDetail {
  [key: string]: unknown;
}

export function formatDiagnosticLogLine(event: string, detail?: DiagnosticLogDetail): string {
  const suffix = detail ? " " + JSON.stringify(detail) : "";
  return "[" + new Date().toISOString() + "] " + event + suffix;
}

export function diagnosticLog(event: string, detail?: DiagnosticLogDetail): void {
  try {
    if (typeof window !== "undefined" && typeof window.__nyuukouLog === "function") {
      window.__nyuukouLog(event, detail);
    }
  } catch {
    // Diagnostic logging must never break the extension UI.
  }
}

export function errorToDiagnosticDetail(error: unknown): DiagnosticLogDetail {
  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message,
      stack: error.stack,
    };
  }
  return { message: String(error) };
}
