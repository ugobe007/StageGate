/**
 * Schedule.tsx — Public prospect-facing scheduling page (v21)
 *
 * Shows available call slots grouped by date.
 * Prospect fills in name, email, company → slot is booked.
 * Host + prospect receive calendar invite emails (ICS) via Resend.
 */
import { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Link } from "wouter";
import { Calendar, Clock, User, CheckCircle, ChevronRight, ArrowLeft } from "lucide-react";

// Fetch 60 days of upcoming slots
const START = new Date();
const END = new Date(Date.now() + 60 * 24 * 60 * 60 * 1000);

function formatDate(d: Date) {
  return d.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });
}
function formatTime(d: Date) {
  return d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
}
function formatDuration(start: Date, end: Date) {
  const mins = Math.round((end.getTime() - start.getTime()) / 60000);
  if (mins < 60) return `${mins} min`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m ? `${h}h ${m}m` : `${h}h`;
}
function dateKey(d: Date) {
  return d.toISOString().split("T")[0];
}

type Slot = {
  id: number;
  hostName: string;
  hostEmail: string;
  slotStart: Date;
  slotEnd: Date;
  isBooked: boolean | null;
};

export default function Schedule() {
  const { data: slots = [], isLoading } = trpc.scheduling.getAvailableSlots.useQuery(
    { startDate: START, endDate: END },
    { staleTime: 30_000 }
  );

  const bookSlotMutation = trpc.scheduling.bookSlot.useMutation({
    onSuccess: () => {
      setBookingDone(true);
    },
    onError: (err) => {
      if (err.data?.code === "CONFLICT") {
        toast.error("That slot was just taken — please choose another.");
      } else {
        toast.error(err.message || "Something went wrong. Please try again.");
      }
      setSelectedSlot(null);
    },
  });

  const [selectedSlot, setSelectedSlot] = useState<Slot | null>(null);
  const [bookingDone, setBookingDone] = useState(false);
  const [form, setForm] = useState({ name: "", email: "", company: "" });

  // Group slots by date
  const grouped = useMemo(() => {
    const map = new Map<string, Slot[]>();
    for (const s of slots) {
      const key = dateKey(new Date(s.slotStart));
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(s as Slot);
    }
    return Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b));
  }, [slots]);

  function handleBook() {
    if (!form.name.trim() || !form.email.trim()) {
      toast.error("Name and email are required.");
      return;
    }
    if (!selectedSlot) return;
    bookSlotMutation.mutate({
      slotId: selectedSlot.id,
      bookedByName: form.name,
      bookedByEmail: form.email,
      company: form.company || undefined,
    });
  }

  return (
    <div style={{ background: "#050508", minHeight: "100vh", color: "#fff" }}>
      {/* Nav */}
      <div style={{ borderBottom: "1px solid rgba(255,255,255,0.08)", padding: "24px 0" }}>
        <div style={{ maxWidth: 1100, margin: "0 auto", padding: "0 24px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <Link href="/">
            <span style={{ fontSize: 13, color: "rgba(255,255,255,0.45)", letterSpacing: "0.08em", textTransform: "uppercase", cursor: "pointer", display: "flex", alignItems: "center", gap: 6 }}>
              <ArrowLeft size={13} /> Back to StageGate
            </span>
          </Link>
          <Link href="/get-started">
            <button style={{ background: "#f59e0b", color: "#000", border: "none", borderRadius: 6, padding: "8px 16px", fontWeight: 700, fontSize: 13, cursor: "pointer" }}>
              Get Started →
            </button>
          </Link>
        </div>
      </div>

      {/* Hero */}
      <div style={{ maxWidth: 1100, margin: "0 auto", padding: "64px 24px 40px" }}>
        <p style={{ fontSize: 11, letterSpacing: "0.18em", textTransform: "uppercase", color: "#f59e0b", marginBottom: 16 }}>
          Schedule a Call
        </p>
        <h1 style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: "clamp(2rem, 5vw, 3.5rem)", fontWeight: 700, lineHeight: 1.1, letterSpacing: "-0.03em", marginBottom: 20 }}>
          Talk to the StageGate team.
        </h1>
        <p style={{ fontSize: 18, color: "rgba(255,255,255,0.75)", maxWidth: 560, lineHeight: 1.6, marginBottom: 8 }}>
          We'll walk through your robot's logistics needs, upcoming shows, and how StageGate can handle everything from port to booth.
        </p>
        <p style={{ fontSize: 13, color: "rgba(255,255,255,0.4)", letterSpacing: "0.04em" }}>
          All times shown in your local timezone. Calls are 30–60 minutes.
        </p>
      </div>

      {/* Divider */}
      <div style={{ maxWidth: 1100, margin: "0 auto", padding: "0 24px" }}>
        <div style={{ borderTop: "1px solid rgba(255,255,255,0.08)", marginBottom: 40 }} />
      </div>

      {/* Slot list */}
      <div style={{ maxWidth: 1100, margin: "0 auto", padding: "0 24px 80px" }}>
        {isLoading ? (
          <div style={{ textAlign: "center", padding: "60px 0", color: "rgba(255,255,255,0.4)" }}>
            <Clock size={32} style={{ margin: "0 auto 12px", display: "block", opacity: 0.4 }} />
            <p>Loading available times…</p>
          </div>
        ) : grouped.length === 0 ? (
          <div style={{ textAlign: "center", padding: "60px 0" }}>
            <Calendar size={40} style={{ margin: "0 auto 16px", display: "block", color: "rgba(255,255,255,0.25)" }} />
            <p style={{ fontSize: 18, fontWeight: 600, marginBottom: 8 }}>No slots available right now</p>
            <p style={{ color: "rgba(255,255,255,0.45)", fontSize: 14, marginBottom: 24 }}>
              Check back soon, or reach us directly at{" "}
              <a href="mailto:hello@onstage.bot" style={{ color: "#f59e0b" }}>hello@onstage.bot</a>
            </p>
            <Link href="/get-started">
              <button style={{ background: "#f59e0b", color: "#000", border: "none", borderRadius: 6, padding: "10px 20px", fontWeight: 700, fontSize: 14, cursor: "pointer" }}>
                Submit a Request Instead →
              </button>
            </Link>
          </div>
        ) : (
          <div style={{ display: "grid", gap: 32 }}>
            {grouped.map(([key, daySlots]) => (
              <div key={key}>
                {/* Date header */}
                <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
                  <Calendar size={15} style={{ color: "#f59e0b" }} />
                  <h3 style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 600, fontSize: 15, color: "rgba(255,255,255,0.9)" }}>
                    {formatDate(new Date(daySlots[0].slotStart))}
                  </h3>
                  <div style={{ flex: 1, height: 1, background: "rgba(255,255,255,0.06)" }} />
                  <span style={{ fontSize: 11, color: "rgba(255,255,255,0.3)" }}>
                    {daySlots.length} slot{daySlots.length !== 1 ? "s" : ""}
                  </span>
                </div>
                {/* Slots for this day */}
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 10 }}>
                  {daySlots.map(slot => (
                    <button
                      key={slot.id}
                      onClick={() => {
                        setSelectedSlot(slot as Slot);
                        setBookingDone(false);
                        setForm({ name: "", email: "", company: "" });
                      }}
                      style={{
                        background: "rgba(255,255,255,0.03)",
                        border: "1px solid rgba(255,255,255,0.1)",
                        borderRadius: 10,
                        padding: "14px 16px",
                        textAlign: "left",
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        gap: 12,
                        color: "#fff",
                      }}
                      onMouseEnter={e => {
                        (e.currentTarget as HTMLButtonElement).style.background = "rgba(245,158,11,0.08)";
                        (e.currentTarget as HTMLButtonElement).style.borderColor = "rgba(245,158,11,0.3)";
                      }}
                      onMouseLeave={e => {
                        (e.currentTarget as HTMLButtonElement).style.background = "rgba(255,255,255,0.03)";
                        (e.currentTarget as HTMLButtonElement).style.borderColor = "rgba(255,255,255,0.1)";
                      }}
                    >
                      <div>
                        <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
                          <Clock size={13} style={{ color: "#f59e0b" }} />
                          <span style={{ fontWeight: 600, fontSize: 14 }}>
                            {formatTime(new Date(slot.slotStart))}
                          </span>
                          <span style={{ fontSize: 11, color: "rgba(255,255,255,0.35)" }}>
                            ({formatDuration(new Date(slot.slotStart), new Date(slot.slotEnd))})
                          </span>
                        </div>
                        <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                          <User size={11} style={{ color: "rgba(255,255,255,0.35)" }} />
                          <span style={{ fontSize: 12, color: "rgba(255,255,255,0.5)" }}>{slot.hostName}</span>
                        </div>
                      </div>
                      <ChevronRight size={16} style={{ color: "rgba(255,255,255,0.25)", flexShrink: 0 }} />
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* What to expect */}
      <div style={{ borderTop: "1px solid rgba(255,255,255,0.08)", padding: "60px 0" }}>
        <div style={{ maxWidth: 1100, margin: "0 auto", padding: "0 24px", display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 48 }}>
          {[
            { num: "01", title: "15-minute intro", desc: "Tell us about your robot, your next show, and your timeline." },
            { num: "02", title: "Custom logistics plan", desc: "We'll outline a full plan: customs, shipping, staging, and activation." },
            { num: "03", title: "No obligation", desc: "No sales pressure. If we're not the right fit, we'll say so." },
          ].map(item => (
            <div key={item.num}>
              <span style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 11, letterSpacing: "0.18em", textTransform: "uppercase" as const, color: "rgba(255,255,255,0.25)", display: "block", marginBottom: 10 }}>
                {item.num}
              </span>
              <h3 style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 18, fontWeight: 600, marginBottom: 8, color: "#fff" }}>
                {item.title}
              </h3>
              <p style={{ fontSize: 14, color: "rgba(255,255,255,0.55)", lineHeight: 1.6 }}>{item.desc}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Booking Dialog */}
      <Dialog
        open={!!selectedSlot}
        onOpenChange={open => {
          if (!open) {
            setSelectedSlot(null);
            setBookingDone(false);
          }
        }}
      >
        <DialogContent className="sm:max-w-md bg-neutral-900 border-neutral-700 text-white">
          <DialogHeader>
            <DialogTitle className="text-white">
              {bookingDone ? "You're booked!" : "Book this slot"}
            </DialogTitle>
          </DialogHeader>

          {selectedSlot && !bookingDone && (
            <>
              {/* Slot summary */}
              <div className="rounded-lg border border-neutral-700 bg-neutral-800 p-4 space-y-1.5 mb-2">
                <div className="flex items-center gap-2 text-sm font-medium text-white">
                  <Calendar size={14} className="text-amber-500" />
                  {formatDate(new Date(selectedSlot.slotStart))}
                </div>
                <div className="flex items-center gap-2 text-sm text-neutral-300">
                  <Clock size={14} className="text-amber-500" />
                  {formatTime(new Date(selectedSlot.slotStart))} — {formatTime(new Date(selectedSlot.slotEnd))}
                  <span className="text-neutral-500 text-xs">
                    ({formatDuration(new Date(selectedSlot.slotStart), new Date(selectedSlot.slotEnd))})
                  </span>
                </div>
                <div className="flex items-center gap-2 text-sm text-neutral-400">
                  <User size={14} />
                  with {selectedSlot.hostName}
                </div>
              </div>

              {/* Prospect form */}
              <div className="space-y-3">
                <div>
                  <label className="text-xs font-medium text-neutral-400 block mb-1">Your name *</label>
                  <Input
                    value={form.name}
                    onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                    placeholder="Jane Smith"
                    className="bg-neutral-800 border-neutral-600 text-white placeholder:text-neutral-500 h-10"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-neutral-400 block mb-1">Email address *</label>
                  <Input
                    type="email"
                    value={form.email}
                    onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                    placeholder="jane@robotics.com"
                    className="bg-neutral-800 border-neutral-600 text-white placeholder:text-neutral-500 h-10"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-neutral-400 block mb-1">Company</label>
                  <Input
                    value={form.company}
                    onChange={e => setForm(f => ({ ...f, company: e.target.value }))}
                    placeholder="Acme Robotics"
                    className="bg-neutral-800 border-neutral-600 text-white placeholder:text-neutral-500 h-10"
                  />
                </div>
                <p className="text-xs text-neutral-500">
                  A calendar invite (.ics) will be sent to your email and to {selectedSlot.hostName}.
                </p>
              </div>

              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => setSelectedSlot(null)}
                  className="border-neutral-600 text-neutral-300 hover:bg-neutral-800"
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleBook}
                  disabled={bookSlotMutation.isPending}
                  className="bg-amber-500 hover:bg-amber-600 text-black font-bold"
                >
                  {bookSlotMutation.isPending ? "Booking…" : "Confirm Booking"}
                </Button>
              </DialogFooter>
            </>
          )}

          {bookingDone && selectedSlot && (
            <div className="text-center py-4 space-y-4">
              <div className="w-14 h-14 rounded-full bg-green-500/10 flex items-center justify-center mx-auto">
                <CheckCircle className="h-7 w-7 text-green-500" />
              </div>
              <div>
                <p className="text-base font-semibold text-white mb-1">Call confirmed!</p>
                <p className="text-sm text-neutral-400">
                  {formatDate(new Date(selectedSlot.slotStart))} at {formatTime(new Date(selectedSlot.slotStart))} with {selectedSlot.hostName}
                </p>
              </div>
              <div className="rounded-lg border border-green-500/20 bg-green-500/5 p-3 text-left">
                <p className="text-xs text-green-400 font-medium mb-1">Calendar invite sent</p>
                <p className="text-xs text-neutral-400">
                  Check <strong className="text-white">{form.email}</strong> for a calendar invite (.ics). {selectedSlot.hostName} has also been notified.
                </p>
              </div>
              <Button
                onClick={() => { setSelectedSlot(null); setBookingDone(false); }}
                className="bg-amber-500 hover:bg-amber-600 text-black font-bold w-full"
              >
                Done
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
