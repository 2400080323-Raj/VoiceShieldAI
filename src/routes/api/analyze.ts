import { createFileRoute } from "@tanstack/react-router";

// VoiceShield analysis endpoint.
// POST multipart/form-data with an `audio` file field.
// Returns { spoofProbability, acousticScore, prosodyScore, spectralScore } (0-100).
//
// Integration point for your model:
//   Set MODEL_API_URL (and optionally MODEL_API_KEY) as a project secret and this
//   route will forward the audio to your hosted model, expecting the same JSON
//   shape back. Until then a deterministic placeholder scorer runs so the full
//   pipeline can be exercised end-to-end.

interface ModelScores {
  spoofProbability: number;
  acousticScore: number;
  prosodyScore: number;
  spectralScore: number;
}

const MAX_BYTES = 20 * 1024 * 1024; // 20 MB
const ACCEPTED = ["audio/", "video/webm", "application/octet-stream"];

function clamp(n: number) {
  return Math.max(0, Math.min(100, Math.round(n)));
}

// Placeholder scorer: derives stable pseudo-scores from the audio bytes so the
// UI works before a real model is connected. Replace by setting MODEL_API_URL.
function placeholderScore(bytes: Uint8Array): ModelScores {
  let h1 = 0;
  let h2 = 0;
  let h3 = 0;
  const stride = Math.max(1, Math.floor(bytes.length / 4096));
  for (let i = 0; i < bytes.length; i += stride) {
    const b = bytes[i] ?? 0;
    h1 = (h1 * 31 + b) >>> 0;
    h2 = (h2 * 17 + b * (i % 7)) >>> 0;
    h3 = (h3 + b * b) >>> 0;
  }
  const spoofProbability = clamp((h1 % 100) * 0.6 + (bytes.length % 40));
  return {
    spoofProbability,
    acousticScore: clamp(100 - spoofProbability + (h2 % 21) - 10),
    prosodyScore: clamp(100 - spoofProbability + (h3 % 21) - 10),
    spectralScore: clamp(100 - spoofProbability + ((h1 ^ h2) % 21) - 10),
  };
}

async function callHostedModel(bytes: Uint8Array, mime: string, apiUrl: string): Promise<ModelScores> {
  const form = new FormData();
  form.append("audio", new Blob([bytes as unknown as BlobPart], { type: mime }), "clip");
  const headers: Record<string, string> = {};
  const key = process.env["MODEL_API_KEY"];
  if (key) headers["Authorization"] = `Bearer ${key}`;
  const res = await fetch(apiUrl, { method: "POST", headers, body: form });
  if (!res.ok) throw new Error(`Model API responded ${res.status}`);
  const data = (await res.json()) as Partial<ModelScores>;
  for (const k of ["spoofProbability", "acousticScore", "prosodyScore", "spectralScore"] as const) {
    if (typeof data[k] !== "number") throw new Error(`Model API response missing ${k}`);
  }
  return {
    spoofProbability: clamp(data.spoofProbability!),
    acousticScore: clamp(data.acousticScore!),
    prosodyScore: clamp(data.prosodyScore!),
    spectralScore: clamp(data.spectralScore!),
  };
}

export const Route = createFileRoute("/api/analyze")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        let form: FormData;
        try {
          form = await request.formData();
        } catch {
          return Response.json({ error: "Expected multipart/form-data" }, { status: 400 });
        }
        const file = form.get("audio");
        if (!(file instanceof File) || file.size === 0) {
          return Response.json({ error: "Missing audio file field 'audio'" }, { status: 400 });
        }
        if (file.size > MAX_BYTES) {
          return Response.json({ error: "Audio too large (max 20 MB)" }, { status: 413 });
        }
        if (!ACCEPTED.some((p) => file.type.startsWith(p))) {
          return Response.json({ error: `Unsupported audio type: ${file.type}` }, { status: 415 });
        }

        const bytes = new Uint8Array(await file.arrayBuffer());
        const apiUrl = process.env["MODEL_API_URL"];
        try {
          const scores = apiUrl ? await callHostedModel(bytes, file.type, apiUrl) : placeholderScore(bytes);
          return Response.json({
            ...scores,
            source: apiUrl ? "model" : "placeholder",
            durationMs: null,
          });
        } catch (err) {
          console.error(err);
          return Response.json({ error: "Analysis failed" }, { status: 502 });
        }
      },
    },
  },
});
