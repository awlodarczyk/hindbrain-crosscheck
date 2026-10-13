"use client";

import { Copy, Download } from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Segmented } from "@/components/ui/segmented";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { api } from "@/lib/api/client";
import type { ProviderId } from "@/lib/db/enums";
import { DangerRow } from "./danger-row";
import { KeyField } from "./key-field";
import { NumberField } from "./number-field";
import { Row, Section } from "./section";
import { useSettingsView } from "./settings-context";
import { copyPath } from "./shell";

const PROVIDERS: readonly { id: ProviderId; name: string; env: string }[] = [
  { id: "claude", name: "Anthropic", env: "ANTHROPIC_API_KEY" },
  { id: "chatgpt", name: "OpenAI", env: "OPENAI_API_KEY" },
];

export function ApiKeysSection() {
  const s = useSettingsView();
  return (
    <Section title="API keys">
      {PROVIDERS.map((p) => (
        <Row key={p.id} title={p.name} sub={p.env} monoSub>
          <KeyField
            provider={p.id}
            state={s.view.secrets[p.id]}
            requirePassword={s.view.mode === "hosted"}
            onReplace={(key) => s.putKey(p.id, key)}
            onReveal={(password) => s.reveal(p.id, password)}
            onRemove={() => s.removeKey(p.id)}
          />
        </Row>
      ))}
    </Section>
  );
}

export function ModelsSection() {
  const { view, update } = useSettingsView();
  const { providers, verification } = view.settings;
  return (
    <Section title="Models">
      {PROVIDERS.map((p, i) => (
        <Row
          key={p.id}
          title={`${p.name} answer model`}
          sub={i === 0 ? "Verification always uses the opposite model." : undefined}
        >
          <Select
            value={providers[p.id].answerModel}
            onValueChange={(v) => update({ providers: { [p.id]: { answerModel: v } } })}
          >
            <SelectTrigger aria-label={`${p.name} answer model`} className="w-44">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {view.models[p.id].map((m) => (
                <SelectItem key={m.id} value={m.id}>
                  {m.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Row>
      ))}
      <Row title="Verification prompt" sub="Claim-by-claim with web search">
        <Select
          value={verification.strictness}
          onValueChange={(v) =>
            update({ verification: { strictness: v as typeof verification.strictness } })
          }
        >
          <SelectTrigger aria-label="Verification strictness" className="w-44">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="lenient">Lenient</SelectItem>
            <SelectItem value="standard">Standard</SelectItem>
            <SelectItem value="strict">Strict (default)</SelectItem>
          </SelectContent>
        </Select>
      </Row>
    </Section>
  );
}

const usd = (n: number) => `$${n.toFixed(2)}`;

export function CostSection() {
  const { view, update } = useSettingsView();
  const { cost } = view.settings;
  const { low, high } = view.estimate;
  return (
    <Section title="Cost controls">
      <Row title="Max searches per call" sub="MAX_SEARCHES" monoSub>
        <NumberField
          label="Max searches per call"
          value={cost.maxSearchesPerCall}
          min={0}
          max={20}
          onChange={(n) => update({ cost: { maxSearchesPerCall: n } })}
        />
      </Row>
      <Row title="Timeout" sub="TIMEOUT_SECONDS" monoSub>
        <NumberField
          label="Timeout in seconds"
          value={cost.timeoutSeconds}
          min={30}
          max={900}
          suffix="s"
          onChange={(n) => update({ cost: { timeoutSeconds: n } })}
        />
      </Row>
      <Row title="Estimated cost" sub="At the current models">
        <span className="font-mono text-[12px] text-text-primary">
          ≈ {usd(low)}–{usd(high)} per question
        </span>
      </Row>
    </Section>
  );
}

export function AppearanceSection() {
  const { view, update } = useSettingsView();
  const { theme, reduceMotion } = view.settings.appearance;
  return (
    <Section title="Appearance">
      <Row title="Theme">
        <Segmented
          ariaLabel="Theme"
          value={theme}
          onChange={(v) => update({ appearance: { theme: v } })}
          options={[
            { value: "light", label: "Light" },
            { value: "dark", label: "Dark" },
            { value: "system", label: "System" },
          ]}
        />
      </Row>
      <Row title="Reduce motion" sub="Disables panel and status animations">
        <Switch
          aria-label="Reduce motion"
          checked={reduceMotion}
          onCheckedChange={(v) => update({ appearance: { reduceMotion: v } })}
        />
      </Row>
    </Section>
  );
}

export function DataSection() {
  const { view, dataDir } = useSettingsView();
  const router = useRouter();
  const local = view.mode === "local" && dataDir !== null;
  const dbPath = local ? `${dataDir}/crosscheck.db` : null;
  const deleteAll = async () => {
    try {
      await api.sessions.removeAll();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not delete history");
      throw e;
    }
    toast.success("History deleted");
    window.dispatchEvent(new Event("hc:history-changed"));
    router.refresh();
  };
  return (
    <Section title="Data">
      <Row title="History" sub={dbPath ?? "Stored on the server"} monoSub={dbPath !== null}>
        <div className="flex items-center gap-2">
          {dbPath && (
            <Button variant="secondary" onClick={() => void copyPath(dbPath)}>
              <Copy className="size-4" />
              Copy path
            </Button>
          )}
          <Button variant="secondary" asChild>
            <a href={api.sessions.exportAllUrl()} download>
              <Download className="size-4" />
              Export all
            </a>
          </Button>
        </div>
      </Row>
      <DangerRow
        title="Danger zone"
        sub="Removes every saved session. Cannot be undone."
        buttonLabel="Delete all history"
        confirmTitle="Delete all history?"
        confirmBody="Every saved session is removed. This cannot be undone."
        confirmWord="DELETE"
        onConfirm={deleteAll}
      />
    </Section>
  );
}

/** General settings page body. */
export function GeneralView() {
  return (
    <>
      <ApiKeysSection />
      <div className="grid gap-6 lg:grid-cols-2">
        <ModelsSection />
        <CostSection />
      </div>
      <AppearanceSection />
      <DataSection />
    </>
  );
}
