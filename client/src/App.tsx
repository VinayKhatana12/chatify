import { useEffect } from "react";
import { Loader2, MessageSquare } from "lucide-react";
import { Toaster } from "sonner";
import { socket } from "@/lib/socket";
import { AuthPage } from "@/pages/AuthPage";
import { ChatPage } from "@/pages/ChatPage";
import { useAuthStore } from "@/store/auth";
import { useChatStore } from "@/store/chat";

function Splash() {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-3 bg-background">
      <div className="flex size-12 items-center justify-center rounded-2xl border border-border bg-card-elevated">
        <MessageSquare className="size-6 text-foreground" />
      </div>
      <Loader2 className="size-5 animate-spin text-muted-foreground" />
    </div>
  );
}

export default function App() {
  const user = useAuthStore((state) => state.user);
  const checkingAuth = useAuthStore((state) => state.checkingAuth);

  useEffect(() => {
    void useAuthStore.getState().checkAuth();
  }, []);

  const userId = user?.id;
  useEffect(() => {
    if (!userId) {
      socket.disconnect();
      useChatStore.getState().unsubscribeFromMessages();
      return;
    }
    if (!socket.connected) {
      socket.connect();
    }
    useChatStore.getState().subscribeToMessages();
    void useChatStore.getState().getConversations();
    return () => {
      useChatStore.getState().unsubscribeFromMessages();
      socket.disconnect();
    };
  }, [userId]);

  return (
    <>
      {checkingAuth ? <Splash /> : user ? <ChatPage /> : <AuthPage />}
      <Toaster theme="dark" position="top-center" richColors />
    </>
  );
}
