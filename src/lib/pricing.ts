/**
 * Pricing plan configuration.
 * Update the `checkoutUrl` values after creating products in LemonSqueezy dashboard.
 */

export type PlanTier = "free" | "founder" | "pro" | "agency";

export interface PricingPlan {
  tier: PlanTier;
  name: string;
  price: string;
  priceNote?: string;
  features: string[];
  limits: {
    searchesPerDay: number;
    compareEnabled: boolean;
    competitorIntel: boolean;
    blueprint: boolean;
    csvExport: boolean;
    pdfExport: boolean;
    historySync: boolean;
    emailDigest: boolean;
  };
  /** LemonSqueezy checkout URL — update after creating products */
  checkoutUrl: string | null;
  popular?: boolean;
}

export const PLANS: PricingPlan[] = [
  {
    tier: "free",
    name: "Free",
    price: "$0",
    priceNote: "forever",
    features: [
      "3 searches per day",
      "Basic AI report",
      "Pain point detection",
      "Build or Skip verdict",
    ],
    limits: {
      searchesPerDay: 3,
      compareEnabled: false,
      competitorIntel: false,
      blueprint: false,
      csvExport: false,
      pdfExport: false,
      historySync: false,
      emailDigest: false,
    },
    checkoutUrl: null,
  },
  {
    tier: "founder",
    name: "Founder",
    price: "$2.99",
    priceNote: "/month",
    popular: true,
    features: [
      "Unlimited searches",
      "Full AI report with revenue models",
      "Search history sync",
      "Weekly email digest",
      "Priority AI processing",
    ],
    limits: {
      searchesPerDay: Infinity,
      compareEnabled: false,
      competitorIntel: false,
      blueprint: false,
      csvExport: false,
      pdfExport: false,
      historySync: true,
      emailDigest: true,
    },
    checkoutUrl: "https://sanzox.lemonsqueezy.com/checkout/buy/5d862ea2-4236-4f45-89b0-51feef96b13a",
  },
  {
    tier: "pro",
    name: "Pro",
    price: "$9.99",
    priceNote: "/month",
    features: [
      "Everything in Founder",
      "Compare mode (head-to-head)",
      "Competitor Intelligence",
      "MVP Blueprint generator",
      "CSV & PDF export",
    ],
    limits: {
      searchesPerDay: Infinity,
      compareEnabled: true,
      competitorIntel: true,
      blueprint: true,
      csvExport: true,
      pdfExport: true,
      historySync: true,
      emailDigest: true,
    },
    checkoutUrl: "https://sanzox.lemonsqueezy.com/checkout/buy/954690eb-26fa-41b8-98e2-070b806855c2",
  },
  {
    tier: "agency",
    name: "Agency",
    price: "$49",
    priceNote: "/month",
    features: [
      "Everything in Pro",
      "3 team seats",
      "API access",
      "White-label PDF reports",
      "Priority support",
    ],
    limits: {
      searchesPerDay: Infinity,
      compareEnabled: true,
      competitorIntel: true,
      blueprint: true,
      csvExport: true,
      pdfExport: true,
      historySync: true,
      emailDigest: true,
    },
    checkoutUrl: "https://sanzox.lemonsqueezy.com/checkout/buy/ccafb9a2-bce1-4884-9d19-ed8adfedc198",
  },
];

export function getPlan(tier: PlanTier): PricingPlan {
  return PLANS.find((p) => p.tier === tier) ?? PLANS[0];
}

export function canUseFeature(
  userTier: PlanTier,
  feature: keyof PricingPlan["limits"],
): boolean {
  const plan = getPlan(userTier);
  return !!plan.limits[feature];
}
