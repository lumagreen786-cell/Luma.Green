"use client";

import { useQuery } from "convex/react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { carbonBatchDraft } from "@/lib/carbon-batch-draft";

import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { LotQueryBoundary } from "./lot-boundary";

export function CarbonBatchExport(props: {
  orgId: Id<"orgs">;
  transformationId: Id<"lotTransformations">;
}) {
  const t = useTranslations("lots");
  const [isOpen, setIsOpen] = useState(false);
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button
        type="button"
        variant="outline"
        aria-expanded={isOpen}
        onClick={() => {
          setIsOpen(!isOpen);
        }}
      >
        {t("carbonEvidenceDraft")}
      </Button>
      {isOpen ? (
        <LotQueryBoundary>
          <DownloadDraft {...props} />
        </LotQueryBoundary>
      ) : null}
    </div>
  );
}

function DownloadDraft({
  orgId,
  transformationId,
}: {
  orgId: Id<"orgs">;
  transformationId: Id<"lotTransformations">;
}) {
  const common = useTranslations("common");
  const t = useTranslations("evidence.export");
  const record = useQuery(api.traceability.carbonBatchPreparation, {
    expectedOrgId: orgId,
    transformationId,
  });
  if (!record) return <p role="status">{common("loading")}</p>;
  return (
    <Button
      type="button"
      variant="outline"
      onClick={() => {
        let url: string | undefined;
        try {
          const draft = carbonBatchDraft(record, orgId);
          url = URL.createObjectURL(
            new Blob([JSON.stringify(draft, null, 2)], {
              type: "application/json",
            }),
          );
          const anchor = document.createElement("a");
          anchor.href = url;
          anchor.download = "luma-internal-carbon-draft.json";
          anchor.click();
        } catch {
          toast.error(common("error"));
        } finally {
          if (url) URL.revokeObjectURL(url);
        }
      }}
    >
      {t("json")}
    </Button>
  );
}
