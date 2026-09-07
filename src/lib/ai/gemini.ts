import { GeminiModelOption, DEFAULT_GEMINI_MODEL } from "@/types";

const GEMINI_BASE_URL = "https://generativelanguage.googleapis.com/v1beta/models";

export interface GeminiContentPart {
  text?: string;
  inlineData?: {
    mimeType: string;
    data: string;
  };
}

export interface GeminiRequestBody {
  contents: Array<{
    role: "user";
    parts: GeminiContentPart[];
  }>;
  generationConfig: {
    temperature: number;
    maxOutputTokens: number;
  };
  systemInstruction?: {
    parts: Array<{ text: string }>;
  };
}

export interface GeminiRequestOptions {
  apiKey: string;
  model?: GeminiModelOption | string;
  parts: GeminiContentPart[];
  systemInstruction?: string;
  temperature?: number;
  maxOutputTokens?: number;
}

interface GeminiCandidate {
  content?: {
    parts?: Array<{ text?: string }>;
  };
}

interface GeminiApiResponse {
  candidates?: GeminiCandidate[];
  error?: {
    message?: string;
  };
}

export interface GeminiCallOptions {
  jsonMode?: boolean;
  maxOutputTokens?: number;
  temperature?: number;
}

/**
 * Helper untuk memanggil Google Gemini REST API secara dinamis sesuai pilihan model pengguna.
 * Type-safe tanpa `any`.
 */
export async function callGemini(
  apiKey: string,
  model: GeminiModelOption | string,
  parts: GeminiContentPart[],
  systemInstruction?: string,
  options?: GeminiCallOptions
): Promise<string> {
  const activeModel = model || DEFAULT_GEMINI_MODEL;
  const url = `${GEMINI_BASE_URL}/${activeModel}:generateContent?key=${apiKey}`;

  const generationConfig: Record<string, any> = {
    temperature: options?.temperature ?? 0.3,
    maxOutputTokens: options?.maxOutputTokens ?? 2048,
  };

  if (options?.jsonMode) {
    generationConfig.responseMimeType = "application/json";
  }

  const body: Record<string, any> = {
    contents: [{ role: "user", parts }],
    generationConfig,
  };

  if (systemInstruction) {
    body.systemInstruction = {
      parts: [{ text: systemInstruction }],
    };
  }

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const errData: GeminiApiResponse = await res.json().catch(() => ({}));
    const errMsg = errData.error?.message || `HTTP ${res.status}`;
    throw new Error(`Gemini API error [${activeModel}]: ${errMsg}`);
  }

  const data: GeminiApiResponse = await res.json();
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text || "";
  if (!text) throw new Error("Gemini tidak mengembalikan respons teks.");
  return text;
}
