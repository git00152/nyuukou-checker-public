// inspector.ts — レイヤースコープ再帰走査
// doc.pageItems 直接使用禁止（Pitfall 6: O(n²) 問題）
// layer.pageItems ベースの再帰走査を使用する

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

function pushUnique<T>(results: T[], item: T): void {
  for (let i = 0; i < results.length; i++) {
    if (results[i] === item) return;
  }
  results.push(item);
}

/**
 * doc.layers を再帰走査して全 PathItem を収集する
 * グループ内のアイテムも再帰的に収集する
 */
export function collectPathItems(doc: Document): PathItem[] {
  const results: PathItem[] = [];

  // CompoundPathItem の子 PathItem を収集する
  // CompoundPathItem 自体は stroked/strokeWidth を持たない（Adobe API 仕様）
  // 実際のストローク情報は pathItems コレクション内の子 PathItem が持つ
  function collectFromCompoundPath(cpi: CompoundPathItem): void {
    const cpiItems = (cpi as unknown as { pathItems: { [key: number]: PathItem; length: number } }).pathItems;
    for (let j = 0; j < cpiItems.length; j++) {
      pushUnique(results, cpiItems[j]);
    }
  }

  function collectFromGroup(group: GroupItem): void {
    const items = group.pageItems;
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (item.typename === "PathItem") {
        pushUnique(results, item as PathItem);
      } else if (item.typename === "CompoundPathItem") {
        collectFromCompoundPath(item as CompoundPathItem);
      } else if (item.typename === "GroupItem") {
        collectFromGroup(item as GroupItem);
      }
    }
  }

  function collectFromLayer(layer: Layer): void {
    const items = layer.pageItems;
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (item.typename === "PathItem") {
        pushUnique(results, item as PathItem);
      } else if (item.typename === "CompoundPathItem") {
        collectFromCompoundPath(item as CompoundPathItem);
      } else if (item.typename === "GroupItem") {
        collectFromGroup(item as GroupItem);
      }
    }
    // サブレイヤーを再帰処理
    for (let i = 0; i < layer.layers.length; i++) {
      collectFromLayer(layer.layers[i]);
    }
  }

  for (let i = 0; i < doc.layers.length; i++) {
    collectFromLayer(doc.layers[i]);
  }

  return results;
}

/**
 * doc.layers を再帰走査して全 TextFrame を収集する
 * グループ内のアイテムも再帰的に収集する
 */
export function collectTextFrames(doc: Document): TextFrame[] {
  const results: TextFrame[] = [];

  function collectFromGroup(group: GroupItem): void {
    const items = group.pageItems;
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (item.typename === "TextFrame") {
        pushUnique(results, item as unknown as TextFrame);
      } else if (item.typename === "GroupItem") {
        collectFromGroup(item as GroupItem);
      }
    }
  }

  function collectFromLayer(layer: Layer): void {
    const items = layer.pageItems;
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (item.typename === "TextFrame") {
        pushUnique(results, item as unknown as TextFrame);
      } else if (item.typename === "GroupItem") {
        collectFromGroup(item as GroupItem);
      }
    }
    // サブレイヤーを再帰処理
    for (let i = 0; i < layer.layers.length; i++) {
      collectFromLayer(layer.layers[i]);
    }
  }

  for (let i = 0; i < doc.layers.length; i++) {
    collectFromLayer(doc.layers[i]);
  }

  return results;
}

/**
 * doc.layers を再帰走査して全 PlacedItem を収集する
 * グループ内・サブレイヤー内のアイテムも再帰的に収集する
 * PlacedItem = リンク画像・埋め込み配置オブジェクト
 */
export function collectPlacedItems(doc: Document): PlacedItemLike[] {
  const results: PlacedItemLike[] = [];

  function collectFromGroup(group: GroupItem): void {
    const items = group.pageItems;
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (item.typename === "PlacedItem") {
        pushUnique(results, item as unknown as PlacedItemLike);
      } else if (item.typename === "GroupItem") {
        collectFromGroup(item as GroupItem);
      }
    }
  }

  function collectFromLayer(layer: Layer): void {
    const items = layer.pageItems;
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (item.typename === "PlacedItem") {
        pushUnique(results, item as unknown as PlacedItemLike);
      } else if (item.typename === "GroupItem") {
        collectFromGroup(item as GroupItem);
      }
    }
    // サブレイヤーを再帰処理
    for (let i = 0; i < layer.layers.length; i++) {
      collectFromLayer(layer.layers[i]);
    }
  }

  for (let i = 0; i < doc.layers.length; i++) {
    collectFromLayer(doc.layers[i]);
  }

  return results;
}

/**
 * doc.layers を再帰走査して全 RasterItem を収集する
 * グループ内・サブレイヤー内のアイテムも再帰的に収集する
 * RasterItem = 埋め込みラスタ画像オブジェクト
 */
export function collectRasterItems(doc: Document): RasterItemLike[] {
  const results: RasterItemLike[] = [];

  function collectFromGroup(group: GroupItem): void {
    const items = group.pageItems;
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (item.typename === "RasterItem") {
        pushUnique(results, item as unknown as RasterItemLike);
      } else if (item.typename === "GroupItem") {
        collectFromGroup(item as GroupItem);
      }
    }
  }

  function collectFromLayer(layer: Layer): void {
    const items = layer.pageItems;
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (item.typename === "RasterItem") {
        pushUnique(results, item as unknown as RasterItemLike);
      } else if (item.typename === "GroupItem") {
        collectFromGroup(item as GroupItem);
      }
    }
    // サブレイヤーを再帰処理
    for (let i = 0; i < layer.layers.length; i++) {
      collectFromLayer(layer.layers[i]);
    }
  }

  for (let i = 0; i < doc.layers.length; i++) {
    collectFromLayer(doc.layers[i]);
  }

  return results;
}
