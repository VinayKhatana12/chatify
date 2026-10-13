function startOfDay(date: Date): number {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
}

/** Sidebar timestamp: HH:mm today, Yesterday, weekday within a week, else date. */
export function formatConversationTime(iso: string): string {
  const date = new Date(iso);
  const now = new Date();
  const days = Math.round((startOfDay(now) - startOfDay(date)) / 86_400_000);

  if (days <= 0) {
    return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  }
  if (days === 1) {
    return "Yesterday";
  }
  if (days < 7) {
    return date.toLocaleDateString([], { weekday: "short" });
  }
  return date.toLocaleDateString([], { day: "numeric", month: "short" });
}

/** Bubble timestamp: HH:mm with tabular-friendly output. */
export function formatMessageTime(iso: string): string {
  return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

/** Stream day separator label. */
export function formatDayLabel(iso: string): string {
  const date = new Date(iso);
  const now = new Date();
  const days = Math.round((startOfDay(now) - startOfDay(date)) / 86_400_000);

  if (days <= 0) {
    return "Today";
  }
  if (days === 1) {
    return "Yesterday";
  }
  const options: Intl.DateTimeFormatOptions = { day: "numeric", month: "short" };
  if (date.getFullYear() !== now.getFullYear()) {
    options.year = "numeric";
  }
  return date.toLocaleDateString([], options);
}

/** Header status line for offline peers. */
export function formatLastSeen(iso: string): string {
  const date = new Date(iso);
  const now = new Date();
  const days = Math.round((startOfDay(now) - startOfDay(date)) / 86_400_000);

  if (days <= 0) {
    return `Last seen at ${date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`;
  }
  if (days === 1) {
    return "Last seen yesterday";
  }
  return `Last seen ${date.toLocaleDateString([], { day: "numeric", month: "short" })}`;
}

export function initialsOf(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]!.toUpperCase())
    .join("");
}
