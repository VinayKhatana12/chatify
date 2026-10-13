import { create } from "zustand";
import { toast } from "sonner";
import { api, getErrorMessage } from "@/lib/api";
import type { User } from "@/types/chat";

interface SignupInput {
  fullName: string;
  username: string;
  email: string;
  password: string;
}

interface AuthState {
  user: User | null;
  checkingAuth: boolean;
  signingIn: boolean;
  signingUp: boolean;
  loggingOut: boolean;
  checkAuth: () => Promise<void>;
  login: (identifier: string, password: string) => Promise<boolean>;
  signup: (input: SignupInput) => Promise<boolean>;
  logout: () => Promise<void>;
}

export const useAuthStore = create<AuthState>()((set) => ({
  user: null,
  checkingAuth: true,
  signingIn: false,
  signingUp: false,
  loggingOut: false,

  checkAuth: async () => {
    try {
      const res = await api.get<{ user: User }>("/auth/me");
      set({ user: res.data.user });
    } catch {
      set({ user: null });
    } finally {
      set({ checkingAuth: false });
    }
  },

  login: async (identifier, password) => {
    set({ signingIn: true });
    try {
      const res = await api.post<{ user: User }>("/auth/login", { identifier, password });
      set({ user: res.data.user });
      toast.success(`Welcome back, ${res.data.user.fullName.split(" ")[0]}`);
      return true;
    } catch (error) {
      toast.error(getErrorMessage(error, "Could not sign in"));
      return false;
    } finally {
      set({ signingIn: false });
    }
  },

  signup: async (input) => {
    set({ signingUp: true });
    try {
      const res = await api.post<{ user: User }>("/auth/signup", input);
      set({ user: res.data.user });
      toast.success("Account created");
      return true;
    } catch (error) {
      toast.error(getErrorMessage(error, "Could not create the account"));
      return false;
    } finally {
      set({ signingUp: false });
    }
  },

  logout: async () => {
    set({ loggingOut: true });
    try {
      await api.post("/auth/logout");
      set({ user: null });
    } catch (error) {
      toast.error(getErrorMessage(error, "Could not log out"));
    } finally {
      set({ loggingOut: false });
    }
  },
}));
