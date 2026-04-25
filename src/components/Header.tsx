import { Link } from "react-router-dom";
import { ThemeToggle } from "./ThemeToggle";
import { HistoryDrawer } from "./HistoryDrawer";

export const Header = () => (
  <header className="sticky top-0 z-40 bg-background/85 backdrop-blur-md border-b border-border print:hidden">
    <div className="container flex h-16 items-center justify-between">
      <Link to="/" className="flex items-center gap-2">
        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground font-bold">
          R
        </div>
        <span className="text-lg font-semibold tracking-tight">RedditLens</span>
      </Link>
      <div className="flex items-center gap-2">
        <HistoryDrawer />
        <ThemeToggle />
      </div>
    </div>
  </header>
);
