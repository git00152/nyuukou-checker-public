import React from "react";
import ReactDOM from "react-dom/client";
import { App } from "./main";
import { diagnosticLog, errorToDiagnosticDetail } from "./utils/diagnosticLogger";

try {
  diagnosticLog("react mount start");
  const rootElement = document.getElementById("app");
  if (!rootElement) {
    throw new Error("Root element #app was not found");
  }
  ReactDOM.createRoot(rootElement).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );
  diagnosticLog("react mount scheduled");
} catch (error) {
  diagnosticLog("react mount failed", errorToDiagnosticDetail(error));
  throw error;
}
