import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Loader2, Plus, LogIn } from "lucide-react";
import { toast } from "sonner";
import { createRoom, joinRoomByCode } from "@/hooks/useRoom";
import { supabase } from "@/integrations/supabase/client";

interface Props {
  game: "cricket" | "ludo";
  trigger: React.ReactNode;
}

export function PlayDialog({ game, trigger }: Props) {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);

  const [maxPlayers, setMaxPlayers] = useState<number>(2);
  const [overs, setOvers] = useState<number>(3);

  // 🔥 GET USER
  const getUserId = async (): Promise<string> => {
    const { data } = await supabase.auth.getUser();
    if (!data.user) throw new Error("User not logged in");
    return data.user.id;
  };

  // =========================
  // CREATE ROOM
  // =========================
  const handleCreate = async () => {
    try {
      setBusy(true);

      const userId = await getUserId();

      const room = await createRoom(
        userId,
        game,
        game === "cricket" ? `${overs}_over` : `${maxPlayers}_player`
      );

      setOpen(false);
      navigate(`/play/${game}/${room.id}`);
    } catch (e: unknown) {
      const err = e as Error;
      toast.error(err.message || "Could not create room");
    } finally {
      setBusy(false);
    }
  };

  // =========================
  // JOIN ROOM
  // =========================
  const handleJoin = async () => {
    if (code.trim().length < 4) {
      toast.error("Enter a valid code");
      return;
    }

    try {
      setBusy(true);

      const userId = await getUserId();

      const id = await joinRoomByCode(code.trim(), userId);

      setOpen(false);
      navigate(`/play/${game}/${id}`);
    } catch (e: unknown) {
      const err = e as Error;
      toast.error(err.message || "Could not join room");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>

      {/* ✅ FIXED DIALOG */}
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="text-2xl capitalize">{game} match</DialogTitle>
          <DialogDescription>
            Create or join a room to start playing.
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="create">
          <TabsList className="grid grid-cols-2">
            <TabsTrigger value="create">Create</TabsTrigger>
            <TabsTrigger value="join">Join</TabsTrigger>
          </TabsList>

          {/* CREATE */}
          <TabsContent value="create" className="space-y-4 mt-4">

            {game === "ludo" && (
              <div>
                <Label>Players</Label>
                <RadioGroup
                  value={String(maxPlayers)}
                  onValueChange={(v) => setMaxPlayers(parseInt(v))}
                  className="grid grid-cols-3 gap-2"
                >
                  {[2, 3, 4].map((n) => (
                    <Label key={n} className="border p-2 text-center cursor-pointer">
                      <RadioGroupItem value={String(n)} className="sr-only" />
                      {n}
                    </Label>
                  ))}
                </RadioGroup>
              </div>
            )}

            {game === "cricket" && (
              <div>
                <Label>Overs</Label>
                <RadioGroup
                  value={String(overs)}
                  onValueChange={(v) => setOvers(parseInt(v))}
                  className="grid grid-cols-2 gap-2"
                >
                  {[3, 20].map((n) => (
                    <Label key={n} className="border p-2 text-center cursor-pointer">
                      <RadioGroupItem value={String(n)} className="sr-only" />
                      {n}
                    </Label>
                  ))}
                </RadioGroup>
              </div>
            )}

            <Button onClick={handleCreate} disabled={busy} className="w-full">
              {busy ? <Loader2 className="animate-spin" /> : "Create Room"}
            </Button>
          </TabsContent>

          {/* JOIN */}
          <TabsContent value="join" className="space-y-4 mt-4">
            <Input
              placeholder="ENTER CODE"
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
            />

            <Button onClick={handleJoin} disabled={busy} className="w-full">
              {busy ? <Loader2 className="animate-spin" /> : "Join Room"}
            </Button>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}