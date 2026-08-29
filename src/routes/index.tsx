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
} from "lucide-react";
import heroWave from "@/assets/waveform-hero.jpg";
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
  LOW: "bg-risk-low/10 text-risk-low border-risk-low/40",
  MEDIUM: "bg-risk-medium/10 text-risk-medium border-risk-medium/40",
  HIGH: "bg-risk-high/10 text-risk-high border-risk-high/40",
  CRITICAL: "bg-risk-critical/10 text-risk-critical border-risk-critical/40",
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

function Index() {
  const [log, setLog] = useState<AnalysisResult[]>(seedLog);
  const [analyzing, setAnalyzing] = useState(false);
  const [step, setStep] = useState(0);
  const [current, setCurrent] = useState<AnalysisResult | null>(null);
  const [displaySpoof, setDisplaySpoof] = useState(0);
  const timerRef = useRef<number | null>(null);

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
        // animate the spoof probability gauge
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

  useEffect(() => () => {
    if (timerRef.current) window.clearInterval(timerRef.current);
  }, []);

  const blocked = log.filter((r) => r.action === "BLOCK").length;
  const verified = log.filter((r) => r.action === "VERIFY").length;
  const exposureBlocked = log
    .filter((r) => r.action === "BLOCK")
    .reduce((sum, r) => sum + r.transactionAmount, 0);

  return (
    <main className="min-h-screen bg-background text-foreground scanline">
      {/* Header */}
      <header className="border-b border-border bg-card/60 backdrop-blur sticky top-0 z-20">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <div className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-primary/15 border border-primary/40">
              <ShieldCheck className="h-5 w-5 text-primary" />
            </div>
            <div className="min-w-0">
              <p className="truncate text-base font-bold tracking-tight">
                Voice<span className="text-primary text-glow-primary">Shield</span>
              </p>
              <p className="text-[11px] uppercase tracking-widest text-muted-foreground">
                Voice authenticity → fraud decision
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 rounded-full border border-risk-low/40 bg-risk-low/10 px-3 py-1.5">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-risk-low opacity-60" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-risk-low" />
            </span>
            <span className="text-xs font-medium text-risk-low">Live monitoring</span>
          </div>
        </div>
      </header>

      {/* Hero band */}
      <section className="relative overflow-hidden border-b border-border">
        <img
          src={heroWave}
          alt="Audio waveform degrading into synthetic artifacts"
          width={1600}
          height={700}
          className="absolute inset-0 h-full w-full object-cover opacity-40"
        />
        <div className="absolute inset-0 bg-gradient-to-r from-background via-background/70 to-background/30" />
        <div className="relative mx-auto max-w-7xl px-4 py-10 sm:px-6 sm:py-14">
          <p className="text-xs font-semibold uppercase tracking-[0.25em] text-primary">
            AI voice-clone firewall
          </p>
          <h1 className="mt-3 max-w-2xl text-3xl font-bold leading-tight tracking-tight sm:text-5xl">
            Catch the cloned voice
            <span className="text-primary text-glow-primary"> before the money moves.</span>
          </h1>
          <p className="mt-4 max-w-xl text-sm text-muted-foreground sm:text-base">
            A 5-second sample is enough to clone a CFO's voice. VoiceShield analyzes every sensitive
            call and converts voice authenticity into an actionable decision: ALLOW, VERIFY, or BLOCK.
          </p>
        </div>
      </section>

      <div className="mx-auto max-w-7xl space-y-6 px-4 py-6 sm:px-6">
        {/* Stat cards */}
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <StatCard icon={Radio} label="Calls analyzed" value={String(log.length + 1284)} tone="text-primary" />
          <StatCard icon={Ban} label="Fraud blocked" value={String(blocked + 37)} tone="text-risk-critical" />
          <StatCard icon={CircleAlert} label="Step-up verifications" value={String(verified + 12)} tone="text-risk-medium" />
          <StatCard icon={Gauge} label="Exposure prevented" value={formatINR(exposureBlocked + 48_200_000)} tone="text-risk-low" />
        </div>

        <div className="grid gap-6 lg:grid-cols-5">
          {/* Analysis console */}
          <section className="rounded-xl border border-border bg-card p-5 card-glow lg:col-span-3">
            <div className="flex items-center justify-between gap-3">
              <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-widest text-muted-foreground">
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
                  className="group rounded-lg border border-border bg-background/60 px-3 py-2.5 text-left text-xs transition-colors hover:border-primary/60 hover:bg-primary/5 disabled:opacity-50"
                >
                  <span className="block font-medium text-foreground">{s.label}</span>
                  <span className="mt-0.5 block text-muted-foreground">
                    {formatINR(s.transactionAmount)} · spoof prior {s.spoofProbability}%
                  </span>
                </button>
              ))}
            </div>

            {/* Pipeline */}
            <div className="mt-6 grid grid-cols-3 gap-2 sm:grid-cols-6">
              {PIPELINE_STEPS.map((p, i) => {
                const active = analyzing && i === step;
                const done = (analyzing && i < step) || (!analyzing && current !== null);
                return (
                  <div
                    key={p.label}
                    className={`flex flex-col items-center gap-2 rounded-lg border px-2 py-3 text-center transition-all ${
                      active
                        ? "border-primary/60 bg-primary/10"
                        : done
                          ? "border-risk-low/40 bg-risk-low/5"
                          : "border-border bg-background/40 opacity-50"
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
            <div className="mt-6 flex h-20 items-center justify-center gap-[3px] rounded-lg border border-border bg-background/60 px-4 overflow-hidden">
              {Array.from({ length: 64 }).map((_, i) => (
                <span
                  key={i}
                  className={`w-[3px] rounded-full ${analyzing ? "bg-primary animate-waveform" : current ? (current.spoofProbability > 50 ? "bg-risk-critical/70" : "bg-risk-low/70") : "bg-muted"}`}
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
                <div className="flex flex-col items-center justify-center rounded-xl border border-border bg-background/60 px-6 py-4">
                  <span className="text-[11px] uppercase tracking-widest text-muted-foreground">
                    Synthetic voice probability
                  </span>
                  <span
                    className={`mt-1 font-mono text-5xl font-bold ${
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
                className={`mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border px-4 py-4 ${
                  current.action === "ALLOW"
                    ? "border-risk-low/50 bg-risk-low/10"
                    : current.action === "VERIFY"
                      ? "border-risk-medium/50 bg-risk-medium/10"
                      : "border-risk-critical/50 bg-risk-critical/10"
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
                    <p className="text-lg font-bold tracking-wide">
                      {current.action}
                      <span className={`ml-2 rounded border px-2 py-0.5 text-xs font-semibold ${RISK_BADGE[current.risk]}`}>
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
          <section className="rounded-xl border border-border bg-card p-5 card-glow lg:col-span-2">
            <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-widest text-muted-foreground">
              <PhoneCall className="h-4 w-4 text-primary" /> Recent call decisions
            </h2>
            <ul className="mt-4 space-y-3">
              {log.map((r) => (
                <li key={r.id + r.timestamp.getTime()} className="rounded-lg border border-border bg-background/50 p-3">
                  <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-2">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{r.callerName}</p>
                      <p className="truncate text-xs text-muted-foreground">{r.callerRole}</p>
                    </div>
                    <span className={`shrink-0 rounded border px-2 py-0.5 text-[10px] font-bold ${RISK_BADGE[r.risk]}`}>
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
        <section className="rounded-xl border border-border bg-card p-5 card-glow">
          <h2 className="text-sm font-semibold uppercase tracking-widest text-muted-foreground">Risk engine policy</h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-4">
            {(
              [
                ["LOW", "Continue", "Authenticity within human range. Call proceeds normally.", "text-risk-low", "border-risk-low/40 bg-risk-low/5"],
                ["MEDIUM", "Verify", "Step-up: one-time passphrase or verified-device push.", "text-risk-medium", "border-risk-medium/40 bg-risk-medium/5"],
                ["HIGH", "Alert", "Supervisor notified · transaction queued for manual review.", "text-risk-high", "border-risk-high/40 bg-risk-high/5"],
                ["CRITICAL", "Block", "Action blocked · MFA + call-back to a number on file.", "text-risk-critical", "border-risk-critical/40 bg-risk-critical/5"],
              ] as const
            ).map(([level, action, desc, tone, box]) => (
              <div key={level} className={`rounded-lg border p-4 ${box}`}>
                <p className={`text-sm font-bold tracking-wide ${tone}`}>
                  {level} <span className="text-muted-foreground font-normal">→ {action}</span>
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
    <div className="rounded-xl border border-border bg-card p-4 card-glow">
      <div className="flex items-center gap-2 text-muted-foreground">
        <Icon className={`h-4 w-4 ${tone}`} />
        <span className="text-[11px] uppercase tracking-widest">{label}</span>
      </div>
      <p className={`mt-2 font-mono text-2xl font-bold ${tone}`}>{value}</p>
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
      <div className="mt-1 h-2 overflow-hidden rounded-full bg-muted">
        <div className={`h-full rounded-full ${tone} transition-all duration-700`} style={{ width: `${value}%` }} />
      </div>
    </div>
  );
}
