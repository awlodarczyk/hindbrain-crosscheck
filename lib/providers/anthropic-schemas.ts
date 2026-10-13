import { z } from "zod";

const citationSchema = z
  .object({ url: z.string().optional(), title: z.string().nullish() })
  .passthrough();

const blockSchema = z
  .object({
    type: z.string(),
    text: z.string().optional(),
    citations: z.array(citationSchema).nullish(),
  })
  .passthrough();

export const anthropicResponseSchema = z.object({
  content: z.array(blockSchema),
  stop_reason: z.string().nullable(),
  model: z.string(),
  usage: z.object({ input_tokens: z.number(), output_tokens: z.number() }).partial().optional(),
});

export const anthropicErrorSchema = z.object({
  error: z.object({ message: z.string().optional() }).passthrough().optional(),
});

export type AnthropicBlock = z.infer<typeof blockSchema>;
export type AnthropicResponse = z.infer<typeof anthropicResponseSchema>;
export type AnthropicMessage = {
  role: "user" | "assistant";
  content: string | readonly AnthropicBlock[];
};
