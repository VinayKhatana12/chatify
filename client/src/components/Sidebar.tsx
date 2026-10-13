import { useMemo, useState } from "react";
import { Loader2, LogOut, MessageSquare, Search } from "lucide-react";
import { Avatar } from "@/components/Avatar";
import { formatConversationTime } from "@/lib/format";
import { useAuthStore } from "@/store/auth";
import { useChatStore } from "@/store/chat";
import type { Conversation } from "@/types/chat";

function previewText(conversation: Conversation, myId: string): string {
  const last = conversation.lastMessage;
  if (!last) {
    return "No messages yet";
  }
  const prefix = last.senderId === myId ? "You: " : "";
  if (last.messageType === "image") {
    return `${prefix}Photo`;
  }
  return `${prefix}${last.content}`;
}

export function Sidebar() {
  const user = useAuthStore((state) => state.user);
  const logout = useAuthStore((state) => state.logout);
  const loggingOut = useAuthStore((state) => state.loggingOut);
  const conversations = useChatStore((state) => state.conversations);
  const selectedUser = useChatStore((state) => state.selectedUser);
  const selectUser = useChatStore((state) => state.selectUser);
  const loadingConversations = useChatStore((state) => state.loadingConversations);
  const [query, setQuery] = useState("");

  const myId = user?.id ?? "";
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) {
      return conversations;
    }
    return conversations.filter(
      (c) =>
        c.peer.fullName.toLowerCase().includes(q) ||
        c.peer.username.toLowerCase().includes(q),
    );
  }, [conversations, query]);

  return (
    <div className="flex h-full flex-col">
      {/* Profile strip */}
      <div className="flex h-16 shrink-0 items-center gap-3 border-b border-border px-4">
        <Avatar name={user?.fullName ?? ""} avatarUrl={user?.avatarUrl} size="md" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium">{user?.fullName}</p>
          <p className="truncate text-xs text-muted-foreground">@{user?.username}</p>
        </div>
        <button
          type="button"
          onClick={() => void logout()}
          disabled={loggingOut}
          className="inline-flex size-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-hover hover:text-foreground disabled:opacity-50"
          aria-label="Log out"
          title="Log out"
        >
          {loggingOut ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <LogOut className="size-4" />
          )}
        </button>
      </div>

      {/* Search */}
      <div className="p-3">
        <div className="relative">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search conversations"
            className="h-9 w-full rounded-lg border border-input bg-input pl-9 pr-3 text-sm placeholder:text-muted-foreground focus:border-ring focus:ring-2 focus:ring-ring/40 focus:outline-none"
          />
        </div>
      </div>

      {/* Conversations */}
      <div className="min-h-0 flex-1 overflow-y-auto px-2 pb-3">
        {loadingConversations ? (
          <div className="flex h-24 items-center justify-center text-muted-foreground">
            <Loader2 className="size-5 animate-spin" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center gap-2 px-6 py-10 text-center">
            <div className="flex size-10 items-center justify-center rounded-xl bg-muted">
              <MessageSquare className="size-5 text-muted-foreground" />
            </div>
            <p className="text-sm font-medium">
              {query ? "No matches" : "No conversations yet"}
            </p>
            <p className="text-xs leading-relaxed text-muted-foreground">
              {query
                ? "Try a different name or username."
                : "Once someone messages you, the chat shows up here."}
            </p>
          </div>
        ) : (
          <ul className="space-y-0.5">
            {filtered.map((conversation) => {
              const active = selectedUser?.id === conversation.peer.id;
              const unread = conversation.unreadCount > 0;
              return (
                <li key={conversation.id}>
                  <button
                    type="button"
                    onClick={() => selectUser(conversation.peer)}
                    className={`flex w-full items-center gap-3 rounded-lg px-2 py-2.5 text-left transition-colors ${
                      active ? "bg-hover" : "hover:bg-hover/60"
                    }`}
                  >
                    <Avatar
                      name={conversation.peer.fullName}
                      avatarUrl={conversation.peer.avatarUrl}
                      userId={conversation.peer.id}
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-baseline justify-between gap-2">
                        <p
                          className={`truncate text-sm ${unread ? "font-semibold text-foreground" : "font-medium"}`}
                        >
                          {conversation.peer.fullName}
                        </p>
                        <span className="shrink-0 text-[11px] tabular-nums text-muted-foreground">
                          {conversation.lastMessage
                            ? formatConversationTime(conversation.lastMessage.createdAt)
                            : ""}
                        </span>
                      </div>
                      <div className="mt-0.5 flex items-center justify-between gap-2">
                        <p
                          className={`truncate text-xs ${unread ? "text-foreground/90" : "text-muted-foreground"}`}
                        >
                          {previewText(conversation, myId)}
                        </p>
                        {unread && (
                          <span className="inline-flex h-[18px] min-w-[18px] shrink-0 items-center justify-center rounded-full bg-online px-1 text-[10.5px] font-semibold tabular-nums text-zinc-950">
                            {conversation.unreadCount > 99 ? "99+" : conversation.unreadCount}
                          </span>
                        )}
                      </div>
                    </div>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
