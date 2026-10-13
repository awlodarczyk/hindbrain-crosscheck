"use client";

import { KeyRound, Terminal } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Segmented } from "@/components/ui/segmented";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import type { SecretView } from "@/lib/api/settings-dto";
import type { ProviderId } from "@/lib/db/enums";
import type { CliInfo } from "@/lib/providers/cli-detect";
import { KeyField } from "./key-field";
import { Row } from "./section";

type Connection = "cli" | "api";

const META: Record<ProviderId, { name: string; cliLabel: string; bin: string; env: string }> = {
  claude: { name: "Claude", cliLabel: "Claude Code CLI", bin: "claude", env: "ANTHROPIC_API_KEY" },
  chatgpt: { name: "ChatGPT", cliLabel: "Codex CLI", bin: "codex", env: "OPENAI_API_KEY" },
};

export type ProviderCardProps = {
  provider: ProviderId;
  connection: Connection;
  cliAllowed: boolean;
  cli: CliInfo;
  secret: SecretView;
  requirePassword?: boolean;
  onConnection: (connection: Connection) => void;
  onTest: () => void;
  onReplace: (apiKey: string) => Promise<void>;
  onReveal: (password?: string) => Promise<string>;
  onRemove: () => Promise<void>;
};

/** True when the selected transport can currently reach the provider. */
export function isConnected(connection: Connection, secret: SecretView, cli: CliInfo): boolean {
  return secret.effective !== "none" || (connection === "cli" && cli.found);
}

const DOT: Record<ProviderId, string> = { claude: "bg-model-claude", chatgpt: "bg-model-chatgpt" };

function detectedLine(bin: string, cli: CliInfo): string {
  if (!cli.found) return "not detected";
  return [[bin, cli.version].filter(Boolean).join(" "), cli.account].filter(Boolean).join(" · ");
}

function ConnectionToggle(props: ProviderCardProps) {
  const { cliLabel } = META[props.provider];
  const toggle = (
    <Segmented<Connection>
      ariaLabel={`${META[props.provider].name} connection`}
      value={props.connection}
      onChange={props.onConnection}
      options={[
        {
          value: "cli",
          label: cliLabel,
          icon: <Terminal className="size-3.5" />,
          disabled: !props.cliAllowed,
        },
        { value: "api", label: "API key", icon: <KeyRound className="size-3.5" /> },
      ]}
    />
  );
  if (props.cliAllowed) return toggle;
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <span tabIndex={0}>{toggle}</span>
        </TooltipTrigger>
        <TooltipContent>CLI is not available in hosted mode</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

function CliRows({ provider, cli, onTest }: ProviderCardProps) {
  const { bin } = META[provider];
  return (
    <>
      <Row title="CLI" sub="Uses your subscription, no API cost">
        <div className="flex items-center gap-2">
          <Input
            readOnly
            aria-label="CLI path"
            className="w-48 font-mono text-[12px]"
            value={cli.found ? (cli.path ?? bin) : "not found in PATH"}
          />
          <Button variant="secondary" onClick={onTest}>
            Test
          </Button>
        </div>
      </Row>
      <Row title="Detected">
        <span className="font-mono text-[12px] text-text-secondary">{detectedLine(bin, cli)}</span>
      </Row>
      {provider === "chatgpt" && (
        <p className="px-4 py-2 text-[12px] text-text-secondary">
          Codex uses the answer model for verification
        </p>
      )}
    </>
  );
}

function ApiRows(props: ProviderCardProps) {
  const { env } = META[props.provider];
  return (
    <>
      <Row title="API key" sub={`${env} in .env`} monoSub>
        <KeyField
          provider={props.provider}
          state={props.secret}
          requirePassword={props.requirePassword}
          onReplace={props.onReplace}
          onReveal={props.onReveal}
          onRemove={props.onRemove}
        />
      </Row>
      <Row title="Billing" sub="Pay per call on your platform account">
        <span className="font-mono text-[12px] text-text-muted">usage not available</span>
      </Row>
    </>
  );
}

/** One provider: connection toggle, CLI or API-key rows and a status badge. */
export function ProviderCard(props: ProviderCardProps) {
  const { provider, connection, secret, cli } = props;
  const connected = isConnected(connection, secret, cli);
  return (
    <section
      aria-label={META[provider].name}
      className="min-w-0 divide-y divide-border-default rounded-panel border border-border-default bg-bg-card"
    >
      <header className="flex items-center justify-between px-4 py-3">
        <h3 className="flex items-center gap-2 text-[11px] font-medium uppercase tracking-wider text-text-muted">
          <span aria-hidden className={`size-2 ${DOT[provider]}`} />
          {META[provider].name}
        </h3>
        <Badge tone={connected ? "supported" : "neutral"}>
          {connected ? "Connected" : "Not connected"}
        </Badge>
      </header>
      <Row title="Connection" sub="How crosscheck reaches the model">
        <ConnectionToggle {...props} />
      </Row>
      {connection === "cli" ? <CliRows {...props} /> : <ApiRows {...props} />}
    </section>
  );
}
