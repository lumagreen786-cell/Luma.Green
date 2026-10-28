"use client";

import Image from "next/image";
import QRCode from "qrcode";
import { useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { authClient } from "@/lib/auth-client";
import { useMounted } from "@/lib/use-mounted";

import { CODE_LENGTH, CodeInput } from "./code-input";
import { codeErrorMessage } from "./errors";
import { groupSecret, secretFromTotpUri } from "./totp";

const QR_SIZE = 208;

/** Scan the QR code, then prove it worked with the first 6-digit code. */
export function AuthenticatorStep({
  totpURI,
  onVerified,
}: {
  totpURI: string;
  onVerified: () => void;
}) {
  const [qr, setQr] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const secret = secretFromTotpUri(totpURI);

  useEffect(() => {
    const drawing = new AbortController();
    void (async () => {
      try {
        const url = await QRCode.toDataURL(totpURI, {
          margin: 1,
          width: QR_SIZE,
        });
        if (!drawing.signal.aborted) setQr(url);
      } catch {
        // The typed key below still works.
      }
    })();
    return () => {
      drawing.abort();
    };
  }, [totpURI]);

  const isMounted = useMounted();
  const checking = useRef(false);

  async function verify(value: string) {
    if (checking.current) return;
    checking.current = true;
    setBusy(true);
    setError(null);
    try {
      const { error: authError } = await authClient.twoFactor.verifyTotp({
        code: value,
      });
      if (!isMounted()) return;
      if (!authError) {
        onVerified();
        return;
      }
      setCode("");
      setError(codeErrorMessage(authError).message);
    } catch {
      if (!isMounted()) return;
      setCode("");
      setError(codeErrorMessage({}).message);
    } finally {
      checking.current = false;
      if (isMounted()) setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <ol className="list-decimal space-y-3 ps-5 text-sm leading-relaxed text-muted-foreground">
        <li>
          Open an authenticator app — Google Authenticator, Microsoft
          Authenticator or 1Password.
        </li>
        <li>Scan this QR code, or type the key under it.</li>
        <li>Enter the 6-digit code the app shows.</li>
      </ol>
      <div className="flex flex-col items-center gap-4 border-y py-5">
        {qr ? (
          <Image
            src={qr}
            alt="QR code to add Luma.Green to your authenticator app"
            width={QR_SIZE}
            height={QR_SIZE}
            unoptimized
            className="rounded-md border"
          />
        ) : (
          <Skeleton
            className="rounded-md"
            style={{ width: QR_SIZE, height: QR_SIZE }}
          />
        )}
        {secret ? (
          <p className="text-center text-xs text-muted-foreground">
            Key:{" "}
            <code className="font-mono text-sm break-all text-foreground select-all">
              {groupSecret(secret)}
            </code>
          </p>
        ) : null}
      </div>
      <form
        className="flex flex-col gap-3"
        onSubmit={(event) => {
          event.preventDefault();
          void verify(code);
        }}
      >
        <Label htmlFor="first-code">Code from the app</Label>
        <CodeInput
          id="first-code"
          value={code}
          onChange={setCode}
          onComplete={(value) => {
            void verify(value);
          }}
          disabled={busy}
          invalid={Boolean(error)}
          describedBy={error ? "first-code-error" : undefined}
        />
        {error ? (
          <p
            id="first-code-error"
            role="alert"
            className="text-sm text-destructive"
          >
            {error}
          </p>
        ) : null}
        <Button
          type="submit"
          size="lg"
          disabled={busy || code.length !== CODE_LENGTH}
        >
          {busy ? "Checking…" : "Turn on the authenticator"}
        </Button>
      </form>
    </div>
  );
}
