import { Link } from "react-router-dom";
import { Navbar } from "@/components/Navbar";
import { useAuth } from "@/hooks/useAuth";
import { Gamepad2, Trophy, Sparkles, Users, Clock, ArrowUpRight } from "lucide-react";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PlayDialog } from "@/components/PlayDialog";

interface MatchRow {
  id: string;
  game_type: "cricket" | "ludo";
  winner_id: string | null;
  created_at: string;
  duration_seconds: number | null;
}

const games = [
  {
    id: "cricket" as const,
    title: "Cricket",
    description: "Timing-based shots, 3 & 20 over modes.",
    players: "2 players",
    gradient: "gradient-cricket",
  },
  {
    id: "ludo" as const,
    title: "Ludo",
    description: "Classic rules, polished animations.",
    players: "2 – 4 players",
    gradient: "gradient-ludo",
  },
];

const Dashboard = () => {
  const { profile, user } = useAuth();
  const [recent, setRecent] = useState<MatchRow[]>([]);

  useEffect(() => {
    if (!user) return;
    supabase
      .from("match_history")
      .select("id, game_type, winner_id, created_at, duration_seconds")
      .order("created_at", { ascending: false })
      .limit(5)
      .then(({ data }) => setRecent((data ?? []) as MatchRow[]));
  }, [user]);

  const stats = [
    { label: "Rating", value: profile?.rating ?? 1000, icon: Sparkles },
    { label: "Wins", value: profile?.wins ?? 0, icon: Trophy },
    { label: "Played", value: profile?.games_played ?? 0, icon: Gamepad2 },
  ];

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="container py-10">
        {/* Welcome */}
        <div className="mb-10 animate-fade-in-up">
          <p className="text-sm text-muted-foreground font-medium">Welcome back</p>
          <h1 className="font-display text-4xl md:text-5xl font-bold mt-1">
            {profile?.display_name || profile?.username || "Player"} 👋
          </h1>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-4 mb-10">
          {stats.map((s) => (
            <div key={s.label} className="bg-card rounded-2xl p-5 shadow-card flex items-center gap-4">
              <div className="h-11 w-11 rounded-xl bg-accent text-accent-foreground flex items-center justify-center">
                <s.icon className="h-5 w-5" />
              </div>
              <div>
                <div className="text-2xl font-display font-bold">{s.value}</div>
                <div className="text-xs text-muted-foreground uppercase tracking-wider font-medium">{s.label}</div>
              </div>
            </div>
          ))}
        </div>

        {/* Games */}
        <div className="mb-10">
          <div className="flex items-end justify-between mb-5">
            <h2 className="font-display text-2xl font-bold">Choose a game</h2>
            <span className="text-xs text-muted-foreground">More games coming soon</span>
          </div>
          <div className="grid sm:grid-cols-2 gap-5">
            {games.map((g) => (
              <PlayDialog
                key={g.id}
                game={g.id}
                trigger={
                  <button
                    className="group relative text-left rounded-3xl overflow-hidden shadow-card hover:shadow-elev transition-spring hover:-translate-y-1 w-full"
                  >
                    <div className={`${g.gradient} aspect-[5/3] p-7 flex flex-col justify-between relative`}>
                      <div className="absolute inset-0 opacity-20" style={{ backgroundImage: "radial-gradient(circle at 80% 20%, white, transparent 50%)" }} />
                      <div className="relative flex items-start justify-between">
                        <span className="text-xs font-google font-medium px-2.5 py-1 rounded-full bg-white/25 text-white backdrop-blur-sm">
                          {g.players}
                        </span>
                      </div>
                      <div className="relative text-white">
                        <h3 className="font-display text-3xl font-bold">{g.title}</h3>
                        <p className="text-white/85 text-sm mt-1">{g.description}</p>
                        <div className="mt-4 inline-flex items-center gap-1 text-sm font-medium opacity-0 group-hover:opacity-100 transition-smooth">
                          Open lobby <ArrowUpRight className="h-4 w-4" />
                        </div>
                      </div>
                    </div>
                  </button>
                }
              />
            ))}
          </div>
        </div>

        {/* Recent matches */}
        <div className="bg-card rounded-2xl shadow-card p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-display text-xl font-bold">Recent matches</h2>
            <Link to="/profile" className="text-sm text-primary font-medium hover:underline">View all</Link>
          </div>
          {recent.length === 0 ? (
            <div className="py-12 text-center">
              <div className="h-14 w-14 rounded-full bg-accent text-accent-foreground flex items-center justify-center mx-auto mb-3">
                <Users className="h-6 w-6" />
              </div>
              <p className="text-muted-foreground text-sm">No matches yet — play your first game!</p>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {recent.map((m) => (
                <div key={m.id} className="py-3 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`h-9 w-9 rounded-lg flex items-center justify-center ${m.game_type === "cricket" ? "gradient-cricket" : "gradient-ludo"}`}>
                      <Gamepad2 className="h-4 w-4 text-white" />
                    </div>
                    <div>
                      <div className="font-medium capitalize">{m.game_type}</div>
                      <div className="text-xs text-muted-foreground">
                        {new Date(m.created_at).toLocaleDateString()}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Clock className="h-3 w-3" />
                    {m.duration_seconds ? `${Math.round(m.duration_seconds / 60)}m` : "—"}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
};

export default Dashboard;
