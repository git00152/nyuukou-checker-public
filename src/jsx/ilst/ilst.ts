import { runner, RunOptions } from "../hostscript/runner";
import { cleanupCheckTargets, deleteCheckTarget, selectCheckTarget } from "../hostscript/actions/targetActions";

export { cleanupCheckTargets, deleteCheckTarget, selectCheckTarget };

export const runAll = (options?: RunOptions) => runner.runAll(undefined, options);

export const cleanupPreview = (): void => {
  try {
    var previewFile = new File(Folder.temp + "/preflight-preview.png");
    if (previewFile.exists) {
      previewFile.remove();
    }
  } catch (e) {
    // クリーンアップ失敗は無視
  }
};

export interface CleanupAcrobatCheckPdfResult {
  removed: boolean;
  error?: string;
}

export const cleanupAcrobatCheckPdf = (): CleanupAcrobatCheckPdfResult => {
  try {
    var pdfFile = new File(Folder.temp + "/nyuukou-acrobat-tac-check.pdf");
    if (!pdfFile.exists) {
      return { removed: false };
    }
    pdfFile.remove();
    return { removed: true };
  } catch (e) {
    return { removed: false, error: String(e) };
  }
};

export const exportArtboardPreview = (): { filePath: string; artboardBounds: [number, number, number, number] } | string => {
  try {
    var doc = app.activeDocument;
    var exportFile = new File(Folder.temp + "/preflight-preview.png");
    var opts = new ExportOptionsPNG24();
    // @ts-ignore — ExtendScript 型定義に artBoardClipping がない場合
    opts.artBoardClipping = true;
    // スクリーン解像度（72dpi）でエクスポートしてファイルサイズを抑える
    opts.resolution = 72;
    doc.exportFile(exportFile, ExportType.PNG24, opts);
    // アクティブアートボードの矩形を取得（SVG での画像配置に使用）
    var artboards = (doc as unknown as { artboards: { getActiveArtboardIndex(): number; [key: number]: { artboardRect: number[] } } }).artboards;
    var idx = artboards.getActiveArtboardIndex ? artboards.getActiveArtboardIndex() : 0;
    var r = artboards[idx].artboardRect;
    return {
      filePath: exportFile.fsName,
      artboardBounds: [r[0], r[1], r[2], r[3]] as [number, number, number, number],
    };
  } catch (e) {
    return "";
  }
};

export interface AcrobatCheckPdfResult {
  filePath: string;
  error?: string;
  errorCode?: "DOCUMENT_NOT_SAVED" | "PDF_SAVE_FAILED";
}

export const exportAcrobatCheckPdf = (): AcrobatCheckPdfResult => {
  try {
    var doc = app.activeDocument;
    var pdfFile = new File(Folder.temp + "/nyuukou-acrobat-tac-check.pdf");
    if (pdfFile.exists) {
      pdfFile.remove();
    }

    try {
      doc.save();
    } catch (saveError) {
      return {
        filePath: "",
        errorCode: "DOCUMENT_NOT_SAVED",
        error: String(saveError),
      };
    }

    var options = new PDFSaveOptions();
    options.preserveEditability = true;
    options.viewAfterSaving = false;
    try {
      doc.saveAs(pdfFile, options);
    } catch (pdfSaveError) {
      return {
        filePath: "",
        errorCode: "PDF_SAVE_FAILED",
        error: String(pdfSaveError),
      };
    }

    return { filePath: pdfFile.fsName };
  } catch (e) {
    return { filePath: "", error: String(e) };
  }
};
