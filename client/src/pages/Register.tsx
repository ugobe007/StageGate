import { useState } from "react";
import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { trpc } from "@/lib/trpc";
import Navbar from "@/components/Navbar";
import { useAuth } from "@/_core/hooks/useAuth";
import { getLoginUrl } from "@/const";
import { CheckCircle, ArrowRight, Loader2 } from "lucide-react";
import { toast } from "sonner";

const ROBOT_TYPES = [
  "Humanoid Robot", "Industrial Robot", "Collaborative Robot (Cobot)",
  "Delivery Robot", "Service Robot", "Drone / UAV", "Medical Robot",
  "Agricultural Robot", "Security Robot", "Other",
];

export default function Register() {
  const { user, isAuthenticated, loading } = useAuth();
  const [, navigate] = useLocation();
  const { data: existingProfile } = trpc.company.getMyProfile.useQuery(undefined, { enabled: isAuthenticated });

  const [form, setForm] = useState({
    companyName: "",
    website: "",
    contactName: "",
    contactEmail: "",
    contactPhone: "",
    country: "",
    description: "",
    robotTypes: [] as string[],
  });

  const upsertProfile = trpc.company.upsertProfile.useMutation({
    onSuccess: () => {
      toast.success("Company profile saved! Welcome to StageGate.");
      navigate("/dashboard");
    },
    onError: (err) => {
      toast.error(err.message || "Failed to save profile");
    },
  });

  const toggleRobotType = (type: string) => {
    setForm((prev) => ({
      ...prev,
      robotTypes: prev.robotTypes.includes(type)
        ? prev.robotTypes.filter((t) => t !== type)
        : [...prev.robotTypes, type],
    }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.companyName) {
      toast.error("Company name is required");
      return;
    }
    upsertProfile.mutate({
      ...form,
      robotTypes: JSON.stringify(form.robotTypes),
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="animate-spin text-primary" size={32} />
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-background text-foreground">
        <Navbar />
        <div className="pt-32 pb-16">
          <div className="container max-w-lg mx-auto text-center">
            <div className="p-12 rounded-2xl border border-primary/30 bg-primary/5">
              <div className="w-16 h-16 rounded-2xl bg-primary/20 flex items-center justify-center mx-auto mb-6">
                <span className="text-2xl font-bold text-primary">SG</span>
              </div>
              <h1 className="text-3xl font-display font-bold mb-4">Register Your Company</h1>
              <p className="text-muted-foreground mb-8">
                Create a free StageGate account to register your company and access our full service catalog.
              </p>
              <a href={getLoginUrl()}>
                <Button size="lg" className="bg-primary text-primary-foreground hover:bg-primary/90 font-bold w-full gap-2">
                  Sign In to Continue
                  <ArrowRight size={16} />
                </Button>
              </a>
              <p className="mt-4 text-xs text-muted-foreground">Free forever · No credit card required</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (existingProfile) {
    return (
      <div className="min-h-screen bg-background text-foreground">
        <Navbar />
        <div className="pt-32 pb-16">
          <div className="container max-w-lg mx-auto text-center">
            <div className="p-12 rounded-2xl border border-primary/30 bg-primary/5">
              <CheckCircle size={48} className="text-primary mx-auto mb-4" />
              <h1 className="text-3xl font-display font-bold mb-4">You're Already Registered!</h1>
              <p className="text-muted-foreground mb-2">
                <strong className="text-foreground">{existingProfile.companyName}</strong> is registered on StageGate.
              </p>
              <p className="text-muted-foreground mb-8">Head to your dashboard to view orders, book services, or update your profile.</p>
              <div className="flex flex-col gap-3">
                <Link href="/dashboard">
                  <Button size="lg" className="bg-primary text-primary-foreground hover:bg-primary/90 font-bold w-full gap-2">
                    Go to Dashboard <ArrowRight size={16} />
                  </Button>
                </Link>
                <Link href="/order">
                  <Button size="lg" variant="outline" className="border-border w-full">
                    Book Services
                  </Button>
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Navbar />
      <div className="pt-24 pb-16">
        <div className="container max-w-2xl mx-auto">
          <div className="text-center mb-10">
            <Badge className="mb-4 bg-primary/10 text-primary border-primary/30">Free Registration</Badge>
            <h1 className="text-4xl font-display font-bold mb-3">Register Your Company</h1>
            <p className="text-muted-foreground">
              Tell us about your company and robots. This takes about 3 minutes.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-8">
            {/* Company Info */}
            <div className="p-8 rounded-2xl border border-border bg-card">
              <h2 className="font-display font-bold text-lg text-foreground mb-6">Company Information</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div className="md:col-span-2">
                  <Label htmlFor="companyName" className="text-sm font-medium text-foreground mb-2 block">
                    Company Name <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="companyName"
                    value={form.companyName}
                    onChange={(e) => setForm({ ...form, companyName: e.target.value })}
                    placeholder="Acme Robotics Inc."
                    className="bg-input border-border"
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="website" className="text-sm font-medium text-foreground mb-2 block">Website</Label>
                  <Input
                    id="website"
                    value={form.website}
                    onChange={(e) => setForm({ ...form, website: e.target.value })}
                    placeholder="https://acmerobotics.com"
                    className="bg-input border-border"
                  />
                </div>
                <div>
                  <Label htmlFor="country" className="text-sm font-medium text-foreground mb-2 block">Country of Origin</Label>
                  <Input
                    id="country"
                    value={form.country}
                    onChange={(e) => setForm({ ...form, country: e.target.value })}
                    placeholder="United States"
                    className="bg-input border-border"
                  />
                </div>
                <div className="md:col-span-2">
                  <Label htmlFor="description" className="text-sm font-medium text-foreground mb-2 block">Company Description</Label>
                  <Textarea
                    id="description"
                    value={form.description}
                    onChange={(e) => setForm({ ...form, description: e.target.value })}
                    placeholder="Brief description of your company and the robots you make..."
                    className="bg-input border-border resize-none"
                    rows={3}
                  />
                </div>
              </div>
            </div>

            {/* Contact Info */}
            <div className="p-8 rounded-2xl border border-border bg-card">
              <h2 className="font-display font-bold text-lg text-foreground mb-6">Primary Contact</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div>
                  <Label htmlFor="contactName" className="text-sm font-medium text-foreground mb-2 block">Contact Name</Label>
                  <Input
                    id="contactName"
                    value={form.contactName}
                    onChange={(e) => setForm({ ...form, contactName: e.target.value })}
                    placeholder="Jane Smith"
                    className="bg-input border-border"
                  />
                </div>
                <div>
                  <Label htmlFor="contactEmail" className="text-sm font-medium text-foreground mb-2 block">Contact Email</Label>
                  <Input
                    id="contactEmail"
                    type="email"
                    value={form.contactEmail}
                    onChange={(e) => setForm({ ...form, contactEmail: e.target.value })}
                    placeholder="jane@acmerobotics.com"
                    className="bg-input border-border"
                  />
                </div>
                <div>
                  <Label htmlFor="contactPhone" className="text-sm font-medium text-foreground mb-2 block">Contact Phone</Label>
                  <Input
                    id="contactPhone"
                    value={form.contactPhone}
                    onChange={(e) => setForm({ ...form, contactPhone: e.target.value })}
                    placeholder="+1 (555) 000-0000"
                    className="bg-input border-border"
                  />
                </div>
              </div>
            </div>

            {/* Robot Types */}
            <div className="p-8 rounded-2xl border border-border bg-card">
              <h2 className="font-display font-bold text-lg text-foreground mb-2">Robot Types</h2>
              <p className="text-sm text-muted-foreground mb-5">Select all robot types your company makes or sells.</p>
              <div className="flex flex-wrap gap-2">
                {ROBOT_TYPES.map((type) => (
                  <button
                    key={type}
                    type="button"
                    onClick={() => toggleRobotType(type)}
                    className={`px-3 py-1.5 rounded-full text-sm border transition-all ${
                      form.robotTypes.includes(type)
                        ? "bg-primary text-primary-foreground border-primary font-medium"
                        : "bg-secondary text-muted-foreground border-border hover:border-primary/50 hover:text-foreground"
                    }`}
                  >
                    {type}
                  </button>
                ))}
              </div>
            </div>

            {/* Submit */}
            <div className="flex flex-col sm:flex-row gap-4">
              <Button
                type="submit"
                size="lg"
                className="flex-1 bg-primary text-primary-foreground hover:bg-primary/90 font-bold gap-2"
                disabled={upsertProfile.isPending}
              >
                {upsertProfile.isPending ? (
                  <><Loader2 size={16} className="animate-spin" /> Saving...</>
                ) : (
                  <>Complete Registration <ArrowRight size={16} /></>
                )}
              </Button>
              <Link href="/">
                <Button size="lg" variant="outline" className="border-border text-muted-foreground">
                  Cancel
                </Button>
              </Link>
            </div>
            <p className="text-xs text-center text-muted-foreground">
              Free forever · No credit card required · You can update your profile anytime
            </p>
          </form>
        </div>
      </div>
    </div>
  );
}
