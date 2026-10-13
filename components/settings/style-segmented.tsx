"use client";

import { Segmented } from "@/components/ui/segmented";
import type { Settings } from "@/lib/settings/schema";

type Style = Settings["tuning"]["answerStyle"];
const OPTIONS = [
  { value: "concise", label: "Concise" },
  { value: "balanced", label: "Balanced" },
  { value: "thorough", label: "Thorough" },
] as const;

export function StyleSegmented({
  value,
  onChange,
}: {
  value: Style;
  onChange: (v: Style) => void;
}) {
  return <Segmented ariaLabel="Answer style" value={value} onChange={onChange} options={OPTIONS} />;
}
