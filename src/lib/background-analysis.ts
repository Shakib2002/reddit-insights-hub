/**
 * Background Analysis Manager
 * Runs analysis in the background even when user navigates away.
 * Stores results in sessionStorage and shows browser notification on completion.
 */

import { supabase } from "@/integrations/supabase/client";
import type { ResultsPayload, ComparePayload } from "@/lib/types";
import { saveToHistory, saveValidationToHistory } from "@/lib/history";
import { dbSaveSearch, dbSaveValidation } from "@/lib/db-history";
import { incrementDailySearchCount } from "@/lib/usage";

export type AnalysisStatus = "idle" | "fetching" | "analyzing" | "saving" | "done" | "error";

interface AnalysisState {
  status: AnalysisStatus;
  keyword: string;
  error?: string;
  startedAt?: number;
}

// Global state (persists across React component lifecycle)
let _state: AnalysisState = { status: "idle", keyword: "" };
let _listeners: Set<() => void> = new Set();

function notify() {
  _listeners.forEach((fn) => fn());
}

export function subscribeAnalysis(fn: () => void) {
  _listeners.add(fn);
  return () => _listeners.delete(fn);
}

export function getAnalysisState(): AnalysisState {
  return _state;
}

/** Request browser notification permission (call once on page load) */
export function requestNotificationPermission() {
  if ("Notification" in window && Notification.permission === "default") {
    Notification.requestPermission();
  }
}

function showBrowserNotification(title: string, body: string) {
  if ("Notification" in window && Notification.permission === "granted") {
    const n = new Notification(title, {
      body,
      icon: "/favicon.svg",
      tag: "redditlens-analysis",
    });
    n.onclick = () => {
      window.focus();
      n.close();
    };
  }
}

/**
 * Run a search in the background. Safe to call even if user navigates away.
 * Results are stored in sessionStorage. Browser notification is shown on completion.
 */
export async function runBackgroundSearch(opts: {
  keyword: string;
  appIdea: string;
  subreddit: string;
  numResults: number;
  includeAllContext: boolean;
  language: string;
  userId?: string;
  mode: "search" | "validate" | "compare";
  keyword2?: string;
  onStep?: (status: AnalysisStatus, detail?: string) => void;
}): Promise<void> {
  _state = { status: "fetching", keyword: opts.keyword, startedAt: Date.now() };
  notify();

  try {
    if (opts.mode === "validate") {
      await runValidateBackground(opts);
    } else if (opts.mode === "compare") {
      await runCompareBackground(opts);
    } else {
      await runSingleBackground(opts);
    }

    _state = { status: "done", keyword: opts.keyword };
    notify();

    // Show browser notification if user is on a different tab/page
    if (document.hidden) {
      showBrowserNotification(
        "✅ Analysis Complete!",
        `Your research for "${opts.keyword}" is ready. Click to view results.`
      );
    }
  } catch (e: any) {
    _state = { status: "error", keyword: opts.keyword, error: e.message };
    notify();

    if (document.hidden) {
      showBrowserNotification(
        "❌ Analysis Failed",
        `Research for "${opts.keyword}" encountered an error.`
      );
    }

    throw e; // Re-throw so the caller can handle it
  }
}

async function runSingleBackground(opts: any) {
  opts.onStep?.("fetching", `Searching for "${opts.keyword}"`);
  _state = { status: "fetching", keyword: opts.keyword, startedAt: _state.startedAt };
  notify();

  const { data: redditData, error: redditErr } = await supabase.functions.invoke("reddit-fetch", {
    body: {
      keyword: opts.keyword,
      subreddit: opts.subreddit,
      numResults: opts.numResults,
      includeAllContext: opts.includeAllContext,
    },
  });

  if (redditErr) {
    let msg = (redditErr as any).message ?? "Reddit fetch failed";
    try {
      const body = (redditErr as any).context?.body;
      if (body) {
        const parsed = typeof body === "string" ? JSON.parse(body) : body;
        msg = parsed?.error || msg;
      }
    } catch {}
    const err = new Error(msg);
    (err as any)._stage = "reddit";
    throw err;
  }

  const fetched = redditData?.results?.length ?? 0;
  opts.onStep?.("analyzing", `Analyzing top ${Math.min(fetched, 10)} posts with AI`);
  _state = { status: "analyzing", keyword: opts.keyword, startedAt: _state.startedAt };
  notify();

  const analyzeResults = (redditData?.results ?? []).slice(0, 10);
  const { data: analyzeData, error: analyzeErr } = await supabase.functions.invoke("analyze", {
    body: {
      results: analyzeResults,
      keyword: opts.keyword,
      appIdea: opts.appIdea,
      language: opts.language,
    },
  });

  if (analyzeErr) {
    let msg = analyzeErr.message;
    try {
      const body = (analyzeErr as any).context?.body;
      if (body) msg = JSON.parse(body).error || msg;
    } catch {}
    const err = new Error(msg);
    (err as any)._stage = "ai";
    throw err;
  }

  // Save results
  opts.onStep?.("saving", "Saving results...");
  _state = { status: "saving", keyword: opts.keyword, startedAt: _state.startedAt };
  notify();

  const payload: ResultsPayload = {
    inputs: {
      keyword: opts.keyword,
      appIdea: opts.appIdea,
      subreddit: opts.subreddit.replace(/^r\//, ""),
      numResults: opts.numResults,
      effectiveSubreddits: redditData?.effectiveSubreddits ?? [],
      language: opts.language,
      rationale: redditData?.rationale,
      redditPosts: redditData?.results ?? [],
      totalFound: Number(redditData?.totalFound ?? fetched),
      serperOk: redditData?.serperOk !== false,
      debug: redditData?.debug,
    },
    analysis: analyzeData.analysis,
  } as ResultsPayload;

  sessionStorage.setItem("redditlens_results", JSON.stringify(payload));
  saveToHistory(payload);
  if (opts.userId) {
    dbSaveSearch(opts.userId, payload).catch(() => {});
  }
  incrementDailySearchCount();
}

async function runValidateBackground(opts: any) {
  opts.onStep?.("fetching", `Searching for "${opts.keyword}"`);
  _state = { status: "fetching", keyword: opts.keyword, startedAt: _state.startedAt };
  notify();

  const { data: redditData, error: redditErr } = await supabase.functions.invoke("reddit-fetch", {
    body: {
      keyword: opts.keyword,
      subreddit: opts.subreddit,
      numResults: opts.numResults,
    },
  });

  if (redditErr) {
    let msg = (redditErr as any).message ?? "Reddit fetch failed";
    try {
      const body = (redditErr as any).context?.body;
      if (body) msg = (typeof body === "string" ? JSON.parse(body) : body)?.error || msg;
    } catch {}
    const err = new Error(msg);
    (err as any)._stage = "reddit";
    throw err;
  }

  opts.onStep?.("analyzing", "Running AI validation...");
  _state = { status: "analyzing", keyword: opts.keyword, startedAt: _state.startedAt };
  notify();

  const analyzeResults = (redditData?.results ?? []).slice(0, 10);
  const { data: analyzeData, error: analyzeErr } = await supabase.functions.invoke("analyze", {
    body: {
      results: analyzeResults,
      keyword: opts.keyword,
      appIdea: opts.appIdea,
      language: opts.language,
    },
  });

  if (analyzeErr) {
    let msg = analyzeErr.message;
    try {
      const body = (analyzeErr as any).context?.body;
      if (body) msg = JSON.parse(body).error || msg;
    } catch {}
    const err = new Error(msg);
    (err as any)._stage = "ai";
    throw err;
  }

  opts.onStep?.("saving", "Saving results...");
  _state = { status: "saving", keyword: opts.keyword, startedAt: _state.startedAt };
  notify();

  const payload = {
    inputs: {
      keyword: opts.keyword,
      appIdea: opts.appIdea,
      subreddit: opts.subreddit.replace(/^r\//, ""),
      numResults: opts.numResults,
      effectiveSubreddits: redditData?.effectiveSubreddits ?? [],
      language: opts.language,
      redditPosts: redditData?.results ?? [],
      totalFound: Number(redditData?.totalFound ?? (redditData?.results?.length ?? 0)),
      serperOk: redditData?.serperOk !== false,
    },
    analysis: analyzeData.analysis,
  };

  sessionStorage.setItem("redditlens_validate", JSON.stringify(payload));
  saveValidationToHistory(payload as any);
  if (opts.userId) {
    dbSaveValidation(opts.userId, payload as any).catch(() => {});
  }
  incrementDailySearchCount();
}

async function runCompareBackground(opts: any) {
  opts.onStep?.("fetching", "Searching both keywords...");
  _state = { status: "fetching", keyword: opts.keyword, startedAt: _state.startedAt };
  notify();

  const fetchBoth = await Promise.all([
    supabase.functions.invoke("reddit-fetch", {
      body: { keyword: opts.keyword, subreddit: opts.subreddit, numResults: opts.numResults, includeAllContext: opts.includeAllContext },
    }),
    supabase.functions.invoke("reddit-fetch", {
      body: { keyword: opts.keyword2, subreddit: opts.subreddit, numResults: opts.numResults, includeAllContext: opts.includeAllContext },
    }),
  ]);

  for (const { error } of fetchBoth) {
    if (error) {
      const err = new Error((error as any).message ?? "Reddit fetch failed");
      (err as any)._stage = "reddit";
      throw err;
    }
  }

  opts.onStep?.("analyzing", "Analyzing both topics...");
  _state = { status: "analyzing", keyword: opts.keyword, startedAt: _state.startedAt };
  notify();

  const analyzeBoth = await Promise.all([
    supabase.functions.invoke("analyze", {
      body: { results: (fetchBoth[0].data?.results ?? []).slice(0, 10), keyword: opts.keyword, appIdea: opts.appIdea, language: opts.language },
    }),
    supabase.functions.invoke("analyze", {
      body: { results: (fetchBoth[1].data?.results ?? []).slice(0, 10), keyword: opts.keyword2, appIdea: opts.appIdea, language: opts.language },
    }),
  ]);

  for (const { error } of analyzeBoth) {
    if (error) {
      const err = new Error((error as any).message ?? "AI analysis failed");
      (err as any)._stage = "ai";
      throw err;
    }
  }

  opts.onStep?.("saving", "Saving comparison...");
  _state = { status: "saving", keyword: opts.keyword, startedAt: _state.startedAt };
  notify();

  const makePayload = (rd: any, ad: any, kw: string): ResultsPayload => ({
    inputs: {
      keyword: kw,
      appIdea: opts.appIdea,
      subreddit: opts.subreddit.replace(/^r\//, ""),
      numResults: opts.numResults,
      effectiveSubreddits: rd?.effectiveSubreddits ?? [],
      language: opts.language,
      redditPosts: rd?.results ?? [],
      totalFound: Number(rd?.totalFound ?? (rd?.results?.length ?? 0)),
      serperOk: rd?.serperOk !== false,
    },
    analysis: ad.analysis,
  } as ResultsPayload);

  const left = makePayload(fetchBoth[0].data, analyzeBoth[0].data, opts.keyword);
  const right = makePayload(fetchBoth[1].data, analyzeBoth[1].data, opts.keyword2);

  const compare: ComparePayload = { mode: "compare", left, right };
  sessionStorage.setItem("redditlens_compare", JSON.stringify(compare));
  saveToHistory(left);
  saveToHistory(right);
  if (opts.userId) {
    dbSaveSearch(opts.userId, left).catch(() => {});
    dbSaveSearch(opts.userId, right).catch(() => {});
  }
  incrementDailySearchCount();
}
