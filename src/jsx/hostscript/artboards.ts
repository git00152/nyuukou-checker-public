import type { ArtboardDescriptor } from "./types";

type ArtboardLike = {
  name?: string;
  artboardRect: number[];
};

type ArtboardsCollectionLike = {
  length: number;
  getActiveArtboardIndex?: () => number;
  [index: number]: ArtboardLike;
};

type DocumentArtboardsLike = {
  artboards: ArtboardsCollectionLike;
};

export function getActiveArtboardIndex(doc: Document): number {
  try {
    const artboards = (doc as unknown as DocumentArtboardsLike).artboards;
    if (artboards && typeof artboards.getActiveArtboardIndex === "function") {
      const index = artboards.getActiveArtboardIndex();
      return typeof index === "number" && index >= 0 ? index : 0;
    }
  } catch (_) {
    // Fall through to the first artboard.
  }
  return 0;
}

export function getArtboardRect(doc: Document, index?: number): [number, number, number, number] | null {
  try {
    const artboards = (doc as unknown as DocumentArtboardsLike).artboards;
    if (!artboards || artboards.length <= 0) return null;
    const targetIndex = typeof index === "number" ? index : getActiveArtboardIndex(doc);
    const artboard = artboards[targetIndex] || artboards[0];
    if (!artboard || !artboard.artboardRect || artboard.artboardRect.length < 4) return null;
    const rect = artboard.artboardRect;
    return [rect[0], rect[1], rect[2], rect[3]];
  } catch (_) {
    return null;
  }
}

export function getArtboardDescriptors(doc: Document): {
  artboards: ArtboardDescriptor[];
  activeArtboardIndex: number;
} {
  const descriptors: ArtboardDescriptor[] = [];
  const activeArtboardIndex = getActiveArtboardIndex(doc);
  try {
    const artboards = (doc as unknown as DocumentArtboardsLike).artboards;
    const count = artboards && typeof artboards.length === "number" ? artboards.length : 0;
    for (let i = 0; i < count; i++) {
      const artboard = artboards[i];
      const rect = artboard && artboard.artboardRect;
      if (!rect || rect.length < 4) continue;
      const fallbackName = "Artboard " + String(i + 1);
      descriptors.push({
        index: i,
        name: String(artboard.name || fallbackName),
        rect: [rect[0], rect[1], rect[2], rect[3]],
      });
    }
  } catch (_) {
    return { artboards: [], activeArtboardIndex };
  }
  return { artboards: descriptors, activeArtboardIndex };
}

export function artboardFingerprint(artboard: ArtboardDescriptor): string {
  return [
    String(artboard.index),
    artboard.name,
    artboard.rect[0].toFixed(3),
    artboard.rect[1].toFixed(3),
    artboard.rect[2].toFixed(3),
    artboard.rect[3].toFixed(3),
  ].join("|");
}

export function artboardsFingerprint(artboards: ArtboardDescriptor[]): string {
  const parts: string[] = [];
  for (let i = 0; i < artboards.length; i++) {
    parts.push(artboardFingerprint(artboards[i]));
  }
  return parts.join("||");
}
