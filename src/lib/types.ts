export type Tier = "standard" | "whitelabel";

export const TIERS: Record<Tier, { name: string; price: number; label: string }> = {
  standard: { name: "Agency Report", price: 9900, label: "$99" },
  whitelabel: { name: "Agency Report + White Label", price: 14900, label: "$149" },
};

export type Platform = "OpenAI" | "Gemini" | "Perplexity";

export type QueryResult = {
  question: string;
  platform: Platform;
  answer: string;
  brandMentioned: boolean;
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

export type OrderStatus = "pending" | "processing" | "complete" | "failed";