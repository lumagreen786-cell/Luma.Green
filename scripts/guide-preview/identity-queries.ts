import { ConvexError } from "convex/values";

function saveFixture() {
  return Promise.resolve(null);
}
function checkFixture() {
  return new URLSearchParams(window.location.search).get("scenario") === "limit"
    ? Promise.reject(new ConvexError({ code: "CHECK_LIMIT" }))
    : Promise.resolve(null);
}
/** Loopback fixture adapter only. Never contacts Convex or Surepass. */
export function useMutation() {
  return saveFixture;
}
export function useAction() {
  return checkFixture;
}
