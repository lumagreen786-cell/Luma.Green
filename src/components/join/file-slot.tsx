"use client";

import { useMutation } from "convex/react";
import {
  CameraIcon,
  FileIcon,
  LoaderIcon,
  UploadIcon,
  XIcon,
} from "lucide-react";
import { useFormatter, useTranslations } from "next-intl";
import { useRef, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { authClient } from "@/lib/auth-client";
import { convexSiteUrlFrom } from "@/lib/convex-urls";
import { clientEnv } from "@/lib/env";
import { prepareUpload } from "@/lib/upload-image";

import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import {
  acceptFor,
  FILE_RULES,
  fileProblem,
  type FileType,
} from "../../../convex/lib/onboarding";
import { describedBy, FieldSet } from "./fields";
import type { FileSummary } from "./use-mine";

const MB = 1024 * 1024;
const convexUrl = clientEnv.NEXT_PUBLIC_CONVEX_URL;
const siteUrl =
  clientEnv.NEXT_PUBLIC_CONVEX_SITE_URL ??
  (convexUrl ? convexSiteUrlFrom(convexUrl) : undefined);
const SHOWN_ERRORS = new Set([
  "fileType",
  "fileTooBig",
  "uploadFailed",
  "uploadUnavailable",
]);

/**
 * The private upload route checks the draft, actual type and size before
 * keeping the file in R2.
 */
function useUploader(type: FileType) {
  const [uploading, setUploading] = useState(0);
  const [problem, setProblem] = useState<string | null>(null);

  /** A `join.errors` key when it didn't work, else null. */
  async function uploadOne(file: File): Promise<string | null> {
    // Catch the obvious in the browser; the server checks the bytes anyway.
    const early = fileProblem(type, {
      contentType: file.type,
      size: file.size,
    });
    if (early) return early;
    try {
      const prepared = await prepareUpload(file, type);
      if (!siteUrl) return "uploadUnavailable";
      const { data } = await authClient.convex.token({
        fetchOptions: { throw: false },
      });
      if (!data?.token) return "uploadFailed";
      const response = await fetch(
        `${siteUrl}/application-uploads?type=${type}`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${data.token}`,
            "Content-Type": "application/octet-stream",
            "X-Luma-File-Name": encodeURIComponent(prepared.name),
            "X-Luma-File-Size": String(prepared.size),
          },
          body: prepared,
          cache: "no-store",
        },
      );
      const result = (await response.json()) as
        { ok: true } | { ok: false; error: string };
      if (result.ok) return null;
      return SHOWN_ERRORS.has(result.error) ? result.error : "uploadFailed";
    } catch {
      return "uploadFailed";
    }
  }

  async function upload(files: readonly File[]) {
    if (files.length === 0) return;
    setProblem(null);
    setUploading(files.length);
    for (const file of files) {
      const failed = await uploadOne(file);
      if (failed) setProblem(failed);
      setUploading((count) => count - 1);
    }
  }

  return { upload, uploading, problem };
}

function PickIcon({
  isUploading,
  isCamera,
}: {
  isUploading: boolean;
  isCamera: boolean;
}) {
  if (isUploading) return <LoaderIcon aria-hidden className="animate-spin" />;
  return isCamera ? <CameraIcon aria-hidden /> : <UploadIcon aria-hidden />;
}

/** One upload slot: pick (or take) a file; see it listed; remove it. */
export function FileSlot({
  type,
  files,
  label,
  hint,
  error,
  capture,
}: {
  type: FileType;
  files: readonly FileSummary[];
  label: string;
  hint: string;
  /** A `join.errors` key from the form, e.g. `fileMissing`. */
  error?: string;
  /** Open the camera straight away on phones: the selfie. */
  capture?: "user" | "environment";
}) {
  const t = useTranslations("join.files");
  const format = useFormatter();
  const remove = useMutation(api.applicationFiles.remove);
  const common = useTranslations("common");
  const removing = useRef(false);
  const [isRemoving, setIsRemoving] = useState(false);

  async function removeFile(fileId: Id<"applicationFiles">) {
    if (removing.current) return;
    removing.current = true;
    setIsRemoving(true);
    try {
      await remove({ fileId });
    } catch {
      toast.error(common("error"));
    } finally {
      removing.current = false;
      setIsRemoving(false);
    }
  }
  const input = useRef<HTMLInputElement>(null);
  const { upload, uploading, problem } = useUploader(type);

  const id = `file-${type}`;
  const isSingle = FILE_RULES[type].max === 1;
  // A single slot can always be replaced; a list stops at its limit.
  const room = isSingle ? 1 : FILE_RULES[type].max - files.length;
  const shownError = problem ?? (files.length === 0 ? error : undefined);

  let pickLabel = t("choose");
  if (uploading > 0) pickLabel = t("uploading");
  else if (capture) pickLabel = t("takePhoto");
  else if (!isSingle && files.length > 0) pickLabel = t("addMore");

  return (
    <FieldSet id={id} legend={label} hint={hint} error={shownError}>
      {files.length > 0 ? (
        <ul className="flex flex-col gap-2">
          {files.map((file) => (
            <li
              key={file.id}
              className="flex items-center gap-3 border-b border-border py-3"
            >
              <FileIcon aria-hidden className="size-5 shrink-0 text-primary" />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium">
                  {file.name}
                </span>
                <span className="text-xs text-muted-foreground">
                  {file.size < MB
                    ? t("sizeKb", {
                        size: format.number(Math.max(1, file.size / 1024), {
                          maximumFractionDigits: 0,
                        }),
                      })
                    : t("size", {
                        size: format.number(file.size / MB, {
                          maximumFractionDigits: 1,
                        }),
                      })}
                </span>
              </span>
              <Button
                type="button"
                variant="ghost"
                size="icon-lg"
                aria-label={`${t("remove")}: ${file.name}`}
                disabled={isRemoving || uploading > 0}
                onClick={() => {
                  void removeFile(file.id);
                }}
              >
                <XIcon aria-hidden />
              </Button>
            </li>
          ))}
        </ul>
      ) : null}
      {room > 0 ? (
        <div>
          <input
            ref={input}
            id={id}
            type="file"
            className="sr-only"
            accept={acceptFor(type)}
            multiple={!isSingle}
            capture={capture}
            aria-describedby={describedBy(id, shownError, hint)}
            onChange={(event) => {
              const chosen = [...(event.target.files ?? [])].slice(0, room);
              // Clear the picker so choosing the same file again still fires.
              if (input.current) input.current.value = "";
              void upload(chosen);
            }}
          />
          <Button
            type="button"
            variant="outline"
            className="h-12"
            disabled={uploading > 0 || isRemoving}
            onClick={() => input.current?.click()}
          >
            <PickIcon isUploading={uploading > 0} isCamera={Boolean(capture)} />
            {pickLabel}
          </Button>
        </div>
      ) : null}
    </FieldSet>
  );
}
