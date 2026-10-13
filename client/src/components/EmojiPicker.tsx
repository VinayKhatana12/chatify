import { useEffect, useRef } from "react";

const EMOJIS = [
  "😀", "😅", "😂", "🤣", "😊", "😍", "🥰", "😎",
  "🤔", "😴", "🙃", "😢", "😭", "😤", "😡", "🤯",
  "🥳", "😱", "🤗", "🤝", "👍", "👎", "👏", "🙏",
  "💪", "🔥", "✨", "🎉", "❤️", "💜", "💯", "⚡",
  "☕", "🍕", "🍻", "🎮", "🌙", "☀️", "🌈", "🐱",
  "🐶", "🦊", "🐢", "🚀", "🛸", "📌", "✅", "❌",
];

interface EmojiPickerProps {
  onSelect: (emoji: string) => void;
  onClose: () => void;
}

export function EmojiPicker({ onSelect, onClose }: EmojiPickerProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onPointerDown(event: PointerEvent) {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        onClose();
      }
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onClose();
      }
    }
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [onClose]);

  return (
    <div
      ref={ref}
      className="animate-fade-up absolute bottom-full left-0 z-20 mb-2 w-72 rounded-xl border border-border bg-card-elevated p-2 shadow-2xl shadow-black/40"
    >
      <div className="grid grid-cols-8 gap-0.5">
        {EMOJIS.map((emoji) => (
          <button
            key={emoji}
            type="button"
            onClick={() => onSelect(emoji)}
            className="flex size-8 items-center justify-center rounded-lg text-lg hover:bg-hover"
            aria-label={`Insert ${emoji}`}
          >
            {emoji}
          </button>
        ))}
      </div>
    </div>
  );
}
