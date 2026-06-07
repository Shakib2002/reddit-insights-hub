import { Link, useNavigate } from "react-router-dom";
import { HistoryDrawer } from "./HistoryDrawer";
import logoUrl from "@/assets/redditlens-logo.svg";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { LogIn, LogOut, User as UserIcon } from "lucide-react";

export const Header = () => {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();

  return (
    <header
      className="sticky top-0 z-50 backdrop-blur-xl border-b border-border/80 print:hidden"
      style={{ background: "rgba(10,10,11,0.8)" }}
    >
      <div className="container flex h-[72px] items-center justify-between">
        <Link to="/" className="flex items-center group" aria-label="RedditLens home">
          <img
            src={logoUrl}
            alt="RedditLens"
            className="h-9 xs:h-10 sm:h-12 md:h-14 w-auto max-w-[60vw] group-hover:scale-[1.03] transition-transform"
          />
        </Link>
        <div className="flex items-center gap-1.5">
          <HistoryDrawer />
          <Button
            variant="ghost"
            size="sm"
            className="gap-1 text-muted-foreground hover:text-primary hidden sm:inline-flex"
            onClick={() => navigate("/pricing")}
          >
            Pricing
          </Button>
          {user ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="gap-1.5 border-border/80 hover:border-primary/40 hover:text-primary" aria-label="Account menu">
                  <UserIcon className="h-4 w-4" />
                  <span className="hidden sm:inline max-w-[120px] truncate">
                    {user.email?.split("@")[0]}
                  </span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel className="text-xs text-muted-foreground font-normal truncate">
                  {user.email}
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={async () => {
                    await signOut();
                    navigate("/");
                  }}
                >
                  <LogOut className="h-4 w-4" /> Sign out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5 border-primary/50 text-primary hover:bg-primary hover:text-primary-foreground hover:border-primary"
              onClick={() => navigate("/auth")}
            >
              <LogIn className="h-4 w-4" />
              <span className="hidden sm:inline">Sign in</span>
            </Button>
          )}
        </div>
      </div>
    </header>
  );
};
