import { describe, it, expect } from "vitest";
import {
  parseColorModeFromPNG,
  parseColorModeFromJPEG,
  parseColorModeFromPSD,
  parseColorModeFromTIFF,
  parseColorModeFromEPS,
  _getExtGlobal,
} from "../../src/jsx/hostscript/checks/imageColorReader";

// ─── ヘルパー: テスト用バイト列生成 ────────────────────────────────────────

/**
 * PNG バイト列を生成する
 * PNG シグネチャ (8) + IHDR チャンク長 (4) + "IHDR" (4) + IHDR データ (13) = 29 バイト
 */
function makePNGBytes(colorType: number, bitDepth = 8): string {
  // PNG シグネチャ
  const sig = "\x89PNG\r\n\x1a\n";
  // IHDR チャンク: 長さ=13 (big-endian 4 bytes)
  const ihdrLen = "\x00\x00\x00\x0d";
  const ihdrType = "IHDR";
  // IHDR データ: width(4) + height(4) + bitDepth(1) + colorType(1) + compress(1) + filter(1) + interlace(1)
  const ihdrData =
    "\x00\x00\x00\x64" + // width = 100
    "\x00\x00\x00\x64" + // height = 100
    String.fromCharCode(bitDepth) +
    String.fromCharCode(colorType) +
    "\x00\x00\x00"; // compression, filter, interlace
  return sig + ihdrLen + ihdrType + ihdrData;
}

/**
 * JPEG バイト列を生成する（SOI + APP0 + SOF0）
 * SOI (2) + APP0 (18) + SOF0 (10) = 30 バイト
 * SOF0 の Nf バイトは offset 29 (= 20 + 9)
 */
function makeJPEGBytes(nComponents: number): string {
  const soi = "\xff\xd8";
  // APP0: marker(2) + length(2=16) + "JFIF\0"(5) + version(2) + unit(1) + Xd(2) + Yd(2) + thumb(2) = 18 bytes
  const app0 =
    "\xff\xe0" +
    "\x00\x10" + // length = 16 (includes 2-byte length field)
    "JFIF\x00" +
    "\x01\x01\x00" +
    "\x00\x01\x00\x01" +
    "\x00\x00";
  // SOF0: marker(2) + length(2=8) + precision(1) + height(2) + width(2) + Nf(1) = 10 bytes
  const sof0 =
    "\xff\xc0" +
    "\x00\x08" + // length = 8
    "\x08" + // precision = 8
    "\x00\x64\x00\x64" + // height=100, width=100
    String.fromCharCode(nComponents);
  return soi + app0 + sof0;
}

/**
 * PSD バイト列を生成する
 * "8BPS"(4) + version(2) + reserved(6) + channels(2) + height(4) + width(4) + depth(2) + mode(2) = 26 バイト
 */
function makePSDBytes(modeValue: number): string {
  return (
    "8BPS" +
    "\x00\x01" + // version = 1 (PSD)
    "\x00\x00\x00\x00\x00\x00" + // reserved
    "\x00\x03" + // channels = 3
    "\x00\x00\x00\x64" + // height = 100
    "\x00\x00\x00\x64" + // width = 100
    "\x00\x08" + // bit depth = 8
    String.fromCharCode(0, modeValue) // color mode (big-endian)
  );
}

/**
 * TIFF バイト列を生成する（リトルエンディアン）
 * ヘッダ(8) + IFD エントリ数(2) + エントリ0(12) = 22 バイト
 * PhotometricInterpretation タグ (0x0106 = 262) のみを含む
 */
function makeTIFFBytes(photoInterp: number, bigEndian = false): string {
  function le16(v: number): string {
    return String.fromCharCode(v & 0xff, (v >> 8) & 0xff);
  }
  function le32(v: number): string {
    return String.fromCharCode(v & 0xff, (v >> 8) & 0xff, (v >> 16) & 0xff, (v >> 24) & 0xff);
  }
  function be16(v: number): string {
    return String.fromCharCode((v >> 8) & 0xff, v & 0xff);
  }
  function be32(v: number): string {
    return String.fromCharCode((v >> 24) & 0xff, (v >> 16) & 0xff, (v >> 8) & 0xff, v & 0xff);
  }

  if (!bigEndian) {
    // リトルエンディアン ("II")
    const header = "II" + le16(42) + le32(8); // IFD offset = 8
    const ifd =
      le16(1) + // 1 entry
      le16(0x0106) + // tag = PhotometricInterpretation
      le16(3) + // type = SHORT
      le32(1) + // count = 1
      le16(photoInterp) + // value
      le16(0); // padding
    return header + ifd;
  } else {
    // ビッグエンディアン ("MM")
    const header = "MM" + be16(42) + be32(8); // IFD offset = 8
    const ifd =
      be16(1) + // 1 entry
      be16(0x0106) + // tag = PhotometricInterpretation
      be16(3) + // type = SHORT
      be32(1) + // count = 1
      be16(photoInterp) + // value
      be16(0); // padding
    return header + ifd;
  }
}

// ─── _getExtGlobal ──────────────────────────────────────────────────────────

describe("_getExtGlobal", () => {
  it("Node.js 環境でグローバルオブジェクトを返す（null でない）", () => {
    expect(_getExtGlobal()).not.toBeNull();
  });

  it("Node.js 環境で返ったオブジェクトは関数を持つ", () => {
    const g = _getExtGlobal();
    expect(typeof g).toBe("object");
  });
});

// ─── parseColorModeFromPNG ──────────────────────────────────────────────────

describe("parseColorModeFromPNG", () => {
  it("colorType=2 (RGB) → 'RGB'", () => {
    expect(parseColorModeFromPNG(makePNGBytes(2))).toBe("RGB");
  });

  it("colorType=6 (RGBA) → 'RGB'", () => {
    expect(parseColorModeFromPNG(makePNGBytes(6))).toBe("RGB");
  });

  it("colorType=0 (Grayscale) → 'Grayscale'", () => {
    expect(parseColorModeFromPNG(makePNGBytes(0))).toBe("Grayscale");
  });

  it("colorType=4 (Grayscale+Alpha) → 'Grayscale'", () => {
    expect(parseColorModeFromPNG(makePNGBytes(4))).toBe("Grayscale");
  });

  it("colorType=3 (Indexed) → 'Indexed'", () => {
    expect(parseColorModeFromPNG(makePNGBytes(3))).toBe("Indexed");
  });

  it("colorType=0, bitDepth=1 (1-bit mono) → 'Bitmap'", () => {
    expect(parseColorModeFromPNG(makePNGBytes(0, 1))).toBe("Bitmap");
  });

  it("短すぎるバイト列 → null", () => {
    expect(parseColorModeFromPNG("short")).toBeNull();
  });

  it("PNG シグネチャが不正 → null", () => {
    const bad = "XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX";
    expect(parseColorModeFromPNG(bad)).toBeNull();
  });

  it("IHDR タイプが不正 → null", () => {
    // PNG シグネチャは正しいが IHDR の 4 バイトが違う
    const sig = "\x89PNG\r\n\x1a\n";
    const ihdrLen = "\x00\x00\x00\x0d";
    const bad = sig + ihdrLen + "XXXX" + "\x00".repeat(13);
    expect(parseColorModeFromPNG(bad)).toBeNull();
  });
});

// ─── parseColorModeFromJPEG ─────────────────────────────────────────────────

describe("parseColorModeFromJPEG", () => {
  it("Nf=1 (Grayscale JPEG) → 'Grayscale'", () => {
    expect(parseColorModeFromJPEG(makeJPEGBytes(1))).toBe("Grayscale");
  });

  it("Nf=3 (RGB JPEG) → 'RGB'", () => {
    expect(parseColorModeFromJPEG(makeJPEGBytes(3))).toBe("RGB");
  });

  it("Nf=4 (CMYK JPEG) → 'CMYK'", () => {
    expect(parseColorModeFromJPEG(makeJPEGBytes(4))).toBe("CMYK");
  });

  it("SOF なし (SOI のみ) → null", () => {
    expect(parseColorModeFromJPEG("\xff\xd8")).toBeNull();
  });

  it("空バイト列 → null", () => {
    expect(parseColorModeFromJPEG("")).toBeNull();
  });

  it("JPEG SOI シグネチャが不正 → null", () => {
    expect(parseColorModeFromJPEG("\x00\x00")).toBeNull();
  });
});

// ─── parseColorModeFromPSD ──────────────────────────────────────────────────

describe("parseColorModeFromPSD", () => {
  it("mode=3 (RGB) → 'RGB'", () => {
    expect(parseColorModeFromPSD(makePSDBytes(3))).toBe("RGB");
  });

  it("mode=4 (CMYK) → 'CMYK'", () => {
    expect(parseColorModeFromPSD(makePSDBytes(4))).toBe("CMYK");
  });

  it("mode=1 (Grayscale) → 'Grayscale'", () => {
    expect(parseColorModeFromPSD(makePSDBytes(1))).toBe("Grayscale");
  });

  it("mode=0 (Bitmap) → 'Bitmap'", () => {
    expect(parseColorModeFromPSD(makePSDBytes(0))).toBe("Bitmap");
  });

  it("mode=2 (Indexed) → 'Indexed'", () => {
    expect(parseColorModeFromPSD(makePSDBytes(2))).toBe("Indexed");
  });

  it("mode=9 (Lab) → 'Lab'", () => {
    expect(parseColorModeFromPSD(makePSDBytes(9))).toBe("Lab");
  });

  it("シグネチャが不正 → null", () => {
    expect(parseColorModeFromPSD("NOTPSD" + "\x00".repeat(20))).toBeNull();
  });

  it("短すぎるバイト列 → null", () => {
    expect(parseColorModeFromPSD("8BPS")).toBeNull();
  });

  it("PSB フォーマット（version=2）でも color mode を正しく読み取る", () => {
    // PSB は PSD と同じ "8BPS" シグネチャでバージョンが 2 になるだけ
    // color mode のオフセット (24-25) は PSD と同一
    const psb =
      "8BPS" +
      "\x00\x02" + // version = 2 (PSB)
      "\x00\x00\x00\x00\x00\x00" + // reserved
      "\x00\x03" + // channels
      "\x00\x00\x00\x64" + // height
      "\x00\x00\x00\x64" + // width
      "\x00\x08" + // depth
      String.fromCharCode(0, 4); // color mode = 4 (CMYK)
    expect(parseColorModeFromPSD(psb)).toBe("CMYK");
  });
});

// ─── parseColorModeFromTIFF ─────────────────────────────────────────────────

describe("parseColorModeFromTIFF", () => {
  it("リトルエンディアン, PhotometricInterp=2 (RGB) → 'RGB'", () => {
    expect(parseColorModeFromTIFF(makeTIFFBytes(2))).toBe("RGB");
  });

  it("リトルエンディアン, PhotometricInterp=5 (CMYK) → 'CMYK'", () => {
    expect(parseColorModeFromTIFF(makeTIFFBytes(5))).toBe("CMYK");
  });

  it("リトルエンディアン, PhotometricInterp=1 (Grayscale) → 'Grayscale'", () => {
    expect(parseColorModeFromTIFF(makeTIFFBytes(1))).toBe("Grayscale");
  });

  it("リトルエンディアン, PhotometricInterp=0 (MinIsWhite Grayscale) → 'Grayscale'", () => {
    expect(parseColorModeFromTIFF(makeTIFFBytes(0))).toBe("Grayscale");
  });

  it("ビッグエンディアン, PhotometricInterp=2 (RGB) → 'RGB'", () => {
    expect(parseColorModeFromTIFF(makeTIFFBytes(2, true))).toBe("RGB");
  });

  it("ビッグエンディアン, PhotometricInterp=5 (CMYK) → 'CMYK'", () => {
    expect(parseColorModeFromTIFF(makeTIFFBytes(5, true))).toBe("CMYK");
  });

  it("バイトオーダーマーカーが不正 → null", () => {
    expect(parseColorModeFromTIFF("XX\x2a\x00" + "\x00".repeat(20))).toBeNull();
  });

  it("短すぎるバイト列 → null", () => {
    expect(parseColorModeFromTIFF("II")).toBeNull();
  });

  it("マジックナンバーが不正 → null", () => {
    // "II" + 0 (not 42) + IFD offset
    const bad = "II\x00\x00\x08\x00\x00\x00" + "\x00".repeat(14);
    expect(parseColorModeFromTIFF(bad)).toBeNull();
  });
});

// ─── parseColorModeFromEPS ──────────────────────────────────────────────────

describe("parseColorModeFromEPS", () => {
  it("%%ImageData: W H 8 4 → 'CMYK'", () => {
    const text = "%!PS-Adobe-3.0\n%%ImageData: 2480 3508 8 4\n%%EndComments\n";
    expect(parseColorModeFromEPS(text)).toBe("CMYK");
  });

  it("%%ImageData: W H 8 3 → 'RGB'", () => {
    const text = "%!PS-Adobe-3.0\n%%ImageData: 2480 3508 8 3\n%%EndComments\n";
    expect(parseColorModeFromEPS(text)).toBe("RGB");
  });

  it("%%ImageData: W H 8 1 → 'Grayscale'", () => {
    const text = "%!PS-Adobe-3.0\n%%ImageData: 2480 3508 8 1\n%%EndComments\n";
    expect(parseColorModeFromEPS(text)).toBe("Grayscale");
  });

  it("%%ImageData: W H 1 1 → 'Bitmap'", () => {
    const text = "%!PS-Adobe-3.0\n%%ImageData: 2480 3508 1 1\n%%EndComments\n";
    expect(parseColorModeFromEPS(text)).toBe("Bitmap");
  });

  it("%%DocumentProcessColors: Cyan Magenta Yellow → 'CMYK'", () => {
    const text = "%!PS-Adobe-3.0\n%%DocumentProcessColors: Cyan Magenta Yellow Black\n%%EndComments\n";
    expect(parseColorModeFromEPS(text)).toBe("CMYK");
  });

  it("%%DocumentProcessColors: Black のみ → 'Grayscale'", () => {
    const text = "%!PS-Adobe-3.0\n%%DocumentProcessColors: Black\n%%EndComments\n";
    expect(parseColorModeFromEPS(text)).toBe("Grayscale");
  });

  it("%%EndComments より後の %%ImageData は無視される", () => {
    const text = "%!PS-Adobe-3.0\n%%EndComments\n%%ImageData: 100 100 8 3\n";
    expect(parseColorModeFromEPS(text)).toBeNull();
  });

  it("空文字列 → null", () => {
    expect(parseColorModeFromEPS("")).toBeNull();
  });

  it("一致するヘッダなし → null", () => {
    const text = "%!PS-Adobe-3.0\n%%Title: test\n%%EndComments\n";
    expect(parseColorModeFromEPS(text)).toBeNull();
  });

  it("CRLF 改行にも対応する", () => {
    const text = "%!PS-Adobe-3.0\r\n%%ImageData: 100 100 8 4\r\n%%EndComments\r\n";
    expect(parseColorModeFromEPS(text)).toBe("CMYK");
  });
});
