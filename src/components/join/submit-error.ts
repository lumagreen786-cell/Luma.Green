import { ConvexError } from "convex/values";

/**
 * What to tell someone whose "Send" didn't go through: a `join.errors` key,
 * or `fixErrors` (under `join.form`) when the server found gaps the form
 * missed.
 */
export type SubmitFailure = "fixErrors" | "generic" | "identity";

export function submitErrorKey(error: unknown): SubmitFailure {
  if (!(error instanceof ConvexError)) return "generic";
  const data: unknown = error.data;
  const code =
    typeof data === "object" && data !== null && "code" in data
      ? data.code
      : data;
  if (code === "VALIDATION_REQUIRED") return "identity";
  return code === "INCOMPLETE" ? "fixErrors" : "generic";
}
