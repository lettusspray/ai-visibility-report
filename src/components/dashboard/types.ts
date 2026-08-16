export type SnapshotRow = {
  id: string;
  status: string;
  progress_message: string | null;
  report_json: unknown;
  brand_visibility: number | null;
  competitor_visibility: unknown;
  platform_stats: unknown;
  question_count: number | null;
  created_at: string;
  completed_at: string | null;
  error_message: string | null;
  access_token: string | null;
};

export type CompetitorVis = { name: string; visibility: number };
export type PlatformBreakdown = {
  platform: string;
  brandVisibility: number;
  competitorVisibility: CompetitorVis[];
  summary: string;
  exampleExcerpts: { question: string; excerpt: string }[];
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

export type ReportJson = {
  executiveSummary?: string;
  brandVisibility?: number;
  competitorVisibility?: CompetitorVis[];
  platforms?: PlatformBreakdown[];
  whyLosing?: string[];
  actionItems?: { title: string; detail: string; impact: string }[];
  closingNote?: string;
  productVisibility?: ProductVisibility[];
  keywordVisibility?: KeywordVisibility[];
  sentiment?: SentimentStats;
};

export type AnswerRow = {
  question: string;
  region?: string | null;
  platform: string;
  answer: string;
  brandMentioned: boolean;
  cited: boolean;
  competitorsMentioned: string[];
  engine?: string;
  sources?: string[];
  keyword?: string | null;
  productsMentioned?: string[];
  sentiment?: { label: "positive" | "neutral" | "negative"; reason?: string } | null;
  error?: string;
};
