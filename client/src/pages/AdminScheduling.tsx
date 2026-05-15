/**
 * AdminScheduling.tsx
 *
 * Admin panel for managing robot team availability slots.
 * Bob and Tommy can add/remove time slots for prospect calls.
 * Shows all booked calls with meeting notes.
 */
import { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Calendar, Clock, Plus, CheckCircle, User, Pencil, Trash2 } from "lucide-react";

const TEAM_MEMBERS = [
  { name: "Bob", email: "bob@onstage.bot" },
  { name: "Tommy Laplante", email: "tom@starsupportinc.com" },
];

const SLOT_DURATIONS = [
  { label: "30 minutes", minutes: 30 },
  { label: "45 minutes", minutes: 45 },
  { label: "1 hour", minutes: 60 },
];

export default function AdminScheduling() {
  const { data: allSlots = [], refetch } = trpc.scheduling.getAllSlots.useQuery();
  const addSlotsMutation = trpc.scheduling.addSlots.useMutation({
    onSuccess: (data) => {
      toast.success(`Added ${data.count} slot${data.count !== 1 ? "s" : ""}`);
      refetch();
      setShowAddDialog(false);
    },
    onError: (err) => toast.error(err.message),
  });
  const updateNotesMutation = trpc.scheduling.updateMeetingNotes.useMutation({
    onSuccess: () => {
      toast.success("Meeting notes saved");
      refetch();
      setEditingNotes(null);
    },
    onError: (err) => toast.error(err.message),
  });

  const [showAddDialog, setShowAddDialog] = useState(false);
  const [editingNotes, setEditingNotes] = useState<{ slotId: number; notes: string } | null>(null);

  // Add slot form state
  const [hostEmail, setHostEmail] = useState(TEAM_MEMBERS[0].email);
  const [slotDate, setSlotDate] = useState("");
  const [slotTime, setSlotTime] = useState("09:00");
  const [duration, setDuration] = useState(60);
  const [bulkDays, setBulkDays] = useState(1);

  const upcomingSlots = useMemo(() =>
    allSlots.filter(s => new Date(s.slotStart) >= new Date()).sort(
      (a, b) => new Date(a.slotStart).getTime() - new Date(b.slotStart).getTime()
    ), [allSlots]);

  const bookedSlots = useMemo(() =>
    allSlots.filter(s => s.isBooked).sort(
      (a, b) => new Date(b.slotStart).getTime() - new Date(a.slotStart).getTime()
    ), [allSlots]);

  const availableCount = upcomingSlots.filter(s => !s.isBooked).length;
  const bookedCount = bookedSlots.length;

  function handleAddSlots() {
    if (!slotDate || !slotTime) {
      toast.error("Please select a date and time");
      return;
    }
    const host = TEAM_MEMBERS.find(m => m.email === hostEmail)!;
    const slots = [];
    for (let i = 0; i < bulkDays; i++) {
      const base = new Date(`${slotDate}T${slotTime}:00`);
      base.setDate(base.getDate() + i);
      const end = new Date(base.getTime() + duration * 60 * 1000);
      slots.push({
        hostName: host.name,
        hostEmail: host.email,
        slotStart: base,
        slotEnd: end,
      });
    }
    addSlotsMutation.mutate({ slots });
  }

  function formatSlotTime(start: Date | string, end: Date | string) {
    const s = new Date(start);
    const e = new Date(end);
    return `${s.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })} · ${s.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })} – ${e.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}`;
  }

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Scheduling</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Manage robot team availability for prospect calls
          </p>
        </div>
        <Button onClick={() => setShowAddDialog(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Add Availability
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold text-amber-500">{availableCount}</div>
            <div className="text-sm text-muted-foreground">Open slots</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold">{bookedCount}</div>
            <div className="text-sm text-muted-foreground">Booked calls</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold">{allSlots.length}</div>
            <div className="text-sm text-muted-foreground">Total slots</div>
          </CardContent>
        </Card>
      </div>

      {/* Upcoming availability */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Calendar className="h-4 w-4 text-amber-500" />
            Upcoming Availability
          </CardTitle>
        </CardHeader>
        <CardContent>
          {upcomingSlots.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">
              No upcoming slots — add availability so prospects can book calls.
            </p>
          ) : (
            <div className="space-y-2">
              {upcomingSlots.map(slot => (
                <div
                  key={slot.id}
                  className="flex items-center justify-between p-3 rounded-lg border bg-card hover:bg-accent/30 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <Clock className="h-4 w-4 text-muted-foreground shrink-0" />
                    <div>
                      <div className="text-sm font-medium">
                        {formatSlotTime(slot.slotStart, slot.slotEnd)}
                      </div>
                      <div className="text-xs text-muted-foreground flex items-center gap-1">
                        <User className="h-3 w-3" />
                        {slot.hostName}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {slot.isBooked ? (
                      <Badge className="bg-green-500/10 text-green-600 border-green-500/20">
                        <CheckCircle className="h-3 w-3 mr-1" />
                        Booked — {slot.bookedByName}
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="text-amber-500 border-amber-500/30">
                        Available
                      </Badge>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Booked calls */}
      {bookedSlots.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <CheckCircle className="h-4 w-4 text-green-500" />
              Booked Calls
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {bookedSlots.map(slot => (
                <div key={slot.id} className="p-3 rounded-lg border bg-card space-y-2">
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="text-sm font-medium">
                        {slot.bookedByName}
                        {slot.bookedByEmail && (
                          <span className="text-muted-foreground font-normal ml-2">
                            ({slot.bookedByEmail})
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-muted-foreground mt-0.5">
                        {formatSlotTime(slot.slotStart, slot.slotEnd)} · with {slot.hostName}
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setEditingNotes({ slotId: slot.id, notes: slot.meetingNotes ?? "" })}
                    >
                      <Pencil className="h-3 w-3 mr-1" />
                      Notes
                    </Button>
                  </div>
                  {slot.meetingNotes && (
                    <div className="text-xs text-muted-foreground bg-muted/50 rounded p-2">
                      {slot.meetingNotes}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Add Availability Dialog */}
      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add Availability</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Host</label>
              <Select value={hostEmail} onValueChange={setHostEmail}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TEAM_MEMBERS.map(m => (
                    <SelectItem key={m.email} value={m.email}>{m.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Date</label>
              <Input
                type="date"
                value={slotDate}
                onChange={e => setSlotDate(e.target.value)}
                min={new Date().toISOString().split("T")[0]}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Start time</label>
                <Input
                  type="time"
                  value={slotTime}
                  onChange={e => setSlotTime(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Duration</label>
                <Select value={String(duration)} onValueChange={v => setDuration(Number(v))}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {SLOT_DURATIONS.map(d => (
                      <SelectItem key={d.minutes} value={String(d.minutes)}>{d.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Repeat for (days)</label>
              <Input
                type="number"
                min={1}
                max={30}
                value={bulkDays}
                onChange={e => setBulkDays(Math.max(1, Math.min(30, Number(e.target.value))))}
              />
              <p className="text-xs text-muted-foreground">
                Creates {bulkDays} slot{bulkDays !== 1 ? "s" : ""} on consecutive days at the same time
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddDialog(false)}>Cancel</Button>
            <Button onClick={handleAddSlots} disabled={addSlotsMutation.isPending}>
              {addSlotsMutation.isPending ? "Adding..." : `Add ${bulkDays} slot${bulkDays !== 1 ? "s" : ""}`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Meeting Notes Dialog */}
      <Dialog open={!!editingNotes} onOpenChange={open => !open && setEditingNotes(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Meeting Notes</DialogTitle>
          </DialogHeader>
          <Textarea
            placeholder="Add notes from this call — key points, next steps, follow-up actions..."
            value={editingNotes?.notes ?? ""}
            onChange={e => setEditingNotes(prev => prev ? { ...prev, notes: e.target.value } : null)}
            rows={6}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingNotes(null)}>Cancel</Button>
            <Button
              onClick={() => {
                if (editingNotes) {
                  updateNotesMutation.mutate({ slotId: editingNotes.slotId, meetingNotes: editingNotes.notes });
                }
              }}
              disabled={updateNotesMutation.isPending}
            >
              {updateNotesMutation.isPending ? "Saving..." : "Save Notes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
