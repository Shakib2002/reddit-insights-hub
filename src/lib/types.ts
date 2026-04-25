export type ReportLanguage = "en" | "bn" | "both";

export interface PainPoint {
  title: string;
  description: string;
  source: string;
  signal: "High" | "Medium" | "Low";
  commercialIntent?: "High" | "Medium" | "Low";
  link?: string;
  sourceIndex?: number;
}

export interface Niche {
  niche: string;
  description: string;
  size: "Large" | "Medium" | "Small";
}

export interface Sentiment {
  positive: number;
  neutral: number;
  negative: number;
}

export interface CompetitorGap {
  gap: string;
  description: string;
  opportunity?: string;
}

export interface Persona {
  persona: string;
  pain: string;
  willingToPay?: "Yes" | "Maybe" | "No";
}

export interface Analysis {
  summary: string;
  ideaMatchScore: number;
  painPoints: PainPoint[];
  ideaValidation: { matchPercentage: number; reasons: string[] };
  competitorGaps: CompetitorGap[];
  firstUserPersonas: Persona[];
  recommendedSubreddits: string[];
  sentiment: Sentiment;
  sentimentSummary: string;
  niches: Niche[];
}

export interface SearchRationale {
  summary: string;
  topSignals: { signal: string; count: number }[];
  multiQueryHits: number;
  avgScore: number;
  totalQueries: number;
}

export interface RedditPost {
  title: string;
  snippet: string;
  link: string;
  subreddit: string;
  score: number;
}

export interface SearchInputs {
  keyword: string;
  appIdea: string;
  subreddit: string;
  numResults?: number;
  effectiveSubreddits?: string[];
  language?: ReportLanguage;
  rationale?: SearchRationale;
  redditPosts?: RedditPost[];
  totalFound?: number;
  serperOk?: boolean;
  debug?: {
    totalFound: number;
    queriesRun: number;
    apiKeySet: boolean;
    anySerperOk?: boolean;
    perQueryStatuses?: number[];
  };
}

export interface ResultsPayload {
  inputs: SearchInputs;
  analysis: Analysis;
}

export interface ComparePayload {
  mode: "compare";
  left: ResultsPayload;
  right: ResultsPayload;
}

export interface Blueprint {
  mvpFeatures: string[];
  techStack: string[];
  targetUser: string;
  revenueModel: string;
  timeToMVP: string;
  firstMilestone: string;
}

export interface ValidationDimension {
  name: string;
  score: number;
  verdict: string;
  evidence: string;
  redditQuote: string;
}

export interface Validation {
  overallScore: number;
  verdict: string;
  verdictReason: string;
  dimensions: ValidationDimension[];
  strengths: string[];
  weaknesses: string[];
  pivotSuggestions: string[];
  nextSteps: string[];
  redditEvidenceCount: number;
}

export interface ValidatePayload {
  mode: "validate";
  inputs: SearchInputs;
  validation: Validation;
}

export interface HistoryItem {
  id: string;
  keyword: string;
  timestamp: number;
  painScore: number;
  summary: string;
  payload: ResultsPayload | ValidatePayload;
  kind?: "search" | "validate";
}
