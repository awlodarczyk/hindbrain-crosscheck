"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Topbar } from "@/components/shell/topbar";
import { Composer, type ComposerSubmit } from "@/components/session/composer";
import { Kbd } from "@/components/ui/kbd";
import { api } from "@/lib/api/client";
import type { SettingsView } from "@/lib/api/settings-dto";
import type { ProviderId } from "@/lib/db/enums";
import { FirstRunPanel } from "./first-run-panel";
import { FooterNote } from "./footer-note";
import { Hero } from "./hero";
import { HowItWorks } from "./how-it-works";
import { ModeToggle } from "./mode-toggle";
import { isProviderUsable } from "./provider-usable";

const errorMessage = (e: unknown) => (e instanceof Error ? e.message : "Something went wrong");

/** The "New question" screen. */
export function NewQuestionView({ initialView }: { initialView: SettingsView }) {
  const router = useRouter();
  const [view, setView] = React.useState(initialView);
  const [mode, setMode] = React.useState<"ask" | "paste">("ask");
  const firstRun = !(["claude", "chatgpt"] as const).some((p) => isProviderUsable(view, p));

  async function submit(input: ComposerSubmit) {
    try {
      const { id } = await api.sessions.create(input);
      router.push(`/s/${id}`);
    } catch (e) {
      toast.error(errorMessage(e));
    }
  }

  async function useCli(p: ProviderId) {
    try {
      const s = view.settings;
      await api.settings.put({
        ...s,
        providers: { ...s.providers, [p]: { ...s.providers[p], connection: "cli" } },
      });
      setView(await api.settings.get());
    } catch (e) {
      toast.error(errorMessage(e));
    }
  }

  return (
    <div className="flex min-h-full flex-col">
      <Topbar
        crumbs={[{ label: "History", href: "/" }, { label: "New question" }]}
        actions={
          <span className="hidden items-center gap-1.5 text-xs text-text-muted sm:flex">
            <Kbd>J</Kbd>
            <Kbd>K</Kbd>
            navigate history
          </span>
        }
      />
      <div className="mx-auto flex w-full max-w-[720px] flex-1 flex-col gap-4 px-4 pt-16 md:pt-[82px]">
        <Hero />
        {firstRun && <FirstRunPanel view={view} onUseCli={useCli} />}
        <div className={firstRun ? "opacity-55" : undefined}>
          <Composer
            variant="centered"
            settings={view.settings}
            models={view.models}
            mode={mode}
            disabled={firstRun}
            disabledLabel="Connect a provider first"
            onSubmit={submit}
          />
        </div>
        {!firstRun && (
          <>
            <div className="flex justify-center">
              <ModeToggle value={mode} onChange={setMode} />
            </div>
            <div className="mt-2">
              <HowItWorks />
            </div>
          </>
        )}
      </div>
      <FooterNote mode={view.mode} />
    </div>
  );
}
