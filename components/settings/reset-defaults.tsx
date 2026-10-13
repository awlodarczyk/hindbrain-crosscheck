"use client";

import { RotateCcw } from "lucide-react";
import { useState } from "react";
import { ConfirmDialog } from "@/components/shell/confirm-dialog";
import { Button } from "@/components/ui/button";
import { DEFAULT_SETTINGS } from "@/lib/settings/defaults";
import { useSettingsView } from "./settings-context";

/** Restores the model, tuning and verification settings after confirmation. */
export function ResetDefaults() {
  const { update } = useSettingsView();
  const [open, setOpen] = useState(false);
  const { providers, reasoningEffort, tuning, verification } = DEFAULT_SETTINGS;
  return (
    <>
      <Button variant="secondary" onClick={() => setOpen(true)}>
        <RotateCcw className="size-4" />
        Reset to defaults
      </Button>
      <ConfirmDialog
        open={open}
        onOpenChange={setOpen}
        title="Reset to defaults?"
        body="Models, answer tuning and verification return to their default values. API keys are kept."
        confirmLabel="Reset"
        onConfirm={() => update({ providers, reasoningEffort, tuning, verification })}
      />
    </>
  );
}
