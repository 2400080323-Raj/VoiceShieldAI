import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  ShieldCheck,
  ShieldAlert,
  ShieldX,
  Mic,
  PhoneCall,
  Activity,
  AudioWaveform,
  Fingerprint,
  Gauge,
  CircleAlert,
  Ban,
  BadgeCheck,
  ScanLine,
  Radio,
  Play,
  Pause,
  X,
} from "lucide-react";
import {
  DEMO_SCENARIOS,
  computeRisk,
  formatINR,
  type AnalysisResult,
  type DemoScenario,
  type RiskLevel,
} from "@/lib/voiceshield";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "VoiceShield — AI Voice Deepfake Fraud Prevention" },
      {
        name: "description",
        content:
          "VoiceShield detects voice-cloning and AI-generated impersonation during sensitive calls, then turns voice authenticity into an actionable ALLOW / VERIFY / BLOCK decision.",
      },
      { property: "og:title", content: "VoiceShield — AI Voice Deepfake Fraud Prevention" },
      {
        property: "og:description",
        content:
          "Real-time anti-spoofing for phone and VoIP calls. Wav2Vec2 detection, acoustic + prosody analysis, and a risk engine that blocks fraudulent transactions.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

const PIPELINE_STEPS = [
  { icon: PhoneCall, label: "Incoming Call" },
  { icon: Mic, label: "Capture Voice" },
  { icon: AudioWaveform, label: "Wav2Vec2 Anti-Spoofing" },
  { icon: Activity, label: "Acoustic + Prosody" },
  { icon: Fingerprint, label: "Context + Risk Engine" },
  { icon: ShieldCheck, label: "Verdict" },
];

const RISK_BADGE: Record<RiskLevel, string> = {
  LOW: "bg-risk-low/10 text-risk-low",
  MEDIUM: "bg-risk-medium/10 text-risk-medium",
  HIGH: "bg-risk-high/10 text-risk-high",
  CRITICAL: "bg-risk-critical/10 text-risk-critical",
};

function seedLog(): AnalysisResult[] {
  const now = Date.now();
  return DEMO_SCENARIOS.map((s, i) => makeResult(s, new Date(now - (i + 1) * 1000 * 60 * 14)));
}

function makeResult(s: DemoScenario, timestamp: Date): AnalysisResult {
  const { risk, action } = computeRisk(s.spoofProbability, s.transactionAmount);
  return {
    id: Math.random().toString(36).slice(2, 8).toUpperCase(),
    callerName: s.callerName,
    callerRole: s.callerRole,
    spoofProbability: s.spoofProbability,
    transactionAmount: s.transactionAmount,
    durationSec: s.durationSec,
    acousticScore: s.acousticScore,
    prosodyScore: s.prosodyScore,
    spectralScore: s.spectralScore,
    risk,
    action,
    timestamp,
    note: s.note,
  };
}

interface PendingAudio {
  file: File;
  url: string;
  peaks: number[];
  sampleRate: number;
  channels: number;
  durationSec: number;
}

function Index() {
  const [log, setLog] = useState<AnalysisResult[]>(seedLog);
  const [analyzing, setAnalyzing] = useState(false);
  const [step, setStep] = useState(0);
  const [current, setCurrent] = useState<AnalysisResult | null>(null);
  const [displaySpoof, setDisplaySpoof] = useState(0);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [pending, setPending] = useState<PendingAudio | null>(null);
  const [playing, setPlaying] = useState(false);
  const timerRef = useRef<number | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const clearPending = useCallback(() => {
    setPending((p) => {
      if (p) URL.revokeObjectURL(p.url);
      return null;
    });
    setPlaying(false);
    audioRef.current?.pause();
  }, []);

  const loadPending = useCallback(
    async (file: File) => {
      setUploadError(null);
      clearPending();
      try {
        const bytes = await file.arrayBuffer();
        const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        const buf = await new Ctx().decodeAudioData(bytes);
        const data = buf.getChannelData(0);
        const N = 96;
        const peaks: number[] = [];
        const block = Math.max(1, Math.floor(data.length / N));
        for (let i = 0; i < N; i++) {
          let max = 0;
          const start = i * block;
          for (let j = start; j < Math.min(start + block, data.length); j += 16) {
            const v = Math.abs(data[j] ?? 0);
            if (v > max) max = v;
          }
          peaks.push(max);
        }
        const peakMax = Math.max(...peaks, 0.01);
        setPending({
          file,
          url: URL.createObjectURL(file),
          peaks: peaks.map((p) => p / peakMax),
          sampleRate: buf.sampleRate,
          channels: buf.numberOfChannels,
          durationSec: buf.duration,
        });
      } catch {
        setUploadError(`Could not decode "${file.name}" — unsupported or corrupted audio.`);
      }
    },
    [clearPending],
  );

  const runAnalysis = useCallback((scenario: DemoScenario) => {
    if (timerRef.current) window.clearInterval(timerRef.current);
    setAnalyzing(true);
    setCurrent(null);
    setStep(0);
    setDisplaySpoof(0);

    let s = 0;
    timerRef.current = window.setInterval(() => {
      s += 1;
      setStep(s);
      if (s >= PIPELINE_STEPS.length) {
        if (timerRef.current) window.clearInterval(timerRef.current);
        const result = makeResult(scenario, new Date());
        const start = performance.now();
        const tick = (t: number) => {
          const p = Math.min(1, (t - start) / 900);
          setDisplaySpoof(Math.round(scenario.spoofProbability * (1 - Math.pow(1 - p, 3))));
          if (p < 1) requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
        setCurrent(result);
        setAnalyzing(false);
        setLog((prev) => [result, ...prev].slice(0, 8));
      }
    }, 650);
  }, []);

  const runUploadedAudio = useCallback(async (file: File) => {
    setUploadError(null);
    clearPending();
    if (timerRef.current) window.clearInterval(timerRef.current);
    setAnalyzing(true);
    setCurrent(null);
    setStep(2);
    try {
      const form = new FormData();
      form.append("audio", file);
      const res = await fetch("/api/analyze", { method: "POST", body: form });
      const data = (await res.json()) as Record<string, number | string>;
      if (!res.ok) throw new Error(String(data["error"] ?? "Analysis failed"));

      const scenario: DemoScenario = {
        label: file.name,
        callerName: "Uploaded sample",
        callerRole: file.name,
        spoofProbability: Number(data["spoofProbability"]),
        acousticScore: Number(data["acousticScore"]),
        prosodyScore: Number(data["prosodyScore"]),
        spectralScore: Number(data["spectralScore"]),
        transactionAmount: 0,
        durationSec: 0,
        note:
          data["source"] === "model"
            ? "Scores returned by the connected anti-spoofing model."
            : "Placeholder scorer — set MODEL_API_URL to connect your model.",
      };
      let s = 2;
      timerRef.current = window.setInterval(() => {
        s += 1;
        setStep(s);
        if (s >= PIPELINE_STEPS.length) {
          if (timerRef.current) window.clearInterval(timerRef.current);
          const result = makeResult(scenario, new Date());
          const start = performance.now();
          const tick = (t: number) => {
            const p = Math.min(1, (t - start) / 900);
            setDisplaySpoof(Math.round(scenario.spoofProbability * (1 - Math.pow(1 - p, 3))));
            if (p < 1) requestAnimationFrame(tick);
          };
          requestAnimationFrame(tick);
          setCurrent(result);
          setAnalyzing(false);
          setLog((prev) => [result, ...prev].slice(0, 8));
        }
      }, 450);
    } catch (err) {
      setAnalyzing(false);
      setUploadError(err instanceof Error ? err.message : "Analysis failed");
    }
  }, [clearPending]);

  useEffect(
    () => () => {
      if (timerRef.current) window.clearInterval(timerRef.current);
      setPending((p) => {
        if (p) URL.revokeObjectURL(p.url);
        return null;
      });
    },
    [],
  );

  const blocked = log.filter((r) => r.action === "BLOCK").length;
  const verified = log.filter((r) => r.action === "VERIFY").length;
  const exposureBlocked = log
    .filter((r) => r.action === "BLOCK")
    .reduce((sum, r) => sum + r.transactionAmount, 0);

  return (
    <main className="min-h-screen bg-background text-foreground">
      {/* Header */}
      <header className="sticky top-0 z-20 border-b border-border bg-card/80 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3 sm:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-primary/10">
              <ShieldCheck className="h-5 w-5 text-primary" />
            </div>
            <div className="min-w-0">
              <p className="truncate font-display text-base font-semibold tracking-tight">
                VoiceShield
              </p>
              <p className="text-xs text-muted-foreground">
                Voice authenticity → fraud decision
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 rounded-full bg-risk-low/10 px-3 py-1.5">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-risk-low opacity-50" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-risk-low" />
            </span>
            <span className="text-xs font-medium text-risk-low">Live monitoring</span>
          </div>
        </div>
      </header>

      {/* Hero band */}
      <section className="border-b border-border bg-card">
        <div className="relative mx-auto max-w-6xl px-4 py-10 sm:px-6 sm:py-14">
          <div className="flex flex-col gap-8 lg:flex-row lg:items-center lg:justify-between">
            <div className="max-w-xl">
              <p className="text-xs font-medium text-primary">AI voice-clone firewall</p>
              <h1 className="mt-3 font-display text-3xl font-semibold leading-tight tracking-tight sm:text-4xl">
                Catch the cloned voice before the money moves.
              </h1>
              <p className="mt-4 text-sm leading-relaxed text-muted-foreground sm:text-base">
                A 5-second sample is enough to clone a CFO's voice. VoiceShield analyzes every sensitive
                call and converts voice authenticity into an actionable decision: ALLOW, VERIFY, or BLOCK.
              </p>
            </div>

            {/* Soft waveform illustration */}
            <div className="flex h-28 items-center justify-center gap-[3px] rounded-2xl bg-secondary/60 px-6 lg:w-80">
              {Array.from({ length: 32 }).map((_, i) => {
                const h = 20 + Math.abs(Math.sin(i * 0.55)) * 80;
                return (
                  <span
                    key={i}
                    className="w-[3px] rounded-full bg-primary/30"
                    style={{ height: `${h}%` }}
                  />
                );
              })}
            </div>
          </div>
        </div>
      </section>

      <div className="mx-auto max-w-6xl space-y-6 px-4 py-6 sm:px-6">
        {/* Stat cards */}
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <StatCard icon={Radio} label="Calls analyzed" value={String(log.length + 1284)} tone="text-primary" />
          <StatCard icon={Ban} label="Fraud blocked" value={String(blocked + 37)} tone="text-risk-critical" />
          <StatCard icon={CircleAlert} label="Step-up verifications" value={String(verified + 12)} tone="text-risk-medium" />
          <StatCard icon={Gauge} label="Exposure prevented" value={formatINR(exposureBlocked + 48_200_000)} tone="text-risk-low" />
        </div>

        <div className="grid gap-6 lg:grid-cols-5">
          {/* Analysis console */}
          <section className="rounded-2xl card-soft p-5 lg:col-span-3">
            <div className="flex items-center justify-between gap-3">
              <h2 className="flex items-center gap-2 font-display text-sm font-medium text-muted-foreground">
                <ScanLine className="h-4 w-4 text-primary" /> Analysis console
              </h2>
              <span className="font-mono text-[11px] text-muted-foreground">wav2vec2-antispoof · v2.4</span>
            </div>

            {/* Scenario picker */}
            <div className="mt-4 grid gap-2 sm:grid-cols-2">
              {DEMO_SCENARIOS.map((s) => (
                <button
                  key={s.label}
                  onClick={() => runAnalysis(s)}
                  disabled={analyzing}
                  className="group rounded-xl border border-border bg-secondary/50 px-3 py-2.5 text-left text-xs transition-colors hover:border-primary/40 hover:bg-primary/[0.04] disabled:opacity-50"
                >
                  <span className="block font-medium text-foreground">{s.label}</span>
                  <span className="mt-0.5 block text-muted-foreground">
                    {formatINR(s.transactionAmount)} · spoof prior {s.spoofProbability}%
                  </span>
                </button>
              ))}
            </div>

            {/* Upload real audio */}
            <div className="mt-3">
              <input
                ref={fileRef}
                type="file"
                accept="audio/*"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) loadPending(f);
                  e.target.value = "";
                }}
              />
              <button
                onClick={() => fileRef.current?.click()}
                disabled={analyzing}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-3 py-2.5 text-xs font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
              >
                <Mic className="h-4 w-4" /> Select audio to analyze
              </button>
              {uploadError && <p className="mt-2 text-xs text-risk-critical">{uploadError}</p>}
            </div>

            {/* Pending audio preview */}
            {pending && (
              <div className="mt-3 rounded-2xl border border-border bg-secondary/30 p-3">
                <div className="flex items-center justify-between gap-2">
                  <p className="min-w-0 truncate font-mono text-xs text-foreground">{pending.file.name}</p>
                  <button
                    onClick={clearPending}
                    className="shrink-0 rounded-lg p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                    aria-label="Discard audio"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>

                <div className="mt-2 flex items-center gap-3">
                  <button
                    onClick={() => {
                      const el = audioRef.current;
                      if (!el) return;
                      if (playing) {
                        el.pause();
                      } else {
                        void el.play();
                      }
                    }}
                    className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-primary/10 text-primary transition-colors hover:bg-primary/20"
                    aria-label={playing ? "Pause" : "Play"}
                  >
                    {playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4 translate-x-[1px]" />}
                  </button>
                  <div className="flex h-12 flex-1 items-center gap-[2px] overflow-hidden">
                    {pending.peaks.map((p, i) => (
                      <span
                        key={i}
                        className={`w-full min-w-[2px] rounded-full ${playing ? "bg-primary" : "bg-primary/40"}`}
                        style={{ height: `${Math.max(6, p * 100)}%` }}
                      />
                    ))}
                  </div>
                </div>
                <audio
                  ref={audioRef}
                  src={pending.url}
                  onPlay={() => setPlaying(true)}
                  onPause={() => setPlaying(false)}
                  onEnded={() => setPlaying(false)}
                  className="hidden"
                />

                <div className="mt-2 flex flex-wrap gap-1.5 font-mono text-[10px]">
                  <span className="rounded-lg bg-card px-2 py-1 text-muted-foreground">
                    {(pending.sampleRate / 1000).toFixed(1)} kHz
                  </span>
                  <span className="rounded-lg bg-card px-2 py-1 text-muted-foreground">
                    {pending.durationSec.toFixed(2)} s
                  </span>
                  <span className="rounded-lg bg-card px-2 py-1 text-muted-foreground">
                    {pending.channels === 1 ? "mono" : `${pending.channels}ch`}
                  </span>
                  <span className="rounded-lg bg-card px-2 py-1 text-muted-foreground">
                    {(pending.file.size / 1024).toFixed(0)} KB
                  </span>
                  <span
                    className={`rounded-lg px-2 py-1 ${
                      pending.sampleRate < 16000
                        ? "bg-risk-medium/10 text-risk-medium"
                        : "bg-risk-low/10 text-risk-low"
                    }`}
                  >
                    {pending.sampleRate < 16000 ? "below 16 kHz model input" : "meets 16 kHz model input"}
                  </span>
                </div>

                <button
                  onClick={() => runUploadedAudio(pending.file)}
                  disabled={analyzing}
                  className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl border border-primary/30 bg-primary/5 px-3 py-2.5 text-xs font-medium text-primary transition-colors hover:bg-primary/10 disabled:opacity-50"
                >
                  <ScanLine className="h-4 w-4" /> Run analysis
                </button>
              </div>
            )}

            {/* Pipeline */}
            <div className="mt-6 grid grid-cols-3 gap-2 sm:grid-cols-6">
              {PIPELINE_STEPS.map((p, i) => {
                const active = analyzing && i === step;
                const done = (analyzing && i < step) || (!analyzing && current !== null);
                return (
                  <div
                    key={p.label}
                    className={`flex flex-col items-center gap-2 rounded-xl border px-2 py-3 text-center transition-all ${
                      active
                        ? "border-primary/40 bg-primary/[0.04]"
                        : done
                          ? "border-risk-low/30 bg-risk-low/[0.03]"
                          : "border-border bg-secondary/30 opacity-60"
                    }`}
                  >
                    <p.icon
                      className={`h-4 w-4 ${active ? "text-primary animate-pulse" : done ? "text-risk-low" : "text-muted-foreground"}`}
                    />
                    <span className="text-[10px] leading-tight text-muted-foreground">{p.label}</span>
                  </div>
                );
              })}
            </div>

            {/* Waveform animation */}
            <div className="mt-6 flex h-20 items-center justify-center gap-[3px] overflow-hidden rounded-2xl bg-secondary/40 px-4">
              {Array.from({ length: 64 }).map((_, i) => (
                <span
                  key={i}
                  className={`w-[3px] rounded-full ${analyzing ? "bg-primary/70 animate-waveform" : current ? (current.spoofProbability > 50 ? "bg-risk-critical/60" : "bg-risk-low/60") : "bg-muted"}`}
                  style={{
                    height: `${12 + Math.abs(Math.sin(i * 0.55)) * 60}%`,
                    animationDelay: analyzing ? `${(i % 12) * 0.07}s` : undefined,
                  }}
                />
              ))}
            </div>

            {/* Result */}
            {current && !analyzing && (
              <div className="mt-6 grid gap-4 sm:grid-cols-[auto_1fr]">
                <div className="flex flex-col items-center justify-center rounded-2xl border border-border bg-secondary/30 px-6 py-4">
                  <span className="text-[11px] text-muted-foreground">Synthetic voice probability</span>
                  <span
                    className={`mt-1 font-mono text-4xl font-semibold ${
                      current.spoofProbability > 60
                        ? "text-risk-critical"
                        : current.spoofProbability > 25
                          ? "text-risk-medium"
                          : "text-risk-low"
                    }`}
                  >
                    {displaySpoof}%
                  </span>
                </div>
                <div className="space-y-3">
                  <ScoreBar label="Acoustic authenticity" value={current.acousticScore} />
                  <ScoreBar label="Prosody naturalness" value={current.prosodyScore} />
                  <ScoreBar label="Spectral integrity" value={current.spectralScore} />
                </div>
              </div>
            )}

            {/* Verdict */}
            {current && !analyzing && (
              <div
                className={`mt-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl px-4 py-4 ${
                  current.action === "ALLOW"
                    ? "bg-risk-low/[0.06]"
                    : current.action === "VERIFY"
                      ? "bg-risk-medium/[0.06]"
                      : "bg-risk-critical/[0.06]"
                }`}
              >
                <div className="flex items-center gap-3">
                  {current.action === "ALLOW" ? (
                    <BadgeCheck className="h-8 w-8 text-risk-low" />
                  ) : current.action === "VERIFY" ? (
                    <ShieldAlert className="h-8 w-8 text-risk-medium" />
                  ) : (
                    <ShieldX className="h-8 w-8 text-risk-critical" />
                  )}
                  <div>
                    <p className="font-display text-lg font-semibold tracking-wide">
                      {current.action}
                      <span className={`ml-2 rounded-lg px-2 py-0.5 text-xs font-medium ${RISK_BADGE[current.risk]}`}>
                        {current.risk} RISK
                      </span>
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {current.action === "BLOCK"
                        ? "Transaction held · MFA + call-back to verified number required"
                        : current.action === "VERIFY"
                          ? "Step-up verification: one-time passphrase challenge issued"
                          : "Call continues · transaction may proceed"}
                    </p>
                  </div>
                </div>
                <p className="max-w-xs text-xs text-muted-foreground">{current.note}</p>
              </div>
            )}
          </section>

          {/* Call log */}
          <section className="rounded-2xl card-soft p-5 lg:col-span-2">
            <h2 className="flex items-center gap-2 font-display text-sm font-medium text-muted-foreground">
              <PhoneCall className="h-4 w-4 text-primary" /> Recent call decisions
            </h2>
            <ul className="mt-4 space-y-3">
              {log.map((r) => (
                <li key={r.id + r.timestamp.getTime()} className="rounded-xl border border-border bg-secondary/30 p-3">
                  <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-2">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{r.callerName}</p>
                      <p className="truncate text-xs text-muted-foreground">{r.callerRole}</p>
                    </div>
                    <span className={`shrink-0 rounded-lg px-2 py-0.5 text-[10px] font-medium ${RISK_BADGE[r.risk]}`}>
                      {r.action}
                    </span>
                  </div>
                  <div className="mt-2 flex items-center justify-between font-mono text-[11px] text-muted-foreground">
                    <span>
                      spoof <span className={r.spoofProbability > 50 ? "text-risk-critical" : "text-risk-low"}>{r.spoofProbability}%</span>
                    </span>
                    <span>{formatINR(r.transactionAmount)}</span>
                    <span>
                      {r.timestamp.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          </section>
        </div>

        {/* Risk policy strip */}
        <section className="rounded-2xl card-soft p-5">
          <h2 className="font-display text-sm font-medium text-muted-foreground">Risk engine policy</h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-4">
            {(
              [
                ["LOW", "Continue", "Authenticity within human range. Call proceeds normally.", "text-risk-low", "bg-risk-low/[0.04]"],
                ["MEDIUM", "Verify", "Step-up: one-time passphrase or verified-device push.", "text-risk-medium", "bg-risk-medium/[0.04]"],
                ["HIGH", "Alert", "Supervisor notified · transaction queued for manual review.", "text-risk-high", "bg-risk-high/[0.04]"],
                ["CRITICAL", "Block", "Action blocked · MFA + call-back to a number on file.", "text-risk-critical", "bg-risk-critical/[0.04]"],
              ] as const
            ).map(([level, action, desc, tone, box]) => (
              <div key={level} className={`rounded-xl p-4 ${box}`}>
                <p className={`text-sm font-semibold tracking-wide ${tone}`}>
                  {level} <span className="font-normal text-muted-foreground">→ {action}</span>
                </p>
                <p className="mt-2 text-xs leading-relaxed text-muted-foreground">{desc}</p>
              </div>
            ))}
          </div>
        </section>

        <footer className="pb-6 pt-2 text-center text-xs text-muted-foreground">
          VoiceShield · a security layer between voice communication and high-risk actions — telecom, VoIP, banking, government.
        </footer>
      </div>
    </main>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
  tone,
}: {
  icon: typeof Radio;
  label: string;
  value: string;
  tone: string;
}) {
  return (
    <div className="rounded-2xl card-soft p-4">
      <div className="flex items-center gap-2 text-muted-foreground">
        <Icon className={`h-4 w-4 ${tone}`} />
        <span className="text-[11px] font-medium">{label}</span>
      </div>
      <p className={`mt-2 font-mono text-2xl font-semibold ${tone}`}>{value}</p>
    </div>
  );
}

function ScoreBar({ label, value }: { label: string; value: number }) {
  const tone = value >= 70 ? "bg-risk-low" : value >= 40 ? "bg-risk-medium" : "bg-risk-critical";
  return (
    <div>
      <div className="flex justify-between text-[11px] text-muted-foreground">
        <span>{label}</span>
        <span className="font-mono">{value}/100</span>
      </div>
      <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-muted">
        <div className={`h-full rounded-full ${tone} transition-all duration-700`} style={{ width: `${value}%` }} />
      </div>
    </div>
  );
}
