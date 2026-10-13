import { useRef, useState } from "react";
import type { ChangeEvent, KeyboardEvent } from "react";
import { Image as ImageIcon, Loader2, SendHorizontal, Smile } from "lucide-react";
import { toast } from "sonner";
import { EmojiPicker } from "@/components/EmojiPicker";
import { useChatStore } from "@/store/chat";

const MAX_TEXT_LENGTH = 4000;

export function MessageInput() {
  const selectedUser = useChatStore((state) => state.selectedUser);
  const sendMessage = useChatStore((state) => state.sendMessage);
  const sendTyping = useChatStore((state) => state.sendTyping);
  const sendStopTyping = useChatStore((state) => state.sendStopTyping);

  const [value, setValue] = useState("");
  const [showEmoji, setShowEmoji] = useState(false);
  const [uploading, setUploading] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!selectedUser) {
    return null;
  }
  const peerId = selectedUser.id;

  function resizeTextarea() {
    const el = textareaRef.current;
    if (!el) {
      return;
    }
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 140)}px`;
  }

  function handleChange(event: ChangeEvent<HTMLTextAreaElement>) {
    const next = event.target.value;
    setValue(next);
    resizeTextarea();

    if (next.trim().length > 0) {
      sendTyping(peerId);
    } else {
      sendStopTyping(peerId);
    }
  }

  async function handleFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = ""; // allow re-picking the same file
    if (!file) {
      return;
    }
    if (!file.type.startsWith("image/")) {
      toast.error("Only image files are supported");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Images are limited to 5 MB");
      return;
    }
    setUploading(true);
    try {
      await sendMessage({ imageFile: file });
    } finally {
      setUploading(false);
    }
  }

  function submit() {
    const content = value.trim();
    if (!content) {
      return;
    }
    sendStopTyping(peerId);
    setValue("");
    requestAnimationFrame(resizeTextarea);
    void sendMessage({ text: content });
  }

  function onKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      submit();
    }
  }

  return (
    <footer className="shrink-0 border-t border-border bg-card/80 backdrop-blur">
      <div className="relative mx-auto flex max-w-3xl items-end gap-1.5 p-3">
        {showEmoji && (
          <EmojiPicker
            onSelect={(emoji) => {
              setValue((current) => current + emoji);
              textareaRef.current?.focus();
            }}
            onClose={() => setShowEmoji(false)}
          />
        )}

        <button
          type="button"
          onClick={() => setShowEmoji((open) => !open)}
          className={`inline-flex size-9 shrink-0 items-center justify-center rounded-lg hover:bg-hover ${
            showEmoji ? "text-foreground" : "text-muted-foreground"
          }`}
          aria-label="Emoji picker"
          title="Emoji"
        >
          <Smile className="size-[18px]" />
        </button>

        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
          className="inline-flex size-9 shrink-0 items-center justify-center rounded-lg text-muted-foreground hover:bg-hover hover:text-foreground disabled:opacity-50"
          aria-label="Attach an image"
          title="Attach image"
        >
          {uploading ? (
            <Loader2 className="size-[18px] animate-spin" />
          ) : (
            <ImageIcon className="size-[18px]" />
          )}
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(event) => void handleFile(event)}
        />

        <textarea
          ref={textareaRef}
          rows={1}
          value={value}
          onChange={handleChange}
          onKeyDown={onKeyDown}
          maxLength={MAX_TEXT_LENGTH}
          placeholder={`Message ${selectedUser.fullName.split(" ")[0]}`}
          className="max-h-[140px] min-h-[38px] flex-1 resize-none rounded-xl border border-input bg-input px-3 py-2 text-sm leading-relaxed placeholder:text-muted-foreground focus:border-ring focus:ring-2 focus:ring-ring/40 focus:outline-none"
        />

        <button
          type="button"
          onClick={submit}
          disabled={value.trim().length === 0}
          className="inline-flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
          aria-label="Send message"
          title="Send"
        >
          <SendHorizontal className="size-4" />
        </button>
      </div>
    </footer>
  );
}
