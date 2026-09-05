/**
 * The message to show a user for something thrown.
 *
 * `catch` binds `unknown`, because a throw can carry anything — an Error, a
 * string, a rejected value from a library. Reading `.message` off it directly
 * requires calling it `any`, which buys the shorter line by turning off type
 * checking for everything downstream of it.
 *
 * `fallback` is what the user sees when the throw carries nothing readable, so
 * it should name the action that failed rather than say "something went wrong".
 */
export function errorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message) return error.message
  if (typeof error === "string" && error) return error
  return fallback
}
