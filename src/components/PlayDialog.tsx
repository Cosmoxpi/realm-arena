import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Loader2, Plus, LogIn } from "lucide-react";
import { toast } from "sonner";
import { createRoom, joinRoomByCode } from "@/hooks/useRoom";

interface Props {
  game: "cricket" | "ludo";
  trigger: React.ReactNode;
}

export function PlayDialog({ game, trigger }: Props) {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  // ludo: 2-4, cricket: 2
  const [maxPlayers, setMaxPlayers] = useState<number>(game === "ludo" ? 2 : 2);
  const [overs, setOvers] = useState<number>(3); // cricket

  const handleCreate = async () => {
    try {
      setBusy(true);
      const settings = game === "cricket" ? { overs } : {};
      const max = game === "cricket" ? 2 : maxPlayers;
      const room = await createRoom(game, max, settings);
      setOpen(false);
      navigate(`/play/${game}/${room.id}`);
    } catch (e: any) {
      toast.error(e?.message ?? "Could not create room");
    } finally {
      setBusy(false);
    }
  };

  const handleJoin = async () => {
    if (code.trim().length < 4) return toast.error("Enter a valid code");
    try {
      setBusy(true);
      const id = await joinRoomByCode(code.trim());
      setOpen(false);
      navigate(`/play/${game}/${id}`);
    } catch (e: any) {
      toast.error(e?.message ?? "Could not join room");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="rounded-3xl">
        <DialogHeader>
          <DialogTitle className="font-display text-2xl capitalize">{game} match</DialogTitle>
        </DialogHeader>
        <Tabs defaultValue="create">
          <TabsList className="grid grid-cols-2 rounded-full p-1 h-10">
            <TabsTrigger value="create" className="rounded-full">Create room</TabsTrigger>
            <TabsTrigger value="join" className="rounded-full">Join with code</TabsTrigger>
          </TabsList>

          <TabsContent value="create" className="space-y-5 mt-5">
            {game === "ludo" && (
              <div className="space-y-2">
                <Label>Players</Label>
                <RadioGroup
                  value={String(maxPlayers)}
                  onValueChange={(v) => setMaxPlayers(parseInt(v))}
                  className="grid grid-cols-3 gap-2"
                >
                  {[2, 3, 4].map((n) => (
                    <Label
                      key={n}
                      htmlFor={`p${n}`}
                      className={`cursor-pointer rounded-xl border-2 p-3 text-center font-medium transition-smooth ${
                        maxPlayers === n ? "border-primary bg-accent text-accent-foreground" : "border-border"
                      }`}
                    >
                      <RadioGroupItem id={`p${n}`} value={String(n)} className="sr-only" />
                      {n} players
                    </Label>
                  ))}
                </RadioGroup>
              </div>
            )}

            {game === "cricket" && (
              <div className="space-y-2">
                <Label>Match length</Label>
                <RadioGroup
                  value={String(overs)}
                  onValueChange={(v) => setOvers(parseInt(v))}
                  className="grid grid-cols-2 gap-2"
                >
                  {[3, 20].map((n) => (
                    <Label
                      key={n}
                      htmlFor={`o${n}`}
                      className={`cursor-pointer rounded-xl border-2 p-3 text-center font-medium transition-smooth ${
                        overs === n ? "border-primary bg-accent text-accent-foreground" : "border-border"
                      }`}
                    >
                      <RadioGroupItem id={`o${n}`} value={String(n)} className="sr-only" />
                      {n} overs
                    </Label>
                  ))}
                </RadioGroup>
              </div>
            )}

            <Button onClick={handleCreate} disabled={busy} className="w-full h-11 rounded-full font-google font-medium shadow-glow">
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Plus className="h-4 w-4 mr-1" /> Create room</>}
            </Button>
          </TabsContent>

          <TabsContent value="join" className="space-y-4 mt-5">
            <div className="space-y-2">
              <Label htmlFor="code">Room code</Label>
              <Input
                id="code"
                placeholder="ABC123"
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                maxLength={6}
                className="rounded-xl h-12 text-center text-2xl font-display font-bold tracking-[0.4em] uppercase"
              />
            </div>
            <Button onClick={handleJoin} disabled={busy} className="w-full h-11 rounded-full font-google font-medium shadow-glow">
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <><LogIn className="h-4 w-4 mr-1" /> Join</>}
            </Button>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
