const AUTH_ERROR_MESSAGES: Record<string, string> = {
  invalid_credentials: "Email or password is incorrect.",
  email_not_confirmed: "Confirm your email before signing in.",
  user_already_exists: "An account with this email already exists. Sign in instead.",
  email_exists: "An account with this email already exists. Sign in instead.",
  weak_password: "Choose a password with at least 8 characters.",
  over_request_rate_limit: "Too many attempts. Wait a moment and try again.",
  user_banned: "This account cannot sign in. Contact your clinic administrator.",
};

export function toAuthErrorMessage(code: string | undefined, fallback: string) {
  if (!code) {
    return fallback;
  }

  return AUTH_ERROR_MESSAGES[code] ?? fallback;
}

export const SUPABASE_CONFIG_MESSAGE =
  "Authentication is unavailable until the Supabase environment variables are set.";
