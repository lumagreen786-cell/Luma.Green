import { useTranslations } from "next-intl";
import { useId } from "react";

import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";

export function AgeConfirmation({
  checked,
  onChange,
}: {
  checked: boolean;
  onChange: (isAdult: boolean) => void;
}) {
  const t = useTranslations("join.consent");
  const id = useId();
  return (
    <Label
      htmlFor={id}
      className="min-h-11 cursor-pointer items-center gap-3 font-normal"
    >
      <Checkbox
        id={id}
        checked={checked}
        onCheckedChange={(value) => {
          onChange(value === true);
        }}
      />
      <span>{t("age")}</span>
    </Label>
  );
}
