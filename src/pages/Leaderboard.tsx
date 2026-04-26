import { Navbar } from "@/components/Navbar";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Trophy, Crown, Medal } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

interface Row {
  user_id: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
  rating: number;
  wins: number;
  games_played: number;
}

const Leaderboard = () => {
  const [rows, setRows] = useState<Row[] | null>(null);

  useEffect(() => {
    supabase
      .from("profiles")
      .select("user_id, username, display_name, avatar_url, rating, wins, games_played")
      .order("rating", { ascending: false })
      .limit(50)
      .then(({ data }) => setRows((data ?? []) as Row[]));
  }, []);

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="container py-10 max-w-3xl">
        <div className="text-center mb-8 animate-fade-in-up">
          <div className="inline-flex h-14 w-14 rounded-2xl gradient-primary items-center justify-center shadow-glow mb-4">
            <Trophy className="h-7 w-7 text-primary-foreground" />
          </div>
          <h1 className="font-display text-4xl font-bold">Leaderboard</h1>
          <p className="text-muted-foreground mt-1">Top players by rating</p>
        </div>

        <div className="bg-card rounded-3xl shadow-card overflow-hidden">
          {rows === null ? (
            <div className="p-6 space-y-3">
              {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-14 rounded-xl" />)}
            </div>
          ) : rows.length === 0 ? (
            <div className="py-16 text-center text-muted-foreground">No players yet — be the first!</div>
          ) : (
            <div className="divide-y divide-border">
              {rows.map((r, i) => {
                const initial = (r.display_name || r.username).charAt(0).toUpperCase();
                const rank = i + 1;
                return (
                  <div key={r.user_id} className="flex items-center gap-4 p-4 hover:bg-surface transition-smooth">
                    <RankBadge rank={rank} />
                    <Avatar className="h-10 w-10">
                      <AvatarImage src={r.avatar_url ?? undefined} />
                      <AvatarFallback className="gradient-primary text-primary-foreground font-semibold">{initial}</AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium truncate">{r.display_name || r.username}</div>
                      <div className="text-xs text-muted-foreground">@{r.username} · {r.wins}W · {r.games_played} played</div>
                    </div>
                    <div className="text-right">
                      <div className="font-display text-lg font-bold">{r.rating}</div>
                      <div className="text-[10px] text-muted-foreground uppercase tracking-wider">Rating</div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </main>
    </div>
  );
};

const RankBadge = ({ rank }: { rank: number }) => {
  if (rank === 1)
    return <div className="h-9 w-9 rounded-xl bg-google-yellow/20 text-google-yellow flex items-center justify-center"><Crown className="h-4 w-4" /></div>;
  if (rank === 2)
    return <div className="h-9 w-9 rounded-xl bg-muted text-muted-foreground flex items-center justify-center"><Medal className="h-4 w-4" /></div>;
  if (rank === 3)
    return <div className="h-9 w-9 rounded-xl bg-google-red/15 text-google-red flex items-center justify-center"><Medal className="h-4 w-4" /></div>;
  return <div className="h-9 w-9 rounded-xl bg-surface-2 text-muted-foreground flex items-center justify-center text-sm font-semibold">{rank}</div>;
};

export default Leaderboard;
