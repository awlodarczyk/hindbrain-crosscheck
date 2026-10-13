import { cn } from "@/lib/utils";

const PROSE =
  "text-base leading-6 md:text-[14px] text-text-primary [&_p]:mb-3 [&_ul]:mb-3 [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5 [&_strong]:font-semibold [&_a]:text-accent-default [&_a]:underline [&_code]:font-mono [&_code]:text-[13px] [&_pre]:mb-3 [&_pre]:overflow-x-auto [&_pre]:rounded-control [&_pre]:bg-bg-muted [&_pre]:p-3 [&_table]:text-[13px]";

/**
 * Renders server-sanitized answer markup. This is the only HTML sink in the app and
 * must be fed exclusively from `Call.html`.
 */
export function HtmlBody({ html, className }: { html: string; className?: string }) {
  return <div className={cn(PROSE, className)} dangerouslySetInnerHTML={{ __html: html }} />;
}
