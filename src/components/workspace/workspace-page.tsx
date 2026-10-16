"use client";

import { useAction, useMutation, useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { ConvexError } from "convex/values";
import { ArrowRightIcon, CheckIcon } from "lucide-react";
import { useFormatter, useLocale, useTranslations } from "next-intl";
import { useState } from "react";
import { toast } from "sonner";

import {
  AppPageHeader,
  ListSkeleton,
  SettingsSection,
} from "@/components/app/page-parts";
import { useSignedInQuery } from "@/components/providers/use-signed-in-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { isLocale, localeDirection } from "@/i18n/locales";
import { Link } from "@/i18n/navigation";

import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import {
  canManageWorkspaceRole,
  type WorkspaceRole,
} from "../../../convex/lib/workspaceRoles";

type Team = FunctionReturnType<typeof api.workspace.team>;
const roles = ["owner", "admin", "member", "viewer"] as const;

function RoleSelect({
  value,
  onChange,
  allowed,
  label,
  id,
}: {
  value: WorkspaceRole;
  onChange: (role: WorkspaceRole) => void;
  allowed: readonly WorkspaceRole[];
  label?: string;
  id?: string;
}) {
  const t = useTranslations("workspace");
  const locale = useLocale();
  return (
    <Select
      value={value}
      onValueChange={(value) => {
        if (roles.includes(value as WorkspaceRole))
          onChange(value as WorkspaceRole);
      }}
      dir={isLocale(locale) ? localeDirection(locale) : "ltr"}
    >
      <SelectTrigger
        id={id}
        aria-label={label ?? t("role")}
        className="min-h-11 w-full"
      >
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {allowed.map((role) => (
          <SelectItem key={role} value={role}>
            {t(role)}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function useWorkspaceError() {
  const t = useTranslations("workspace");
  return (error: unknown) => {
    if (error instanceof ConvexError) {
      if (error.data === "LAST_OWNER_REQUIRED") {
        toast.error(t("lastOwner"));
        return;
      }
      if (error.data === "INVITATION_RATE_LIMITED") {
        toast.error(t("invitationLimit"));
        return;
      }
    }
    toast.error(t("error"));
  };
}

export function WorkspacePage() {
  const t = useTranslations("workspace");
  const workspaces = useSignedInQuery(api.workspace.list);
  const select = useMutation(api.workspace.select);
  const showError = useWorkspaceError();
  const [busy, setBusy] = useState(false);
  const selected = workspaces?.find((workspace) => workspace.selected);
  async function choose(orgId: Id<"orgs">) {
    setBusy(true);
    try {
      await select({ orgId });
    } catch (error) {
      showError(error);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="flex min-w-0 flex-col gap-6">
      <AppPageHeader title={t("title")} />
      {workspaces == null ? <ListSkeleton /> : null}
      {workspaces?.length === 0 ? <p>{t("empty")}</p> : null}
      {workspaces && workspaces.length > 0 ? (
        <>
          <SettingsSection id="choose-workspace" title={t("choose")}>
            <ul className="divide-y border-b">
              {workspaces.map(({ org, role, selected }) => (
                <li
                  key={org.id}
                  className="flex flex-wrap items-center justify-between gap-3 py-4"
                >
                  <div className="min-w-0">
                    <p className="font-semibold break-words">{org.name}</p>
                    <p className="text-sm text-muted-foreground">{t(role)}</p>
                  </div>
                  <Button
                    variant={selected ? "secondary" : "outline"}
                    aria-pressed={selected}
                    disabled={busy || selected}
                    onClick={() => void choose(org.id)}
                  >
                    {selected ? <CheckIcon aria-hidden /> : null}
                    {t("choose")}
                  </Button>
                </li>
              ))}
            </ul>
          </SettingsSection>
          {selected ? (
            <TeamSection
              key={`${selected.org.id}-${selected.role}`}
              orgId={selected.org.id}
            />
          ) : null}
          {selected ? (
            <Button asChild variant="outline" className="self-start">
              <Link href="/app">
                {selected.org.name}
                <ArrowRightIcon aria-hidden className="rtl:rotate-180" />
              </Link>
            </Button>
          ) : null}
        </>
      ) : null}
    </div>
  );
}

function TeamSection({ orgId }: { orgId: Id<"orgs"> }) {
  const t = useTranslations("workspace");
  const team = useQuery(api.workspace.team, { orgId });
  if (!team) return <ListSkeleton />;
  const canManage = team.role === "owner" || team.role === "admin";
  return (
    <>
      <SettingsSection id="workspace-team" title={t("team")}>
        {team.role === "viewer" ? (
          <p className="mb-3 text-muted-foreground">{t("readOnly")}</p>
        ) : null}
        <ul className="divide-y border-b">
          {team.members.map((member) => (
            <MemberRow
              key={`${member.id}-${member.role}`}
              member={member}
              orgId={orgId}
              actorRole={team.role}
            />
          ))}
        </ul>
      </SettingsSection>
      {canManage ? (
        <>
          <InviteForm orgId={orgId} actorRole={team.role} />
          <Invitations orgId={orgId} invitations={team.invitations} />
        </>
      ) : null}
    </>
  );
}

function MemberRow({
  member,
  orgId,
  actorRole,
}: {
  member: Team["members"][number];
  orgId: Id<"orgs">;
  actorRole: WorkspaceRole;
}) {
  const t = useTranslations("workspace");
  const common = useTranslations("common");
  const changeRole = useMutation(api.workspace.changeRole);
  const remove = useMutation(api.workspace.removeMember);
  const showError = useWorkspaceError();
  const [role, setRole] = useState(member.role);
  const [busy, setBusy] = useState(false);
  const [confirming, setConfirming] = useState(false);
  async function change(isRemoving: boolean) {
    setBusy(true);
    try {
      if (isRemoving) await remove({ orgId, membershipId: member.id });
      else await changeRole({ orgId, membershipId: member.id, role });
      setConfirming(false);
    } catch (error) {
      showError(error);
    } finally {
      setBusy(false);
    }
  }
  const allowed = roles.filter((target) =>
    canManageWorkspaceRole(actorRole, target),
  );
  return (
    <li className="grid min-w-0 gap-3 py-4 md:grid-cols-[minmax(0,1fr)_auto] md:items-center">
      <div className="min-w-0">
        <p className="font-semibold break-words">
          {member.name || t("member")}
        </p>
        <p className="text-sm text-muted-foreground">{t(member.role)}</p>
      </div>
      {member.canManage ? (
        <>
          <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-center">
            <div className="min-w-0 sm:min-w-40 sm:flex-1">
              <RoleSelect
                value={role}
                onChange={setRole}
                allowed={allowed}
                label={`${t("role")}: ${member.name}`}
              />
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button
                variant="outline"
                disabled={busy || role === member.role}
                onClick={() => void change(false)}
              >
                {common("save")}
              </Button>
              <Button
                variant="outline"
                disabled={busy}
                onClick={() => {
                  setConfirming(true);
                }}
              >
                {t("remove")}
              </Button>
            </div>
          </div>
          {confirming ? (
            <div className="flex flex-col gap-3 border-s-2 border-destructive ps-4 md:col-span-2">
              <p>{t("confirmRemove")}</p>
              <div className="flex flex-wrap gap-2">
                <Button
                  variant="destructive"
                  disabled={busy}
                  onClick={() => void change(true)}
                >
                  {t("remove")}
                </Button>
                <Button
                  variant="outline"
                  disabled={busy}
                  onClick={() => {
                    setConfirming(false);
                  }}
                >
                  {common("cancel")}
                </Button>
              </div>
            </div>
          ) : null}
        </>
      ) : null}
    </li>
  );
}

function InviteForm({
  orgId,
  actorRole,
}: {
  orgId: Id<"orgs">;
  actorRole: WorkspaceRole;
}) {
  const t = useTranslations("workspace");
  const locale = useLocale();
  const invite = useAction(api.workspace.invite);
  const showError = useWorkspaceError();
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<WorkspaceRole>("member");
  const [busy, setBusy] = useState(false);
  async function submit() {
    if (role === "owner") return;
    setBusy(true);
    try {
      await invite({ orgId, email, role, locale });
      setEmail("");
    } catch (error) {
      showError(error);
    } finally {
      setBusy(false);
    }
  }
  return (
    <SettingsSection id="workspace-invite" title={t("invite")}>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          void submit();
        }}
        className="grid min-w-0 gap-4 md:grid-cols-[minmax(0,1fr)_minmax(9rem,0.5fr)_auto] md:items-end"
      >
        <div className="flex min-w-0 flex-col gap-2">
          <Label htmlFor="invite-email">{t("email")}</Label>
          <Input
            id="invite-email"
            type="email"
            dir="ltr"
            required
            maxLength={254}
            value={email}
            onChange={(event) => {
              setEmail(event.target.value);
            }}
            autoComplete="email"
          />
        </div>
        <div className="flex min-w-0 flex-col gap-2">
          <Label htmlFor="invite-role">{t("role")}</Label>
          <RoleSelect
            id="invite-role"
            value={role}
            onChange={setRole}
            allowed={roles.filter(
              (target) =>
                target !== "owner" && canManageWorkspaceRole(actorRole, target),
            )}
          />
        </div>
        <Button
          type="submit"
          disabled={busy}
          className="justify-self-start md:self-end"
        >
          {t("invite")}
        </Button>
      </form>
    </SettingsSection>
  );
}

function Invitations({
  invitations,
  orgId,
}: {
  invitations: Team["invitations"];
  orgId: Id<"orgs">;
}) {
  const t = useTranslations("workspace");
  const format = useFormatter();
  const revoke = useMutation(api.workspace.revokeInvitation);
  const showError = useWorkspaceError();
  const [busy, setBusy] = useState(false);
  async function cancel(invitationId: Id<"workspaceInvitations">) {
    setBusy(true);
    try {
      await revoke({ orgId, invitationId });
    } catch (error) {
      showError(error);
    } finally {
      setBusy(false);
    }
  }
  const deliveryKeys = {
    pending: "deliveryPending",
    accepted: "deliveryAccepted",
    failed: "deliveryFailed",
  } as const;
  return (
    <SettingsSection id="pending-invites" title={t("pending")}>
      <ul className="divide-y border-b">
        {invitations.map((invitation) => (
          <li
            key={invitation.id}
            className="flex flex-wrap items-center justify-between gap-3 py-4"
          >
            <div className="min-w-0">
              <p className="break-all" dir="ltr">
                {invitation.email}
              </p>
              <p className="text-sm text-muted-foreground">
                {t(invitation.role)}
              </p>
              <p className="text-sm">{t(deliveryKeys[invitation.delivery])}</p>
              <p className="text-sm text-muted-foreground">
                {t("expires", {
                  date: format.dateTime(invitation.expiresAt, {
                    dateStyle: "medium",
                  }),
                })}
              </p>
            </div>
            {invitation.canManage ? (
              <Button
                variant="outline"
                disabled={busy}
                onClick={() => void cancel(invitation.id)}
              >
                {t("revoke")}
              </Button>
            ) : null}
          </li>
        ))}
      </ul>
    </SettingsSection>
  );
}
