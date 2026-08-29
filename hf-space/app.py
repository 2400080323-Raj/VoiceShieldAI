# HuggingFace Space entrypoint for your Wav2Vec2 anti-spoofing model.
# API contract expected by the VoiceShield dashboard (/api/analyze):
#   POST /analyze  (multipart/form-data, field name: "audio")
#   → JSON: { "spoofProbability": 0-100, "acousticScore": 0-100,
#             "prosodyScore": 0-100, "spectralScore": 0-100 }
#
# Only step you must do: paste your existing model loading + prediction
# into the two marked sections below.

import io
import numpy as np
import soundfile as sf
from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI(title="VoiceShield Anti-Spoofing Model")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["POST"],
    allow_headers=["*"],
)

# ── 1. LOAD YOUR MODEL HERE (runs once at startup) ──────────────────────────
# Example:
#   from transformers import Wav2Vec2ForSequenceClassification, AutoFeatureExtractor
#   extractor = AutoFeatureExtractor.from_pretrained("your/checkpoint")
#   model = Wav2Vec2ForSequenceClassification.from_pretrained("your/checkpoint")
model = None
extractor = None
# ─────────────────────────────────────────────────────────────────────────────

TARGET_SR = 16000


def predict_spoof_probability(waveform: np.ndarray, sr: int) -> float:
    # ── 2. CALL YOUR MODEL HERE ─────────────────────────────────────────────
    # Return the probability (0.0–1.0) that the voice is synthetic/cloned.
    # Example:
    #   inputs = extractor(waveform, sampling_rate=sr, return_tensors="pt")
    #   logits = model(**inputs).logits
    #   return float(torch.softmax(logits, dim=-1)[0, 1])  # spoof class
    raise NotImplementedError("Wire your model into predict_spoof_probability()")
    # ─────────────────────────────────────────────────────────────────────────


def clamp(x: float) -> float:
    return max(0.0, min(100.0, round(x, 1)))


@app.post("/analyze")
async def analyze(audio: UploadFile = File(...)):
    raw = await audio.read()
    if not raw:
        raise HTTPException(400, "Empty audio file")
    try:
        waveform, sr = sf.read(io.BytesIO(raw), dtype="float32")
    except Exception:
        raise HTTPException(415, f"Could not decode audio ({audio.content_type})")
    if waveform.ndim > 1:
        waveform = waveform.mean(axis=1)  # stereo → mono
    if sr != TARGET_SR:
        # simple resample; swap in librosa.resample / torchaudio if preferred
        n = int(len(waveform) * TARGET_SR / sr)
        waveform = np.interp(
            np.linspace(0, len(waveform) - 1, n), np.arange(len(waveform)), waveform
        )
        sr = TARGET_SR

    spoof_prob = predict_spoof_probability(waveform, sr)  # 0..1
    spoof = clamp(spoof_prob * 100)

    # Derive component scores from the spoof signal plus simple signal stats.
    # Replace with per-branch model outputs if your model provides them.
    rms = float(np.sqrt(np.mean(waveform**2)) + 1e-8)
    zcr = float(np.mean(np.abs(np.diff(np.signbit(waveform)))))
    base = 100 - spoof
    return {
        "spoofProbability": spoof,
        "acousticScore": clamp(base + (rms * 40 - 5)),
        "prosodyScore": clamp(base + (zcr * 30 - 8)),
        "spectralScore": clamp(base - 3),
    }


@app.get("/")
def health():
    return {"status": "ok", "model_loaded": model is not None}
