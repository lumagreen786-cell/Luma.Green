"use client";

import { CameraIcon, XIcon } from "lucide-react";
import Image from "next/image";
import { useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

function Photo({ file, onRemove }: { file: File; onRemove: () => void }) {
  const common = useTranslations("join.form");
  const [url, setUrl] = useState<string>();
  useEffect(() => {
    const nextUrl = URL.createObjectURL(file);
    // eslint-disable-next-line react-hooks/set-state-in-effect -- Publish this external browser resource only after its create/revoke lifecycle starts.
    setUrl(nextUrl);
    return () => {
      URL.revokeObjectURL(nextUrl);
    };
  }, [file]);
  return (
    <div className="relative overflow-hidden rounded-lg bg-muted">
      {url ? (
        <Image
          src={url}
          alt={file.name}
          width={160}
          height={120}
          unoptimized
          className="aspect-[4/3] w-full object-cover"
        />
      ) : (
        <div className="aspect-[4/3] w-full" />
      )}
      <Button
        type="button"
        variant="secondary"
        size="icon"
        className="absolute end-1 top-1"
        aria-label={`${common("remove")} ${file.name}`}
        onClick={onRemove}
      >
        <XIcon aria-hidden />
      </Button>
    </div>
  );
}

export function RecyclingPhotos({
  files,
  onChange,
  error,
}: {
  files: File[];
  onChange: (files: File[]) => void;
  error?: string;
}) {
  const t = useTranslations("sell.simple");
  const join = useTranslations("join.errors");
  const input = useRef<HTMLInputElement>(null);
  const [problem, setProblem] = useState<string | null>(null);
  return (
    <section className="space-y-3" aria-labelledby="recycling-photos-title">
      <Label
        id="recycling-photos-title"
        htmlFor="recycling-photos"
        className="text-base font-semibold"
      >
        {t("photos")}
      </Label>
      <p className="text-sm text-muted-foreground">{t("photoHint")}</p>
      <Input
        ref={input}
        id="recycling-photos"
        type="file"
        accept="image/jpeg,image/png,image/webp"
        multiple
        className="hidden"
        tabIndex={-1}
        aria-describedby={
          problem || error ? "recycling-photo-error" : undefined
        }
        onChange={(event) => {
          const added = [...(event.target.files ?? [])];
          const element = event.currentTarget;
          element.value = "";
          if (files.length + added.length > 5) {
            setProblem(t("photosTooMany"));
            return;
          }
          if (
            added.some(
              (file) =>
                !["image/jpeg", "image/png", "image/webp"].includes(file.type),
            )
          ) {
            setProblem(join("fileType"));
            return;
          }
          if (
            added.some(
              (file) => file.size > 10 * 1024 * 1024 || file.size === 0,
            )
          ) {
            setProblem(join("fileTooBig"));
            return;
          }
          setProblem(null);
          onChange([...files, ...added]);
        }}
      />
      <Button
        type="button"
        variant="outline"
        className="min-h-14 w-full justify-center"
        onClick={() => {
          input.current?.click();
        }}
      >
        <CameraIcon aria-hidden />
        {t("photos")}
      </Button>
      {files.length > 0 ? (
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
          {files.map((file, index) => (
            <Photo
              key={`${file.name}-${String(file.lastModified)}-${String(index)}`}
              file={file}
              onRemove={() => {
                onChange(files.filter((_, position) => position !== index));
              }}
            />
          ))}
        </div>
      ) : null}
      {problem || error ? (
        <p
          id="recycling-photo-error"
          role="alert"
          className="text-sm text-destructive"
        >
          {problem ?? error}
        </p>
      ) : null}
    </section>
  );
}
