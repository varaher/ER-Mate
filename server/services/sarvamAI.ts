import FormData from "form-data";

const SARVAM_API_BASE = "https://api.sarvam.ai";

function getSarvamApiKey(): string | null {
  return process.env.SARVAM_AI_API_KEY || null;
}

export interface SarvamTranscriptionResult {
  transcript: string;
  language_code?: string;
}

export async function sarvamSpeechToText(
  audioBuffer: Buffer,
  filename: string,
  languageCode: string = "unknown"
): Promise<SarvamTranscriptionResult> {
  const apiKey = getSarvamApiKey();
  if (!apiKey) {
    throw new Error("Sarvam AI API key not configured");
  }

  const formData = new FormData();
  formData.append("file", audioBuffer, {
    filename: filename,
    contentType: getAudioMimeType(filename),
  });
  formData.append("model", "saaras:v3");
  formData.append("language_code", languageCode);
  formData.append("mode", "transcribe");

  const response = await fetch(`${SARVAM_API_BASE}/speech-to-text/transcribe`, {
    method: "POST",
    headers: {
      "api-subscription-key": apiKey,
      ...formData.getHeaders(),
    },
    body: formData.getBuffer(),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error("[Sarvam STT] Error:", response.status, errorText);
    throw new Error(`Sarvam STT failed: ${response.status} - ${errorText}`);
  }

  const result = await response.json() as SarvamTranscriptionResult;
  console.log("[Sarvam STT] Success, language:", result.language_code, "transcript length:", result.transcript?.length);
  return result;
}

export async function sarvamSpeechToTextTranslate(
  audioBuffer: Buffer,
  filename: string
): Promise<SarvamTranscriptionResult> {
  const apiKey = getSarvamApiKey();
  if (!apiKey) {
    throw new Error("Sarvam AI API key not configured");
  }

  const formData = new FormData();
  formData.append("file", audioBuffer, {
    filename: filename,
    contentType: getAudioMimeType(filename),
  });

  const response = await fetch(`${SARVAM_API_BASE}/speech-to-text/translate`, {
    method: "POST",
    headers: {
      "api-subscription-key": apiKey,
      ...formData.getHeaders(),
    },
    body: formData.getBuffer(),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error("[Sarvam STT Translate] Error:", response.status, errorText);
    throw new Error(`Sarvam STT translate failed: ${response.status} - ${errorText}`);
  }

  const result = await response.json() as SarvamTranscriptionResult;
  console.log("[Sarvam STT Translate] Success, language:", result.language_code);
  return result;
}

export interface SarvamDocParseResult {
  output: string;
  parsed_text?: string;
}

export async function sarvamParsePDF(
  pdfBuffer: Buffer,
  pageNumber: number = 1
): Promise<string> {
  const apiKey = getSarvamApiKey();
  if (!apiKey) {
    throw new Error("Sarvam AI API key not configured");
  }

  const formData = new FormData();
  formData.append("pdf", pdfBuffer, {
    filename: "document.pdf",
    contentType: "application/pdf",
  });
  formData.append("page_number", String(pageNumber));
  formData.append("sarvam_mode", "large");

  const response = await fetch(`${SARVAM_API_BASE}/parse/parsepdf`, {
    method: "POST",
    headers: {
      "api-subscription-key": apiKey,
      ...formData.getHeaders(),
    },
    body: formData.getBuffer(),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error("[Sarvam Parse] Error:", response.status, errorText);
    throw new Error(`Sarvam document parse failed: ${response.status} - ${errorText}`);
  }

  const result = await response.json() as SarvamDocParseResult;
  
  if (result.output) {
    try {
      const decoded = Buffer.from(result.output, "base64").toString("utf-8");
      return decoded;
    } catch {
      return result.output;
    }
  }

  return result.parsed_text || "";
}

export function isSarvamAvailable(): boolean {
  return !!getSarvamApiKey();
}

function getAudioMimeType(filename: string): string {
  const ext = filename.split(".").pop()?.toLowerCase() || "";
  const mimeMap: Record<string, string> = {
    mp3: "audio/mpeg",
    wav: "audio/wav",
    m4a: "audio/mp4",
    aac: "audio/aac",
    ogg: "audio/ogg",
    webm: "audio/webm",
    flac: "audio/flac",
    amr: "audio/amr",
    wma: "audio/x-ms-wma",
    opus: "audio/opus",
  };
  return mimeMap[ext] || "audio/mpeg";
}
