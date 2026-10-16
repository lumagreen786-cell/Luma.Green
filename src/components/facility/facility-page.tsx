"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { FactoryIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { useId, useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

import { AppPageHeader, ListSkeleton } from "@/components/app/page-parts";
import { useWorkspace } from "@/components/app/use-workspace";
import { WorkflowTabs } from "@/components/app/workflow-tabs";
import { EvidenceDialog, LotField } from "@/components/lots/form-parts";
import { NotForYou } from "@/components/shop/guards";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";

import { api } from "../../../convex/_generated/api";
import { PROCESS_KINDS } from "../../../convex/lib/industrialClassification";
import { FacilityRegistrations } from "./facility-registrations";
import { IndustryExplorer } from "./industry-explorer";

type Facility = FunctionReturnType<typeof api.industrialProfiles.mine>[number];
const formSchema = z.object({
  name: z.string().trim().min(1).max(120),
  siteReference: z.string().trim().min(1).max(500),
});

export function FacilityPage() {
  const workspace = useWorkspace();
  const t = useTranslations("facility");
  const team = useTranslations("workspace");
  if (workspace === undefined) return <ListSkeleton />;
  if (workspace?.kind !== "org")
    return (
      <NotForYou
        title={t("title")}
        heading={t("title")}
        body={team("empty")}
        icon={FactoryIcon}
      />
    );
  return (
    <FacilityWorkspace
      key={`${workspace.org.id}:${workspace.role}`}
      canManage={workspace.role === "owner" || workspace.role === "admin"}
    />
  );
}

function FacilityWorkspace({ canManage }: { canManage: boolean }) {
  const t = useTranslations("facility");
  const industry = useTranslations("industry");
  const rows = useQuery(api.industrialProfiles.mine, {});
  return (
    <div className="flex min-w-0 flex-col gap-6">
      <AppPageHeader
        title={t("title")}
        lead={t("lead")}
        actions={canManage ? <FacilityForm /> : undefined}
      />
      {canManage ? null : (
        <p className="text-sm text-muted-foreground">{t("readOnly")}</p>
      )}
      <WorkflowTabs
        items={[
          {
            value: "facilities",
            label: t("title"),
            content: (
              <div className="space-y-5">
                {" "}
                {rows === undefined ? (
                  <ListSkeleton />
                ) : (
                  <ul className="divide-y border-y">
                    {rows.map((facility) => (
                      <li
                        key={facility._id}
                        className="flex min-w-0 flex-col gap-3 py-5"
                      >
                        <div className="min-w-0 space-y-2">
                          <h2 className="font-medium break-words">
                            {facility.name}
                          </h2>
                          <p className="text-sm break-words">
                            {facility.siteReference}
                          </p>
                          {facility.sector ? (
                            <p
                              lang="en"
                              dir="ltr"
                              className="text-sm break-words"
                            >
                              {facility.sector.name}
                            </p>
                          ) : null}
                          <ul className="flex flex-wrap gap-x-4 gap-y-2 text-sm text-muted-foreground">
                            {facility.capabilities.map((kind) => (
                              <li key={kind}>{t(`processKinds.${kind}`)}</li>
                            ))}
                          </ul>
                        </div>
                        {canManage ? (
                          <div className="shrink-0">
                            <FacilityForm facility={facility} />
                          </div>
                        ) : null}
                        <FacilityRegistrations facilityId={facility._id} />
                      </li>
                    ))}
                  </ul>
                )}
                {rows?.length === 0 ? (
                  <p className="text-muted-foreground">{t("empty")}</p>
                ) : null}
              </div>
            ),
          },
          {
            value: "industry",
            label: industry("title"),
            content: <IndustryExplorer />,
          },
        ]}
      />
    </div>
  );
}

function FacilityForm({ facility }: { facility?: Facility }) {
  const t = useTranslations("facility");
  const industry = useTranslations("industry");
  const common = useTranslations("common");
  const lots = useTranslations("lots");
  const id = useId();
  const [open, setOpen] = useState(false);
  const [choosing, setChoosing] = useState(false);
  const [sectorId, setSectorId] = useState(facility?.sectorId);
  const [sectorTitle, setSectorTitle] = useState(facility?.sector?.name ?? "");
  const [capabilities, setCapabilities] = useState<Facility["capabilities"]>(
    facility?.capabilities ?? [],
  );
  const [failed, setFailed] = useState(false);
  const save = useMutation(api.industrialProfiles.save);
  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: facility?.name ?? "",
      siteReference: facility?.siteReference ?? "",
    },
  });
  return (
    <EvidenceDialog
      title={t(facility ? "edit" : "add")}
      hint={t("processNote")}
      open={open}
      onOpen={() => {
        setOpen(true);
      }}
      onClose={() => {
        if (!form.formState.isSubmitting) setOpen(false);
      }}
    >
      <form
        onSubmit={(event) => {
          void form.handleSubmit(async (values) => {
            setFailed(false);
            if (capabilities.length === 0) {
              setFailed(true);
              return;
            }
            try {
              await save({
                ...values,
                facilityId: facility?._id,
                sectorId,
                capabilities,
              });
              setOpen(false);
              toast.success(lots("saved"));
            } catch {
              setFailed(true);
              toast.error(common("error"));
            }
          })(event);
        }}
      >
        <fieldset
          disabled={form.formState.isSubmitting}
          className="flex min-w-0 flex-col gap-4"
        >
          <LotField
            label={t("name")}
            registration={form.register("name")}
            invalid={Boolean(form.formState.errors.name)}
            required
            maxLength={120}
          />
          <LotField
            label={t("siteReference")}
            registration={form.register("siteReference")}
            invalid={Boolean(form.formState.errors.siteReference)}
            required
            maxLength={500}
          />
          <div className="flex flex-col gap-2">
            <p className="text-sm font-medium">{t("sector")}</p>
            {sectorTitle ? (
              <p lang="en" dir="ltr" className="break-words">
                {sectorTitle}
              </p>
            ) : null}
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setChoosing(!choosing);
                }}
              >
                {industry("select")}
              </Button>
              {sectorId ? (
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => {
                    setSectorId(undefined);
                    setSectorTitle("");
                  }}
                >
                  {industry("clear")}
                </Button>
              ) : null}
            </div>
          </div>
          {choosing ? (
            <IndustryExplorer
              onSelect={(item) => {
                setSectorId(item.id);
                setSectorTitle(item.title);
                setChoosing(false);
              }}
            />
          ) : null}
          <fieldset className="flex flex-col gap-1 border-y py-3">
            <legend className="text-sm font-medium">{t("capabilities")}</legend>
            {PROCESS_KINDS.map((kind) => (
              <label
                htmlFor={`${id}-${kind}`}
                key={kind}
                className="flex min-h-11 items-center gap-3"
              >
                <Checkbox
                  id={`${id}-${kind}`}
                  checked={capabilities.includes(kind)}
                  onCheckedChange={(checked) => {
                    setCapabilities((current) =>
                      checked === true
                        ? [...current.filter((item) => item !== kind), kind]
                        : current.filter((item) => item !== kind),
                    );
                  }}
                />
                <span>{t(`processKinds.${kind}`)}</span>
              </label>
            ))}
          </fieldset>
          {failed || Object.keys(form.formState.errors).length > 0 ? (
            <p role="alert" className="text-sm text-destructive">
              {capabilities.length === 0 ? lots("required") : common("error")}
            </p>
          ) : null}
          <Button
            type="submit"
            className="self-start"
            disabled={form.formState.isSubmitting}
          >
            {lots(form.formState.isSubmitting ? "saving" : "save")}
          </Button>
        </fieldset>
      </form>
    </EvidenceDialog>
  );
}
