"use client";

import { Segmented } from "@/components/ui/segmented";
import { Switch } from "@/components/ui/switch";
import { Row, Section } from "./section";
import { useSettingsView } from "./settings-context";

/** Verification settings page body. */
export function VerificationView() {
  const { view, update } = useSettingsView();
  const v = view.settings.verification;
  return (
    <Section title="Verification">
      <Row title="Strictness" sub="How hard the verifier pushes back on claims">
        <Segmented
          ariaLabel="Strictness"
          value={v.strictness}
          onChange={(strictness) => update({ verification: { strictness } })}
          options={[
            { value: "lenient", label: "Lenient" },
            { value: "standard", label: "Standard" },
            { value: "strict", label: "Strict" },
          ]}
        />
      </Row>
      <Row title="Require a source per claim" sub="Claims without a source are marked unverified">
        <Switch
          aria-label="Require a source per claim"
          checked={v.requireSourcePerClaim}
          onCheckedChange={(requireSourcePerClaim) =>
            update({ verification: { requireSourcePerClaim } })
          }
        />
      </Row>
      <Row title="Re-run on disagreement" sub="Run the verifier again when the models disagree">
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
