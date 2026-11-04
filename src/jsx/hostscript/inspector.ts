// Shared layer/group traversal; collection order is preserved for target references.
import { overlapsArtboard } from "./utils/coordinateUtils";

export type InspectionBounds = [number, number, number, number];

export interface VisitDocumentItemsOptions {
  bounds?: InspectionBounds;
}

/** PlacedItem（リンク画像・埋め込み配置）の Like 型 */
export interface PlacedItemLike {
  typename: string;
  name: string;
  file?: { fsName: string };
  matrix: { mValueA: number; mValueB: number; mValueC: number; mValueD: number };
  geometricBounds: [number, number, number, number];
  /** リンク画像のカラースペース（IMG-05 チェックで使用、取得不可の場合は undefined） */
  imageColorSpace?: unknown;
}

/** RasterItem（埋め込みラスタ）の Like 型 */
export interface RasterItemLike {
  typename: string;
  name: string;
  imageColorSpace: unknown;
  status?: unknown;
  embedded: boolean;
  geometricBounds: [number, number, number, number];
  /** 埋め込み画像の解像度（DPI）。IMG-01/02/03 チェックで使用 */
  resolution?: { horizontal: number; vertical: number };
}

/** Visit each item once, including nested groups and compound subpaths. */
export function visitDocumentItems(
  doc: Document,
  visit: (item: PageItem, layer: Layer) => void,
  options?: VisitDocumentItemsOptions,
): void {
  var seenIds: { [key: string]: boolean } = {};
  var withoutId: PageItem[] = [];

  function itemIntersectsScope(item: PageItem): boolean {
    if (!options || !options.bounds) return true;
    try {
      var gb = (item as unknown as { geometricBounds?: [number, number, number, number] }).geometricBounds;
      if (!gb || gb.length < 4) return true;
      return overlapsArtboard([gb[0], gb[1], gb[2], gb[3]], options.bounds);
    } catch (_) {
      // Unknown bounds must not prune a group; a nested item may still be relevant.
      return true;
    }
  }

  function visitItems(items: { length: number; [index: number]: PageItem }, layer: Layer): void {
    var count = items.length;
    for (var i = 0; i < count; i++) {
      var item = items[i];
      var uuid = "";
      try { uuid = (item as unknown as { uuid?: string }).uuid || ""; } catch (_) { /* optional */ }
      if (uuid) {
        var key = "$" + uuid;
        if (seenIds[key]) continue;
        seenIds[key] = true;
      } else {
        var found = false;
        for (var j = 0; j < withoutId.length; j++) {
          if (withoutId[j] === item) { found = true; break; }
        }
        if (found) continue;
        withoutId.push(item);
      }
      if (itemIntersectsScope(item)) visit(item, layer);
      if (item.typename === "GroupItem") {
        if (itemIntersectsScope(item)) visitItems((item as GroupItem).pageItems, layer);
      } else if (item.typename === "CompoundPathItem") {
        if (itemIntersectsScope(item)) visitItems((item as CompoundPathItem).pathItems, layer);
      }
    }
  }

  function visitLayers(layers: { length: number; [index: number]: Layer }): void {
    var count = layers.length;
    for (var i = 0; i < count; i++) {
      var layer = layers[i];
      visitItems(layer.pageItems, layer);
      if (layer.layers) visitLayers(layer.layers);
    }
  }
  visitLayers(doc.layers);
}

export interface InspectionItems {
  pathItems: PathItem[];
  textFrames: TextFrame[];
  placedItems: PlacedItemLike[];
  rasterItems: RasterItemLike[];
}

/** Collect all checker inputs in one DOM traversal. */
export function collectInspectionItems(doc: Document, bounds?: InspectionBounds): InspectionItems {
  var collected: InspectionItems = { pathItems: [], textFrames: [], placedItems: [], rasterItems: [] };
  // ExtendScript (ES3) 互換: 条件演算子の真側にオブジェクトリテラルを書くと
  // 読み込み時に「SyntaxError: 予期された結果: :」になるため if 文で組み立てる。
  var visitOptions: { bounds: InspectionBounds } | undefined = undefined;
  if (bounds) visitOptions = { bounds: bounds };
  visitDocumentItems(doc, function (item) {
    switch (item.typename) {
      case "PathItem": collected.pathItems.push(item as PathItem); break;
      case "TextFrame": collected.textFrames.push(item as unknown as TextFrame); break;
      case "PlacedItem": collected.placedItems.push(item as unknown as PlacedItemLike); break;
      case "RasterItem": collected.rasterItems.push(item as unknown as RasterItemLike); break;
    }
  }, visitOptions);
  return collected;
}

export function collectInspectionItemsForArtboard(doc: Document, bounds: InspectionBounds): InspectionItems {
  return collectInspectionItems(doc, bounds);
}

export function collectPathItems(doc: Document): PathItem[] {
  return collectInspectionItems(doc).pathItems;
}

export function collectTextFrames(doc: Document): TextFrame[] {
  return collectInspectionItems(doc).textFrames;
}

export function collectPlacedItems(doc: Document): PlacedItemLike[] {
  return collectInspectionItems(doc).placedItems;
}

export function collectRasterItems(doc: Document): RasterItemLike[] {
  return collectInspectionItems(doc).rasterItems;
}
