const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const USERNAME_PATTERN = /^[a-z0-9_]+$/;

export interface SignupInput {
  fullName: string;
  username: string;
  email: string;
  password: string;
}

export type SignupParseResult =
  | { ok: true; value: SignupInput }
  | { ok: false; errors: Record<string, string> };

export function parseSignupInput(body: Record<string, unknown>): SignupParseResult {
  const errors: Record<string, string> = {};

  const fullName = String(body.fullName ?? "").trim();
  const username = String(body.username ?? "").trim().toLowerCase();
  const email = String(body.email ?? "").trim().toLowerCase();
  const password = typeof body.password === "string" ? body.password : "";

  if (fullName.length < 1 || fullName.length > 60) {
    errors.fullName = "Full name must be between 1 and 60 characters";
  }
  if (username.length < 3 || username.length > 30) {
    errors.username = "Username must be between 3 and 30 characters";
  } else if (!USERNAME_PATTERN.test(username)) {
    errors.username = "Username may only contain lowercase letters, numbers and underscores";
  }
  if (!EMAIL_PATTERN.test(email)) {
    errors.email = "Enter a valid email address";
  }
  if (password.length < 8 || password.length > 128) {
    errors.password = "Password must be between 8 and 128 characters";
  }

  if (Object.keys(errors).length > 0) {
    return { ok: false, errors };
  }
  return { ok: true, value: { fullName, username, email, password } };
}
