import { ArrowLeft } from "lucide-react";
import { Avatar } from "@/components/Avatar";
import { useChatStore } from "@/store/chat";

export function ChatHeader() {
  const selectedUser = useChatStore((state) => state.selectedUser);
  const isTyping = useChatStore((state) => state.isTyping);
  const clearSelection = useChatStore((state) => state.clearSelection);
  const onlineUsers = useChatStore((state) => state.onlineUsers);

  if (!selectedUser) {
    return null;
  }

  const online = onlineUsers.includes(selectedUser.id);
  const status = isTyping ? "typing" : online ? "online" : "offline";

  return (
    <header className="flex h-16 shrink-0 items-center gap-3 border-b border-border bg-card px-4">
      <button
        type="button"
        onClick={clearSelection}
        className="inline-flex size-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-hover hover:text-foreground md:hidden"
        aria-label="Back to conversations"
      >
        <ArrowLeft className="size-4" />
      </button>

      <Avatar
        name={selectedUser.fullName}
        avatarUrl={selectedUser.avatarUrl}
        userId={selectedUser.id}
        size="md"
      />

      <div className="min-w-0">
        <p className="truncate text-sm font-medium">{selectedUser.fullName}</p>
        {status === "typing" ? (
          <p className="flex items-center gap-1.5 text-xs font-medium text-online">
            Typing
            <span className="inline-flex gap-0.5">
              <span className="typing-dot size-1 rounded-full bg-online" />
              <span className="typing-dot size-1 rounded-full bg-online [animation-delay:150ms]" />
              <span className="typing-dot size-1 rounded-full bg-online [animation-delay:300ms]" />
            </span>
          </p>
        ) : (
          <p className="truncate text-xs text-muted-foreground">
            {online ? "Online" : "Offline"}
          </p>
        )}
      </div>
    </header>
  );
}
