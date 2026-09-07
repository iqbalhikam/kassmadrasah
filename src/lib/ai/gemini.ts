import { GeminiModelOption, DEFAULT_GEMINI_MODEL } from "@/types";

const GEMINI_BASE_URL = "https://generativelanguage.googleapis.com/v1beta/models";

export interface GeminiContentPart {
  text?: string;
  inlineData?: {
    mimeType: string;
    data: string;
  };
}

// --- NEW INTERFACE FOR GENERATION CONFIG ---
export interface GeminiGenerationConfig {
  temperature: number;
  maxOutputTokens: number;
  responseMimeType?: string; // Added for jsonMode
}

// --- UPDATED INTERFACE FOR REQUEST BODY ---
export interface GeminiRequestBody {
  contents: Array<{
    role: "user";
    parts: GeminiContentPart[];
  }>;
  generationConfig: GeminiGenerationConfig; // Using the new specific interface
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

  // --- REPLACEMENT 1: Using specific interface for generationConfig ---
  const generationConfig: GeminiGenerationConfig = {
    temperature: options?.temperature ?? 0.3,
    maxOutputTokens: options?.maxOutputTokens ?? 2048,
  };

  if (options?.jsonMode) {
    generationConfig.responseMimeType = "application/json";
  }

  // --- REPLACEMENT 2: Using specific interface for body ---
  const body: GeminiRequestBody = {
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
    let errData: GeminiApiResponse = {};
    // --- REPLACEMENT 3: Explicitly handling JSON parsing errors with try-catch ---
    try {
      errData = await res.json();
    } catch (error: unknown) {
      // If res.json() fails, it means the response was not valid JSON.
      // We log the error and proceed with an empty errData,
      // letting the errMsg fallback to HTTP status.
      console.error("Failed to parse error response JSON:", error);
    }
    const errMsg = errData.error?.message || `HTTP ${res.status}`;
    throw new Error(`Gemini API error [${activeModel}]: ${errMsg}`);
  }

  const data: GeminiApiResponse = await res.json();
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text || "";
  if (!text) throw new Error("Gemini tidak mengembalikan respons teks.");
  return text;
}
