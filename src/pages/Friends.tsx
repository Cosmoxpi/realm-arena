import { Navbar } from "@/components/Navbar";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Search, UserPlus, Check, X, Users, Loader2 } from "lucide-react";
import { toast } from "sonner";

interface Profile {
  user_id: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
  rating: number;
}

interface Friendship {
  id: string;
  requester_id: string;
  addressee_id: string;
  status: "pending" | "accepted" | "blocked";
}

const Friends = () => {
  const { user } = useAuth();
  const [query, setQuery] = useState("");
  const [searchResults, setSearchResults] = useState<Profile[]>([]);
  const [searching, setSearching] = useState(false);
  const [friendships, setFriendships] = useState<Friendship[]>([]);
  const [profiles, setProfiles] = useState<Record<string, Profile>>({});

  const refresh = async () => {
    if (!user) return;
    const { data: f } = await supabase
      .from("friendships")
      .select("*")
      .or(`requester_id.eq.${user.id},addressee_id.eq.${user.id}`);
    const fs = (f ?? []) as Friendship[];
    setFriendships(fs);
    const ids = Array.from(new Set(fs.flatMap((x) => [x.requester_id, x.addressee_id]).filter((id) => id !== user.id)));
    if (ids.length) {
      const { data: profs } = await supabase.rpc("get_profiles_by_ids", { _ids: ids });
      const map: Record<string, Profile> = {};
      (profs ?? []).forEach((p: any) => { map[p.user_id] = p; });
      setProfiles(map);
    }
  };

  useEffect(() => { refresh(); }, [user]);

  const search = async () => {
    if (!query.trim()) return;
    setSearching(true);
    const { data } = await supabase
      .from("profiles")
      .select("user_id, username, display_name, avatar_url, rating")
      .or(`username.ilike.%${query}%,display_name.ilike.%${query}%`)
      .neq("user_id", user?.id ?? "")
      .limit(20);
    setSearchResults((data ?? []) as Profile[]);
    setSearching(false);
  };

  const sendRequest = async (addressee_id: string) => {
    const { error } = await supabase.from("friendships").insert({
      requester_id: user!.id,
      addressee_id,
      status: "pending",
    });
    if (error) {
      if (error.code === "23505") return toast.error("Already requested");
      return toast.error(error.message);
    }
    toast.success("Friend request sent");
    refresh();
  };

  const respond = async (id: string, accept: boolean) => {
    if (accept) {
      const { error } = await supabase.from("friendships").update({ status: "accepted" }).eq("id", id);
      if (error) return toast.error(error.message);
      toast.success("Friend added");
    } else {
      const { error } = await supabase.from("friendships").delete().eq("id", id);
      if (error) return toast.error(error.message);
    }
    refresh();
  };

  const remove = async (id: string) => {
    await supabase.from("friendships").delete().eq("id", id);
    refresh();
  };

  const accepted = friendships.filter((f) => f.status === "accepted");
  const incoming = friendships.filter((f) => f.status === "pending" && f.addressee_id === user?.id);
  const outgoing = friendships.filter((f) => f.status === "pending" && f.requester_id === user?.id);

  const otherId = (f: Friendship) => (f.requester_id === user?.id ? f.addressee_id : f.requester_id);

  const Row = ({ p, actions }: { p?: Profile; actions: React.ReactNode }) => {
    if (!p) return null;
    return (
      <div className="flex items-center gap-3 p-3 rounded-xl hover:bg-surface transition-smooth">
        <Avatar className="h-10 w-10">
          <AvatarImage src={p.avatar_url ?? undefined} />
          <AvatarFallback className="gradient-primary text-primary-foreground font-semibold">
            {(p.display_name || p.username).charAt(0).toUpperCase()}
          </AvatarFallback>
        </Avatar>
        <div className="flex-1 min-w-0">
          <div className="font-medium truncate">{p.display_name || p.username}</div>
          <div className="text-xs text-muted-foreground">@{p.username} · {p.rating} rating</div>
        </div>
        {actions}
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="container py-10 max-w-3xl">
        <div className="text-center mb-8 animate-fade-in-up">
          <div className="inline-flex h-14 w-14 rounded-2xl gradient-primary items-center justify-center shadow-glow mb-4">
            <Users className="h-7 w-7 text-primary-foreground" />
          </div>
          <h1 className="font-display text-4xl font-bold">Friends</h1>
          <p className="text-muted-foreground mt-1">Find players, send requests, play together</p>
        </div>

        <Tabs defaultValue="friends" className="bg-card rounded-3xl shadow-card p-6">
          <TabsList className="grid grid-cols-3 rounded-full p-1 h-10">
            <TabsTrigger value="friends" className="rounded-full">Friends ({accepted.length})</TabsTrigger>
            <TabsTrigger value="requests" className="rounded-full">Requests ({incoming.length})</TabsTrigger>
            <TabsTrigger value="find" className="rounded-full">Find</TabsTrigger>
          </TabsList>

          <TabsContent value="friends" className="mt-5">
            {accepted.length === 0 ? (
              <p className="text-center text-muted-foreground py-10 text-sm">No friends yet — find some in the Find tab.</p>
            ) : (
              <div className="space-y-1">
                {accepted.map((f) => (
                  <Row key={f.id} p={profiles[otherId(f)]} actions={
                    <Button size="sm" variant="ghost" onClick={() => remove(f.id)} className="rounded-full">Remove</Button>
                  } />
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="requests" className="mt-5 space-y-4">
            <div>
              <h3 className="text-sm font-semibold mb-2">Incoming</h3>
              {incoming.length === 0 ? <p className="text-xs text-muted-foreground py-3">None.</p> : (
                <div className="space-y-1">
                  {incoming.map((f) => (
                    <Row key={f.id} p={profiles[otherId(f)]} actions={
                      <div className="flex gap-1">
                        <Button size="icon" variant="ghost" onClick={() => respond(f.id, true)} className="h-9 w-9 rounded-full text-success">
                          <Check className="h-4 w-4" />
                        </Button>
                        <Button size="icon" variant="ghost" onClick={() => respond(f.id, false)} className="h-9 w-9 rounded-full text-destructive">
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    } />
                  ))}
                </div>
              )}
            </div>
            <div>
              <h3 className="text-sm font-semibold mb-2">Sent</h3>
              {outgoing.length === 0 ? <p className="text-xs text-muted-foreground py-3">None.</p> : (
                <div className="space-y-1">
                  {outgoing.map((f) => (
                    <Row key={f.id} p={profiles[otherId(f)]} actions={
                      <span className="text-xs text-muted-foreground px-3">Pending…</span>
                    } />
                  ))}
                </div>
              )}
            </div>
          </TabsContent>

          <TabsContent value="find" className="mt-5">
            <div className="flex gap-2 mb-4">
              <Input
                placeholder="Search by username..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && search()}
                className="rounded-xl h-11"
              />
              <Button onClick={search} className="rounded-full h-11 px-5">
                {searching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
              </Button>
            </div>
            {searchResults.length === 0 ? (
              <p className="text-center text-muted-foreground py-6 text-sm">Search for players to add as friends.</p>
            ) : (
              <div className="space-y-1">
                {searchResults.map((p) => {
                  const existing = friendships.find((f) => otherId(f) === p.user_id);
                  return (
                    <Row key={p.user_id} p={p} actions={
                      existing ? (
                        <span className="text-xs text-muted-foreground px-3 capitalize">{existing.status}</span>
                      ) : (
                        <Button size="sm" onClick={() => sendRequest(p.user_id)} className="rounded-full">
                          <UserPlus className="h-3.5 w-3.5 mr-1" /> Add
                        </Button>
                      )
                    } />
                  );
                })}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
};

export default Friends;
