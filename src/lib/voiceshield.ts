export type RiskLevel = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
export type Action = "ALLOW" | "VERIFY" | "BLOCK";

export interface AnalysisResult {
  id: string;
  callerName: string;
  callerRole: string;
  spoofProbability: number; // 0-100
  transactionAmount: number; // INR
  durationSec: number;
  risk: RiskLevel;
  action: Action;
  acousticScore: number;
  prosodyScore: number;
  spectralScore: number;
  timestamp: Date;
  note: string;
}

export function formatINR(n: number) {
  return "₹" + n.toLocaleString("en-IN");
}

export function computeRisk(spoof: number, amount: number): { risk: RiskLevel; action: Action } {
  // Risk engine: combine spoof probability with transaction exposure
  const amountScore = amount >= 2_000_000 ? 40 : amount >= 500_000 ? 25 : amount >= 100_000 ? 12 : 5;
  const combined = spoof * 0.65 + amountScore;
  if (combined >= 70) return { risk: "CRITICAL", action: "BLOCK" };
  if (combined >= 45) return { risk: "HIGH", action: "BLOCK" };
  if (combined >= 22) return { risk: "MEDIUM", action: "VERIFY" };
  return { risk: "LOW", action: "ALLOW" };
}

export const RISK_STYLES: Record<RiskLevel, string> = {
  LOW: "text-risk-low",
  MEDIUM: "text-risk-medium",
  HIGH: "text-risk-high",
  CRITICAL: "text-risk-critical",
};

export interface DemoScenario {
  label: string;
  callerName: string;
  callerRole: string;
  spoofProbability: number;
  transactionAmount: number;
  durationSec: number;
  acousticScore: number;
  prosodyScore: number;
  spectralScore: number;
  note: string;
}

export const DEMO_SCENARIOS: DemoScenario[] = [
  {
    label: "Genuine CFO — routine ₹2L",
    callerName: "Ananya Deshmukh",
    callerRole: "CFO, Meridian Group",
    spoofProbability: 8,
    transactionAmount: 200_000,
    durationSec: 47,
    acousticScore: 96,
    prosodyScore: 93,
    spectralScore: 95,
    note: "Natural micro-pauses and breathing patterns detected. Spectral artifacts within human range.",
  },
  {
    label: "Cloned CFO — urgent ₹25L",
    callerName: "Ananya Deshmukh (suspected clone)",
    callerRole: "CFO, Meridian Group",
    spoofProbability: 94,
    transactionAmount: 2_500_000,
    durationSec: 31,
    acousticScore: 22,
    prosodyScore: 18,
    spectralScore: 11,
    note: "Neural vocoder fingerprints detected. Unnatural prosody flatness on stressed syllables.",
  },
  {
    label: "Unknown caller — ₹75L transfer",
    callerName: "Unknown (+91 98XXX XX210)",
    callerRole: "Claims: Vendor, Axis Logistics",
    spoofProbability: 61,
    transactionAmount: 7_500_000,
    durationSec: 52,
    acousticScore: 48,
    prosodyScore: 41,
    spectralScore: 37,
    note: "Partial synthetic segments detected. Possible replay attack or voice conversion pipeline.",
  },
  {
    label: "Board member — verbal approval",
    callerName: "Rohan Iyer",
    callerRole: "Board Member",
    spoofProbability: 29,
    transactionAmount: 850_000,
    durationSec: 64,
    acousticScore: 74,
    prosodyScore: 71,
    spectralScore: 69,
    note: "Borderline acoustic variance. Poor call quality may be masking natural features.",
  },
];
