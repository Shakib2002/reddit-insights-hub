import logoUrl from "@/assets/redditlens-logo.svg";
import { Heart } from "lucide-react";

export const Footer = () => {
  const year = new Date().getFullYear();
  return (
    <footer className="border-t border-border/80 bg-card/30 backdrop-blur-sm print:hidden mt-16">
      <div className="container py-8 flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <img src={logoUrl} alt="RedditLens" className="h-7 w-auto" />
          <span className="text-xs text-muted-foreground">© {year} RedditLens</span>
        </div>
        <p className="text-sm text-muted-foreground flex items-center gap-1.5">
          Made with <Heart className="h-3.5 w-3.5 fill-primary text-primary" aria-hidden /> by{" "}
          <a
            href="https://helloshakib.pro.bd/"
            target="_blank"
            rel="noopener noreferrer"
            className="font-semibold text-foreground hover:text-primary transition-colors underline-offset-4 hover:underline"
          >
            Shakibul Hasan Shakib
          </a>
        </p>
      </div>
    </footer>
  );
};
