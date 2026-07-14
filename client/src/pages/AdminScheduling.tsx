/**
 * AdminScheduling.tsx
 *
 * Admin panel for managing robot team availability slots.
 * Bob and Tommy can add/remove time slots for prospect calls.
 * Shows all booked calls with meeting notes.
 *
 * v20: Fully self-service — slot CRUD with date/time picker, host selector,
 * delete button per slot, recurring weekly option.
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
import {
  Calendar, Clock, Plus, CheckCircle, User, Pencil, Trash2,
  RefreshCw, AlertCircle,
} from "lucide-react";
import { AdminPage, AdminPageHeader, adminTw } from "@/lib/adminTheme";

const TEAM_MEMBERS = [
  { name: "Bob", email: "bob@onstage.bot" },
  { name: "Tommy Laplante", email: "tom@starsupportinc.com" },
  { name: "Robot Team", email: "hello@onstage.bot" },
];

const SLOT_DURATIONS = [
  { label: "30 minutes", minutes: 30 },
  { label: "45 minutes", minutes: 45 },
  { label: "1 hour", minutes: 60 },
  { label: "90 minutes", minutes: 90 },
];

const RECURRENCE_OPTIONS = [
  { label: "One-time", value: 1 },
  { label: "2 consecutive days", value: 2 },
  { label: "5 days (Mon–Fri)", value: 5 },
  { label: "7 days (1 week)", value: 7 },
  { label: "14 days (2 weeks)", value: 14 },
  { label: "30 days (1 month)", value: 30 },
];

export default function AdminScheduling() {
  const utils = trpc.useUtils();
  const { data: allSlots = [], isLoading } = trpc.scheduling.getAllSlots.useQuery();

  const addSlotsMutation = trpc.scheduling.addSlots.useMutation({
    onSuccess: (data) => {
      toast.success(`Added ${data.count} slot${data.count !== 1 ? "s" : ""}`);
      utils.scheduling.getAllSlots.invalidate();
      setShowAddDialog(false);
      resetForm();
    },
    onError: (err) => toast.error(err.message),
  });

  const deleteSlotMutation = trpc.scheduling.deleteSlot.useMutation({
    onSuccess: () => {
      toast.success("Slot deleted");
      utils.scheduling.getAllSlots.invalidate();
    },
    onError: (err) => toast.error(err.message),
  });

  const updateNotesMutation = trpc.scheduling.updateMeetingNotes.useMutation({
    onSuccess: () => {
      toast.success("Meeting notes saved");
      utils.scheduling.getAllSlots.invalidate();
      setEditingNotes(null);
    },
    onError: (err) => toast.error(err.message),
  });

  const [showAddDialog, setShowAddDialog] = useState(false);
  const [editingNotes, setEditingNotes] = useState<{ slotId: number; notes: string } | null>(null);
  const [deletingSlotId, setDeletingSlotId] = useState<number | null>(null);

  // Add slot form state
  const [hostEmail, setHostEmail] = useState(TEAM_MEMBERS[0].email);
  const [slotDate, setSlotDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    return d.toISOString().split("T")[0];
  });
  const [slotTime, setSlotTime] = useState("09:00");
  const [duration, setDuration] = useState(60);
  const [bulkDays, setBulkDays] = useState(1);

  function resetForm() {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    setSlotDate(d.toISOString().split("T")[0]);
    setSlotTime("09:00");
    setDuration(60);
    setBulkDays(1);
    setHostEmail(TEAM_MEMBERS[0].email);
  }

  const upcomingSlots = useMemo(() =>
    allSlots
      .filter(s => new Date(s.slotStart) >= new Date())
      .sort((a, b) => new Date(a.slotStart).getTime() - new Date(b.slotStart).getTime()),
    [allSlots]
  );

  const pastSlots = useMemo(() =>
    allSlots
      .filter(s => new Date(s.slotStart) < new Date())
      .sort((a, b) => new Date(b.slotStart).getTime() - new Date(a.slotStart).getTime()),
    [allSlots]
  );

  const bookedSlots = useMemo(() =>
    allSlots
      .filter(s => s.isBooked)
      .sort((a, b) => new Date(b.slotStart).getTime() - new Date(a.slotStart).getTime()),
    [allSlots]
  );

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

  function getHostColor(hostName: string) {
    if (hostName === "Bob") return "text-blue-500";
    if (hostName.includes("Tommy")) return "text-purple-500";
    return "text-amber-500";
  }

  const previewSlots = useMemo(() => {
    if (!slotDate || !slotTime) return [];
    const preview = [];
    for (let i = 0; i < Math.min(bulkDays, 5); i++) {
      const base = new Date(`${slotDate}T${slotTime}:00`);
      base.setDate(base.getDate() + i);
      const end = new Date(base.getTime() + duration * 60 * 1000);
      preview.push({ start: base, end });
    }
    return preview;
  }, [slotDate, slotTime, duration, bulkDays]);

  return (
    <AdminPage maxWidth="64rem">
      <AdminPageHeader
        kicker="STAGEGATE / SCHEDULING"
        title="Scheduling"
        description="Manage robot team availability for prospect calls"
        icon={Calendar}
        backHref="/admin"
        actions={
          <Button onClick={() => setShowAddDialog(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Add Availability
          </Button>
        }
      />

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <Card className={adminTw.card}>
          <CardContent className="pt-6">
            <div className={`${adminTw.statValue} text-amber-500`}>{availableCount}</div>
            <div className="text-sm text-muted-foreground">Open slots</div>
          </CardContent>
        </Card>
        <Card className={adminTw.card}>
          <CardContent className="pt-6">
            <div className={`${adminTw.statValue} text-green-500`}>{bookedCount}</div>
            <div className="text-sm text-muted-foreground">Booked calls</div>
          </CardContent>
        </Card>
        <Card className={adminTw.card}>
          <CardContent className="pt-6">
            <div className={adminTw.statValue}>{allSlots.length}</div>
            <div className="text-sm text-muted-foreground">Total slots</div>
          </CardContent>
        </Card>
      </div>

      {/* Upcoming availability */}
      <Card className={adminTw.card}>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Calendar className="h-4 w-4 text-amber-500" />
            Upcoming Availability
            {availableCount > 0 && (
              <Badge variant="outline" className="text-amber-500 border-amber-500/30 ml-auto">
                {availableCount} open
              </Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="py-6 text-center text-sm text-muted-foreground">Loading slots…</div>
          ) : upcomingSlots.length === 0 ? (
            <div className="py-6 text-center space-y-2">
              <AlertCircle className="h-8 w-8 text-muted-foreground mx-auto" />
              <p className="text-sm text-muted-foreground">
                No upcoming slots — add availability so prospects can book calls.
              </p>
              <Button variant="outline" size="sm" onClick={() => setShowAddDialog(true)}>
                <Plus className="h-3 w-3 mr-1" />
                Add Slots
              </Button>
            </div>
          ) : (
            <div className="space-y-2">
              {upcomingSlots.map(slot => (
                <div
                  key={slot.id}
                  className="flex items-center justify-between p-3 rounded-lg border hover:bg-zinc-800/30 transition-colors group"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <Clock className="h-4 w-4 text-muted-foreground shrink-0" />
                    <div className="min-w-0">
                      <div className="text-sm font-medium truncate">
                        {formatSlotTime(slot.slotStart, slot.slotEnd)}
                      </div>
                      <div className={`text-xs flex items-center gap-1 ${getHostColor(slot.hostName)}`}>
                        <User className="h-3 w-3" />
                        {slot.hostName}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {slot.isBooked ? (
                      <Badge className="text-green-600 border-green-500/30">
                        <CheckCircle className="h-3 w-3 mr-1" />
                        {slot.bookedByName}
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="text-amber-500 border-amber-500/30">
                        Available
                      </Badge>
                    )}
                    {!slot.isBooked && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-destructive opacity-0 group-hover:opacity-100 transition-opacity"
                        onClick={() => setDeletingSlotId(slot.id)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
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
        <Card className={adminTw.card}>
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
                          <span className="text-muted-foreground font-normal ml-2 text-xs">
                            ({slot.bookedByEmail})
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-muted-foreground mt-0.5">
                        {formatSlotTime(slot.slotStart, slot.slotEnd)} · with{" "}
                        <span className={getHostColor(slot.hostName)}>{slot.hostName}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-xs h-7"
                        onClick={() => setEditingNotes({ slotId: slot.id, notes: slot.meetingNotes ?? "" })}
                      >
                        <Pencil className="h-3 w-3 mr-1" />
                        Notes
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-destructive"
                        onClick={() => setDeletingSlotId(slot.id)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                  {slot.meetingNotes && (
                    <div className="text-xs text-muted-foreground text-zinc-500">
                      {slot.meetingNotes}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Past slots (collapsed) */}
      {pastSlots.length > 0 && (
        <details className="group">
          <summary className="cursor-pointer text-sm text-muted-foreground hover:text-foreground flex items-center gap-2 py-2">
            <RefreshCw className="h-3.5 w-3.5" />
            {pastSlots.length} past slot{pastSlots.length !== 1 ? "s" : ""}
          </summary>
          <div className="mt-2 space-y-1">
            {pastSlots.slice(0, 20).map(slot => (
              <div key={slot.id} className="flex items-center justify-between p-2 rounded border  text-sm">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Clock className="h-3.5 w-3.5" />
                  {formatSlotTime(slot.slotStart, slot.slotEnd)} · {slot.hostName}
                </div>
                <div className="flex items-center gap-2">
                  {slot.isBooked ? (
                    <Badge variant="outline" className="text-xs text-green-600">Completed</Badge>
                  ) : (
                    <Badge variant="outline" className="text-xs text-muted-foreground">Expired</Badge>
                  )}
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 text-destructive"
                    onClick={() => setDeletingSlotId(slot.id)}
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </details>
      )}

      {/* Add Availability Dialog */}
      <Dialog open={showAddDialog} onOpenChange={open => { setShowAddDialog(open); if (!open) resetForm(); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add Availability Slots</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            {/* Host selector */}
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Host</label>
              <Select value={hostEmail} onValueChange={setHostEmail}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TEAM_MEMBERS.map(m => (
                    <SelectItem key={m.email} value={m.email}>
                      <span className="flex items-center gap-2">
                        <User className="h-3.5 w-3.5 text-muted-foreground" />
                        {m.name}
                        <span className="text-muted-foreground text-xs">({m.email})</span>
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Date + Time */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Start date</label>
                <Input
                  type="date"
                  value={slotDate}
                  onChange={e => setSlotDate(e.target.value)}
                  min={new Date().toISOString().split("T")[0]}
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Start time</label>
                <Input
                  type="time"
                  value={slotTime}
                  onChange={e => setSlotTime(e.target.value)}
                />
              </div>
            </div>

            {/* Duration */}
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

            {/* Recurrence */}
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Repeat</label>
              <Select value={String(bulkDays)} onValueChange={v => setBulkDays(Number(v))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {RECURRENCE_OPTIONS.map(r => (
                    <SelectItem key={r.value} value={String(r.value)}>{r.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Preview */}
            {previewSlots.length > 0 && (
              <div className="rounded-lg border border-zinc-800 p-3 space-y-1.5">
                <p className="text-xs font-medium text-muted-foreground">Preview ({bulkDays} slot{bulkDays !== 1 ? "s" : ""})</p>
                {previewSlots.map((s, i) => (
                  <div key={i} className="text-xs text-foreground">
                    {formatSlotTime(s.start, s.end)}
                  </div>
                ))}
                {bulkDays > 5 && (
                  <p className="text-xs text-muted-foreground">…and {bulkDays - 5} more</p>
                )}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowAddDialog(false); resetForm(); }}>
              Cancel
            </Button>
            <Button onClick={handleAddSlots} disabled={addSlotsMutation.isPending}>
              {addSlotsMutation.isPending
                ? "Adding…"
                : `Add ${bulkDays} slot${bulkDays !== 1 ? "s" : ""}`}
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

      {/* Delete Confirmation Dialog */}
      <Dialog open={deletingSlotId !== null} onOpenChange={open => !open && setDeletingSlotId(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete Slot</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Are you sure you want to delete this slot? This action cannot be undone.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeletingSlotId(null)}>Cancel</Button>
            <Button
              variant="destructive"
              onClick={() => {
                if (deletingSlotId !== null) {
                  deleteSlotMutation.mutate({ slotId: deletingSlotId });
                  setDeletingSlotId(null);
                }
              }}
              disabled={deleteSlotMutation.isPending}
            >
              {deleteSlotMutation.isPending ? "Deleting…" : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminPage>
  );
}
