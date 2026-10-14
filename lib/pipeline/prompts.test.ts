import { describe, expect, it } from "vitest";
import { DEFAULT_SETTINGS } from "@/lib/settings/defaults";
import type { Settings } from "@/lib/settings/schema";
import {
  answerSystemPrompt,
  answerUserPrompt,
  reviewSystemPrompt,
  reviewUserPrompt,
} from "./prompts";
import { CLAIMS_JSON_SPEC, DEPTH_LINE, STRICTNESS_LINE, STYLE_LINE } from "./templates";

const question = "Does creatine help memory?";
const withSettings = (patch: {
  answerLanguage?: Settings["answerLanguage"];
  tuning?: Partial<Settings["tuning"]>;
  verification?: Partial<Settings["verification"]>;
}): Settings => ({
  ...DEFAULT_SETTINGS,
  answerLanguage: patch.answerLanguage ?? DEFAULT_SETTINGS.answerLanguage,
  tuning: { ...DEFAULT_SETTINGS.tuning, ...patch.tuning },
  verification: { ...DEFAULT_SETTINGS.verification, ...patch.verification },
});
const ctx = (settings: Settings) => ({ settings, question });
const reviewUser = (settings: Settings) =>
  reviewUserPrompt({ ...ctx(settings), answerText: "ANSWER BODY", answerProvider: "chatgpt" });

const allOutputs = (s: Settings) => [
  answerSystemPrompt(ctx(s)),
  answerUserPrompt(ctx(s)),
  reviewSystemPrompt(ctx(s)),
  reviewUser(s),
];

describe("snapshots for default settings", () => {
  it("answer system", () => expect(answerSystemPrompt(ctx(DEFAULT_SETTINGS))).toMatchSnapshot());
  it("answer user", () => expect(answerUserPrompt(ctx(DEFAULT_SETTINGS))).toMatchSnapshot());
  it("review system", () => expect(reviewSystemPrompt(ctx(DEFAULT_SETTINGS))).toMatchSnapshot());
  it("review user", () => expect(reviewUser(DEFAULT_SETTINGS)).toMatchSnapshot());
});

describe("settings knobs", () => {
  it("custom instructions appear once in answer and review system prompts", () => {
    const s = withSettings({ tuning: { customInstructions: "  ZZZ-MARKER  " } });
    for (const p of [answerSystemPrompt(ctx(s)), reviewSystemPrompt(ctx(s))]) {
      expect(p.split("ZZZ-MARKER")).toHaveLength(2);
    }
  });

  it("strictness lines", () => {
    const strict = withSettings({ verification: { strictness: "strict" } });
    const lenient = withSettings({ verification: { strictness: "lenient" } });
    expect(reviewSystemPrompt(ctx(strict))).toContain(STRICTNESS_LINE.strict);
    expect(reviewSystemPrompt(ctx(lenient))).not.toContain("Every number");
    expect(reviewSystemPrompt(ctx(lenient))).toContain(STRICTNESS_LINE.lenient);
  });

  it("language line", () => {
    const s = withSettings({ answerLanguage: "pl" });
    expect(answerSystemPrompt(ctx(s))).toContain("Answer in Polish.");
    expect(reviewSystemPrompt(ctx(s))).toContain("Answer in Polish.");
    expect(answerSystemPrompt(ctx(withSettings({ answerLanguage: "en" })))).toContain(
      "Answer in English.",
    );
    expect(answerSystemPrompt(ctx(DEFAULT_SETTINGS))).toContain(
      "Answer in the language of the question.",
    );
  });

  it("style and depth lines", () => {
    const s = withSettings({ tuning: { answerStyle: "thorough", webSearchDepth: "deep" } });
    expect(answerSystemPrompt(ctx(s))).toContain(STYLE_LINE.thorough);
    expect(answerSystemPrompt(ctx(s))).toContain(DEPTH_LINE.deep);
    expect(reviewSystemPrompt(ctx(s))).toContain(DEPTH_LINE.deep);
    const q = withSettings({ tuning: { answerStyle: "concise", webSearchDepth: "quick" } });
    expect(answerSystemPrompt(ctx(q))).toContain(STYLE_LINE.concise);
    expect(answerSystemPrompt(ctx(q))).toContain(DEPTH_LINE.quick);
  });

  it("preferred domains joined with comma", () => {
    const s = withSettings({ tuning: { preferredDomains: ["a.com", "b.org"] } });
    const line = "Prefer sources from these domains when relevant: a.com, b.org.";
    expect(answerSystemPrompt(ctx(s))).toContain(line);
    expect(reviewSystemPrompt(ctx(s))).toContain(line);
    expect(answerSystemPrompt(ctx(DEFAULT_SETTINGS))).not.toContain("Prefer sources from");
  });

  it("requireSourcePerClaim toggles the unverifiable rule", () => {
    const rule = "A claim without a source link must be marked unverifiable.";
    const on = withSettings({ verification: { requireSourcePerClaim: true } });
    const off = withSettings({ verification: { requireSourcePerClaim: false } });
    expect(reviewSystemPrompt(ctx(on))).toContain(rule);
    expect(reviewSystemPrompt(ctx(off))).not.toContain(rule);
  });

  it("few-shot pairs precede the question", () => {
    const s = withSettings({
      tuning: {
        fewShot: [
          { question: "Q1", answer: "A1" },
          { question: "Q2", answer: "A2" },
        ],
      },
    });
    const p = answerUserPrompt(ctx(s));
    expect(p.split("Example question:")).toHaveLength(3);
    expect(p).toContain("Ideal answer:\nA2");
    expect(p.endsWith(`Now answer this question:\n${question}`)).toBe(true);
    expect(answerUserPrompt(ctx(DEFAULT_SETTINGS))).toBe(question);
  });
});

describe("structure", () => {
  it("review user prompt embeds answer, question and provider label", () => {
    const p = reviewUser(DEFAULT_SETTINGS);
    expect(p).toContain("ANSWER BODY");
    expect(p).toContain(question);
    expect(p).toContain("The answer from ChatGPT to check:");
  });

  it("review system prompt ends with the JSON spec", () => {
    const p = reviewSystemPrompt(ctx(DEFAULT_SETTINGS));
    expect(p.endsWith(CLAIMS_JSON_SPEC)).toBe(true);
    expect(p).toContain('"verdict": "supported" | "disputed" | "partial" | "unverifiable"');
    expect(p).toContain("```json");
  });

  it("no undefined or trailing whitespace in any output", () => {
    const busy = withSettings({
      tuning: { customInstructions: "x", preferredDomains: ["a.com"] },
    });
    for (const s of [DEFAULT_SETTINGS, busy]) {
      for (const out of allOutputs(s)) {
        expect(out).not.toContain("undefined");
        expect(out).not.toMatch(/[ \t]+\n/);
        expect(out).not.toMatch(/\s$/);
      }
    }
  });
});

describe("transcript mode", () => {
  const t = {
    ...ctx(DEFAULT_SETTINGS),
    transcript: "User: is creatine safe?\nAssistant: Yes, always.",
  };
  it("answer prompts challenge the conversation instead of answering", () => {
    expect(answerSystemPrompt(t)).toContain("Challenge it");
    expect(answerSystemPrompt(t)).not.toContain("Answer reliably");
    expect(answerUserPrompt(t)).toBe(
      `Focus:\n${question}\n\nThe conversation to check:\n<<<\n${t.transcript}\n>>>`,
    );
  });
  it("review prompts carry the transcript and the misquote rule", () => {
    expect(reviewSystemPrompt(t)).toContain("misrepresents what the transcript says");
    const u = reviewUserPrompt({ ...t, answerText: "A", answerProvider: "claude" });
    expect(u).toContain(`The conversation to check:\n<<<\n${t.transcript}\n>>>`);
    expect(u.indexOf("conversation to check")).toBeLessThan(u.indexOf("The answer from Claude"));
  });
  it("few-shot examples are skipped with a transcript", () => {
    const s = withSettings({ tuning: { fewShot: [{ question: "Q1", answer: "A1" }] } });
    expect(answerUserPrompt({ ...t, settings: s })).not.toContain("Example question");
  });
});
