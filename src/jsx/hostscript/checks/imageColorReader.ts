/**
 * imageColorReader.ts
 * リンク画像（PlacedItem）のバイナリヘッダを解析してカラーモードを取得する。
 *
 * parse* 関数: バイト文字列を受け取る純粋関数 → Vitest でテスト可能。
 * readLinkedImageColorMode: ExtendScript の File API に依存するため、
 *   テストでは checkImageResolution の _colorReader 引数でモックすること。
 *
 * 対応フォーマット: PNG / JPEG / PSD / TIFF / EPS
 */

// ─── グローバルアクセサ ───────────────────────────────────────────────────────

/**
 * ES3 互換のグローバルオブジェクト取得ヘルパー。
 *
 * ExtendScript は ES3 ベースで `globalThis` が存在しない。
 * ビルド時に IIFE `(function(thisObj){...})(this)` でラップされるため、
 * `globalThis.File` ではなく `new Function("return this")()` 経由で
 * 真のグローバルオブジェクト（＝ ExtendScript の File クラスを持つスコープ）を取得する。
 *
 * `new Function(...)` は常に非 strict モードで生成されるため、
 * strict モード内でも正しくグローバルオブジェクトを返す。
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function _getExtGlobal(): any {
  try {
    // eslint-disable-next-line no-new-func
    return new Function("return this")();
  } catch (_) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return typeof globalThis !== "undefined" ? (globalThis as any) : null;
  }
}

// ─── PNG ─────────────────────────────────────────────────────────────────────

/**
 * PNG IHDR チャンクの bitDepth / colorType バイトからカラーモード文字列を返す。
 *
 * PNG ファイル先頭レイアウト:
 *   offset  0- 7: PNG シグネチャ (8 bytes)
 *   offset  8-11: IHDR チャンクデータ長 = 0x0000000D (4 bytes big-endian)
 *   offset 12-15: "IHDR" (4 bytes)
 *   offset 16-19: 幅 (4 bytes)
 *   offset 20-23: 高さ (4 bytes)
 *   offset    24: bit depth (1 byte)
 *   offset    25: color type (1 byte)
 *
 * colorType: 0/4=Grayscale(±Alpha), 2/6=RGB(±Alpha), 3=Indexed
 *
 * @param bytes ファイルの先頭バイト列（最低 26 バイト必要）
 * @returns "RGB" | "Grayscale" | "Indexed" | "Bitmap" | null
 */
export function parseColorModeFromPNG(bytes: string): string | null {
  if (bytes.length < 26) return null;
  // PNG シグネチャ先頭 2 バイト確認 (0x89, 'P')
  if ((bytes.charCodeAt(0) & 0xFF) !== 0x89 ||
      (bytes.charCodeAt(1) & 0xFF) !== 0x50) return null;
  // IHDR タイプ確認 (offset 12-15 = "IHDR")
  if (bytes.charCodeAt(12) !== 0x49 || bytes.charCodeAt(13) !== 0x48 ||
      bytes.charCodeAt(14) !== 0x44 || bytes.charCodeAt(15) !== 0x52) return null;

  var bitDepth  = bytes.charCodeAt(24) & 0xFF;
  var colorType = bytes.charCodeAt(25) & 0xFF;

  // Grayscale(±alpha): colorType 0 / 4
  if (colorType === 0 || colorType === 4) {
    if (bitDepth === 1) return "Bitmap"; // 1-bit モノクロ
    return "Grayscale";
  }
  // RGB(±alpha): colorType 2 / 6
  if (colorType === 2 || colorType === 6) return "RGB";
  // Indexed color: colorType 3
  if (colorType === 3) return "Indexed";
  return null;
}

// ─── JPEG ────────────────────────────────────────────────────────────────────

/**
 * JPEG SOF マーカーの成分数（Nf）からカラーモード文字列を返す。
 *
 * SOF マーカー内レイアウト（マーカー先頭 offset i を基準）:
 *   i+0, i+1: FF Cx (SOF marker)
 *   i+2, i+3: 長さフィールド（2-byte 自身を含む big-endian）
 *   i+4:      precision
 *   i+5, i+6: height
 *   i+7, i+8: width
 *   i+9:      Nf (成分数)
 *
 * Nf: 1=Grayscale, 3=RGB(YCbCr), 4=CMYK(YCCK)
 *
 * @param bytes ファイルのバイト列
 * @returns "RGB" | "Grayscale" | "CMYK" | null
 */
export function parseColorModeFromJPEG(bytes: string): string | null {
  var len = bytes.length;
  if (len < 3) return null;
  // SOI マーカー確認 (FF D8)
  if ((bytes.charCodeAt(0) & 0xFF) !== 0xFF ||
      (bytes.charCodeAt(1) & 0xFF) !== 0xD8) return null;

  var i = 2; // SOI の次から走査
  var maxScan = Math.min(len, 131072); // 最大 128KB 走査

  while (i + 1 < maxScan) {
    if ((bytes.charCodeAt(i) & 0xFF) !== 0xFF) { i++; continue; }
    var marker = bytes.charCodeAt(i + 1) & 0xFF;

    if (marker === 0xFF) { i++; continue; }  // fill bytes
    if (marker === 0x00) { i += 2; continue; } // stuffed byte

    // SOF マーカー群: C0-CF（C4=DHT, C8=JPEG拡張, CC=DAC を除く）
    if (marker >= 0xC0 && marker <= 0xCF &&
        marker !== 0xC4 && marker !== 0xC8 && marker !== 0xCC) {
      if (i + 9 < len) {
        var nf = bytes.charCodeAt(i + 9) & 0xFF;
        if (nf === 1) return "Grayscale";
        if (nf === 3) return "RGB";
        if (nf === 4) return "CMYK";
      }
      return null; // SOF 発見したが Nf 読み取り不可
    }

    if (marker === 0xD9) return null; // EOI
    // 長さフィールドなしマーカー: SOI(D8), RST0-7(D0-D7), TEM(01)
    if (marker === 0xD8 || (marker >= 0xD0 && marker <= 0xD7) || marker === 0x01) {
      i += 2; continue;
    }
    // 長さ付きセグメントをスキップ (長さフィールドは自身 2 バイトを含む)
    if (i + 3 < len) {
      var segLen = ((bytes.charCodeAt(i + 2) & 0xFF) << 8) |
                  (bytes.charCodeAt(i + 3) & 0xFF);
      if (segLen < 2) break;
      i += 2 + segLen;
    } else break;
  }
  return null;
}

// ─── PSD ─────────────────────────────────────────────────────────────────────

/**
 * PSD ファイルヘッダのカラーモードフィールドから文字列を返す。
 *
 * PSD ヘッダレイアウト:
 *   offset  0- 3: "8BPS" シグネチャ
 *   offset  4- 5: バージョン (1=PSD, 2=PSB)
 *   offset  6-11: 予約済み (6 bytes)
 *   offset 12-13: チャンネル数
 *   offset 14-17: 高さ
 *   offset 18-21: 幅
 *   offset 22-23: ビット深度
 *   offset 24-25: カラーモード (big-endian 16-bit)
 *
 * カラーモード値: 0=Bitmap, 1=Grayscale, 2=Indexed, 3=RGB, 4=CMYK,
 *                7=Multichannel, 8=Duotone, 9=Lab
 *
 * @param bytes ファイルの先頭バイト列（最低 26 バイト必要）
 * @returns "RGB" | "CMYK" | "Grayscale" | "Indexed" | "Bitmap" | "Lab" | "Duotone" | "Multichannel" | null
 */
export function parseColorModeFromPSD(bytes: string): string | null {
  if (bytes.length < 26) return null;
  // "8BPS" シグネチャ確認
  if (bytes.charCodeAt(0) !== 0x38 || bytes.charCodeAt(1) !== 0x42 ||
      bytes.charCodeAt(2) !== 0x50 || bytes.charCodeAt(3) !== 0x53) return null;

  var modeVal = ((bytes.charCodeAt(24) & 0xFF) << 8) |
                 (bytes.charCodeAt(25) & 0xFF);
  switch (modeVal) {
    case 0: return "Bitmap";
    case 1: return "Grayscale";
    case 2: return "Indexed";
    case 3: return "RGB";
    case 4: return "CMYK";
    case 7: return "Multichannel";
    case 8: return "Duotone";
    case 9: return "Lab";
    default: return null;
  }
}

// ─── TIFF ────────────────────────────────────────────────────────────────────

/**
 * TIFF の PhotometricInterpretation タグ (0x0106) からカラーモード文字列を返す。
 *
 * TIFF ファイルヘッダ:
 *   offset 0-1: バイトオーダー ("II"=LE / "MM"=BE)
 *   offset 2-3: マジックナンバー (42)
 *   offset 4-7: 第1 IFD オフセット
 *
 * IFD エントリ (12 bytes):
 *   2: タグ / 2: 型 / 4: カウント / 4: 値または値へのオフセット
 *
 * PhotometricInterpretation 値:
 *   0/1=Grayscale, 2=RGB, 3=Indexed(Palette), 5=CMYK, 6=YCbCr, 8=Lab
 *
 * @param bytes ファイルのバイト列
 * @returns "RGB" | "CMYK" | "Grayscale" | "Indexed" | "Lab" | null
 */
export function parseColorModeFromTIFF(bytes: string): string | null {
  if (bytes.length < 8) return null;

  var b0 = bytes.charCodeAt(0) & 0xFF;
  var b1 = bytes.charCodeAt(1) & 0xFF;
  var isLE: boolean;
  if      (b0 === 0x49 && b1 === 0x49) { isLE = true;  } // "II" = little-endian
  else if (b0 === 0x4D && b1 === 0x4D) { isLE = false; } // "MM" = big-endian
  else return null;

  // バイトオーダーに応じた 16/32-bit 読み取りヘルパー
  function r16(off: number): number {
    var lo = bytes.charCodeAt(off)     & 0xFF;
    var hi = bytes.charCodeAt(off + 1) & 0xFF;
    return isLE ? lo + hi * 256 : lo * 256 + hi;
  }
  function r32(off: number): number {
    var a = bytes.charCodeAt(off)     & 0xFF;
    var bv = bytes.charCodeAt(off + 1) & 0xFF;
    var c = bytes.charCodeAt(off + 2) & 0xFF;
    var d = bytes.charCodeAt(off + 3) & 0xFF;
    return isLE
      ? a + bv * 256 + c * 65536 + d * 16777216
      : a * 16777216 + bv * 65536 + c * 256 + d;
  }

  // マジックナンバー確認 (42)
  if (r16(2) !== 42) return null;

  var ifdOffset = r32(4);
  if (ifdOffset + 2 > bytes.length) return null;

  var numEntries = r16(ifdOffset);
  var TAG_PHOTOMETRIC = 0x0106; // = 262

  for (var i = 0; i < numEntries; i++) {
    var entryOff = ifdOffset + 2 + i * 12;
    if (entryOff + 12 > bytes.length) break;
    if (r16(entryOff) === TAG_PHOTOMETRIC) {
      // 型=SHORT(3), カウント=1 の場合、値フィールド先頭 2 バイトに値が入る
      var val = r16(entryOff + 8);
      switch (val) {
        case 0: case 1: return "Grayscale"; // MinIsWhite / MinIsBlack
        case 2:         return "RGB";
        case 3:         return "Indexed";
        case 5:         return "CMYK";
        case 6:         return "RGB";  // YCbCr → RGB として扱う
        case 8:         return "Lab";
        default:        return null;
      }
    }
  }
  return null;
}

// ─── EPS ─────────────────────────────────────────────────────────────────────

/**
 * EPS ファイルのヘッダテキストからカラーモード文字列を返す。
 *
 * EPS ヘッダコメント（%% で始まる DSC コメント）を最大 100 行走査する。
 * %%EndComments に到達した時点でスキャンを終了する。
 *
 * 判定優先順位:
 *   1. %%ImageData: W H bits components
 *      - bits=1, components=1 → "Bitmap"
 *      - components=1        → "Grayscale"
 *      - components=3        → "RGB"
 *      - components=4        → "CMYK"
 *   2. %%DocumentProcessColors:
 *      - Cyan/Magenta/Yellow を含む → "CMYK"
 *      - Black のみ               → "Grayscale"
 *
 * @param text EPS ファイルのテキスト内容（改行コード CR/LF/CRLF 対応）
 * @returns "RGB" | "CMYK" | "Grayscale" | "Bitmap" | null
 */
export function parseColorModeFromEPS(text: string): string | null {
  if (!text) return null;
  var lines = text.split(/\r\n|\n|\r/);
  var maxLines = Math.min(lines.length, 100);
  for (var i = 0; i < maxLines; i++) {
    var line = lines[i];

    if (line.indexOf("%%ImageData:") !== -1) {
      var m = /%%ImageData:\s+(\d+)\s+(\d+)\s+(\d+)\s+(\d+)/.exec(line);
      if (m) {
        var bits = parseInt(m[3], 10);
        var comps = parseInt(m[4], 10);
        if (bits === 1 && comps === 1) return "Bitmap";
        if (comps === 1) return "Grayscale";
        if (comps === 3) return "RGB";
        if (comps === 4) return "CMYK";
      }
    }

    if (line.indexOf("%%DocumentProcessColors:") !== -1) {
      var cl = line.toLowerCase();
      if (cl.indexOf("cyan") !== -1 || cl.indexOf("magenta") !== -1 || cl.indexOf("yellow") !== -1) {
        return "CMYK";
      }
      if (cl.indexOf("black") !== -1) {
        return "Grayscale";
      }
    }

    if (line.indexOf("%%EndComments") !== -1) break;
  }
  return null;
}

// ─── ファイル I/O（ExtendScript 専用） ───────────────────────────────────────

/**
 * リンク画像ファイルのバイナリヘッダを読み取り、カラーモード文字列を返す。
 *
 * ExtendScript の File API（encoding="BINARY" / readch()）を使用するため、
 * Node.js テスト環境では動作しない。テストでは checkImageResolution の
 * _colorReader 引数にモック関数を渡すこと。
 *
 * @param fsName ファイルの絶対パス (PlacedItem.file.fsName)
 * @returns "RGB" | "CMYK" | "Grayscale" | "Indexed" | "Bitmap" | "Lab" | null
 */
/**
 * XMP メタデータから photoshop:ColorMode を読み取る（ExtendScript 専用）。
 *
 * AdobeXMPScript が利用可能な場合のみ動作する。
 * ColorMode 値: 0=Bitmap, 1=Grayscale, 2=Indexed, 3=RGB, 4=CMYK, 8=Duotone, 9=Lab
 *
 * @param fsName ファイルの絶対パス
 * @returns "RGB" | "CMYK" | "Grayscale" | "Bitmap" | "Lab" | null
 */
function readColorModeFromXMP(fsName: string): string | null {
  var g = _getExtGlobal();
  if (!g || typeof g.ExternalObject === "undefined") return null;
  try {
    if (!g.ExternalObject.AdobeXMPScript) {
      g.ExternalObject.AdobeXMPScript = new g.ExternalObject("lib:AdobeXMPScript");
    }
  } catch (_) { return null; }
  var xf = null;
  try {
    xf = new g.XMPFile(fsName, g.XMPConst.UNKNOWN, g.XMPConst.OPEN_FOR_READ);
    var x = xf.getXMP();
    if (!x) return null;
    if (!x.doesPropertyExist(g.XMPConst.NS_PHOTOSHOP, "ColorMode")) return null;
    var v = x.getProperty(g.XMPConst.NS_PHOTOSHOP, "ColorMode");
    if (v == null) return null;
    var s = String(v);
    // 文字列表記（一部ソフトウェアが出力する形式）
    if (/[A-Za-z]/.test(s)) {
      if (/^rgb$/i.test(s))               return "RGB";
      if (/^cmyk$/i.test(s))              return "CMYK";
      if (/^gray(scale)?$/i.test(s))      return "Grayscale";
      if (/^bitmap$/i.test(s))            return "Bitmap";
      if (/^lab$/i.test(s))               return "Lab";
      return null;
    }
    // 数値表記（Photoshop XMP 標準）
    var n = Number(s);
    if (!isNaN(n)) {
      switch (n) {
        case 0: return "Bitmap";
        case 1: return "Grayscale";
        case 3: return "RGB";
        case 4: return "CMYK";
        case 9: return "Lab";
      }
    }
    return null;
  } catch (_e2) {
    return null;
  } finally {
    if (xf) { try { xf.closeFile(); } catch (_) { /* ignore */ } }
  }
}

/**
 * EPS ファイルをテキストとして読み込み、カラーモードを返す（ExtendScript 専用）。
 *
 * @param fsName ファイルの絶対パス
 * @returns "RGB" | "CMYK" | "Grayscale" | "Bitmap" | null
 */
function readEPSColorMode(fsName: string): string | null {
  // ExtendScript の File クラスはスコープチェーン経由でグローバルとして直接アクセス可能。
  // ilst.ts の new File(...) と同じパターンで直接使用する。
  // (TypeScript の src/jsx は tsconfig.json の exclude 対象のため型エラーにならない)
  var f = null;
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    f = new (File as any)(fsName) as {
      open(mode: string): boolean;
      encoding: string;
      readln(): string;
      eof: boolean;
      close(): void;
    };
    if (!f.open("r")) return null;
    f.encoding = "UTF-8";
    var lines: string[] = [];
    var lineCount = 0;
    while (!f.eof && lineCount < 100) {
      lines.push(f.readln());
      lineCount++;
    }
    try { f.close(); } catch (_) { /* ignore */ }
    f = null;
    return parseColorModeFromEPS(lines.join("\n"));
  } catch (_e) {
    if (f) { try { (f as { close(): void }).close(); } catch (_) { /* ignore */ } }
    return null;
  }
}

/**
 * JPEG ファイルをストリーム解析して成分数（Nf）からカラーモードを返す。
 *
 * サンプルスクリプト（ai_LinkPanelPlus_Refactored_PSact.jsx）の
 * _readJPEGComponents 関数と同じ方式:
 *   - open() 後に encoding="BINARY" を設定
 *   - readch() で 1 バイトずつ読み取り
 *   - 非 SOF セグメントは f.seek() でスキップ（バッファ蓄積なし）
 *
 * Nf: 1=Grayscale, 3=RGB(YCbCr), 4=CMYK(YCCK)
 */
function readJPEGColorMode(fsName: string): string | null {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  var f: {
    open(mode: string): boolean;
    encoding: string;
    eof: boolean;
    readch(): string;
    seek(n: number, rel: number): boolean;
    close(): void;
  } | null = null;
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    f = new (File as any)(fsName) as typeof f;
    if (!f) return null;
    // サンプルスクリプトと同じ順序: open() 後に encoding="BINARY"
    if (!f.open("r")) return null;
    f.encoding = "BINARY";

    var c = function(ch: string): number { return ch.charCodeAt(0) & 255; };

    var MAX_SCAN = 1048576; // 1MB（大容量 EXIF/APP ブロックも想定）
    var bytePos = 0;

    // SOI マーカー確認 (FF D8)
    if (c(f.readch()) !== 0xFF || c(f.readch()) !== 0xD8) {
      try { f.close(); } catch (_) { /* ignore */ }
      return null;
    }
    bytePos += 2;

    while (!f.eof && bytePos < MAX_SCAN) {
      var a = c(f.readch()); bytePos++;
      if (a !== 0xFF) {
        // マーカー境界がずれた場合は失敗
        try { f.close(); } catch (_) { /* ignore */ }
        return null;
      }
      var m = c(f.readch()); bytePos++;

      if (m === 0xD9 || m === 0xDA) break; // EOI or SOS

      // スタッフィングバイト (FF FF...) をスキップ
      while (m === 0xFF) { m = c(f.readch()); bytePos++; }

      // セグメント長フィールド (big-endian, 自身の 2 バイトを含む)
      var lh = c(f.readch()); var ll = c(f.readch()); bytePos += 2;
      var segLen = (lh << 8) | ll;
      if (segLen < 2) {
        try { f.close(); } catch (_) { /* ignore */ }
        return null;
      }

      // SOF マーカー群: C0-C3, C5-C7, C9-CB, CD-CF（DHT=C4, JPEGext=C8, DAC=CC を除く）
      var isSOF = ((m >= 0xC0 && m <= 0xC3) || (m >= 0xC5 && m <= 0xC7) ||
                   (m >= 0xC9 && m <= 0xCB) || (m >= 0xCD && m <= 0xCF));
      if (isSOF) {
        // SOF データ先頭 6 バイト: precision(1) + height(2) + width(2) + Nf(1)
        var sofData = "";
        var readCount = Math.min(segLen - 2, 6);
        for (var i = 0; i < readCount; i++) { sofData += f.readch(); }
        try { f.close(); } catch (_) { /* ignore */ }
        if (sofData.length >= 6) {
          var nf = sofData.charCodeAt(5) & 255;
          if (nf === 1) return "Grayscale";
          if (nf === 3) return "RGB";
          if (nf === 4) return "CMYK";
        }
        return null;
      }

      // 非 SOF セグメント: f.seek() でデータをスキップ（readch() ループより高速）
      f.seek(segLen - 2, 1);
      bytePos += (segLen - 2);
    }

    try { f.close(); } catch (_) { /* ignore */ }
    return null;
  } catch (_e) {
    if (f) { try { f.close(); } catch (_) { /* ignore */ } }
    return null;
  }
}

export function readLinkedImageColorMode(fsName: string): string | null {
  // ExtendScript (ES3) 互換: for...of / const / let 使用不可
  var MAX_BYTES = 131072; // 128 KB
  var f = null;
  try {
    var lowerName = String(fsName).toLowerCase();

    // EPS はテキストヘッダのため別読み込み
    if (/\.eps$/i.test(lowerName)) {
      // 1) XMP が利用可能なら優先（AI ファイル埋め込み XMP が読めるケースあり）
      var xmpModeEPS = readColorModeFromXMP(fsName);
      if (xmpModeEPS) return xmpModeEPS;
      // 2) EPS テキストヘッダを走査
      return readEPSColorMode(fsName);
    }

    // XMP メタデータを最優先（PSD/PSB は photoshop:ColorMode が最も確実）
    var xmpMode = readColorModeFromXMP(fsName);
    if (xmpMode) return xmpMode;

    // JPEG: サンプルスクリプトと同じストリーム解析方式（readJPEGColorMode）を使用
    // バッファ蓄積 + parseColorModeFromJPEG 方式では BINARY readch() の
    // 文字列蓄積に関する ExtendScript の互換性問題が生じるため別関数で処理する
    if (/\.jpe?g$/i.test(lowerName)) {
      return readJPEGColorMode(fsName);
    }

    // その他フォーマット (PSD/PSB/TIFF): バイト列を蓄積してから解析
    // ExtendScript の File クラスはスコープチェーン経由でグローバルとして直接アクセス可能。
    // ilst.ts の new File(...) と同じパターンで直接使用する。
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    f = new (File as any)(fsName) as {
      open(mode: string): boolean;
      encoding: string;
      eof: boolean;
      readch(): string;
      close(): void;
    };
    if (!f.open("r")) return null;
    f.encoding = "BINARY";

    var bytes = "";
    var byteCount = 0;
    while (!f.eof && byteCount < MAX_BYTES) {
      bytes += f.readch();
      byteCount++;
    }
    try { f.close(); } catch (_) { /* ignore */ }
    f = null;

    if (/\.ps[db]$/i.test(lowerName)) return parseColorModeFromPSD(bytes); // PSD + PSB
    if (/\.tiff?$/i.test(lowerName)) return parseColorModeFromTIFF(bytes);
    return null;
  } catch (_e) {
    if (f) { try { (f as { close(): void }).close(); } catch (_) { /* ignore */ } }
    return null;
  }
}
