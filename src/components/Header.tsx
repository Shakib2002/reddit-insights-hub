import { Link } from "react-router-dom";
import { ThemeToggle } from "./ThemeToggle";

export const Header = () => (
  <header className="border-b border-border">
    <div className="container flex h-16 items-center justify-between">
      <Link to="/" className="flex items-center gap-2">
        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground font-bold">
          R
        </div>
        <span className="text-lg font-semibold tracking-tight">RedditLens</span>
      </Link>
      <ThemeToggle />
    </div>
  </header>
);
