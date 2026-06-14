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

export const STICKER_PACKS: StickerPack[] = [
  {
    id: "emojis",
    name: "表情",
    icon: `${BASE}/emojis/smile.svg`,
    stickers: [
      { id: "smile", name: "微笑", url: `${BASE}/emojis/smile.svg`, tags: ["笑", "开心", "happy"] },
      { id: "laugh", name: "大笑", url: `${BASE}/emojis/laugh.svg`, tags: ["笑", "开心", "lol"] },
      { id: "cry", name: "哭", url: `${BASE}/emojis/cry.svg`, tags: ["哭", "sad"] },
      { id: "angry", name: "生气", url: `${BASE}/emojis/angry.svg`, tags: ["生气", "angry"] },
      { id: "surprised", name: "惊讶", url: `${BASE}/emojis/surprised.svg`, tags: ["惊讶", "wow"] },
      { id: "cool", name: "酷", url: `${BASE}/emojis/cool.svg`, tags: ["酷", "cool"] },
      { id: "love", name: "爱心眼", url: `${BASE}/emojis/love.svg`, tags: ["爱", "love"] },
      { id: "thinking", name: "思考", url: `${BASE}/emojis/thinking.svg`, tags: ["思考", "think"] },
      { id: "sleepy", name: "困", url: `${BASE}/emojis/sleepy.svg`, tags: ["困", "sleep"] },
      { id: "happy", name: "开心", url: `${BASE}/emojis/happy.svg`, tags: ["开心", "happy"] },
      { id: "sad", name: "难过", url: `${BASE}/emojis/sad.svg`, tags: ["难过", "sad"] },
      { id: "wink", name: "眨眼", url: `${BASE}/emojis/wink.svg`, tags: ["眨眼", "wink"] },
    ],
  },
  {
    id: "animals",
    name: "动物",
    icon: `${BASE}/animals/cat.svg`,
    stickers: [
      { id: "cat", name: "猫咪", url: `${BASE}/animals/cat.svg`, tags: ["猫", "cat"] },
      { id: "dog", name: "狗狗", url: `${BASE}/animals/dog.svg`, tags: ["狗", "dog"] },
      { id: "rabbit", name: "兔子", url: `${BASE}/animals/rabbit.svg`, tags: ["兔", "rabbit"] },
      { id: "panda", name: "熊猫", url: `${BASE}/animals/panda.svg`, tags: ["熊猫", "panda"] },
      { id: "fox", name: "狐狸", url: `${BASE}/animals/fox.svg`, tags: ["狐狸", "fox"] },
      { id: "bear", name: "熊", url: `${BASE}/animals/bear.svg`, tags: ["熊", "bear"] },
      { id: "penguin", name: "企鹅", url: `${BASE}/animals/penguin.svg`, tags: ["企鹅", "penguin"] },
      { id: "hamster", name: "仓鼠", url: `${BASE}/animals/hamster.svg`, tags: ["仓鼠", "hamster"] },
      { id: "duck", name: "鸭子", url: `${BASE}/animals/duck.svg`, tags: ["鸭子", "duck"] },
      { id: "owl", name: "猫头鹰", url: `${BASE}/animals/owl.svg`, tags: ["猫头鹰", "owl"] },
    ],
  },
  {
    id: "gestures",
    name: "手势",
    icon: `${BASE}/gestures/thumbsup.svg`,
    stickers: [
      { id: "thumbsup", name: "点赞", url: `${BASE}/gestures/thumbsup.svg`, tags: ["赞", "ok", "thumbsup"] },
      { id: "wave", name: "挥手", url: `${BASE}/gestures/wave.svg`, tags: ["挥手", "hi", "wave"] },
      { id: "clap", name: "鼓掌", url: `${BASE}/gestures/clap.svg`, tags: ["鼓掌", "clap"] },
      { id: "fist", name: "拳头", url: `${BASE}/gestures/fist.svg`, tags: ["拳头", "加油", "fist"] },
      { id: "peace", name: "比耶", url: `${BASE}/gestures/peace.svg`, tags: ["耶", "peace"] },
      { id: "ok", name: "OK", url: `${BASE}/gestures/ok.svg`, tags: ["ok", "好的"] },
      { id: "heart", name: "比心", url: `${BASE}/gestures/heart.svg`, tags: ["心", "爱", "heart"] },
      { id: "highfive", name: "击掌", url: `${BASE}/gestures/highfive.svg`, tags: ["击掌", "highfive"] },
    ],
  },
];

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
