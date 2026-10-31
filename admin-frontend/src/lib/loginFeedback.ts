export type LoginField = "email" | "password";
export type LoginFieldErrors = Partial<Record<LoginField, string>>;

export interface LoginFailure {
  message: string;
  invalidFields: LoginField[];
  focus: LoginField | "form";
}

export function validateLogin(
  email: string,
  password: string,
): LoginFieldErrors {
  const errors: LoginFieldErrors = {};
  if (!email.trim()) errors.email = "Enter your email address.";
  else if (!/^[^\s@]+@[^\s@]+$/.test(email.trim()))
    errors.email = "Enter a valid email address, such as name@example.com";
  if (!password) errors.password = "Enter your password.";
  return errors;
}

/** Stable Auth codes, rather than raw service messages, drive user feedback. */
export function signInFailure(error: unknown): LoginFailure {
  const detail =
    error && typeof error === "object"
      ? (error as { code?: unknown; status?: unknown; name?: unknown })
      : {};
  if (detail.status === 429 || detail.code === "over_request_rate_limit") {
    return {
      message: "Too many sign-in attempts. Wait a few minutes, then try again.",
      invalidFields: [],
      focus: "form",
    };
  }
  if (detail.code === "invalid_credentials") {
    return {
      message: "Email or password is incorrect. Check both and try again.",
      invalidFields: ["email", "password"],
      focus: "password",
    };
  }
  if (detail.code === "email_not_confirmed") {
    return {
      message:
        "Confirm your email using the link in your inbox, then try again. Need help? Contact your CDRRMO administrator.",
      invalidFields: ["email"],
      focus: "email",
    };
  }
  if (detail.code === "email_address_invalid") {
    return {
      message:
        "Check that you are using the email address provided by your administrator.",
      invalidFields: ["email"],
      focus: "email",
    };
  }
  if (detail.code === "user_banned") {
    return {
      message:
        "This account cannot sign in. Contact your CDRRMO administrator for help.",
      invalidFields: [],
      focus: "form",
    };
  }
  if (detail.code === "request_timeout" || detail.name === "TimeoutError") {
    return {
      message: "Sign-in took too long. Check your connection and try again.",
      invalidFields: [],
      focus: "form",
    };
  }
  if (typeof detail.status === "number" && detail.status >= 500) {
    return {
      message:
        "The sign-in service is temporarily unavailable. Please try again shortly.",
      invalidFields: [],
      focus: "form",
    };
  }
  if (
    detail.name === "AuthRetryableFetchError" ||
    detail.name === "TypeError"
  ) {
    return {
      message:
        "Unable to connect. Check your internet connection and try again.",
      invalidFields: [],
      focus: "form",
    };
  }
  return {
    message:
      "We couldn't sign you in. Please try again. If this continues, contact your CDRRMO administrator.",
    invalidFields: [],
    focus: "form",
  };
}
