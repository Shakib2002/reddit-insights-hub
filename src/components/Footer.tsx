import logoUrl from "@/assets/redditlens-logo.svg";
import { Heart, ExternalLink } from "lucide-react";

export const Footer = () => {
  const year = new Date().getFullYear();
  return (
    <footer
      className="relative border-t border-border/60 print:hidden mt-20"
      style={{ background: "linear-gradient(180deg, transparent 0%, hsl(var(--card)/0.6) 100%)" }}
    >
      {/* top accent line */}
      <div className="absolute inset-x-0 top-0 h-px section-divider" aria-hidden />

      <div className="container py-10">
        <div className="flex flex-col md:flex-row items-center justify-between gap-6">
          {/* Brand */}
          <div className="flex items-center gap-3">
            <img src={logoUrl} alt="RedditLens" className="h-8 w-auto opacity-90" />
            <div className="hidden sm:flex flex-col leading-tight">
              <span className="text-xs text-muted-foreground">
                Discover what Reddit really wants
              </span>
              <span className="text-[11px] text-muted-foreground/70">
                © {year} RedditLens · All rights reserved
              </span>
            </div>
          </div>

          {/* Attribution */}
          <p className="text-sm text-muted-foreground flex items-center gap-1.5 flex-wrap justify-center">
            <span>Made with</span>
            <Heart
              className="h-3.5 w-3.5 fill-primary text-primary animate-pulse"
              aria-hidden
            />
            <span>by</span>
            <a
              href="https://www.sanzox.com/"
              target="_blank"
              rel="noopener noreferrer"
              className="group inline-flex items-center gap-1 font-semibold text-foreground hover:text-primary transition-colors"
            >
              <span className="border-b border-transparent group-hover:border-primary/60 transition-colors">
                Sanzox
              </span>
              <ExternalLink className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity" aria-hidden />
            </a>
          </p>
        </div>

        {/* Mobile-only year line */}
        <div className="mt-4 sm:hidden text-center text-[11px] text-muted-foreground/70">
          © {year} RedditLens · All rights reserved
        </div>
      </div>
    </footer>
  );
};
