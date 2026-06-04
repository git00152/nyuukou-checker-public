// Keep CEP startup imports limited to modules used by the panel.

//@ts-ignore
export const child_process = (
  typeof window.cep !== "undefined" ? require("child_process") : {}
) as typeof import("child_process");
export const fs = (
  typeof window.cep !== "undefined" ? require("fs") : {}
) as typeof import("fs");
export const os = (
  typeof window.cep !== "undefined" ? require("os") : {}
) as typeof import("os");
