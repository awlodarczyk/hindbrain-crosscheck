"use client";

import type { SessionDetail } from "@/lib/api/sessions-dto";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AnswerCard } from "./answer-card";
import { CrossCheckTable } from "./cross-check-table";
import { RawView } from "./raw-view";
import { ReviewCard } from "./review-card";
import { SourcesList } from "./sources-list";
import { uniqueSources, type LatestView } from "./select-bundle";
import { viewCalls } from "./meta-line";
import { useMedia } from "@/components/shell/use-media";

/** Answers / Cross-check / Sources / Raw tab set for the latest attempt. */
export function SessionTabs({
  detail,
  view,
  onRetry,
}: {
  detail: SessionDetail;
  view: LatestView;
  onRetry: (callId: string) => void;
}) {
  const collapsible = useMedia("(max-width: 768px)");
  const calls = viewCalls(view);
  const reviews = [view.reviews.chatgpt, view.reviews.claude].flatMap((c) => (c ? [c] : []));
  const claimsOf = (id: string | undefined) => (id ? (view.claimsByCall[id] ?? []) : []);
  return (
    <Tabs defaultValue="answers">
      <TabsList aria-label="Session views">
        <TabsTrigger value="answers">Answers</TabsTrigger>
        <TabsTrigger value="cross-check">Cross-check</TabsTrigger>
        <TabsTrigger value="sources" className="gap-1.5">
          Sources{" "}
          <Badge tone="neutral" className="h-[18px] px-1.5">
            {uniqueSources(calls).length}
          </Badge>
        </TabsTrigger>
        <TabsTrigger value="raw">Raw</TabsTrigger>
      </TabsList>
      <TabsContent value="answers">
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <AnswerCard
            provider="claude"
            call={view.answers.claude}
            onRetry={onRetry}
            collapsible={collapsible}
            defaultOpen
          />
          <AnswerCard
            provider="chatgpt"
            call={view.answers.chatgpt}
            onRetry={onRetry}
            collapsible={collapsible}
          />
          <ReviewCard
            reviewer="chatgpt"
            target="claude"
            call={view.reviews.chatgpt}
            claims={claimsOf(view.reviews.chatgpt?.id)}
            onRetry={onRetry}
            collapsible={collapsible}
          />
          <ReviewCard
            reviewer="claude"
            target="chatgpt"
            call={view.reviews.claude}
            claims={claimsOf(view.reviews.claude?.id)}
            onRetry={onRetry}
            collapsible={collapsible}
          />
        </div>
      </TabsContent>
      <TabsContent value="cross-check">
        <CrossCheckTable reviews={reviews} claimsByCall={view.claimsByCall} />
      </TabsContent>
      <TabsContent value="sources">
        <SourcesList calls={calls} />
      </TabsContent>
      <TabsContent value="raw">
        <RawView detail={detail} />
      </TabsContent>
    </Tabs>
  );
}
