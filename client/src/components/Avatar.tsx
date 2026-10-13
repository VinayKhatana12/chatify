import { initialsOf } from "@/lib/format";
import { useChatStore } from "@/store/chat";

interface AvatarProps {
  name: string;
  avatarUrl?: string;
  userId?: string;
  size?: "sm" | "md" | "lg";
}

const SIZES = {
  sm: { box: "size-8", text: "text-[11px]", dot: "size-2.5" },
  md: { box: "size-10", text: "text-xs", dot: "size-3" },
  lg: { box: "size-12", text: "text-sm", dot: "size-3.5" },
} as const;

export function Avatar({ name, avatarUrl, userId, size = "md" }: AvatarProps) {
  const onlineUsers = useChatStore((state) => state.onlineUsers);
  const online =
    userId !== undefined &&
    (onlineUsers.length > 0
      ? onlineUsers.includes(userId)
      : useChatStore.getState().conversations.find((c) => c.peer.id === userId)?.peer.isOnline === true);

  const s = SIZES[size];
  return (
    <div className="relative shrink-0">
      <div
        className={`${s.box} flex items-center justify-center overflow-hidden rounded-full bg-zinc-800 font-medium text-zinc-300 select-none`}
      >
        {avatarUrl ? (
          <img src={avatarUrl} alt={name} className="size-full object-cover" />
        ) : (
          <span className={s.text}>{initialsOf(name) || "?"}</span>
        )}
      </div>
      {online && (
        <span
          className={`absolute right-0 bottom-0 ${s.dot} rounded-full bg-online ring-2 ring-background`}
          aria-label="Online"
        />
      )}
    </div>
  );
}
