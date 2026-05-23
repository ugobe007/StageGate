/**
 * StageGate RSS feed registry — cross-referenced with Ready For Robots scrape_targets.py
 *
 * Categories:
 *   oem_prospect     — robot OEM show attendance, product launches (shared w/ RFR OEM_INTELLIGENCE)
 *   show_ecosystem   — organizers, exhibit houses, AV, event cos (StageGate partners)
 *   logistics_freight — freight/drayage/trade show logistics (shared w/ RFR buyer logistics feeds)
 *   pr_releases      — press release wires (robotics tags)
 *   google_monitor   — Google News RSS monitors for show + OEM signals
 *
 * sharedWithRfr: true when the same URL exists in Ready For Robots RSS_FEED_TARGETS or OEM_INTELLIGENCE_TARGETS
 */

export type RssFeedCategory =
  | "oem_prospect"
  | "show_ecosystem"
  | "logistics_freight"
  | "pr_releases"
  | "google_monitor";

export type RssFeedTarget = {
  url: string;
  label: string;
  category: RssFeedCategory;
  cadence: "daily" | "weekly";
  sharedWithRfr: boolean;
  notes?: string;
};

/** All StageGate RSS feeds — deduped by URL */
export const RSS_FEED_TARGETS: RssFeedTarget[] = [
  // ── OEM / robotics trade press (from RFR OEM_INTELLIGENCE_TARGETS) ─────────
  {
    url: "https://www.therobotreport.com/feed/",
    label: "The Robot Report",
    category: "oem_prospect",
    cadence: "daily",
    sharedWithRfr: true,
    notes: "Exhibitor previews, product launches, show coverage",
  },
  {
    url: "https://www.robotics247.com/feed",
    label: "Robotics 24/7",
    category: "oem_prospect",
    cadence: "daily",
    sharedWithRfr: true,
  },
  {
    url: "https://spectrum.ieee.org/feeds/topic/robotics.rss",
    label: "IEEE Spectrum Robotics",
    category: "oem_prospect",
    cadence: "daily",
    sharedWithRfr: true,
  },
  {
    url: "https://www.automationworld.com/rss.xml",
    label: "Automation World",
    category: "oem_prospect",
    cadence: "daily",
    sharedWithRfr: true,
    notes: "Automate, MODEX, industrial automation show coverage",
  },
  {
    url: "https://www.a3automate.org/news/rss/",
    label: "A3 Automate News",
    category: "oem_prospect",
    cadence: "daily",
    sharedWithRfr: true,
    notes: "Automate show organizer — exhibitor announcements",
  },
  {
    url: "https://www.massrobotics.org/news/feed/",
    label: "MassRobotics",
    category: "oem_prospect",
    cadence: "weekly",
    sharedWithRfr: true,
  },
  {
    url: "https://techcrunch.com/tag/robotics/feed/",
    label: "TechCrunch Robotics",
    category: "oem_prospect",
    cadence: "daily",
    sharedWithRfr: true,
    notes: "Funding + US market entry signals for OEM prospects",
  },
  {
    url: "https://www.suasnews.com/feed/",
    label: "sUAS News",
    category: "oem_prospect",
    cadence: "daily",
    sharedWithRfr: true,
  },
  {
    url: "https://dronelife.com/feed/",
    label: "Drone Life",
    category: "oem_prospect",
    cadence: "daily",
    sharedWithRfr: true,
  },
  {
    url: "https://www.roboticsbusinessreview.com/feed/",
    label: "Robotics Business Review",
    category: "oem_prospect",
    cadence: "daily",
    sharedWithRfr: false,
    notes: "RBR — enterprise robotics deployments and show news",
  },
  {
    url: "https://www.modernmaterialhandling.com/rss/news",
    label: "Modern Materials Handling",
    category: "oem_prospect",
    cadence: "daily",
    sharedWithRfr: false,
    notes: "MODEX / ProMat AMR and warehouse robot coverage",
  },

  // ── PR wires (shared with RFR) ─────────────────────────────────────────────
  {
    url: "https://www.prnewswire.com/rss/news-releases-list.rss?tagAbbr=ROB",
    label: "PR Newswire — Robotics",
    category: "pr_releases",
    cadence: "daily",
    sharedWithRfr: true,
  },
  {
    url: "https://feeds.prnewswire.com/rnews/20130101/automation-robotics",
    label: "PR Newswire — Automation & Robotics",
    category: "pr_releases",
    cadence: "daily",
    sharedWithRfr: true,
  },
  {
    url: "https://www.businesswire.com/rss/home/?rss=G17&rpcid=business_robotics",
    label: "Business Wire — Robotics",
    category: "pr_releases",
    cadence: "daily",
    sharedWithRfr: true,
  },
  {
    url: "https://globenewswire.com/RssFeed/organization/robotics",
    label: "GlobeNewswire — Robotics",
    category: "pr_releases",
    cadence: "daily",
    sharedWithRfr: true,
  },

  // ── Logistics / freight (RFR buyer feeds — relevant for StageGate partners) ─
  {
    url: "https://www.freightwaves.com/news/feed",
    label: "FreightWaves",
    category: "logistics_freight",
    cadence: "daily",
    sharedWithRfr: true,
  },
  {
    url: "https://www.logisticsmgmt.com/rss/news.xml",
    label: "Logistics Management",
    category: "logistics_freight",
    cadence: "daily",
    sharedWithRfr: true,
  },
  {
    url: "https://www.supplychainbrain.com/rss",
    label: "Supply Chain Brain",
    category: "logistics_freight",
    cadence: "daily",
    sharedWithRfr: true,
  },
  {
    url: "https://www.supplychaindive.com/feeds/news/",
    label: "Supply Chain Dive",
    category: "logistics_freight",
    cadence: "daily",
    sharedWithRfr: true,
  },
  {
    url: "https://theloadstar.com/feed/",
    label: "The Loadstar",
    category: "logistics_freight",
    cadence: "daily",
    sharedWithRfr: true,
  },
  {
    url: "https://www.joc.com/api/rssfeed",
    label: "Journal of Commerce",
    category: "logistics_freight",
    cadence: "daily",
    sharedWithRfr: true,
  },
  {
    url: "https://www.ttnews.com/rss.xml",
    label: "Transport Topics",
    category: "logistics_freight",
    cadence: "daily",
    sharedWithRfr: true,
  },
  {
    url: "https://www.inboundlogistics.com/rss/",
    label: "Inbound Logistics",
    category: "logistics_freight",
    cadence: "daily",
    sharedWithRfr: true,
  },
  {
    url: "https://www.mhlnews.com/rss/all",
    label: "MH&L News (Material Handling & Logistics)",
    category: "logistics_freight",
    cadence: "daily",
    sharedWithRfr: true,
  },
  {
    url: "https://www.dcvelocity.com/rss/",
    label: "DC Velocity",
    category: "logistics_freight",
    cadence: "daily",
    sharedWithRfr: true,
  },
  {
    url: "https://www.manufacturingdive.com/feeds/news/",
    label: "Manufacturing Dive",
    category: "logistics_freight",
    cadence: "daily",
    sharedWithRfr: true,
  },

  // ── Show ecosystem (StageGate-specific — partners + organizers) ─────────────
  {
    url: "https://www.tsnn.com/feed/",
    label: "TSNN (Trade Show News Network)",
    category: "show_ecosystem",
    cadence: "daily",
    sharedWithRfr: false,
    notes: "Trade show industry news — exhibitors, GCs, show announcements",
  },
  {
    url: "https://www.exhibitoronline.com/feed/",
    label: "EXHIBITOR Magazine",
    category: "show_ecosystem",
    cadence: "daily",
    sharedWithRfr: false,
  },
  {
    url: "https://www.eventmarketer.com/feed/",
    label: "Event Marketer",
    category: "show_ecosystem",
    cadence: "daily",
    sharedWithRfr: false,
  },
  {
    url: "https://www.meetingsnet.com/rss.xml",
    label: "Meetings Net",
    category: "show_ecosystem",
    cadence: "daily",
    sharedWithRfr: false,
  },
  {
    url: "https://www.avnetwork.com/rss",
    label: "AV Network",
    category: "show_ecosystem",
    cadence: "daily",
    sharedWithRfr: false,
    notes: "AV / power / booth tech — Encore-adjacent ecosystem",
  },
  {
    url: "https://www.livedesignonline.com/rss/feed/all",
    label: "Live Design",
    category: "show_ecosystem",
    cadence: "daily",
    sharedWithRfr: false,
    notes: "Live events, staging, production",
  },
  {
    url: "https://www.tradeshownews.com/feed/",
    label: "Trade Show News",
    category: "show_ecosystem",
    cadence: "daily",
    sharedWithRfr: false,
  },
  {
    url: "https://www.hospitalitynet.org/rss/4000062.xml",
    label: "Hospitality Net",
    category: "show_ecosystem",
    cadence: "daily",
    sharedWithRfr: true,
    notes: "Shared w/ RFR — hotel brands exhibit at CES; service robot OEM buyers",
  },
  {
    url: "https://www.hoteldive.com/feeds/news/",
    label: "Hotel Dive",
    category: "show_ecosystem",
    cadence: "daily",
    sharedWithRfr: true,
  },

  // ── Google News monitors (from RFR OEM_INTELLIGENCE) ─────────────────────────
  {
    url: "https://news.google.com/rss/search?q=CES+2027+robot+exhibitor&hl=en-US&gl=US&ceid=US:en",
    label: "Google News — CES robot exhibitors",
    category: "google_monitor",
    cadence: "weekly",
    sharedWithRfr: true,
  },
  {
    url: "https://news.google.com/rss/search?q=Automate+2026+2027+robot+booth&hl=en-US&gl=US&ceid=US:en",
    label: "Google News — Automate robot booths",
    category: "google_monitor",
    cadence: "weekly",
    sharedWithRfr: true,
  },
  {
    url: "https://news.google.com/rss/search?q=humanoid+robot+%22Las+Vegas%22+2026+2027&hl=en-US&gl=US&ceid=US:en",
    label: "Google News — humanoids Las Vegas",
    category: "google_monitor",
    cadence: "weekly",
    sharedWithRfr: true,
  },
  {
    url: "https://news.google.com/rss/search?q=NAB+Show+robot+exhibitor+2026&hl=en-US&gl=US&ceid=US:en",
    label: "Google News — NAB robot exhibitors",
    category: "google_monitor",
    cadence: "weekly",
    sharedWithRfr: false,
  },
  {
    url: "https://news.google.com/rss/search?q=trade+show+exhibitor+robot+warehouse+staging&hl=en-US&gl=US&ceid=US:en",
    label: "Google News — trade show robot logistics",
    category: "google_monitor",
    cadence: "weekly",
    sharedWithRfr: false,
  },
  {
    url: "https://news.google.com/rss/search?q=Freeman+GES+exhibit+house+robot+CES&hl=en-US&gl=US&ceid=US:en",
    label: "Google News — exhibit house robotics",
    category: "google_monitor",
    cadence: "weekly",
    sharedWithRfr: true,
    notes: "Freeman, GES, exhibit house robot booth coverage",
  },
];

export function getRssFeedUrls(category?: RssFeedCategory): string[] {
  const feeds = category
    ? RSS_FEED_TARGETS.filter((f) => f.category === category)
    : RSS_FEED_TARGETS;
  return feeds.map((f) => f.url);
}

export function rssFeedStats() {
  const byCategory = {} as Record<RssFeedCategory, number>;
  let shared = 0;
  let stagegateOnly = 0;
  for (const f of RSS_FEED_TARGETS) {
    byCategory[f.category] = (byCategory[f.category] ?? 0) + 1;
    if (f.sharedWithRfr) shared++;
    else stagegateOnly++;
  }
  return {
    total: RSS_FEED_TARGETS.length,
    sharedWithRfr: shared,
    stagegateOnly,
    byCategory,
  };
}
