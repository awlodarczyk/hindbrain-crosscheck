import { z } from "zod";

const annotationSchema = z
  .object({ type: z.string(), url: z.string().nullish(), title: z.string().nullish() })
  .passthrough();

const contentSchema = z
  .object({
    type: z.string(),
    text: z.string().nullish(),
    annotations: z.array(annotationSchema).nullish(),
  })
  .passthrough();

const outputItemSchema = z
  .object({ type: z.string(), content: z.array(contentSchema).nullish() })
  .passthrough();

export const openAIResponseSchema = z.object({
  id: z.string().optional(),
  model: z.string(),
  output_text: z.string().nullish(),
  status: z.string().nullish(),
  incomplete_details: z.object({ reason: z.string().nullish() }).nullish(),
  output: z.array(outputItemSchema),
  usage: z
    .object({ input_tokens: z.number().optional(), output_tokens: z.number().optional() })
    .nullish(),
  error: z.object({ message: z.string().optional() }).passthrough().nullish(),
});

export const openAIErrorSchema = z.object({
  error: z.object({ message: z.string().optional() }).passthrough().nullish(),
});

export type OpenAIResponse = z.infer<typeof openAIResponseSchema>;
