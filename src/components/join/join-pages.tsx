"use client";

import type { BusinessKind } from "../../../convex/lib/onboarding";
import { BusinessJourney } from "./business-journey";
import { JoinGate } from "./join-gate";
import { KabadiwalaForm } from "./kabadiwala-form";
import { SaathiForm } from "./saathi-form";

// Client entry points for the (join) pages: the gate hands the form its
// application, which a server page can't pass as a function.

export function KabadiwalaJoin() {
  return (
    <JoinGate kind="kabadiwala">
      {({ application, loginPhone }) => (
        <KabadiwalaForm application={application} loginPhone={loginPhone} />
      )}
    </JoinGate>
  );
}

export function BusinessJoin({ kind }: { kind: BusinessKind }) {
  return (
    <JoinGate kind={kind}>
      {({ application, loginPhone }) => (
        <BusinessJourney
          kind={kind}
          application={application}
          loginPhone={loginPhone}
        />
      )}
    </JoinGate>
  );
}

/** Keep old document links working inside the combined registration journey. */
export function DocumentsJoin({ kind }: { kind: BusinessKind }) {
  return <BusinessJoin kind={kind} />;
}

export function SaathiJoin() {
  return (
    <JoinGate kind="saathi">
      {({ application }) => <SaathiForm application={application} />}
    </JoinGate>
  );
}
