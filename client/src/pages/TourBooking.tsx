/**
 * client/src/pages/TourBooking.tsx
 *
 * Showroom Tour Booking — Cal's first CTA landing page.
 * Visitors can request a showroom tour or off-floor demo consultation.
 * Form submits via the existing bookingRequest tRPC procedure and
 * sends a notification to the owner.
 */
import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import {
  MapPin, Calendar, Bot, Zap, CheckCircle2,
  ArrowRight, Factory, Cpu, Building2, Warehouse
} from "lucide-react";

const VENUES = [
  {
    id: "stagegate_office",
    icon: Building2,
    name: "StageGate Las Vegas Office",
    description: "Our dedicated robot staging and demo space. Controlled environment, power available, loading dock access.",
    highlight: "Free for qualified robot companies",
    color: "border-amber-500/40 bg-amber-500/5",
    iconColor: "text-amber-400",
  },
  {
    id: "innovation_center",
    icon: Zap,
    name: "Downtown Innovation Center",
    description: "Modern event space in downtown Las Vegas. Great for press demos, investor meetings, and customer showcases.",
    highlight: "We can arrange access",
    color: "border-blue-500/40 bg-blue-500/5",
    iconColor: "text-blue-400",
  },
  {
    id: "black_fire",
    icon: Factory,
    name: "Black Fire Innovation Center",
    description: "UNLV's tech hub near the Strip. Ideal for academic partnerships, startup demos, and media coverage.",
    highlight: "Near the convention center",
    color: "border-violet-500/40 bg-violet-500/5",
    iconColor: "text-violet-400",
  },
  {
    id: "hotel_casino",
    icon: Warehouse,
    name: "Hotel / Casino Venue",
    description: "Many Strip properties offer meeting rooms and ballrooms at low or no cost for qualified exhibitors.",
    highlight: "We know who to call",
    color: "border-emerald-500/40 bg-emerald-500/5",
    iconColor: "text-emerald-400",
  },
];

const ROBOT_TYPES = [
  "Humanoid / Biped",
  "Mobile Robot / AMR",
  "Industrial Arm / Manipulator",
  "Drone / Aerial",
  "Heavy Industrial (Fanuc, Yaskawa, KUKA, Omron)",
  "Service Robot",
  "Collaborative Robot (Cobot)",
  "Other",
];

export default function TourBooking() {
  const [submitted, setSubmitted] = useState(false);
  const [form, setForm] = useState({
    company: "",
    contactName: "",
    contactEmail: "",
    robotType: "",
    showName: "",
    preferredVenue: "",
    notes: "",
  });

  const bookTour = trpc.bookings.create.useMutation({
    onSuccess: () => {
      setSubmitted(true);
      toast.success("Request sent! Cal will be in touch shortly.");
    },
    onError: (err: { message: string }) => {
      toast.error(`Something went wrong: ${err.message}`);
    },
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.company || !form.contactEmail) {
      toast.error("Company name and email are required.");
      return;
    }
    bookTour.mutate({
      company: form.company,
      contactName: form.contactName || "(not provided)",
      contactEmail: form.contactEmail,
      robotType: form.robotType || undefined,
      showName: form.showName || undefined,
      specialHandling: [
        form.preferredVenue ? `Preferred venue: ${form.preferredVenue}` : "",
        form.notes,
      ].filter(Boolean).join("\n") || undefined,
      services: ["showroom_tour"],
    });
  }

  if (submitted) {
    return (
      <div className="min-h-screen bg-zinc-950 text-white flex items-center justify-center px-4">
        <div className="max-w-md text-center space-y-6">
          <div className="w-16 h-16 rounded-full bg-emerald-500/20 flex items-center justify-center mx-auto">
            <CheckCircle2 className="w-8 h-8 text-emerald-400" />
          </div>
          <h1 className="text-2xl font-bold text-white">You're on Cal's list.</h1>
          <p className="text-zinc-400 leading-relaxed">
            Cal will reach out within 24 hours to confirm your showroom tour or off-floor demo space.
            In the meantime, if you have questions, email{" "}
            <a href="mailto:cal@onstage.bot" className="text-amber-400 hover:underline">cal@onstage.bot</a>.
          </p>
          <a
            href="/"
            className="inline-flex items-center gap-2 text-sm text-zinc-400 hover:text-white transition-colors"
          >
            ← Back to StageGate
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-white">
      {/* Hero */}
      <div className="border-b border-zinc-800 bg-zinc-900/50">
        <div className="max-w-4xl mx-auto px-6 py-16">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-lg bg-amber-500/20 flex items-center justify-center">
              <Bot className="w-5 h-5 text-amber-400" />
            </div>
            <span className="text-sm text-zinc-400">StageGate · Las Vegas</span>
          </div>
          <h1 className="text-4xl font-bold text-white mb-4 leading-tight">
            Book a Showroom Tour<br />
            <span className="text-amber-400">or Off-Floor Demo Space</span>
          </h1>
          <p className="text-lg text-zinc-400 max-w-2xl leading-relaxed">
            The trade show floor isn't always the best place to demo your robot. We can set you up
            with a proper space — controlled environment, right power, real audience — before, during,
            or after the show.
          </p>
          <div className="flex flex-wrap gap-3 mt-6">
            {[
              "No floor space required",
              "We handle logistics",
              "Heavy industrial welcome",
              "Free for qualified companies",
            ].map(tag => (
              <span key={tag} className="px-3 py-1 rounded-full bg-zinc-800 text-zinc-300 text-sm border border-zinc-700">
                {tag}
              </span>
            ))}
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-6 py-12">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
          {/* Left: Venue options */}
          <div>
            <h2 className="text-lg font-semibold text-white mb-6">Available Venues</h2>
            <div className="space-y-4">
              {VENUES.map(({ id, icon: Icon, name, description, highlight, color, iconColor }) => (
                <div
                  key={id}
                  onClick={() => setForm(f => ({ ...f, preferredVenue: id }))}
                  className={`rounded-xl border p-4 cursor-pointer transition-all ${color} ${
                    form.preferredVenue === id ? "ring-2 ring-amber-500" : "hover:border-zinc-600"
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <div className={`w-8 h-8 rounded-lg bg-zinc-800 flex items-center justify-center flex-shrink-0 ${iconColor}`}>
                      <Icon className="w-4 h-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <span className="font-medium text-sm text-white">{name}</span>
                        {form.preferredVenue === id && (
                          <CheckCircle2 className="w-4 h-4 text-amber-400 flex-shrink-0" />
                        )}
                      </div>
                      <p className="text-xs text-zinc-500 leading-relaxed mb-1.5">{description}</p>
                      <span className="text-xs text-amber-400 font-medium">{highlight}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-8 p-4 rounded-xl bg-zinc-900 border border-zinc-800">
              <div className="flex items-center gap-2 mb-2">
                <MapPin className="w-4 h-4 text-zinc-500" />
                <span className="text-sm font-medium text-zinc-300">Las Vegas, NV</span>
              </div>
              <p className="text-xs text-zinc-500 leading-relaxed">
                All venues are within 15 minutes of the Las Vegas Convention Center and Mandalay Bay
                Convention Center. We coordinate transport for heavy equipment when needed.
              </p>
            </div>
          </div>

          {/* Right: Form */}
          <div>
            <h2 className="text-lg font-semibold text-white mb-6">Request a Tour</h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs text-zinc-400 mb-1.5 font-medium">Company *</label>
                <Input
                  value={form.company}
                  onChange={e => setForm(f => ({ ...f, company: e.target.value }))}
                  placeholder="Acme Robotics"
                  className="bg-zinc-900 border-zinc-700 text-white placeholder:text-zinc-600"
                  required
                />
              </div>
              <div>
                <label className="block text-xs text-zinc-400 mb-1.5 font-medium">Your Name</label>
                <Input
                  value={form.contactName}
                  onChange={e => setForm(f => ({ ...f, contactName: e.target.value }))}
                  placeholder="Alex Chen"
                  className="bg-zinc-900 border-zinc-700 text-white placeholder:text-zinc-600"
                />
              </div>
              <div>
                <label className="block text-xs text-zinc-400 mb-1.5 font-medium">Email *</label>
                <Input
                  type="email"
                  value={form.contactEmail}
                  onChange={e => setForm(f => ({ ...f, contactEmail: e.target.value }))}
                  placeholder="alex@acmerobotics.com"
                  className="bg-zinc-900 border-zinc-700 text-white placeholder:text-zinc-600"
                  required
                />
              </div>
              <div>
                <label className="block text-xs text-zinc-400 mb-1.5 font-medium">Robot Type</label>
                <select
                  value={form.robotType}
                  onChange={e => setForm(f => ({ ...f, robotType: e.target.value }))}
                  className="w-full h-9 px-3 rounded-md bg-zinc-900 border border-zinc-700 text-white text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
                >
                  <option value="">Select type…</option>
                  {ROBOT_TYPES.map(t => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs text-zinc-400 mb-1.5 font-medium">
                  Upcoming Show
                </label>
                <Input
                  value={form.showName}
                  onChange={e => setForm(f => ({ ...f, showName: e.target.value }))}
                  placeholder="CES 2026, NAB 2026, MODEX…"
                  className="bg-zinc-900 border-zinc-700 text-white placeholder:text-zinc-600"
                />
              </div>
              <div>
                <label className="block text-xs text-zinc-400 mb-1.5 font-medium">
                  Notes / Special Requirements
                </label>
                <Textarea
                  value={form.notes}
                  onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                  placeholder="Power requirements, weight, dimensions, demo audience size, preferred dates…"
                  rows={4}
                  className="bg-zinc-900 border-zinc-700 text-white placeholder:text-zinc-600 resize-none"
                />
              </div>

              {form.preferredVenue && (
                <div className="flex items-center gap-2 text-xs text-amber-400 bg-amber-500/10 rounded-lg px-3 py-2 border border-amber-500/20">
                  <Calendar className="w-3.5 h-3.5" />
                  <span>
                    Preferred venue: {VENUES.find(v => v.id === form.preferredVenue)?.name}
                  </span>
                </div>
              )}

              <Button
                type="submit"
                className="w-full bg-amber-500 hover:bg-amber-600 text-black font-semibold gap-2 h-11"
                disabled={bookTour.isPending}
              >
                {bookTour.isPending ? (
                  "Sending to Cal…"
                ) : (
                  <>Request Tour <ArrowRight className="w-4 h-4" /></>
                )}
              </Button>
              <p className="text-xs text-zinc-600 text-center">
                Cal will follow up within 24 hours at{" "}
                <a href="mailto:cal@onstage.bot" className="text-zinc-500 hover:text-zinc-400">
                  cal@onstage.bot
                </a>
              </p>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
