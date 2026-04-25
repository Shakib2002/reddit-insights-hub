export interface PainPoint {
  title: string;
  description: string;
  source: string;
  signal: "High" | "Medium" | "Low";
}

export interface Analysis {
  summary: string;
  ideaMatchScore: number;
  painPoints: PainPoint[];
  ideaValidation: { matchPercentage: number; reasons: string[] };
  competitorGaps: { gap: string; description: string }[];
  firstUserPersonas: { persona: string; pain: string }[];
  recommendedSubreddits: string[];
}

export type ReportLanguage = "en" | "bn" | "both";

export interface SearchInputs {
  keyword: string;
  appIdea: string;
  subreddit: string;
  numResults?: number;
  effectiveSubreddits?: string[];
  language?: ReportLanguage;
}

export interface ResultsPayload {
  inputs: SearchInputs;
  analysis: Analysis;
}
