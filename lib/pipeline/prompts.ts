import type { ProviderId } from "@/lib/db/enums";
import type { Settings } from "@/lib/settings/schema";
import { CLAIMS_JSON_SPEC, DEPTH_LINE, STRICTNESS_LINE, STYLE_LINE } from "./templates";

/** `transcript` switches both prompts to challenging a pasted conversation instead of answering. */
export type PromptContext = { settings: Settings; question: string; transcript?: string | null };

/** Focus used when a transcript session is created without a question. */
export const TRANSCRIPT_DEFAULT_QUESTION = "Which claims in this conversation hold up?";

export const PROVIDER_LABEL: Record<ProviderId, string> = {
  claude: "Claude",
  chatgpt: "ChatGPT",
};

const ANSWER_BASE = [
  "Answer reliably. When the question concerns facts, studies, guidelines or things",
  "that change over time, use search and cite sources. In health and science topics",
  "rely on the evidence hierarchy: clinical guidelines, systematic reviews and",
  "meta-analyses, RCTs; state the strength and limits of the evidence. Separate what",
  "is known from what is uncertain. Do not invent sources.",
].join(" ");

const TRANSCRIPT_BASE = [
  "You are given the transcript of a conversation between a user and an AI assistant.",
  "Challenge it: list the factual claims and the reasoning in the assistant's replies,",
  "verify each in current sources via search, point out errors, unsupported conclusions",
  "and important omissions, and finish with a corrected assessment. Address the user's",
  "focus question first. In health and science topics rely on the evidence hierarchy:",
  "clinical guidelines, systematic reviews and meta-analyses, RCTs; state the strength",
  "and limits of the evidence. Separate what is known from what is uncertain. Do not",
  "invent sources.",
].join(" ");

const TRANSCRIPT_REVIEW_RULE =
  "The answer is an analysis of a conversation transcript: also check whether it misquotes " +
  "or misrepresents what the transcript says.";

const REVIEW_BASE = [
  "You are an independent fact reviewer. Check the answer below from the other model.",
  "Rules: break the answer into checkable claims and rate each separately;",
  "verify in current sources via search;",
  "prefer primary sources (guidelines, systematic reviews, peer-reviewed studies,",
  "official documentation); give a source link per claim;",
  "never invent citations - no search result is not a confirmation;",
  "point out important omissions if they change the conclusions;",
  "separate what sources say from your interpretation;",
  "flag weak or conflicting evidence.",
].join(" ");

const NO_SOURCE_RULE = "A claim without a source link must be marked unverifiable.";

const LANGUAGE_LINE: Record<Settings["answerLanguage"], string> = {
  auto: "Answer in the language of the question.",
  en: "Answer in English.",
  pl: "Answer in Polish.",
};

export function answerLanguageLine(lang: Settings["answerLanguage"]): string {
  return LANGUAGE_LINE[lang];
}

function domainsLine({ tuning }: Settings): string {
  return tuning.preferredDomains.length
    ? `Prefer sources from these domains when relevant: ${tuning.preferredDomains.join(", ")}.`
    : "";
}

function customBlock({ tuning }: Settings): string {
  const text = tuning.customInstructions.trim();
  return text ? `Additional instructions from the user:\n${text}` : "";
}

function join(parts: readonly string[]): string {
  return parts.filter((p) => p !== "").join("\n\n");
}

const transcriptBlock = (t: string) => `The conversation to check:\n<<<\n${t}\n>>>`;

export function answerSystemPrompt({ settings, transcript }: PromptContext): string {
  const { tuning, answerLanguage } = settings;
  return join([
    transcript ? TRANSCRIPT_BASE : ANSWER_BASE,
    answerLanguageLine(answerLanguage),
    STYLE_LINE[tuning.answerStyle],
    DEPTH_LINE[tuning.webSearchDepth],
    domainsLine(settings),
    customBlock(settings),
  ]);
}

export function answerUserPrompt({ settings, question, transcript }: PromptContext): string {
  if (transcript) return join([`Focus:\n${question}`, transcriptBlock(transcript)]);
  const { fewShot } = settings.tuning;
  if (fewShot.length === 0) return question;
  const examples = fewShot.map(
    (ex) => `Example question:\n${ex.question}\n\nIdeal answer:\n${ex.answer}`,
  );
  return join([...examples, `Now answer this question:\n${question}`]);
}

export function reviewSystemPrompt({ settings, transcript }: PromptContext): string {
  const { verification, tuning, answerLanguage } = settings;
  return join([
    REVIEW_BASE,
    transcript ? TRANSCRIPT_REVIEW_RULE : "",
    STRICTNESS_LINE[verification.strictness],
    verification.requireSourcePerClaim ? NO_SOURCE_RULE : "",
    answerLanguageLine(answerLanguage),
    DEPTH_LINE[tuning.webSearchDepth],
    domainsLine(settings),
    customBlock(settings),
    CLAIMS_JSON_SPEC,
  ]);
}

export function reviewUserPrompt(
  ctx: PromptContext & { answerText: string; answerProvider: ProviderId },
): string {
  const label = PROVIDER_LABEL[ctx.answerProvider];
  return [
    `The question that was asked:\n<<<\n${ctx.question}\n>>>`,
    ...(ctx.transcript ? [transcriptBlock(ctx.transcript)] : []),
    `The answer from ${label} to check:\n<<<\n${ctx.answerText}\n>>>`,
  ].join("\n\n");
}
