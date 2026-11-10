import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

/**
 * This build has no Convex deployment, so there is nothing to sign in to —
 * see docs/operations/environments.md for switching it on.
 */
export function AdminUnavailable() {
  return (
    <Alert className="rounded-xl border-border bg-card p-5">
      <AlertTitle>The admin console isn&apos;t switched on here</AlertTitle>
      <AlertDescription>
        This deployment isn&apos;t connected to Convex yet. The steps are in
        docs/operations/environments.md.
      </AlertDescription>
    </Alert>
  );
}
