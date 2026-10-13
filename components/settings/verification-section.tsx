"use client";

import { Switch } from "@/components/ui/switch";
import { Row, Section } from "./section";
import { useSettingsView } from "./settings-context";
import { StrictnessRow } from "./strictness-row";

/** Strictness and re-run controls; shared by the Models and Verification screens. */
export function VerificationSection() {
  const { view, update } = useSettingsView();
  const v = view.settings.verification;
  return (
    <Section title="Verification">
      <Row title="Strictness" sub="How hard the reviewer pushes back">
        <StrictnessRow
          value={v.strictness}
          onChange={(strictness) => update({ verification: { strictness } })}
        />
      </Row>
      <Row title="Require a source per claim" sub="Claims without a link are marked Unverifiable">
        <Switch
          aria-label="Require a source per claim"
          checked={v.requireSourcePerClaim}
          onCheckedChange={(requireSourcePerClaim) =>
            update({ verification: { requireSourcePerClaim } })
          }
        />
      </Row>
      <Row
        title="Re-run on disagreement"
        sub="Ask both models once more when ≥ 3 claims are disputed"
      >
        <Switch
          aria-label="Re-run on disagreement"
          checked={v.rerunOnDisagreement}
          onCheckedChange={(rerunOnDisagreement) =>
            update({ verification: { rerunOnDisagreement } })
          }
        />
      </Row>
    </Section>
  );
}
