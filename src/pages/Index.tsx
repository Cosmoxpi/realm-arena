import { Link } from "react-router-dom";
import { Navbar } from "@/components/Navbar";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { ArrowRight, Gamepad2, Sparkles, Trophy, Users, Wifi, Zap } from "lucide-react";

const Index = () => {
  const { user } = useAuth();

  const features = [
    { icon: Wifi, title: "Real-time multiplayer", text: "Server-authoritative state with lag compensation and reconnects." },
    { icon: Sparkles, title: "Stunning visuals", text: "Polished animations and physics-based gameplay built for the web." },
    { icon: Trophy, title: "Ranked leaderboards", text: "Climb the ladder, track your stats, and beat your friends." },
    { icon: Users, title: "Private rooms", text: "Share a code and play instantly. No installs, no waiting." },
  ];

  return (
    <div className="min-h-screen bg-background">
      <Navbar />

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 gradient-mesh opacity-70 pointer-events-none" />
        <div className="container relative pt-20 pb-28 md:pt-32 md:pb-40">
          <div className="max-w-3xl mx-auto text-center animate-fade-in-up">
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-accent text-accent-foreground text-sm font-medium mb-6">
              <Zap className="h-3.5 w-3.5" />
              Built for real-time play
            </div>
            <h1 className="font-display text-5xl md:text-7xl font-bold tracking-tight mb-6">
              Play{" "}
              <span className="text-gradient">together,</span>
              <br />
              from anywhere.
            </h1>
            <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto mb-10">
              A modern multiplayer platform for Cricket and Ludo. Smooth networking, beautiful graphics, friends list, and ranked leaderboards.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Button asChild size="lg" className="rounded-full font-google font-medium h-12 px-8 shadow-glow">
                <Link to={user ? "/dashboard" : "/auth"}>
                  {user ? "Open dashboard" : "Get started — it's free"}
                  <ArrowRight className="ml-1 h-4 w-4" />
                </Link>
              </Button>
              <Button asChild size="lg" variant="outline" className="rounded-full h-12 px-8">
                <a href="#games">Explore games</a>
              </Button>
            </div>
          </div>

          {/* Floating game preview cards */}
          <div className="mt-20 grid sm:grid-cols-2 gap-6 max-w-3xl mx-auto" id="games">
            <div className="relative rounded-2xl overflow-hidden shadow-elev animate-float" style={{ animationDelay: "0s" }}>
              <div className="gradient-cricket aspect-[4/3] p-6 flex flex-col justify-between">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-google font-medium px-2.5 py-1 rounded-full bg-white/20 text-white backdrop-blur-sm">2 players</span>
                  <Gamepad2 className="h-5 w-5 text-white/80" />
                </div>
                <div className="text-white">
                  <h3 className="font-display text-3xl font-bold">Cricket</h3>
                  <p className="text-white/80 text-sm mt-1">Physics-based shots, 3 & 20 over modes</p>
                </div>
              </div>
            </div>
            <div className="relative rounded-2xl overflow-hidden shadow-elev animate-float" style={{ animationDelay: "0.5s" }}>
              <div className="gradient-ludo aspect-[4/3] p-6 flex flex-col justify-between">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-google font-medium px-2.5 py-1 rounded-full bg-white/20 text-white backdrop-blur-sm">2-4 players</span>
                  <Gamepad2 className="h-5 w-5 text-white/80" />
                </div>
                <div className="text-white">
                  <h3 className="font-display text-3xl font-bold">Ludo</h3>
                  <p className="text-white/80 text-sm mt-1">Classic rules, beautifully animated</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="py-24 bg-surface">
        <div className="container">
          <div className="text-center max-w-2xl mx-auto mb-16">
            <h2 className="font-display text-4xl md:text-5xl font-bold mb-4">Everything you need to play.</h2>
            <p className="text-muted-foreground text-lg">Designed for speed, polish, and pure fun.</p>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {features.map((f, i) => (
              <div
                key={f.title}
                className="bg-card rounded-2xl p-6 shadow-card hover:shadow-elev transition-spring hover:-translate-y-1"
                style={{ animationDelay: `${i * 80}ms` }}
              >
                <div className="h-11 w-11 rounded-xl bg-accent text-accent-foreground flex items-center justify-center mb-4">
                  <f.icon className="h-5 w-5" />
                </div>
                <h3 className="font-display font-semibold text-lg mb-1">{f.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{f.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-24">
        <div className="container">
          <div className="relative overflow-hidden rounded-3xl gradient-primary p-12 md:p-20 text-center shadow-elev">
            <div className="absolute inset-0 opacity-20" style={{ backgroundImage: "radial-gradient(circle at 30% 20%, white, transparent 50%)" }} />
            <div className="relative">
              <h2 className="font-display text-4xl md:text-5xl font-bold text-primary-foreground mb-4">Ready to play?</h2>
              <p className="text-primary-foreground/90 text-lg mb-8 max-w-xl mx-auto">
                Create your account and jump into a match in seconds.
              </p>
              <Button asChild size="lg" variant="secondary" className="rounded-full font-google font-medium h-12 px-8">
                <Link to={user ? "/dashboard" : "/auth"}>
                  {user ? "Open dashboard" : "Create free account"}
                  <ArrowRight className="ml-1 h-4 w-4" />
                </Link>
              </Button>
            </div>
          </div>
        </div>
      </section>

      <footer className="border-t border-border/60 py-8">
        <div className="container text-center text-sm text-muted-foreground">
          © {new Date().getFullYear()} PlayHub. Built with care.
        </div>
      </footer>
    </div>
  );
};

export default Index;
