import type { ResultsPayload } from "./types";

export function reportToMarkdown(p: ResultsPayload): string {
  const { inputs, analysis } = p;
  const lines: string[] = [];
  lines.push(`# RedditLens Report — ${inputs.keyword}`);
  lines.push("");
  if (inputs.appIdea) lines.push(`**Idea:** ${inputs.appIdea}`);
  lines.push(`**Pain Score:** ${Math.round(analysis.ideaMatchScore)}/100`);
  lines.push(`**Posts Found:** ${inputs.totalFound ?? inputs.redditPosts?.length ?? 0}`);
  lines.push("");
  lines.push("## Summary");
  lines.push(analysis.summary || "_(no summary)_");
  lines.push("");
  lines.push(
    `## Sentiment\n- Positive: ${analysis.sentiment.positive}%\n- Neutral: ${analysis.sentiment.neutral}%\n- Negative: ${analysis.sentiment.negative}%`,
  );
  if (analysis.sentimentSummary) lines.push(`\n_${analysis.sentimentSummary}_`);
  lines.push("");
  lines.push("## Pain Points");
  for (const pp of analysis.painPoints) {
    lines.push(`### ${pp.title}  \`${pp.signal}\``);
    lines.push(pp.description);
    if (pp.link) lines.push(`[View on Reddit](${pp.link})`);
    lines.push("");
  }
  lines.push("## Competitor Gaps");
  for (const g of analysis.competitorGaps) {
    lines.push(`- **${g.gap}** — ${g.description}${g.opportunity ? ` _(Opportunity: ${g.opportunity})_` : ""}`);
  }
  lines.push("");
  lines.push("## Niche Opportunities");
  for (const n of analysis.niches) lines.push(`- **${n.niche}** \`${n.size}\` — ${n.description}`);
  lines.push("");
  lines.push("## Potential First Users");
  for (const u of analysis.firstUserPersonas) {
    lines.push(`- **${u.persona}** — ${u.pain}${u.willingToPay ? ` _(Pays: ${u.willingToPay})_` : ""}`);
  }
  lines.push("");
  if (analysis.recommendedSubreddits.length) {
    lines.push("## Recommended Subreddits");
    lines.push(analysis.recommendedSubreddits.map((s) => `r/${s.replace(/^r\//, "")}`).join(", "));
  }
  return lines.join("\n");
}

function csvEscape(v: unknown): string {
  const s = String(v ?? "");
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export function reportToCsv(p: ResultsPayload): string {
  const rows: string[][] = [
    ["Section", "Title", "Detail", "Signal/Size", "Link"],
  ];
  for (const pp of p.analysis.painPoints) {
    rows.push(["Pain Point", pp.title, pp.description, pp.signal, pp.link ?? ""]);
  }
  for (const g of p.analysis.competitorGaps) {
    rows.push(["Competitor Gap", g.gap, `${g.description}${g.opportunity ? " | " + g.opportunity : ""}`, "", ""]);
  }
  for (const n of p.analysis.niches) {
    rows.push(["Niche", n.niche, n.description, n.size, ""]);
  }
  for (const u of p.analysis.firstUserPersonas) {
    rows.push(["First User", u.persona, u.pain, u.willingToPay ?? "", ""]);
  }
  for (const post of p.inputs.redditPosts ?? []) {
    rows.push(["Evidence", post.title, post.snippet || "", String(post.score ?? ""), post.link]);
  }
  return rows.map((r) => r.map(csvEscape).join(",")).join("\n");
}

export function downloadFile(filename: string, content: string, mime: string) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, 0);
}

export function safeFilename(s: string): string {
  return s.replace(/[^a-z0-9-_]+/gi, "-").replace(/^-+|-+$/g, "").slice(0, 60) || "report";
}
