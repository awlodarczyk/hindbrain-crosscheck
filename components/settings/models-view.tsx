"use client";

import { toast } from "sonner";
import type { ProviderId } from "@/lib/db/enums";
import { DomainChips } from "./domain-chips";
import { EffortSegmented } from "./effort-segmented";
import { FewShotRow } from "./fewshot-row";
import { InstructionsTextarea } from "./instructions-textarea";
import { ModelSelect } from "./model-select";
import { ProviderCard } from "./provider-card";
import { ResetDefaults } from "./reset-defaults";
import { Row, Section } from "./section";
import { useSettingsView } from "./settings-context";
import { SliderRow } from "./slider-row";
import { StyleSegmented } from "./style-segmented";
import { VerificationSection } from "./verification-section";
import { WebSearchRow } from "./web-search-row";

const PROVIDERS: readonly ProviderId[] = ["claude", "chatgpt"];
const CLI_KEY = { claude: "claude", chatgpt: "codex" } as const;
const NAME: Record<ProviderId, string> = { claude: "Claude", chatgpt: "ChatGPT" };

function Providers() {
  const s = useSettingsView();
  const test = async (p: ProviderId) => {
    try {
      const status = await s.testProvider(p);
      (status.ok ? toast.success : toast.error)(status.detail);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Test failed");
    }
  };
  return (
    <div className="grid gap-4 md:grid-cols-2">
      {PROVIDERS.map((p) => (
        <ProviderCard
          key={p}
          provider={p}
          connection={s.view.settings.providers[p].connection}
          cliAllowed={s.view.cliAllowed}
          cli={s.view.cli[CLI_KEY[p]]}
          secret={s.view.secrets[p]}
          requirePassword={s.view.mode === "hosted"}
          onConnection={(connection) => s.update({ providers: { [p]: { connection } } })}
          onTest={() => void test(p)}
          onReplace={(key) => s.putKey(p, key)}
          onReveal={(password) => s.reveal(p, password)}
          onRemove={() => s.removeKey(p)}
        />
      ))}
    </div>
  );
}

function ModelsSection() {
  const { view, update } = useSettingsView();
  const { providers, reasoningEffort } = view.settings;
  return (
    <Section title="Models">
      <Row title="Answer model" sub="Produces the first answer">
        <div className="flex flex-wrap gap-2">
          {PROVIDERS.map((p) => (
            <ModelSelect
              key={p}
              provider={p}
              label={`${NAME[p]} answer model`}
              value={providers[p].answerModel}
              models={view.models[p]}
              onChange={(v) => v && update({ providers: { [p]: { answerModel: v } } })}
            />
          ))}
        </div>
      </Row>
      <Row title="Verification model" sub="Checks the other provider's answer">
        <div className="flex flex-wrap gap-2">
          {PROVIDERS.map((p) => (
            <ModelSelect
              key={p}
              provider={p}
              allowSame
              label={`${NAME[p]} verification model`}
              value={providers[p].verificationModel}
              models={view.models[p]}
              onChange={(v) => update({ providers: { [p]: { verificationModel: v } } })}
            />
          ))}
        </div>
      </Row>
      <Row title="Reasoning effort" sub="Higher = slower, better on hard questions">
        <EffortSegmented
          value={reasoningEffort}
          estimate={view.estimate}
          onChange={(v) => update({ reasoningEffort: v })}
        />
      </Row>
    </Section>
  );
}

function TuningSection() {
  const { view, update } = useSettingsView();
  const t = view.settings.tuning;
  return (
    <Section title="Answer tuning">
      <div className="flex flex-col gap-3 px-4 py-3">
        <div>
          <div className="text-[13px] font-medium text-text-primary">Custom instructions</div>
          <div className="text-[12px] text-text-secondary">
            Appended to the system prompt. Keep it short and testable.
          </div>
        </div>
        <InstructionsTextarea
          value={t.customInstructions}
          onChange={(customInstructions) => update({ tuning: { customInstructions } })}
        />
      </div>
      <Row title="Answer style" sub="Length and depth of the first answer">
        <StyleSegmented
          value={t.answerStyle}
          onChange={(answerStyle) => update({ tuning: { answerStyle } })}
        />
      </Row>
      <Row title="Temperature" sub="Lower = more deterministic. 0.2 recommended for fact-checking.">
        <SliderRow
          label="Temperature"
          value={t.temperature}
          min={0}
          max={1}
          step={0.05}
          onChange={(temperature) => update({ tuning: { temperature } })}
        />
      </Row>
      <Row title="Web search" sub="Searches per call and how deep to go">
        <WebSearchRow
          max={t.webSearchMax}
          depth={t.webSearchDepth}
          onMax={(webSearchMax) => update({ tuning: { webSearchMax } })}
          onDepth={(webSearchDepth) => update({ tuning: { webSearchDepth } })}
        />
      </Row>
      <Row title="Preferred domains" sub="Searched first and weighted higher in verification">
        <DomainChips
          domains={t.preferredDomains}
          onChange={(preferredDomains) =>
            update({ tuning: { preferredDomains: [...preferredDomains] } })
          }
        />
      </Row>
      <Row title="Few-shot examples" sub="Question → ideal answer pairs sent with every prompt">
        <FewShotRow
          examples={t.fewShot}
          onChange={(fewShot) => update({ tuning: { fewShot: [...fewShot] } })}
        />
      </Row>
    </Section>
  );
}

/** Settings · Models page body. */
export function ModelsView() {
  return (
    <>
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-[24px] font-semibold text-text-primary">Models</h2>
          <p className="mt-1 text-[14px] text-text-secondary">
            Pick how each provider is reached, which models answer, and how answers are tuned.
            Verification always runs on the opposite provider.
          </p>
        </div>
        <ResetDefaults />
      </div>
      <Providers />
      <ModelsSection />
      <TuningSection />
      <VerificationSection />
    </>
  );
}
