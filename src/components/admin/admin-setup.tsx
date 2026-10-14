"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery } from "convex/react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { type ComponentProps, useEffect, useRef, useState } from "react";
import {
  type FieldError,
  useForm,
  type UseFormRegisterReturn,
} from "react-hook-form";

import { isConvexConfigured } from "@/components/providers/convex-provider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { authClient } from "@/lib/auth-client";

import { api } from "../../../convex/_generated/api";
import { AdminUnavailable } from "./admin-unavailable";
import { AuthenticatorStep } from "./authenticator-step";
import { BackupCodes } from "./backup-codes";
import { adminProfileSchema, type AdminProfileValues } from "./schemas";

interface Enrolment {
  totpURI: string;
  backupCodes: string[];
}
export function AdminSetup() {
  return isConvexConfigured ? <SetupIdentity /> : <AdminUnavailable />;
}
function SetupIdentity() {
  const session = authClient.useSession();
  return <SetupSteps key={session.data?.user.id ?? "signed-out"} />;
}
function SetupSteps() {
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  const router = useRouter();
  const me = useQuery(api.identity.me);
  const saveProfile = useMutation(api.identity.saveAdminProfile);
  const [enrolment, setEnrolment] = useState<Enrolment | null>(null);
  const [showCodes, setShowCodes] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isFinished = me?.kind === "admin" && me.twoFactorEnabled && !enrolment;
  useEffect(() => {
    if (isFinished) router.replace("/admin");
  }, [isFinished, router]);
  async function enrol() {
    setBusy(true);
    setError(null);
    try {
      const result = await authClient.twoFactor.enable({});
      if (!mounted.current) return;
      if (result.error)
        setError(
          "Sign in with a new phone code, then try setup again within five minutes.",
        );
      else setEnrolment(result.data);
    } catch {
      if (mounted.current)
        setError("Could not start authenticator setup. Try again.");
    } finally {
      if (mounted.current) setBusy(false);
    }
  }
  if (me === undefined || isFinished) return <p role="status">Loading…</p>;
  if (me?.kind !== "admin")
    return (
      <div className="flex flex-col gap-5">
        <p>Sign in with the configured admin phone number to continue.</p>
        <Button asChild>
          <Link href="/admin/login">Go to phone sign-in</Link>
        </Button>
      </div>
    );
  if (enrolment && showCodes)
    return (
      <BackupCodes
        codes={enrolment.backupCodes}
        onDone={() => {
          router.replace("/admin");
        }}
      />
    );
  if (enrolment)
    return (
      <AuthenticatorStep
        totpURI={enrolment.totpURI}
        onVerified={() => {
          setShowCodes(true);
        }}
      />
    );
  if (!me.adminName)
    return (
      <ProfileForm
        onSave={async (profile) => {
          await saveProfile(profile);
        }}
      />
    );
  return (
    <div className="flex flex-col gap-5">
      <p>Connect an authenticator app to finish admin setup.</p>
      {error ? (
        <p role="alert" className="text-destructive">
          {error}
        </p>
      ) : null}
      <Button
        disabled={busy}
        onClick={() => {
          void enrol();
        }}
      >
        {busy ? "Preparing…" : "Connect authenticator"}
      </Button>
      <Link href="/admin/login">Verify phone again</Link>
    </div>
  );
}

function ProfileForm({
  onSave,
}: {
  onSave: (profile: AdminProfileValues) => Promise<void>;
}) {
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<AdminProfileValues>({
    resolver: zodResolver(adminProfileSchema),
    defaultValues: { name: "", phone: "", dateOfBirth: "", aadhaarLast4: "" },
  });

  async function onSubmit(values: AdminProfileValues) {
    try {
      await onSave(values);
    } catch {
      setError("root", { message: "Couldn't save. Check the details." });
    }
  }

  return (
    <form
      noValidate
      className="flex flex-col gap-5"
      onSubmit={(event) => {
        void handleSubmit(onSubmit)(event);
      }}
    >
      <p className="text-sm text-muted-foreground">
        Your account exists. Add your details to carry on.
      </p>
      <ProfileFields
        fields={{
          name: register("name"),
          phone: register("phone"),
          dateOfBirth: register("dateOfBirth"),
          aadhaarLast4: register("aadhaarLast4"),
        }}
        errors={errors}
      />
      {errors.root ? (
        <p role="alert" className="text-sm text-destructive">
          {errors.root.message}
        </p>
      ) : null}
      <Button type="submit" size="lg" disabled={isSubmitting}>
        {isSubmitting ? "Saving…" : "Save and continue"}
      </Button>
    </form>
  );
}

type ProfileKey = keyof AdminProfileValues;

function ProfileFields({
  fields,
  errors,
}: {
  fields: Record<ProfileKey, UseFormRegisterReturn>;
  errors: Partial<Record<ProfileKey, FieldError>>;
}) {
  return (
    <>
      <Field
        id="name"
        label="Full name"
        error={errors.name}
        autoComplete="name"
        {...fields.name}
      />
      <Field
        id="phone"
        label="Mobile number"
        error={errors.phone}
        type="tel"
        inputMode="numeric"
        autoComplete="tel-national"
        placeholder="98765 43210"
        {...fields.phone}
      />
      <Field
        id="dateOfBirth"
        label="Date of birth"
        error={errors.dateOfBirth}
        type="date"
        autoComplete="bday"
        {...fields.dateOfBirth}
      />
      <Field
        id="aadhaarLast4"
        label="Last four digits of your Aadhaar"
        hint="Only these four. Luma.Green never stores a full Aadhaar number."
        error={errors.aadhaarLast4}
        inputMode="numeric"
        maxLength={4}
        autoComplete="off"
        className="w-24 font-mono tracking-widest"
        {...fields.aadhaarLast4}
      />
    </>
  );
}

function Field({
  id,
  label,
  hint,
  error,
  className,
  ...input
}: ComponentProps<typeof Input> & {
  id: string;
  label: string;
  hint?: string;
  error?: FieldError;
}) {
  let describedBy: string | undefined;
  if (error) describedBy = `${id}-error`;
  else if (hint) describedBy = `${id}-hint`;
  const Control = Input;
  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor={id}>{label}</Label>
      <Control
        id={id}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy}
        className={className}
        {...input}
      />
      {error ? (
        <p id={`${id}-error`} role="alert" className="text-sm text-destructive">
          {error.message}
        </p>
      ) : null}
      {!error && hint ? (
        <p id={`${id}-hint`} className="text-sm text-muted-foreground">
          {hint}
        </p>
      ) : null}
    </div>
  );
}
