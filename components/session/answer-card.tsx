import { Link as LinkIcon } from "lucide-react";
import type { ProviderId } from "@/lib/db/enums";
import { PROVIDER_LABEL } from "@/lib/pipeline/prompts";
import type { Call } from "@/lib/repos/types";
import { CallPlaceholder } from "./call-state";
import { CardFrame } from "./card-frame";
import { HtmlBody } from "./html-body";
import { callMeta, domainOf } from "./meta-line";

/** One provider's answer with its cited source chips. */
export function AnswerCard({
  provider,
  call,
  onRetry,
  collapsible,
  defaultOpen,
}: {
  provider: ProviderId;
  call: Call | null;
  onRetry?: (callId: string) => void;
  collapsible?: boolean;
  defaultOpen?: boolean;
}) {
  const done = call?.status === "done" && call.html !== null;
  const cites = call?.citations ?? [];
  return (
    <CardFrame
      collapsible={collapsible}
      defaultOpen={defaultOpen}
      provider={provider}
      label={`${PROVIDER_LABEL[provider]} answer`}
      title={PROVIDER_LABEL[provider]}
      sub={call?.model}
      right={call ? callMeta(call) : undefined}
      footer={
        call?.status === "running" ? (
          <footer className="flex min-h-10 items-center border-t border-border-default bg-bg-subtle px-4 py-2 text-[12px] text-text-muted">
            Sources appear when the answer lands
          </footer>
        ) : done && cites.length > 0 ? (
          <footer className="flex min-h-10 flex-wrap items-center gap-2 border-t border-border-default bg-bg-subtle px-4 py-2">
            <span className="text-[12px] text-text-muted">Sources</span>
            {cites.map((c) => (
              <a
                key={c.url}
                href={c.url}
                target="_blank"
                rel="noopener noreferrer"
                title={c.title}
                className="inline-flex h-6 items-center gap-1 rounded-control border border-border-default bg-bg-subtle px-2 font-mono text-[12px] text-text-secondary hover:text-text-primary"
              >
                <LinkIcon aria-hidden className="size-3" />
                {domainOf(c.url)}
              </a>
            ))}
          </footer>
        ) : undefined
      }
    >
      <div className="p-4">
        {done ? (
          <HtmlBody html={call.html ?? ""} />
        ) : (
          <CallPlaceholder call={call} provider={provider} kind="answer" onRetry={onRetry} />
        )}
      </div>
    </CardFrame>
  );
}
