export interface Sticker {
  id: string;
  name: string;
  url: string;
  tags: string[];
}

export interface StickerPack {
  id: string;
  name: string;
  icon: string;
  stickers: Sticker[];
}

const BASE = "/stickers";

export const STICKER_PACKS: StickerPack[] = [];

/** 搜索贴纸 */
export function searchStickers(query: string): Sticker[] {
  const q = query.toLowerCase();
  return STICKER_PACKS.flatMap((pack) =>
    pack.stickers.filter(
      (s) => s.name.toLowerCase().includes(q) || s.tags.some((t) => t.includes(q))
    )
  );
}

/** 获取所有贴纸 */
export function getAllStickers(): Sticker[] {
  return STICKER_PACKS.flatMap((pack) => pack.stickers);
}
