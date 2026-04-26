import { useEffect, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { Gamepad2, Loader2 } from "lucide-react";

const emailSchema = z.string().trim().email({ message: "Enter a valid email" }).max(255);
const passwordSchema = z.string().min(8, "Password must be at least 8 characters").max(72);
const usernameSchema = z
  .string()
  .trim()
  .min(3, "Username must be at least 3 characters")
  .max(20, "Username too long")
  .regex(/^[a-zA-Z0-9_]+$/, "Letters, numbers, underscores only");

const Auth = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [username, setUsername] = useState("");
  const [loading, setLoading] = useState(false);
  const [oauthLoading, setOauthLoading] = useState(false);

  useEffect(() => {
    if (user) navigate("/dashboard", { replace: true });
  }, [user, navigate]);

  const handleEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const e1 = emailSchema.safeParse(email);
      const p1 = passwordSchema.safeParse(password);
      if (!e1.success) return toast.error(e1.error.issues[0].message);
      if (!p1.success) return toast.error(p1.error.issues[0].message);

      setLoading(true);
      if (mode === "signup") {
        const u1 = usernameSchema.safeParse(username);
        if (!u1.success) { setLoading(false); return toast.error(u1.error.issues[0].message); }

        const { error } = await supabase.auth.signUp({
          email: e1.data,
          password: p1.data,
          options: {
            emailRedirectTo: `${window.location.origin}/dashboard`,
            data: { username: u1.data, display_name: u1.data },
          },
        });
        if (error) throw error;
        toast.success("Welcome to PlayHub! 🎮");
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email: e1.data,
          password: p1.data,
        });
        if (error) throw error;
        toast.success("Signed in");
      }
    } catch (err: any) {
      const msg = err?.message ?? "Something went wrong";
      if (msg.toLowerCase().includes("user already registered")) {
        toast.error("Account already exists. Try signing in instead.");
      } else if (msg.toLowerCase().includes("invalid login")) {
        toast.error("Wrong email or password.");
      } else {
        toast.error(msg);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleGoogle = async () => {
    try {
      setOauthLoading(true);
      const { error } = await lovable.auth.signInWithOAuth("google");
      if (error) throw error;
    } catch (err: any) {
      toast.error(err?.message ?? "Google sign-in failed");
      setOauthLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 gradient-hero relative overflow-hidden">
      <div className="absolute inset-0 gradient-mesh opacity-60 pointer-events-none" />
      <div className="relative w-full max-w-md">
        <Link to="/" className="flex items-center gap-2 justify-center mb-8 group">
          <div className="h-10 w-10 rounded-xl gradient-primary flex items-center justify-center shadow-glow transition-spring group-hover:scale-110">
            <Gamepad2 className="h-5 w-5 text-primary-foreground" strokeWidth={2.5} />
          </div>
          <span className="font-display font-bold text-2xl">
            Play<span className="text-gradient">Hub</span>
          </span>
        </Link>

        <div className="bg-card rounded-3xl shadow-elev p-8 border border-border/60 animate-fade-in-up">
          <div className="text-center mb-6">
            <h1 className="font-display text-2xl font-bold">
              {mode === "signin" ? "Welcome back" : "Create your account"}
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              {mode === "signin" ? "Sign in to start playing" : "Join the fun in seconds"}
            </p>
          </div>

          <Button
            variant="outline"
            onClick={handleGoogle}
            disabled={oauthLoading || loading}
            className="w-full h-11 rounded-full font-google font-medium ring-google border-0"
          >
            {oauthLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : (
              <>
                <GoogleIcon /> Continue with Google
              </>
            )}
          </Button>

          <div className="my-6 flex items-center gap-3 text-xs text-muted-foreground">
            <div className="h-px flex-1 bg-border" />
            or
            <div className="h-px flex-1 bg-border" />
          </div>

          <Tabs value={mode} onValueChange={(v) => setMode(v as any)}>
            <TabsList className="grid w-full grid-cols-2 rounded-full p-1 h-10">
              <TabsTrigger value="signin" className="rounded-full">Sign in</TabsTrigger>
              <TabsTrigger value="signup" className="rounded-full">Sign up</TabsTrigger>
            </TabsList>

            <form onSubmit={handleEmail} className="space-y-4 mt-6">
              <TabsContent value="signup" className="m-0">
                <div className="space-y-2">
                  <Label htmlFor="username">Username</Label>
                  <Input
                    id="username"
                    placeholder="cool_player"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    className="h-11 rounded-xl"
                  />
                </div>
              </TabsContent>

              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="h-11 rounded-xl"
                  autoComplete="email"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="h-11 rounded-xl"
                  autoComplete={mode === "signin" ? "current-password" : "new-password"}
                />
              </div>

              <Button type="submit" disabled={loading} className="w-full h-11 rounded-full font-google font-medium shadow-glow">
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : (mode === "signin" ? "Sign in" : "Create account")}
              </Button>
            </form>
          </Tabs>
        </div>

        <p className="text-center text-xs text-muted-foreground mt-6">
          By continuing, you agree to PlayHub's terms of service.
        </p>
      </div>
    </div>
  );
};

const GoogleIcon = () => (
  <svg className="h-4 w-4 mr-2" viewBox="0 0 24 24" aria-hidden>
    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.99.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84C6.71 7.31 9.14 5.38 12 5.38z"/>
  </svg>
);

export default Auth;
