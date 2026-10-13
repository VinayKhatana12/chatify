import { useState } from "react";
import type { FormEvent } from "react";
import { Loader2, MessageSquare } from "lucide-react";
import { useAuthStore } from "@/store/auth";

type Mode = "login" | "signup";

const inputClasses =
  "h-10 w-full rounded-lg border border-input bg-input px-3 text-sm placeholder:text-muted-foreground focus:border-ring focus:ring-2 focus:ring-ring/40 focus:outline-none";

export function AuthPage() {
  const login = useAuthStore((state) => state.login);
  const signup = useAuthStore((state) => state.signup);
  const signingIn = useAuthStore((state) => state.signingIn);
  const signingUp = useAuthStore((state) => state.signingUp);

  const [mode, setMode] = useState<Mode>("login");
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");

  const busy = mode === "login" ? signingIn : signingUp;

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (mode === "login") {
      await login(identifier, password);
    } else {
      await signup({ fullName, username, email, password });
    }
  }

  return (
    <div className="relative flex min-h-dvh items-center justify-center overflow-hidden bg-background px-4">
      {/* Subtle top glow, monochrome */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-72 bg-gradient-to-b from-zinc-800/30 to-transparent"
      />

      <div className="animate-fade-up relative w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center text-center">
          <div className="mb-4 flex size-12 items-center justify-center rounded-2xl border border-border bg-card-elevated">
            <MessageSquare className="size-6 text-foreground" />
          </div>
          <h1 className="text-2xl font-semibold tracking-tight">Chatify</h1>
          <p className="mt-1.5 text-sm text-muted-foreground">
            Private messaging, fast and minimal.
          </p>
        </div>

        <div className="rounded-2xl border border-border bg-card p-6 shadow-2xl shadow-black/30">
          <div className="mb-5 grid grid-cols-2 gap-1 rounded-lg bg-input p-1">
            {(["login", "signup"] as const).map((option) => (
              <button
                key={option}
                type="button"
                onClick={() => setMode(option)}
                className={`h-8 rounded-md text-sm font-medium transition-colors ${
                  mode === option
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {option === "login" ? "Log in" : "Sign up"}
              </button>
            ))}
          </div>

          <form onSubmit={(event) => void onSubmit(event)} className="space-y-4">
            {mode === "signup" && (
              <>
                <div className="space-y-1.5">
                  <label htmlFor="fullName" className="block text-xs font-medium text-foreground">
                    Full name
                  </label>
                  <input
                    id="fullName"
                    type="text"
                    required
                    maxLength={60}
                    autoComplete="name"
                    value={fullName}
                    onChange={(event) => setFullName(event.target.value)}
                    placeholder="Ada Lovelace"
                    className={inputClasses}
                  />
                </div>
                <div className="space-y-1.5">
                  <label htmlFor="username" className="block text-xs font-medium text-foreground">
                    Username
                  </label>
                  <input
                    id="username"
                    type="text"
                    required
                    minLength={3}
                    maxLength={30}
                    autoComplete="username"
                    value={username}
                    onChange={(event) => setUsername(event.target.value.toLowerCase())}
                    placeholder="ada"
                    className={inputClasses}
                  />
                  <p className="text-[11px] text-muted-foreground">
                    Lowercase letters, numbers and underscores.
                  </p>
                </div>
                <div className="space-y-1.5">
                  <label htmlFor="email" className="block text-xs font-medium text-foreground">
                    Email
                  </label>
                  <input
                    id="email"
                    type="email"
                    required
                    autoComplete="email"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    placeholder="ada@example.com"
                    className={inputClasses}
                  />
                </div>
              </>
            )}

            {mode === "login" && (
              <div className="space-y-1.5">
                <label htmlFor="identifier" className="block text-xs font-medium text-foreground">
                  Username or email
                </label>
                <input
                  id="identifier"
                  type="text"
                  required
                  autoComplete="username"
                  value={identifier}
                  onChange={(event) => setIdentifier(event.target.value)}
                  placeholder="ada or ada@example.com"
                  className={inputClasses}
                />
              </div>
            )}

            <div className="space-y-1.5">
              <label htmlFor="password" className="block text-xs font-medium text-foreground">
                Password
              </label>
              <input
                id="password"
                type="password"
                required
                minLength={8}
                autoComplete={mode === "login" ? "current-password" : "new-password"}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="••••••••"
                className={inputClasses}
              />
              {mode === "signup" && (
                <p className="text-[11px] text-muted-foreground">At least 8 characters.</p>
              )}
            </div>

            <button
              type="submit"
              disabled={busy}
              className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-lg bg-primary text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-60"
            >
              {busy && <Loader2 className="size-4 animate-spin" />}
              {mode === "login" ? "Log in" : "Create account"}
            </button>
          </form>
        </div>

        <p className="mt-6 text-center text-xs text-muted-foreground">
          {mode === "login" ? "New here? " : "Already have an account? "}
          <button
            type="button"
            onClick={() => setMode(mode === "login" ? "signup" : "login")}
            className="font-medium text-foreground hover:underline"
          >
            {mode === "login" ? "Create an account" : "Log in"}
          </button>
        </p>
      </div>
    </div>
  );
}
