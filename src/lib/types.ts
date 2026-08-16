export type PlanId = "free" | "starter" | "pro";

export type PlanDef = {
  id: PlanId;
  name: string;
  priceUsd: number;
  blurb: string;
  reportsPerMonth: number;
  softCapPerMonth: number;
  maxQuestions: number;
  customQuestions: boolean;
  trendHistory: boolean;
  whiteLabelText: boolean;
  whiteLabelLogo: boolean;
  priorityQueue: boolean;
  features: string[];
};

export const PLANS: Record<PlanId, PlanDef> = {
  free: {
    id: "free",
    name: "Free",
    priceUsd: 0,
    blurb: "One snapshot a month, so you can see the sky.",
    reportsPerMonth: 1,
    softCapPerMonth: 1,
    maxQuestions: 10,
    customQuestions: false,
    trendHistory: false,
    whiteLabelText: false,
    whiteLabelLogo: false,
    priorityQueue: false,
    features: [
      "Account required",
      "1 report per month",
      "Single snapshot — no trend history",
      "Base question set only",
      "Mercercroft branding on exports",
    ],
  },
  starter: {
    id: "starter",
    name: "Starter",
    priceUsd: 99,
    blurb: "Unlimited reports and the full forecast for one agency.",
    reportsPerMonth: Number.POSITIVE_INFINITY,
    softCapPerMonth: 300,
    maxQuestions: 75,
    customQuestions: true,
    trendHistory: true,
    whiteLabelText: true,
    whiteLabelLogo: false,
    priorityQueue: false,
    features: [
      "Unlimited reports",
      "Full question library plus your own custom questions",
      "Trend history — The Forecast view",
      "Text white-label: your agency name on the cover",
      "Region tags on tracked questions",
    ],
  },
  pro: {
    id: "pro",
    name: "Pro",
    priceUsd: 149,
    blurb: "Everything in Starter, fully branded and first in the queue.",
    reportsPerMonth: Number.POSITIVE_INFINITY,
    softCapPerMonth: 300,
    maxQuestions: 75,
    customQuestions: true,
    trendHistory: true,
    whiteLabelText: true,
    whiteLabelLogo: true,
    priorityQueue: true,
    features: [
      "Everything in Starter",
      "Full white-label including logo upload",
      "Priority generation queue",
      "Early access to new model coverage",
    ],
  },
};

export function planOf(value: string | null | undefined): PlanDef {
  return PLANS[(value as PlanId) ?? "free"] ?? PLANS.free;
}

export type QueryResult = {
  question: string;
  region?: string | null;
  platform: string;
  answer: string;
  brandMentioned: boolean;
  cited: boolean;
  competitorsMentioned: string[];
  error?: string;
};

export type PlatformBreakdown = {
  platform: string;
  brandVisibility: number;
  competitorVisibility: { name: string; visibility: number }[];
  summary: string;
  exampleExcerpts: { question: string; excerpt: string }[];
};

export type ReportData = {
  executiveSummary: string;
  brandVisibility: number;
  competitorVisibility: { name: string; visibility: number }[];
  platforms: PlatformBreakdown[];
  whyLosing: string[];
  actionItems: { title: string; detail: string; impact: string }[];
  closingNote: string;
};

export type SnapshotStatus = "pending" | "processing" | "complete" | "failed";
