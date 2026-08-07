import { CEP_Config } from "vite-cep-plugin";

const config: CEP_Config = {
  version: "1.0.7",
  id: "com.git00152.nyuukochecker",
  displayName: "入稿データチェッカー",
  symlink: "local",
  port: 3000,
  servePort: 5000,
  startingDebugPort: 8860,
  extensionManifestVersion: 7.0,
  requiredRuntimeVersion: 11.0,
  hosts: [
    { name: "ILST", version: "[25.3,99.9]" }, // Configured range. Validate each production Illustrator version before distribution.
  ],
  type: "Panel",
  iconDarkNormal: "./src/assets/light-icon.png",
  iconNormal: "./src/assets/dark-icon.png",
  iconDarkNormalRollOver: "./src/assets/light-icon.png",
  iconNormalRollOver: "./src/assets/dark-icon.png",
  parameters: ["--v=0", "--enable-nodejs", "--mixed-context"],
  width: 300,
  height: 500,
  panels: [
    {
      mainPath: "./main/index.html",
      name: "main",
      panelDisplayName: "入稿データチェッカー",
      autoVisible: true,
      width: 300,
      height: 500,
      minWidth: 280,
      minHeight: 400,
      maxWidth: 4096,
      maxHeight: 4096,
    },
  ],
  build: {
    jsxBin: "off",
    sourceMap: true,
  },
  zxp: {
    country: "JP",
    province: "Tokyo",
    org: "git00152",
    password: "",
    tsa: [
      "http://timestamp.digicert.com/",
      "http://timestamp.apple.com/ts01",
    ],
    allowSkipTSA: false,
    sourceMap: false,
    jsxBin: "off",
  },
  installModules: [],
  copyAssets: [],
  copyZipAssets: [],
};
export default config;
