/**
 * Application-level error with a discriminant code for error handling.
 * Services throw AppError instances; transport layers map codes to HTTP status.
 */
export class AppError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly cause?: unknown
  ) {
    super(message);
    this.name = "AppError";
  }

  /**
   * Type guard to check if an error is an AppError, optionally with a specific code.
   */
  static is(err: unknown, code?: string): err is AppError {
    return err instanceof AppError && (code === undefined || err.code === code);
  }
}
