export interface AppSettings {
  largePrintMode: boolean;
  detectOpenPaths: boolean;
  detectFilledOpenPaths: boolean;
  includeGuides: boolean;
  includeTrimMarkLayers: boolean;
  autoPanToSelection: boolean;
  confirmBeforeDelete: boolean;
}

export const DEFAULT_SETTINGS: AppSettings = {
  largePrintMode: false,
  detectOpenPaths: true,
  detectFilledOpenPaths: true,
  includeGuides: false,
  includeTrimMarkLayers: false,
  autoPanToSelection: true,
  confirmBeforeDelete: true,
};
