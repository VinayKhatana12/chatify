import { MessagesSquare } from "lucide-react";
import { ChatHeader } from "@/components/ChatHeader";
import { MessageInput } from "@/components/MessageInput";
import { MessageStream } from "@/components/MessageStream";
import { Sidebar } from "@/components/Sidebar";
import { useChatStore } from "@/store/chat";

function WelcomePane() {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-4 px-6 text-center">
      <div className="flex size-14 items-center justify-center rounded-2xl border border-border bg-card-elevated">
        <MessagesSquare className="size-7 text-muted-foreground" />
      </div>
      <div>
        <h2 className="text-base font-semibold">Your inbox is ready</h2>
        <p className="mx-auto mt-1.5 max-w-xs text-sm leading-relaxed text-muted-foreground">
          Pick a conversation on the left, or wait for someone to reach out.
        </p>
      </div>
    </div>
  );
}

export function ChatPage() {
  const selectedUser = useChatStore((state) => state.selectedUser);

  return (
    <div className="grid h-dvh grid-cols-1 md:grid-cols-[320px_1fr]">
      <aside
        className={`min-h-0 border-border bg-card md:flex md:flex-col md:border-r ${
          selectedUser ? "hidden" : "flex flex-col"
        }`}
      >
        <Sidebar />
      </aside>

      <main
        className={`min-h-0 min-w-0 flex-col bg-background md:flex ${
          selectedUser ? "flex" : "hidden"
        }`}
      >
        {selectedUser ? (
          <>
            <ChatHeader />
            <MessageStream />
            <MessageInput />
          </>
        ) : (
          <WelcomePane />
        )}
      </main>
    </div>
  );
}
