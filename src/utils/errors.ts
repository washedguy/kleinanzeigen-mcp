export type ErrorCode =
  | "AUTH_REQUIRED"
  | "CHALLENGE_REQUIRED"
  | "NAVIGATION_ERROR"
  | "LISTING_NOT_FOUND"
  | "CONVERSATION_NOT_FOUND"
  | "RATE_LIMITED"
  | "INVALID_INPUT"
  | "INTERNAL_ERROR";

const SAFE_MESSAGES: Record<ErrorCode, string> = {
  AUTH_REQUIRED: "Kleinanzeigen login is required. Run `npm run login` and sign in.",
  CHALLENGE_REQUIRED:
    "Kleinanzeigen presented a challenge (e.g. CAPTCHA). Run `npm run login` and solve it manually.",
  NAVIGATION_ERROR: "Failed to navigate to the requested Kleinanzeigen page.",
  LISTING_NOT_FOUND: "The requested listing could not be found.",
  CONVERSATION_NOT_FOUND: "The requested conversation could not be found.",
  RATE_LIMITED: "Kleinanzeigen rate limited the request. Please try again later.",
  INVALID_INPUT: "The provided input is invalid.",
  INTERNAL_ERROR: "An unexpected error occurred.",
};

export class AppError extends Error {
  readonly code: ErrorCode;
  constructor(code: ErrorCode, message?: string) {
    super(message ?? SAFE_MESSAGES[code]);
    this.code = code;
    this.name = new.target.name;
  }
}

export class AuthenticationRequiredError extends AppError {
  constructor(message?: string) {
    super("AUTH_REQUIRED", message);
  }
}

export class ChallengeRequiredError extends AppError {
  constructor(message?: string) {
    super("CHALLENGE_REQUIRED", message);
  }
}

export class NavigationError extends AppError {
  constructor(message?: string) {
    super("NAVIGATION_ERROR", message);
  }
}

export class ListingNotFoundError extends AppError {
  constructor(message?: string) {
    super("LISTING_NOT_FOUND", message);
  }
}

export class ConversationNotFoundError extends AppError {
  constructor(message?: string) {
    super("CONVERSATION_NOT_FOUND", message);
  }
}

export class RateLimitError extends AppError {
  constructor(message?: string) {
    super("RATE_LIMITED", message);
  }
}

export class InvalidInputError extends AppError {
  constructor(message?: string) {
    super("INVALID_INPUT", message);
  }
}

export interface McpErrorPayload {
  error: ErrorCode;
  message: string;
}

/**
 * Maps any thrown value to a safe, client-friendly error payload.
 * Playwright stack traces and other internals are intentionally hidden.
 */
export function toMcpError(err: unknown): McpErrorPayload {
  if (err instanceof AppError) {
    return { error: err.code, message: err.message || SAFE_MESSAGES[err.code] };
  }
  return { error: "INTERNAL_ERROR", message: SAFE_MESSAGES.INTERNAL_ERROR };
}
