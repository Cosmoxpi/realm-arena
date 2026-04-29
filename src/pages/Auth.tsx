import { useEffect, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

import { toast } from "sonner";
import { Gamepad2, Loader2 } from "lucide-react";

// ✅ Validation Schemas
const emailSchema = z.string().trim().email({ message: "Enter a valid email" }).max(255);

const passwordSchema = z
  .string()
  .min(8, "Password must be at least 8 characters")
  .max(72);

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

  // ✅ Auto redirect if logged in
  useEffect(() => {
    if (user) navigate("/dashboard", { replace: true });
  }, [user, navigate]);

  // ✅ Email/Password Auth
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
        if (!u1.success) {
          setLoading(false);
          return toast.error(u1.error.issues[0].message);
        }

        const { error } = await supabase.auth.signUp({
          email: e1.data,
          password: p1.data,
          options: {
            emailRedirectTo: `${window.location.origin}/#/dashboard`,
            data: {
              username: u1.data,
              display_name: u1.data,
            },
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
        toast.success("Signed in successfully");
      }
    } catch (err: unknown) {
      if (err instanceof Error) {
        toast.error(err.message);
      } else {
        toast.error("Something went wrong");
      }
    } finally {
      setLoading(false);
    }
  };

  // ✅ Google OAuth (FIXED FOR HASH ROUTER)
  const handleGoogle = async () => {
    try {
      setOauthLoading(true);

      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: `${window.location.origin}/#/auth/callback`, // ✅ FIXED
        },
      });

      if (error) throw error;
    } catch (err: unknown) {
      if (err instanceof Error) {
        toast.error(err.message);
      } else {
        toast.error("Google sign-in failed");
      }
      setOauthLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-md">

        {/* Logo */}
        <Link to="/" className="flex items-center gap-2 justify-center mb-6">
          <Gamepad2 />
          <span className="text-xl font-bold">PlayHub</span>
        </Link>

        <div className="bg-white p-6 rounded-xl shadow">

          {/* Google Login */}
          <Button
            onClick={handleGoogle}
            disabled={oauthLoading || loading}
            className="w-full mb-4"
          >
            {oauthLoading ? (
              <Loader2 className="animate-spin" />
            ) : (
              "Continue with Google"
            )}
          </Button>

          {/* Tabs */}
          <Tabs value={mode} onValueChange={(v) => setMode(v as "signin" | "signup")}>
            <TabsList className="grid grid-cols-2 mb-4">
              <TabsTrigger value="signin">Sign in</TabsTrigger>
              <TabsTrigger value="signup">Sign up</TabsTrigger>
            </TabsList>

            <form onSubmit={handleEmail} className="space-y-4">

              {mode === "signup" && (
                <div>
                  <Label>Username</Label>
                  <Input
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                  />
                </div>
              )}

              <div>
                <Label>Email</Label>
                <Input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>

              <div>
                <Label>Password</Label>
                <Input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>

              <Button type="submit" className="w-full">
                {loading ? (
                  <Loader2 className="animate-spin" />
                ) : mode === "signin" ? (
                  "Sign in"
                ) : (
                  "Create account"
                )}
              </Button>

            </form>
          </Tabs>
        </div>
      </div>
    </div>
  );
};

export default Auth;