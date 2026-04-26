import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Gamepad2, LogOut, Trophy, User as UserIcon, Users } from "lucide-react";

export function Navbar() {
  const { user, profile, signOut } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const links = [
    { to: "/dashboard", label: "Play", icon: Gamepad2 },
    { to: "/leaderboard", label: "Leaderboard", icon: Trophy },
    { to: "/friends", label: "Friends", icon: Users },
  ];

  const initial = (profile?.display_name || profile?.username || user?.email || "P")
    .charAt(0)
    .toUpperCase();

  return (
    <header className="sticky top-0 z-50 glass border-b border-border/60">
      <div className="container flex h-16 items-center justify-between">
        <Link to={user ? "/dashboard" : "/"} className="flex items-center gap-2 group">
          <div className="relative h-9 w-9 rounded-xl gradient-primary flex items-center justify-center shadow-glow transition-spring group-hover:scale-110">
            <Gamepad2 className="h-5 w-5 text-primary-foreground" strokeWidth={2.5} />
          </div>
          <span className="font-display font-bold text-xl">
            Play<span className="text-gradient">Hub</span>
          </span>
        </Link>

        {user && (
          <nav className="hidden md:flex items-center gap-1">
            {links.map(({ to, label, icon: Icon }) => {
              const active = location.pathname === to;
              return (
                <Link
                  key={to}
                  to={to}
                  className={`px-4 py-2 rounded-full text-sm font-medium transition-smooth flex items-center gap-2 ${
                    active
                      ? "bg-accent text-accent-foreground"
                      : "text-muted-foreground hover:bg-secondary hover:text-foreground"
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  {label}
                </Link>
              );
            })}
          </nav>
        )}

        <div className="flex items-center gap-3">
          {user ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="rounded-full ring-google hover:shadow-md transition-smooth">
                  <Avatar className="h-9 w-9">
                    <AvatarImage src={profile?.avatar_url ?? undefined} />
                    <AvatarFallback className="gradient-primary text-primary-foreground font-semibold">
                      {initial}
                    </AvatarFallback>
                  </Avatar>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel>
                  <div className="flex flex-col">
                    <span className="font-semibold">{profile?.display_name || profile?.username}</span>
                    <span className="text-xs text-muted-foreground font-normal">{user.email}</span>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => navigate("/profile")}>
                  <UserIcon className="mr-2 h-4 w-4" /> Profile
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => navigate("/leaderboard")}>
                  <Trophy className="mr-2 h-4 w-4" /> Leaderboard
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={async () => { await signOut(); navigate("/"); }}>
                  <LogOut className="mr-2 h-4 w-4" /> Sign out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <Button onClick={() => navigate("/auth")} className="rounded-full font-google font-medium">
              Sign in
            </Button>
          )}
        </div>
      </div>
    </header>
  );
}
