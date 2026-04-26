import { Navbar } from "@/components/Navbar";
import { useAuth } from "@/hooks/useAuth";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { z } from "zod";
import { Loader2, Trophy, Target, Gamepad2 } from "lucide-react";

const profileSchema = z.object({
  display_name: z.string().trim().max(40, "Too long").optional().or(z.literal("")),
  bio: z.string().trim().max(200, "Bio max 200 chars").optional().or(z.literal("")),
});

const Profile = () => {
  const { user, profile, refreshProfile } = useAuth();
  const [displayName, setDisplayName] = useState("");
  const [bio, setBio] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (profile) {
      setDisplayName(profile.display_name ?? "");
      setBio(profile.bio ?? "");
    }
  }, [profile]);

  const save = async () => {
    if (!user) return;
    const parsed = profileSchema.safeParse({ display_name: displayName, bio });
    if (!parsed.success) return toast.error(parsed.error.issues[0].message);
    setSaving(true);
    const { error } = await supabase
      .from("profiles")
      .update({ display_name: displayName || null, bio: bio || null })
      .eq("user_id", user.id);
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Profile updated");
    await refreshProfile();
  };

  const initial = (profile?.display_name || profile?.username || "P").charAt(0).toUpperCase();
  const winRate = profile?.games_played ? Math.round((profile.wins / profile.games_played) * 100) : 0;

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="container py-10 max-w-3xl">
        <div className="bg-card rounded-3xl shadow-card p-8 mb-6 animate-fade-in-up">
          <div className="flex items-center gap-5 mb-6">
            <Avatar className="h-20 w-20 ring-4 ring-accent">
              <AvatarImage src={profile?.avatar_url ?? undefined} />
              <AvatarFallback className="gradient-primary text-primary-foreground text-2xl font-bold">
                {initial}
              </AvatarFallback>
            </Avatar>
            <div>
              <h1 className="font-display text-3xl font-bold">{profile?.display_name || profile?.username}</h1>
              <p className="text-muted-foreground">@{profile?.username}</p>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4 mb-6">
            <Stat icon={Trophy} label="Rating" value={profile?.rating ?? 1000} />
            <Stat icon={Gamepad2} label="Played" value={profile?.games_played ?? 0} />
            <Stat icon={Target} label="Win rate" value={`${winRate}%`} />
          </div>
        </div>

        <div className="bg-card rounded-3xl shadow-card p-8">
          <h2 className="font-display text-xl font-bold mb-5">Edit profile</h2>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="display_name">Display name</Label>
              <Input id="display_name" value={displayName} onChange={(e) => setDisplayName(e.target.value)} className="rounded-xl h-11" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="bio">Bio</Label>
              <Textarea id="bio" value={bio} onChange={(e) => setBio(e.target.value)} className="rounded-xl min-h-24" placeholder="Tell others about yourself..." />
            </div>
            <Button onClick={save} disabled={saving} className="rounded-full h-11 px-6 font-google font-medium shadow-glow">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save changes"}
            </Button>
          </div>
        </div>
      </main>
    </div>
  );
};

const Stat = ({ icon: Icon, label, value }: { icon: any; label: string; value: any }) => (
  <div className="bg-surface rounded-2xl p-4 flex items-center gap-3">
    <div className="h-10 w-10 rounded-xl bg-accent text-accent-foreground flex items-center justify-center">
      <Icon className="h-4 w-4" />
    </div>
    <div>
      <div className="text-xl font-display font-bold">{value}</div>
      <div className="text-xs text-muted-foreground uppercase tracking-wider font-medium">{label}</div>
    </div>
  </div>
);

export default Profile;
