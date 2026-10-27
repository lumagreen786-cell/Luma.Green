"use client";

import { useEffect, useRef, useState } from "react";

import {
  type BusinessKind,
  businessSchema,
} from "../../../convex/lib/onboarding";
import { BusinessForm } from "./business-form";
import { DocumentsForm } from "./documents-form";
import type { Application } from "./use-mine";

/** One route, with mounted forms so Back retains entered values and file state. */
export function BusinessJourney({
  kind,
  application,
  loginPhone,
}: {
  kind: BusinessKind;
  application: Application;
  loginPhone: string | undefined;
}) {
  const [stage, setStage] = useState(() =>
    businessSchema.safeParse({
      phones: [],
      weeklyOff: [],
      locationTags: [],
      ...application.business,
    }).success
      ? "documents"
      : "business",
  );
  const businessRegion = useRef<HTMLDivElement>(null);
  const documentsRegion = useRef<HTMLDivElement>(null);
  useEffect(() => {
    (stage === "business" ? businessRegion : documentsRegion).current?.focus();
  }, [stage]);
  const [savedBusiness, setSavedBusiness] = useState(application.business);
  const [visitedDocuments, setVisitedDocuments] = useState(
    stage === "documents",
  );
  return (
    <>
      <div
        ref={businessRegion}
        tabIndex={-1}
        hidden={stage !== "business"}
        className="outline-none"
      >
        <BusinessForm
          kind={kind}
          application={application}
          loginPhone={loginPhone}
          onContinue={(business) => {
            setSavedBusiness(business);
            setVisitedDocuments(true);
            setStage("documents");
          }}
        />
      </div>
      {visitedDocuments ? (
        <div
          ref={documentsRegion}
          tabIndex={-1}
          hidden={stage !== "documents"}
          className="outline-none"
        >
          <DocumentsForm
            kind={kind}
            application={{ ...application, business: savedBusiness }}
            onBack={() => {
              setStage("business");
            }}
          />
        </div>
      ) : null}
    </>
  );
}
