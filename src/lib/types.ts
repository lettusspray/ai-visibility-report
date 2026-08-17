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
    blurb: "One snapshot a month so you can see where you stand — no card required.",
    reportsPerMonth: 1,
    softCapPerMonth: 1,
    maxQuestions: 5,
    customQuestions: false,
    trendHistory: false,
    whiteLabelText: false,
    whiteLabelLogo: false,
    priorityQueue: false,
    features: [
      "1 snapshot per month",
      "5 buyer-intent questions per snapshot",
      "ChatGPT, Gemini and Perplexity coverage",
      "Brand mention and citation tracking",
      "Sentiment analysis with per-engine breakdown",
      "PDF export and shareable link",
      "Mercercroft branding on exports",
    ],
  },
  starter: {
    id: "starter",
    name: "Starter",
    priceUsd: 99,
    blurb: "Unlimited snapshots, the full question library, trend history and white-label reports.",
    reportsPerMonth: Number.POSITIVE_INFINITY,
    softCapPerMonth: 300,
    maxQuestions: 75,
    customQuestions: true,
    trendHistory: true,
    whiteLabelText: true,
    whiteLabelLogo: false,
    priorityQueue: false,
    features: [
      "Unlimited snapshots",
      "75 questions per snapshot plus your own custom questions",
      "ChatGPT, Gemini, Perplexity and DeepSeek coverage",
      "Product map, keyword visibility and sentiment tracking",
      "Brand Brain context for sharper analysis",
      "Trend history — The Forecast view",
      "White-label PDF: your agency name on the cover",
      "Region tags on tracked questions",
      "CSV export from the Explore tab",
    ],
  },
  pro: {
    id: "pro",
    name: "Pro",
    priceUsd: 149,
    blurb: "Everything in Starter, fully white-labeled with your logo and priority queue.",
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
      "Full white-label: your logo on the cover and PDF",
      "Priority generation queue — snapshots run first",
      "Early access to new engine coverage",
      "Dedicated support",
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
  /** Browser-engine id (e.g. browser-chatgpt). */
  engine?: string;
  sources?: string[];
  keyword?: string | null;
  productsMentioned?: string[];
  sentiment?: { label: SentimentLabel; reason?: string } | null;
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
  productVisibility?: ProductVisibility[];
  keywordVisibility?: KeywordVisibility[];
  sentiment?: SentimentStats;
};

export type SnapshotStatus = "pending" | "processing" | "complete" | "failed";

export type SentimentLabel = "positive" | "neutral" | "negative";

export type BrandProduct = {
  id: string;
  brand_id: string;
  name: string;
  category: string | null;
  description: string | null;
  sort_order: number;
};

export type BrandFact = {
  id: string;
  brand_id: string;
  kind: "fact" | "messaging";
  content: string;
  source_url: string | null;
};

export type BrandKeyword = {
  id: string;
  brand_id: string;
  keyword: string;
  priority: number;
  active: boolean;
};

export type BrandBrain = {
  products: BrandProduct[];
  facts: BrandFact[];
  keywords: BrandKeyword[];
};

export type ProductVisibility = {
  product: string;
  category: string | null;
  visibility: number;
  byPlatform: { platform: string; visibility: number }[];
};

export type KeywordVisibility = {
  keyword: string;
  visibility: number;
  mentions: number;
  total: number;
};

export type SentimentStats = {
  overall: { positive: number; negative: number; neutral: number; sample: number };
  byPlatform: {
    platform: string;
    positive: number;
    negative: number;
    neutral: number;
    sample: number;
  }[];
};
