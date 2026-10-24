import { type FunctionReference, getFunctionName } from "convex/server";
import { ConvexError } from "convex/values";

const fixture = {
  gstin: "29ABCDE1234F1Z5",
  businessName: "Synthetic Recycling Works",
  legalName: "Synthetic Recycling Works Limited",
  address: "Sample registered address, Bengaluru",
};
function saveFixture() {
  return Promise.resolve(null);
}
function rejectWrite() {
  return Promise.reject(
    new Error("Isolated fixture: uploads and other writes are disabled"),
  );
}
function checkFixture() {
  return new URLSearchParams(window.location.search).get("scenario") === "limit"
    ? Promise.reject(new ConvexError({ code: "CHECK_LIMIT" }))
    : Promise.resolve(fixture);
}
/** Loopback adapters only: no account, provider request or saved proof. */
export function useMutation(mutation: FunctionReference<"mutation">) {
  return ["applications:saveDraft", "identityChecks:confirmGst"].includes(
    getFunctionName(mutation),
  )
    ? saveFixture
    : rejectWrite;
}
export function useAction(action: FunctionReference<"action">) {
  return getFunctionName(action) === "identityChecks:lookupGst"
    ? checkFixture
    : rejectWrite;
}
export function useQuery() {
  return null;
}
export function useConvexAuth() {
  return { isLoading: false, isAuthenticated: true };
}
export { usePaginatedQuery } from "./queries";
