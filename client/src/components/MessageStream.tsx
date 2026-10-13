import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { AlertCircle, ArrowDown, Check, CheckCheck, Clock, Loader2, MessageCircle } from "lucide-react";
import { formatDayLabel, formatMessageTime } from "@/lib/format";
import { useAuthStore } from "@/store/auth";
import { useChatStore } from "@/store/chat";
import type { Message } from "@/types/chat";

const NEAR_BOTTOM_PX = 160;

function Ticks({ message, peerId }: { message: Message; peerId: string }) {
  if (message.pending) {
    return <Clock className="size-3 text-zinc-400" aria-label="Sending" />;
  }
  if (message.failed) {
    return <AlertCircle className="size-3 text-red-400" aria-label="Not delivered" />;
  }
  if (message.readBy.includes(peerId)) {
    return <CheckCheck className="size-3 text-online" aria-label="Read" />;
  }
  return <Check className="size-3 text-zinc-400" aria-label="Sent" />;
}

function Bubble({ message, isOwn, peerId }: { message: Message; isOwn: boolean; peerId: string }) {
  return (
    <div className={`animate-fade-up flex w-full ${isOwn ? "justify-end" : "justify-start"}`}>
      <div
        className={`max-w-[78%] rounded-2xl px-3 py-2 text-[13.5px] leading-relaxed sm:max-w-[65%] ${
          isOwn
            ? "rounded-br-md bg-bubble-out text-zinc-50"
            : "rounded-bl-md bg-bubble-in text-zinc-100"
        } ${message.failed ? "opacity-80 ring-1 ring-red-500/40" : ""} ${message.pending ? "opacity-70" : ""}`}
      >
        {message.messageType === "image" ? (
          <img
            src={message.content}
            alt="Shared photo"
            className="mb-1 max-h-72 w-auto rounded-lg object-contain"
            loading="lazy"
          />
        ) : (
          <p className="whitespace-pre-wrap break-words">
            {message.content}
          </p>
        )}
        <div
          className={`mt-0.5 flex items-center justify-end gap-1 text-[10.5px] tabular-nums ${
            isOwn ? "text-zinc-400" : "text-zinc-500"
          }`}
        >
          <span>{formatMessageTime(message.createdAt)}</span>
          {isOwn && <Ticks message={message} peerId={peerId} />}
        </div>
      </div>
    </div>
  );
}

export function MessageStream() {
  const user = useAuthStore((state) => state.user);
  const selectedUser = useChatStore((state) => state.selectedUser);
  const messages = useChatStore((state) => state.messages);
  const isTyping = useChatStore((state) => state.isTyping);
  const loadingMessages = useChatStore((state) => state.loadingMessages);
  const hasMore = useChatStore((state) => state.hasMore);
  const loadOlderMessages = useChatStore((state) => state.loadOlderMessages);

  const containerRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const prevScrollHeightRef = useRef(0);
  const [showJump, setShowJump] = useState(false);

  const myId = user?.id ?? "";
  const lastMessageId = messages.length > 0 ? messages[messages.length - 1]!.id : "";

  // Smooth scroll on new messages and the typing indicator.
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [lastMessageId, isTyping]);

  // Preserve viewport when older messages are prepended.
  useLayoutEffect(() => {
    const container = containerRef.current;
    if (container && prevScrollHeightRef.current > 0) {
      container.scrollTop += container.scrollHeight - prevScrollHeightRef.current;
      prevScrollHeightRef.current = 0;
    }
  }, [messages]);

  function onScroll() {
    const container = containerRef.current;
    if (!container) {
      return;
    }
    const distance = container.scrollHeight - container.scrollTop - container.clientHeight;
    setShowJump(distance > NEAR_BOTTOM_PX);
  }

  async function onLoadOlder() {
    const container = containerRef.current;
    if (container) {
      prevScrollHeightRef.current = container.scrollHeight;
    }
    await loadOlderMessages();
  }

  if (!selectedUser) {
    return null;
  }

  // Group messages by day for the separators.
  const groups: { label: string; items: Message[] }[] = [];
  for (const message of messages) {
    const label = formatDayLabel(message.createdAt);
    const lastGroup = groups[groups.length - 1];
    if (lastGroup?.label === label) {
      lastGroup.items.push(message);
    } else {
      groups.push({ label, items: [message] });
    }
  }

  return (
    <div className="relative min-h-0 flex-1">
      <div
        ref={containerRef}
        onScroll={onScroll}
        className="h-full overflow-y-auto px-4 py-5"
      >
        {hasMore && (
          <div className="mb-4 flex justify-center">
            <button
              type="button"
              onClick={() => void onLoadOlder()}
              disabled={loadingMessages}
              className="rounded-full border border-border bg-card px-3 py-1.5 text-xs font-medium text-muted-foreground hover:bg-hover hover:text-foreground disabled:opacity-50"
            >
              {loadingMessages ? "Loading…" : "Load earlier messages"}
            </button>
          </div>
        )}

        {messages.length === 0 && !loadingMessages ? (
          <div className="flex h-full flex-col items-center justify-center gap-3 text-center">
            <div className="flex size-12 items-center justify-center rounded-2xl bg-muted">
              <MessageCircle className="size-6 text-muted-foreground" />
            </div>
            <div>
              <p className="text-sm font-medium">
                No messages with {selectedUser.fullName.split(" ")[0]} yet
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                Send the first message to start the conversation.
              </p>
            </div>
          </div>
        ) : (
          <div className="space-y-1.5">
            {groups.map((group) => (
              <div key={group.label} className="space-y-1.5">
                <div className="sticky top-0 z-10 flex justify-center py-1">
                  <span className="rounded-full border border-border bg-card/90 px-2.5 py-0.5 text-[10.5px] font-medium text-muted-foreground backdrop-blur">
                    {group.label}
                  </span>
                </div>
                {group.items.map((message, index) => {
                  const isOwn = message.senderId === myId;
                  const prev = group.items[index - 1];
                  const grouped = prev !== undefined && prev.senderId === message.senderId;
                  return (
                    <div key={message.id} className={grouped ? "pt-0.5" : "pt-2"}>
                      <Bubble message={message} isOwn={isOwn} peerId={selectedUser.id} />
                    </div>
                  );
                })}
              </div>
            ))}

            {isTyping && (
              <div className="flex justify-start pt-2">
                <div className="flex items-center gap-1 rounded-2xl rounded-bl-md bg-bubble-in px-3.5 py-2.5">
                  <span className="typing-dot size-1.5 rounded-full bg-zinc-400" />
                  <span className="typing-dot size-1.5 rounded-full bg-zinc-400 [animation-delay:150ms]" />
                  <span className="typing-dot size-1.5 rounded-full bg-zinc-400 [animation-delay:300ms]" />
                </div>
              </div>
            )}

            <div ref={bottomRef} className="h-px" />
          </div>
        )}

        {loadingMessages && messages.length === 0 && (
          <div className="flex h-full items-center justify-center text-muted-foreground">
            <Loader2 className="size-5 animate-spin" />
          </div>
        )}
      </div>

      {showJump && (
        <button
          type="button"
          onClick={() => bottomRef.current?.scrollIntoView({ behavior: "smooth" })}
          className="animate-fade-in absolute right-4 bottom-4 z-10 inline-flex size-9 items-center justify-center rounded-full border border-border bg-card-elevated text-muted-foreground shadow-lg shadow-black/30 hover:bg-hover hover:text-foreground"
          aria-label="Jump to latest"
        >
          <ArrowDown className="size-4" />
        </button>
      )}
    </div>
  );
}
