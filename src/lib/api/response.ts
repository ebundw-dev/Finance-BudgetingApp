import {
  AccountingError,
  InsufficientCategoryBalanceError,
  InsufficientUnallocatedCashError,
  NotFoundError,
  ValidationError,
} from "@/lib/accounting/errors";

// Every API route responds with this same { data, error } shape (data null
// on failure, error null on success) so a mobile client can handle any
// endpoint's response uniformly.
export function apiSuccess<T>(data: T, status = 200): Response {
  return Response.json({ data, error: null }, { status });
}

export function apiError(message: string, status: number): Response {
  return Response.json({ data: null, error: message }, { status });
}

// Maps an error thrown by the accounting engine to the same kind of 4xx
// JSON response a Server Action would turn into a redirect-with-error --
// same validation, same failure modes, just a status code instead of a
// query string. Anything that isn't an AccountingError is unexpected and
// is rethrown so Next.js's own 500 handling takes over, rather than
// masking a real bug as a generic client error.
export function apiErrorFromUnknown(error: unknown): Response {
  if (error instanceof NotFoundError) return apiError(error.message, 404);
  if (error instanceof InsufficientCategoryBalanceError || error instanceof InsufficientUnallocatedCashError) {
    return apiError(error.message, 422);
  }
  if (error instanceof ValidationError) return apiError(error.message, 400);
  if (error instanceof AccountingError) return apiError(error.message, 400);
  throw error;
}
