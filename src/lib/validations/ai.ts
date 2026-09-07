import { z } from "zod";
import { GeminiModelOption } from "@/types";

export const geminiModelSchema = z.enum([
  "gemini-3.7-flash",
  "gemini-3.5-flash",
  "gemini-3.5-flash-lite",
  "gemini-3.1-pro-preview",
  "gemini-2.5-flash",
] as const satisfies readonly [GeminiModelOption, ...GeminiModelOption[]]);

export const aiSettingsSchema = z.object({
  apiKey: z.string().trim(),
  model: geminiModelSchema.default("gemini-3.7-flash"),
});

export type AiSettingsInput = z.infer<typeof aiSettingsSchema>;
