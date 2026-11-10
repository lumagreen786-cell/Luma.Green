import { useLocale } from "next-intl";

import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { isLocale, localeDirection } from "@/i18n/locales";

export function Choice({
  id,
  name,
  label,
  options,
  value,
  onValueChange,
  disabled,
}: {
  id: string;
  name: string;
  label: string;
  options: readonly { value: string; label: string }[];
  value?: string;
  onValueChange?: (value: string) => void;
  disabled?: boolean;
}) {
  const locale = useLocale();
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <Select
        name={name}
        value={value}
        onValueChange={onValueChange}
        disabled={disabled}
        required
        dir={isLocale(locale) ? localeDirection(locale) : "ltr"}
      >
        <SelectTrigger id={id} className="min-h-11 w-full">
          <SelectValue placeholder={label} />
        </SelectTrigger>
        <SelectContent>
          {options.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
