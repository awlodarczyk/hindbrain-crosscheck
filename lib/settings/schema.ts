import { z } from "zod";

const connection = z.enum(["cli", "api"]).default("api");

export const SettingsSchema = z.object({
  answerLanguage: z.enum(["auto", "en", "pl"]).default("auto"),
  providers: z
    .object({
      claude: z
        .object({
          connection,
          answerModel: z.string().default("claude-opus-5-5"),
          verificationModel: z.string().nullable().default(null),
        })
        .default({}),
      chatgpt: z
        .object({
          connection,
          answerModel: z.string().default("gpt-5.5"),
          verificationModel: z.string().nullable().default("gpt-5.5-mini"),
        })
        .default({}),
    })
    .default({}),
  reasoningEffort: z.enum(["low", "medium", "high", "max"]).default("high"),
  tuning: z
    .object({
      customInstructions: z.string().max(1000).default(""),
      answerStyle: z.enum(["concise", "balanced", "thorough"]).default("balanced"),
      temperature: z.number().min(0).max(1).default(0.2),
      webSearchMax: z.number().int().min(0).max(20).default(8),
      webSearchDepth: z.enum(["quick", "standard", "deep"]).default("standard"),
      preferredDomains: z
        .array(z.string().regex(/^[a-z0-9.-]+\.[a-z]{2,}$/i))
        .max(20)
        .default([]),
      fewShot: z
        .array(z.object({ question: z.string().max(2000), answer: z.string().max(4000) }))
        .max(5)
        .default([]),
    })
    .default({}),
  verification: z
    .object({
      strictness: z.enum(["lenient", "standard", "strict"]).default("strict"),
      requireSourcePerClaim: z.boolean().default(true),
      rerunOnDisagreement: z.boolean().default(false),
    })
    .default({}),
  cost: z
    .object({
      maxSearchesPerCall: z.number().int().min(0).max(20).default(8),
      timeoutSeconds: z.number().int().min(30).max(900).default(300),
    })
    .default({}),
  appearance: z
    .object({
      theme: z.enum(["light", "dark", "system"]).default("system"),
      reduceMotion: z.boolean().default(false),
    })
    .default({}),
});

export type Settings = z.infer<typeof SettingsSchema>;
