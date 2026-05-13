# StageGate Platform TODO

## Database Schema
- [x] Trade shows table
- [x] Exhibitor leads table (with outreach_status: new/emailed/responded/registered)
- [x] Service catalog table (8 named service lines)
- [x] Service orders table + order items table
- [x] Logistics partners table (customs, transporter, insurance, parts)
- [x] Company profiles table (linked to users)

## Public Marketing Landing Page
- [x] Hero section with tagline and CTA
- [x] Value proposition / problem statement section
- [x] 8 service lines overview with pricing
- [x] Three brand pages/sections: StageGate, StageHand™, StagePro™
- [x] Partner logos section
- [x] Free registration CTA throughout
- [x] Navigation with login/register links

## Authentication and Company Registration
- [x] Manus OAuth login/register flow
- [x] Company profile creation form (company name, robot types, contact info)
- [x] Role-based access: client vs admin
- [x] Profile completion after OAuth

## Service Catalog and Ordering
- [x] Service catalog page with all 8 services
- [x] Service configuration and order form (tied to a trade show)
- [x] Order submission and confirmation

## Client Dashboard
- [x] Active orders view
- [x] Upcoming show schedule
- [x] Order status tracking
- [x] Service history

## AI Trade Show Discovery Engine (Admin)
- [x] Admin input: trade show URL
- [x] Background processing: parse exhibitor list via LLM
- [x] Filter for robotics companies
- [x] Store qualified leads with AI-generated summaries
- [x] Lead list view in admin

## Automated Outreach System (Admin)
- [x] LLM generates personalized email drafts per lead
- [x] Admin review queue for drafts
- [x] Mark as emailed / track responses
- [x] Outreach status pipeline: new → emailed → responded → registered

## Admin Operations Dashboard
- [x] Trade show management (CRUD)
- [x] Exhibitor leads view and actions
- [x] Outreach pipeline monitor
- [x] Service orders review and fulfillment
- [x] Logistics partner directory management

## Logistics Partner Directory
- [x] Partner categories: customs, transporter, insurance, parts
- [x] Partner CRUD (admin)
- [x] Partner directory view

## Owner Notifications
- [x] Notify on new company registration
- [x] Notify on new service order
- [x] Notify on lead response to outreach

## Tests
- [x] Auth procedure tests (logout, me)
- [x] Service catalog procedure tests
- [x] Order creation and access control tests
- [x] Lead discovery and email generation tests
- [x] Partner CRUD access control tests
- [x] Company profile access control tests
- [x] Outreach status label validation tests
- [x] Total: 24 tests passing across 2 test files

## Visual Redesign (v1.1 — "Pop" Upgrade)
- [x] Global CSS: noise texture, gradient mesh backgrounds, refined color tokens
- [x] Hero: asymmetric layout with technical grid graphic, animated tagline, glowing CTA button
- [x] Stats bar: animated count-up numbers, higher contrast treatment
- [x] Service cards: color-coded accent bars by category (logistics/activation/support/marketing)
- [x] Section dividers: diagonal cuts between sections
- [x] Logo marquee: horizontal scrolling partner/show logo strip
- [x] Brand cards: upgraded visual treatment with gradient backgrounds
- [x] City expansion: upgraded card design
- [x] Bottom CTA: stronger visual weight, glow effect
- [x] Navbar: refined with backdrop blur and border

## Visual Redesign v1.2 — Supabase-Style Clean
- [x] Source real robot logistics image (crate/warehouse scene)
- [x] Remove radar/robot SVG graphic from hero
- [x] Redesign CSS: Supabase-style clean palette, stroke-only buttons, tight typography
- [x] Rebuild hero with real image, clean asymmetric layout
- [x] Update all sections to match clean design language
- [x] Update Navbar, Services, StageHand™, StagePro™ pages

## Trade Show Search Bar (v1.3)
- [x] Backend: public `shows.search` tRPC procedure with text + city filter
- [x] ShowSearchBar component: live search input, dropdown results, keyboard nav
- [x] Show result cards: name, date, venue, city badge, "Book Services" CTA
- [x] Empty state and loading skeleton in dropdown
- [x] Integrate search bar into Home.tsx hero section
- [x] Navigate to /order?showId=X when a show is selected
- [x] Vitest test for shows.search procedure (6 tests)

## Notify Me — Show Booking Alerts (v1.4)
- [x] DB: `showNotifications` table (id, showId, email, createdAt)
- [x] Migration applied via webdev_execute_sql
- [x] Backend: `shows.notifyMe` tRPC public procedure (email + showId, dedup by email+showId)
- [x] Backend: owner notification triggered on new signup
- [x] ShowSearchBar: inline "Notify me" email input on upcoming show results
- [x] UI: success/error state after submission (inline confirmation, no page reload)
- [x] Admin: notification requests visible in Admin Shows panel
- [x] Vitest tests for shows.notifyMe procedure (4 tests, 34 total)

## Get a Quote Modal (v1.5)
- [x] DB: `quoteRequests` table (id, name, email, company, robotType, robotCount, showId, serviceIds, notes, status, createdAt)
- [x] Migration applied
- [x] Backend: `quotes.submit` public tRPC procedure (saves quote, notifies owner)
- [x] Backend: `quotes.list` admin-only tRPC procedure
- [x] Backend: `quotes.updateStatus` admin-only tRPC procedure
- [x] Multi-step modal: Step 1 — Robot details (type, count, dimensions, weight)
- [x] Multi-step modal: Step 2 — Show selection (searchable dropdown of upcoming shows)
- [x] Multi-step modal: Step 3 — Services checklist (all 8 service lines with descriptions)
- [x] Multi-step modal: Step 4 — Contact info (name, email, company, notes)
- [x] Step progress indicator at top of modal
- [x] Success confirmation screen after submit
- [x] "Get a Quote" CTA button in Navbar and hero section
- [x] Admin Dashboard: Quote Requests panel with status management
- [x] Vitest tests for quotes.submit and quotes.list procedures (6 tests, 40 total)

## Public Show Calendar Page (v1.7)
- [x] /shows page: card grid of all 2026 Las Vegas trade shows
- [x] Venue filter pills (All Venues + each unique venue)
- [x] Month filter pills (All Months + Jan–Dec)
- [x] Show cards: name, venue, city, date range, status badge, website link
- [x] Per-card CTAs: "Book Services" → /order?showId=X and "Get a Quote" modal trigger
- [x] Empty state when no shows match filters
- [x] Navbar link to /shows
- [x] Route registered in App.tsx

## Show Detail Pages (v1.8)
- [x] DB: add `description`, `roboticsRelevance` (1-5 int), `estimatedExhibitors`, `roboticsExhibitors` columns to trade_shows
- [x] Migration applied
- [x] Seed all 19 Las Vegas shows with descriptions, relevance ratings, and exhibitor counts
- [x] Backend: `shows.get` procedure returns full show detail (already exists, verified)
- [x] Backend: `shows.update` admin procedure supports new fields
- [x] ShowDetail page: hero with show name, dates, venue, status badge
- [x] ShowDetail page: robotics relevance star/bar rating (1-5)
- [x] ShowDetail page: exhibitor stats (total vs robotics exhibitors)
- [x] ShowDetail page: full description section
- [x] ShowDetail page: pre-filled service booking form (show pre-selected, can't be changed)
- [x] ShowDetail page: "Notify me" inline for upcoming shows
- [x] ShowDetail page: back link to /shows calendar
- [x] ShowsCalendar cards: show name links to /shows/:id
- [x] Route /shows/:id registered in App.tsx
- [x] Vitest test for shows.get procedure (42 tests total)

## v1.9 — Option A White B2B Redesign

- [x] Global CSS: light background (#fafafa), near-black text (#0f0f0f), blue accent (#2563eb), filled buttons, clean card borders, Inter + display font
- [x] Navbar: white bg, border-bottom, filled CTA button, dark logo text
- [x] Home: white hero, bold display headline, filled primary button, light stat bar, white service cards with border+shadow, brand architecture cards
- [x] Services page: white layout, service cards with filled icon badges
- [x] StageHand™ page: white layout with amber/orange accent (on-site support brand identity)
- [x] StagePro™ page: white layout with purple accent (training/certification brand identity)
- [x] ShowsCalendar page: white layout, clean filter pills, white show cards
- [x] ShowDetail page: white layout, clean hero, rating bar, booking form

## v2.0 — Option B Deep Slate + Supabase Stroke Style

- [x] Global CSS: deep slate bg (#0d0f14), indigo-cyan accent, stroke-only buttons/badges, clean type scale, no dot grids
- [x] ThemeProvider set to dark
- [x] Navbar: dark bg, stroke-only CTA button, monospace label
- [x] Home: dark hero, stroke buttons, clean stat bar, dark service cards with border only
- [x] Services page: dark layout, stroke badges, inline category labels
- [x] StageHand™ page: dark layout, stroke accent
- [x] StagePro™ page: dark layout, stroke accent
- [x] ShowsCalendar page: dark layout, stroke filter pills, dark show cards
- [x] ShowDetail page: dark layout, stroke booking form

## v3.0 — Marble.com-Inspired Redesign (Pure Black + Massive Type + Robot Photography)

- [x] Upload all 8 robot CES images to static storage, get CDN URLs
- [x] Global CSS: pure black (#000), massive display font (700-900 weight), white/near-white text, single accent color, clean CTA button style
- [x] Navbar: pure black, minimal links, single white CTA pill button
- [x] Hero: full-viewport, robot photo right-side dominant, massive left-aligned headline, single CTA, scroll indicator
- [x] 3-step process section: "Ship → Stage → Perform" with clean numbered cards
- [x] Photo grid section: mosaic of robot CES photos
- [x] Service lines: clean text-only list or minimal card grid
- [x] Bottom CTA: full-width black section with large headline + single button

## v3.1 — Las Vegas Focus + Blue/Purple Accent + CTA Refinement

- [x] Add blue/deep-purple accent CSS variable and text utility class
- [x] Apply accent color to key headline words (e.g. "Las Vegas", "Performs", "Stage")
- [x] Tighten all copy to Las Vegas focus only (remove any multi-city promises)
- [x] Replace hero CTAs with: Register, Demo, How It Works, Services
- [x] Update bottom CTA section to match new button set

## v3.2 — Dedicated Demo Request Modal

- [x] Add demo_requests table to drizzle/schema.ts (id, name, company, robotType, preferredShowId, email, status, createdAt)
- [x] Generate migration SQL and apply via webdev_execute_sql
- [x] Add demos.submit tRPC mutation in server/routers.ts
- [x] Owner notification on new demo request
- [x] Build DemoRequestModal component (name, company, robot type, preferred show dropdowns)
- [x] Wire Demo CTA on Home page to DemoRequestModal (replace GetQuoteModal)
- [x] Write vitest test for demos.submit mutation

## v3.3 — Admin Demo Requests Panel
- [x] Build AdminDemoRequests page with table view (name, company, robot type, show, status, date)
- [x] Status badge colors per status (new, contacted, scheduled, completed, closed)
- [x] Inline status update dropdown per row
- [x] Detail expand/modal for full request info including message
- [x] Add "Demo Requests" nav button and quick link card to AdminDashboard
- [x] Register /admin/demos route in App.tsx
- [x] Write vitest tests for demos.list and demos.updateStatus admin procedures (54 total tests passing)

## v3.4 — Demo Requests Filter & Sort
- [x] Status filter pills: All / New / Contacted / Scheduled / Completed / Closed
- [x] Sort dropdown: Newest First / Oldest First / Company A–Z / Company Z–A / Robot Type A–Z
- [x] Active filter count badge on each status pill
- [x] "Clear" button when status filter is active + empty-state clear button
- [x] Result count label ("Showing X of Y requests · filtered by ... · sorted by ...")

## v3.5 — Demo Requests Search Bar
- [x] Search input filters live across name, company, and robot type
- [x] Clear (×) button inside input when query is non-empty
- [x] Result count reflects combined search + status filter
- [x] Empty state message mentions the search query

### v4.0 — Conversion-Focused Full Rebuild (Robot Guild + Dribbble Reference)
- [x] CSS: Space Grotesk font, near-black bg (#050508), electric blue accent (#4f6ef7), violet secondary (#7c3aed), refined tokens
- [x] Navbar: minimal 4-link nav + 2 CTA buttons (How It Works ghost, Register filled)
- [x] Hero: full-bleed robot photo background, massive headline overlay, positioning statement, 2 CTAs
- [x] Service value strip: 5 cards in priority order (Warehouse, Ship/Receive, Stage, Activate, Promote) with numbered badges
- [x] How It Works: 4-step numbered section with descriptions
- [x] Shows preview: next 3 upcoming Las Vegas shows with date + register link
- [x] Robot Guild partner section: logo + description + link
- [x] Final CTA: "Schedule Your Robot" full-width section
- [x] Footer: minimal links + contact

## v4.1 — XBOT AI Logistics Agent

- [x] DB: xbot_projects table (id, sessionToken, userId nullable, robotMake, robotModel, dimensions, weight, powerReqs, specialHandling, originCountry, originCity, shippingMethod, flightVesselNumber, eta, portOfEntry, hsCode, ataCarnet, customsBroker, showId, boothNumber, setupDate, teardownDate, services JSON, contacts JSON, status, createdAt, updatedAt)
- [x] DB: xbot_logistics_briefs table (id, projectId, timeline JSON, customsChecklist JSON, groundTransportOptions JSON, servicePackage JSON, generatedAt)
- [x] Migration generated and applied via webdev_execute_sql
- [x] tRPC: xbot.createProject (public, returns sessionToken + projectId)
- [x] tRPC: xbot.getProject (public, by id + sessionToken OR userId)
- [x] tRPC: xbot.updateProject (public, by id + sessionToken OR userId)
- [x] tRPC: xbot.generateBrief (public, triggers LLM generation of timeline/checklist/package)
- [x] tRPC: xbot.submitServiceRequest (protected — registration gate)
- [x] tRPC: xbot.listProjects (protected — user's saved projects)
- [x] 6-step wizard UI at /xbot/new with step validation and auto-save
- [x] Step 1: Robot Profile (make, model, dimensions, weight, power, handling)
- [x] Step 2: Origin & Shipping (country, city, method, flight/vessel, ETA, port)
- [x] Step 3: Customs (HS code auto-suggest via LLM, ATA Carnet check, broker choice)
- [x] Step 4: Target Show (show selector from calendar, booth, dates)
- [x] Step 5: Services (dockside, ground transport, warehouse, staging, support, promotion)
- [x] Step 6: Contacts (primary, on-site, emergency)
- [x] Auto-save to localStorage + server on each step
- [x] XBOT project dashboard at /xbot/project/:id
- [x] Logistics timeline display with all deadlines
- [x] Customs checklist with document requirements
- [x] Ground transport options (StageGate or vetted providers list)
- [x] Service package summary
- [x] Registration gate modal when submitting service request
- [x] XBOT landing page at /xbot (entry point + saved projects for logged-in users)
- [x] Add XBOT nav link to Navbar
- [x] Add XBOT entry point section to Home page
- [x] Write vitest tests for xbot procedures (18 tests, 72 total passing)

## v4.2 — XBOT Wizard UX: Progress Bar + Step Transitions

- [x] Progress bar: animated fill from 0% to 100% across 6 steps (step N = N/6 * 100%)
- [x] Step label strip: show all 6 step names with active/completed state indicators
- [x] Smooth slide/fade transition animation when advancing or going back between steps
- [x] Direction-aware animation: slide left when advancing, slide right when going back
- [x] Transition does not block auto-save (save fires before animation completes)

## v5.0 — Editorial Redesign: Typography-First, No Generic Cards

- [x] Design language: emerald green (#00ff87) accent on near-black, Blade Runner / Tron aesthetic — NOT generic SaaS dark
- [x] Remove all padded card boxes from info panels — use inline text, ruled lines, raw grid
- [x] Home hero: asymmetric layout, massive editorial type, no centered-everything formula
- [x] Home services: horizontal ruled list with large numbers, no icon cards
- [x] Home XBOT section: story-driven narrative ("Your robot is sitting in a crate somewhere. XBOT fixes that.") with emotional hook before CTA
- [x] Home Robot Guild: editorial pull-quote style, not a feature card
- [x] XBOT landing: open with a problem statement, not a feature list — give users a reason to care
- [x] XBOT wizard info panels: inline text labels flush to content, no background boxes or padding wrappers
- [x] Global: replace all rounded card borders with thin ruled lines or no border at all
- [x] Global: emerald green replaces indigo as the primary accent color
- [x] Global: amber orange for CTAs (stroke only, no fill on secondary actions)
- [x] Typography: tighten letter-spacing on headings, use tabular numbers for stats

## v5.1 — XBOT Resume Banner
- [x] Detect unfinished XBOT intake in localStorage (xbot_session_token + xbot_project_id keys)
- [x] Show dismissible banner at top of /xbot page with "Draft saved" label and "Continue" CTA
- [x] Banner dismisses on click of × and sets a sessionStorage flag so it doesn't re-appear mid-session
- [x] Banner only shows if a valid projectId + sessionToken exist in localStorage

## v6.0 — Visibility, Prospect Research & XBOT Outreach Engine

### UI Fixes
- [x] Amber CTA buttons: increase font weight to 700, add solid amber fill (not stroke-only), increase padding, add hover glow
- [x] Home page white text: increased opacity to 0.75 on all body/description text for better contrast
- [x] Hero subheadline and section descriptions: opacity boosted to 0.75 minimum

### Prospect Research
- [x] Research robotics companies exhibiting at CES (Las Vegas, Jan)
- [x] Research robotics companies at Manifest (Las Vegas, Feb)
- [x] Research robotics companies at Concrete World (Las Vegas)
- [x] Research robotics companies at AUTOMATE (Detroit/Chicago)
- [x] Research robotics companies at ACTExpo (Las Vegas)
- [x] Research robotics companies at additional Las Vegas trade shows (NAB, SEMA, MHI ProMat, etc.)
- [x] Build structured prospect list: 78 companies seeded — company, robot name/type, contact dept, shows, notes, status

### XBOT Outreach Engine
- [x] DB: prospects table (id, company, robotName, robotType, contactName, contactEmail, contactTitle, shows JSON, status, notes, createdAt)
- [x] DB: outreach_campaigns table (id, prospectId, emailSentAt, emailTemplate, videoMessageUrl, responseStatus, scheduledCallAt, createdAt)
- [x] tRPC: prospects.list, prospects.create, prospects.update, prospects.bulkImport
- [x] tRPC: outreach.sendIntroEmail (generates personalized email via LLM, sends via notification API)
- [x] tRPC: outreach.logVideoMessage (stores uploaded video URL against prospect)
- [x] Admin page /admin/prospects: table of all prospects with status, email send button, notes
- [x] Email template: personalized intro from XBOT — robot name, show, StageGate services pitch, registration link, schedule call CTA
- [x] Video message intake: upload widget on /xbot/video for prospects to record/upload a video request
- [x] Schedule call CTA: wired to Meetup/Google Calendar booking URL on all pages and in email template

## v6.1 — Calendar Link + Outreach Review
- [x] Wire Meetup/Google Calendar booking URL into Schedule Call CTA across all pages and email templates
- [x] Verify email drafts are properly personalized per prospect (robot name, show, pitch)
- [x] Add direct link to /admin/prospects in the nav so owner can review and send emails

## v7.0 — LinkedIn Decision-Maker Research + Schedule Page + Email Management

- [x] Research LinkedIn decision-makers for all 78 prospect companies (Head of Operations, VP Logistics, CTO, CEO)
- [x] Default email: support@DOMAIN; fallback patterns: lastname@, firstname@, firstnamelastname@, firstinitiallastname@
- [x] Update prospect records in DB with contactName, contactTitle, contactEmail, contactLinkedIn, emailConfidence
- [x] Build /schedule page with embedded Google Calendar iframe (America/Los_Angeles timezone)
- [x] Add /schedule link to Navbar and footer
- [x] Update all "Schedule a Call" CTAs to link to /schedule
- [x] Admin prospects: inline editable contactEmail, contactName, contactTitle, contactLinkedIn fields per row
- [x] Admin prospects: email confidence badge (verified/high/medium/low) displayed per contact
- [x] Admin prospects: Edit/Save toggle per row for contact fields

## v7.1 — Bulk Send Email on Prospects Page

- [x] Row checkboxes on each prospect row in /admin/prospects
- [x] "Select All" checkbox in the table header (checks/unchecks all visible rows)
- [x] "Select Verified Only" shortcut button to auto-check rows with emailConfidence = verified or high
- [x] Bulk action toolbar: appears when ≥1 row is selected — shows count + "Send Email to X contacts" amber button
- [x] Bulk send dispatches personalized emails sequentially with per-item success/fail status
- [x] Per-row status update: row turns green on success, red on failure with error tooltip
- [x] tRPC: prospects.bulkSendEmails procedure (array of prospectIds, dispatches sendIntroEmail for each)
- [x] Deselect all / clear selection button in toolbar
- [x] Bulk result summary strip showing sent/failed counts with per-company chips

## v7.2 — Prospects Table: Contacted Filter Pill

- [x] Status filter pills already existed; upgraded with count badges per status
- [x] Active pill highlights in the status accent color (amber for Contacted, green for Responded, indigo for Scheduled)
- [x] "Hide Contacted" quick-toggle button appears when All filter is active — excludes contacted rows in one click
- [x] Toggle turns red when active with "● Hiding Contacted" label
- [x] Row count label updates: "X of 78 prospects (contacted hidden)" when toggle is on

## v7.3 — Domain Update: onstage.bot

- [x] Updated all hardcoded stagegate.ai references to https://onstage.bot in server/routers.ts (both single-send and bulk-send email LLM prompts)
- [x] Confirmed zero remaining references to stagegate.ai or stagegate-ai-lwe9ahma.manus.space in codebase
- [x] www.onstage.bot CNAME → cname.manus.space (Manus hosting) — DNS propagated
- [ ] onstage.bot @ A record: set to 66.241.124.90 in GoDaddy (currently wrong — 104.18.26.246)
- [ ] Register onstage.bot in Manus Settings → Domains for SSL cert provisioning
