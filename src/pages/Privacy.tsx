import { Header } from "@/components/Header";
import { useEffect } from "react";

const Privacy = () => {
  useEffect(() => {
    document.title = "Privacy Policy — RedditLens";
    window.scrollTo(0, 0);
  }, []);

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-1 container max-w-3xl py-16 px-4">
        <h1 className="text-3xl font-bold mb-2">Privacy Policy</h1>
        <p className="text-sm text-muted-foreground mb-8">Last updated: June 8, 2026</p>

        <div className="prose prose-invert prose-sm max-w-none space-y-6 text-muted-foreground [&_h2]:text-foreground [&_h2]:text-xl [&_h2]:font-semibold [&_h2]:mt-8 [&_h2]:mb-3 [&_h3]:text-foreground [&_h3]:text-base [&_h3]:font-medium [&_h3]:mt-4 [&_h3]:mb-2 [&_strong]:text-foreground [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:space-y-1">
          <p>
            RedditLens ("we", "us", "our") is operated by <strong>Sanzox</strong> (<a href="https://www.sanzox.com/" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">sanzox.com</a>). This Privacy Policy explains how we collect, use, and protect your information when you use our service at <strong>redditlens.cc</strong>.
          </p>

          <h2>1. Information We Collect</h2>
          <h3>Account Information</h3>
          <p>When you sign in with Google or email, we collect:</p>
          <ul>
            <li>Email address</li>
            <li>Display name</li>
            <li>Profile picture (if provided by Google)</li>
          </ul>

          <h3>Usage Data</h3>
          <ul>
            <li>Search keywords and topics you analyze</li>
            <li>IP address (for rate limiting and abuse prevention)</li>
            <li>Device fingerprint (a randomly generated anonymous ID stored in your browser)</li>
            <li>Timestamps of searches</li>
          </ul>

          <h3>Payment Information</h3>
          <p>
            Payments are processed by <strong>LemonSqueezy</strong>. We do not store credit card numbers or payment details on our servers. LemonSqueezy handles all payment data per their own <a href="https://www.lemonsqueezy.com/privacy" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">privacy policy</a>.
          </p>

          <h2>2. How We Use Your Information</h2>
          <ul>
            <li><strong>Provide the Service:</strong> Process your search queries, generate AI-powered reports, and display results.</li>
            <li><strong>Account Management:</strong> Authenticate your identity, manage subscriptions, and sync search history.</li>
            <li><strong>Rate Limiting:</strong> Enforce usage limits on free plans using IP address and device fingerprints.</li>
            <li><strong>Email Digests:</strong> If you opt in, send weekly email digests for tracked keywords.</li>
            <li><strong>Improvement:</strong> Analyze aggregated, anonymized usage patterns to improve our service.</li>
          </ul>

          <h2>3. Data Sharing</h2>
          <p>We do <strong>not</strong> sell your personal information. We share data only with:</p>
          <ul>
            <li><strong>Supabase</strong> — Database and authentication infrastructure</li>
            <li><strong>Fireworks AI</strong> — AI analysis processing (receives only Reddit post data and keywords, no personal info)</li>
            <li><strong>Serper</strong> — Search API to find relevant Reddit posts</li>
            <li><strong>LemonSqueezy</strong> — Payment processing</li>
            <li><strong>Vercel</strong> — Website hosting</li>
          </ul>

          <h2>4. Data Retention</h2>
          <ul>
            <li><strong>Account data:</strong> Retained while your account is active. You can delete your account by contacting us.</li>
            <li><strong>Search history:</strong> Stored for your convenience. You can delete individual entries from your dashboard.</li>
            <li><strong>Rate limit records:</strong> Automatically purged after 90 days.</li>
          </ul>

          <h2>5. Cookies & Local Storage</h2>
          <p>We use:</p>
          <ul>
            <li><strong>Supabase auth tokens</strong> (localStorage) — to keep you logged in</li>
            <li><strong>Device fingerprint</strong> (localStorage) — anonymous UUID for rate limiting</li>
            <li><strong>Search count</strong> (localStorage) — to display remaining free searches</li>
          </ul>
          <p>We do <strong>not</strong> use third-party tracking cookies or analytics.</p>

          <h2>6. Your Rights</h2>
          <p>You have the right to:</p>
          <ul>
            <li>Access your personal data</li>
            <li>Request correction or deletion of your data</li>
            <li>Export your search history</li>
            <li>Withdraw consent at any time</li>
            <li>Lodge a complaint with a data protection authority</li>
          </ul>

          <h2>7. Security</h2>
          <p>
            We implement industry-standard security measures including encrypted connections (HTTPS), row-level security (RLS) on all database tables, JWT authentication, and webhook signature verification.
          </p>

          <h2>8. Children's Privacy</h2>
          <p>
            RedditLens is not intended for users under 13 years of age. We do not knowingly collect data from children.
          </p>

          <h2>9. Changes to This Policy</h2>
          <p>
            We may update this Privacy Policy from time to time. Changes will be posted on this page with an updated "Last updated" date.
          </p>

          <h2>10. Contact Us</h2>
          <p>
            For privacy-related questions, contact us at:{" "}
            <a href="mailto:shakib@redditlens.app" className="text-primary hover:underline">
              shakib@redditlens.app
            </a>
          </p>
        </div>
      </main>
    </div>
  );
};

export default Privacy;
