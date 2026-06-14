import { useRef, useEffect, useMemo } from "react";
import Picker from "@emoji-mart/react";
import data from "@emoji-mart/data";
import zhI18n from "@emoji-mart/data/i18n/zh.json";
import enI18n from "@emoji-mart/data/i18n/en.json";
import { STICKER_PACKS } from "../../data/stickers";
import { useSettingsStore } from "../../stores/settingsStore";

const customStickerPacks = STICKER_PACKS.map((pack) => ({
  id: pack.id,
  name: pack.name,
  emojis: pack.stickers.map((s) => ({
    id: s.id,
    name: s.name,
    keywords: s.tags,
    skins: [{ src: s.url }],
  })),
}));

interface EmojiPickerProps {
  onSelect: (emoji: string) => void;
  onStickerSelect: (sticker: { id: string; name: string; src: string }) => void;
  onClose: () => void;
}

export function EmojiPicker({ onSelect, onStickerSelect, onClose }: EmojiPickerProps) {
  const ref = useRef<HTMLDivElement>(null);
  const language = useSettingsStore((s) => s.settings.language);
  const emojiI18n = useMemo(() => language === "en" ? enI18n : zhI18n, [language]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        onClose();
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [onClose]);

  return (
    <div
      ref={ref}
      className="absolute bottom-full mb-2 left-0 z-50 shadow-xl rounded-xl overflow-hidden"
    >
      <style>{`
        em-emoji-picker {
          --rgb-background: 255, 255, 255;
          --rgb-input: 245, 245, 245;
          --rgb-color: 38, 38, 38;
          --em-emoji-size: 2rem;
        }
        em-emoji-picker .em-emoji-picker-category:last-child {
          --em-emoji-size: 3rem;
        }
        em-emoji-picker [data-type="custom"] button {
          width: 56px !important;
          height: 56px !important;
        }
        em-emoji-picker [data-type="custom"] button img {
          width: 48px !important;
          height: 48px !important;
          object-fit: contain;
        }
      `}</style>
      <Picker
        data={data}
        custom={customStickerPacks}
        i18n={emojiI18n}
        onEmojiSelect={(emoji: any) => {
          if (emoji.src) {
            onStickerSelect({ id: emoji.id, name: emoji.name, src: emoji.src });
          } else {
            onSelect(emoji.native);
          }
        }}
        theme="light"
        set="native"
        previewPosition="bottom"
        skinTonePosition="search"
        perLine={8}
        maxFrequentRows={2}
        categories={[
          "frequent",
          "people",
          "nature",
          "foods",
          "activity",
          "places",
          "objects",
          "symbols",
          "flags",
          ...customStickerPacks.map((p) => p.id),
        ]}
      />
    </div>
  );
}
