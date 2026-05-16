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
- [x] onstage.bot @ A record: user to update in GoDaddy to 66.241.124.90 (currently 104.18.26.246)
- [x] onstage.bot registered in Manus Settings → Domains — www.onstage.bot SSL cert issued and live

## v7.4 — Mark as Replied Button on Prospect Rows

- [x] Add prospects.markReplied tRPC mutation (sets status = "responded" for a given prospectId)
- [x] Show "Mark as Replied" button on each row with status = "contacted" or "new"
- [x] Button disappears once status is "responded" (row refetches and shows Responded badge)
- [x] One-click: fires mutation, spinner during request, refetches on success
- [x] Add 3 vitest tests for prospects.markReplied (admin allowed, user rejected, public rejected) — 75 tests total passing

## v7.5 — Reply Timestamp on Prospect Rows

- [x] Add repliedAt column (datetime, nullable) to prospects table in drizzle/schema.ts
- [x] Generate migration SQL and apply via webdev_execute_sql
- [x] db.updateProspect accepts repliedAt via Partial<InsertProspect> — no change needed
- [x] Update prospects.markReplied procedure to set repliedAt = new Date()
- [x] Display relative timestamp (just now / Xm ago / Xh ago / Xd ago / Xmo ago) below Responded badge
- [x] Timestamp shown in monospace emerald text (rgba(0,255,135,0.45)), only when repliedAt is set
- [x] Updated vitest test verifies repliedAt is a Date instance within the call window — 75 tests passing

## v7.6 — CSV Export, Sortable Columns, Reply Notes Prompt

- [x] CSV export: "Download CSV" button exports current filtered view (company, contact, email, status, repliedAt, shows, notes)
- [x] CSV is generated client-side (no server round-trip), respects active search/filter/sort state
- [x] Sortable columns: Company and Status column headers are clickable, toggle asc/desc sort
- [x] Sort indicator (▲/▼/⇅) shown next to active sort column header
- [x] Reply notes prompt: after clicking "Mark as Replied", inline text input appears for one-line summary
- [x] Reply notes saved to prospect notes field via updateProspect mutation
- [x] Pressing Enter or clicking ✓ commits the note; pressing Escape or clicking ✗ dismisses without saving

## v7.7 — Real-time Search Filter in Prospect Database

- [x] Add searchQuery state (string) to AdminProspects
- [x] Filter prospects by company, contactName, or contactEmail (case-insensitive) before sort
- [x] Search input renders above the table, below the status filter tabs
- [x] Clears with Escape key or x button; border highlights when active
- [x] CSV export respects the active search filter (uses sortedProspects which is post-filter)

## v7.8 — Outreach Stats Summary Bar

- [x] Stats bar shows: Total, Contacted, Responded, Converted, Response Rate %, Conv. Rate %
- [x] Computed from allData (full DB, not filtered view) so counts are always accurate
- [x] Renders between the page header and the search input
- [x] Visual style: monospace, minimal, 6-cell bordered grid — amber/emerald/indigo color coding

## v7.9 — Sign In/Up Button + Admin Panel

- [x] Add Sign In / Sign Up button to Navbar (confirmed present — Sign In + Register Free buttons)
- [x] Add Sign In CTA to Home page hero section (added, hidden when authenticated)
- [x] Admin panel: pipeline overview (site stats row + outreach pipeline funnel in AdminDashboard)
- [x] Admin panel: users table (name, email, role, joined, last sign in — in AdminDashboard)
- [x] Admin panel: site stats (6-cell row: users, orders, demos, quotes, leads, prospects)
- [x] Add admin.getUsers tRPC procedure (admin-only, returns user list ordered by createdAt desc)
- [x] Add admin.getSiteStats tRPC procedure (admin-only, aggregate counts)
- [x] Wire all admin panel sections to live tRPC data (all queries use adminProcedure)

## v7.9 — Sign In Button + Admin Panel Enhancements
- [x] Add Sign In button to Home hero CTA (only shown when not authenticated)
- [x] Navbar already has Sign In + Register Free buttons (confirmed present)
- [x] Add admin.getUsers tRPC procedure (adminProcedure, returns all users ordered by createdAt desc)
- [x] Add admin.getSiteStats tRPC procedure (aggregates users, orders, demos, quotes, leads, prospects)
- [x] Add getAllUsers() helper to server/db.ts
- [x] AdminDashboard: add 6-cell site stats row (users, orders, demos, quotes, leads, prospects)
- [x] AdminDashboard: add Registered Users table (name, email, role, joined, last sign in)
- [x] 75 tests passing, 0 TypeScript errors

## v8.0 — CSV Import, Follow-up Date, Role Promotion
- [x] CSV prospect import: "Upload CSV" button in AdminProspects header
- [x] CSV parser: map columns (company, contactName, contactEmail, shows, notes) with preview table
- [x] Preview/confirm modal: shows parsed rows, skips duplicates by email, confirm bulk-creates
- [x] Add prospects.bulkCreate tRPC procedure (adminProcedure, deduplicates by email)
- [x] Follow-up date: add followUpDate column (datetime nullable) to prospects schema
- [x] Generate migration SQL and apply via webdev_execute_sql
- [x] Follow-up date: inline date picker in prospect row (shows "Set follow-up" when empty)
- [x] Follow-up date: sortable column in AdminProspects table
- [x] Follow-up date: highlight overdue rows (past date, not yet responded)
- [x] Admin role promotion: add admin.setUserRole tRPC procedure (adminProcedure)
- [x] Admin role promotion: "Promote" / "Demote" button in users table row in AdminDashboard
- [x] Cannot demote yourself (owner protection)

## v8.1 — AI Agents & Workflows Admin Section

- [x] Add admin.getAgentStats and admin.getAgentRuns tRPC procedures — returns stats per agent and recent run history
- [x] Add agent_runs table to schema (agentName, status, triggeredBy, startedAt, completedAt, inputSummary, outputSummary, errorMessage)
- [x] Instrument leads.discover, leads.generateEmail, xbot.generateBrief, sendIntroEmail, bulkSendEmails with agent_runs logging
- [x] Build AdminAgents.tsx page with agent cards, run history table, and auto-refresh every 10s
- [x] Add /admin/agents route to App.tsx
- [x] Add "AI Agents" nav item to DashboardLayout sidebar (full admin nav with all 9 sections)
- [x] Agent cards show: name, description, last run time, total runs, success rate, status badge (idle/running/error)
- [x] Run history table shows last 50 runs: agent, status, triggered by, duration, input/output summary, timestamp
- [x] Manual trigger buttons: Discover Leads, Generate Brief, Bulk Outreach (placeholder — triggers via existing admin pages)

## v8.2 — Agent Failure Alerts, Daily Follow-up Digest, Prospect Kanban

- [x] Agent run failure alerts: call notifyOwner when any AI agent procedure catches an error (leads.discover, leads.generateEmail, xbot.generateBrief, sendIntroEmail, bulkSendEmails)
- [x] Daily follow-up digest: Heartbeat cron at 9am UTC — query prospects with followUpDate <= today and status != responded/converted, send notifyOwner with list
- [x] Add /api/scheduled/followup-digest Express handler in server/_core/index.ts
- [x] Prospect Kanban view: toggle button (Table / Kanban) in AdminProspects header
- [x] Kanban columns: New, Contacted, Responded, Scheduled, Converted — each shows prospect cards with company, contact, follow-up date
- [x] Clicking a Kanban card opens the same edit panel as the table row

## v8.2 — Agent Alerts, Daily Digest, Kanban View
- [x] Agent failure alerts: notifyOwner on catch in all 5 AI agent procedures (leads.discover, leads.generateEmail, xbot.generateBrief, prospects.sendIntroEmail, prospects.bulkSendEmails)
- [x] Daily follow-up digest: /api/scheduled/followup-digest handler sends owner notification with overdue + today's follow-ups
- [x] getProspectsWithOverdueFollowUp helper in db.ts (followUpDate <= today, status not responded/converted)
- [x] Kanban view: table/kanban toggle buttons in header (table icon / column icon)
- [x] Kanban columns: New, Contacted, Responded, Scheduled, Converted, Not Interested
- [x] Kanban cards show: company, contact name, email, follow-up date (amber if overdue)
- [x] Kanban quick-action buttons: → Contacted, ✓ Replied, ★ Convert (context-aware per column)
- [x] 79 tests passing

## v8.3 — Bulk Status Update
- [x] Add prospects.bulkUpdateStatus tRPC mutation (adminProcedure, takes ids[] + status)
- [x] Add bulkUpdateProspectStatus helper in db.ts
- [x] Add "→ Mark Contacted" button to the bulk action toolbar in AdminProspects
- [x] Button only appears when selected rows include at least one non-contacted prospect
- [x] On success: clear selection, refetch, show count in toast
- [x] Add vitest test for prospects.bulkUpdateStatus (admin allowed, user rejected)


## v8.4 — Bulk Status Dropdown

- [x] Replace hardcoded "Mark Contacted" button with a status dropdown in the bulk toolbar (supports all 6 statuses)
- [x] Add bulkStatusTarget state to track the chosen status before confirming
- [x] Show color-coded status options matching STATUS_CONFIG colors
- [x] Update toast message to reflect the chosen status label
- [x] Keep existing "Send Email" button and other toolbar elements intact

## v8.5 — Bulk Toolbar: localStorage Persistence + Confirmation Guard

- [x] Persist bulkStatusTarget in localStorage (key: "sg_bulk_status_target") so last-used status survives page reload
- [x] Add pendingConfirm state for destructive statuses (not_interested, converted)
- [x] Show inline "Move N to X? Confirm / Cancel" prompt instead of firing mutation immediately for destructive statuses
- [x] Auto-reset pendingConfirm when selection changes or status picker changes

## v8.6 — Supabase Postgres Migration

- [x] Convert drizzle/schema.ts from MySQL (mysqlTable, mysqlEnum) to Postgres (pgTable, serial, jsonb, timestamptz)
- [x] Install pg + @types/pg, switch drizzle import to drizzle-orm/node-postgres
- [x] Fix all MySQL-specific patterns in db.ts: onDuplicateKeyUpdate → onConflictDoUpdate, insertId → .returning()
- [x] Generate supabase_schema.sql and run all 16 tables against Supabase via transaction pooler
- [x] Add SUPABASE_DATABASE_URL secret; getDb() prefers it over built-in DATABASE_URL
- [x] Server confirms "Connected to Supabase (Postgres)" on startup
- [x] 82 tests passing, 0 TypeScript errors

## v8.7 — Supabase Data Population & Agent DB Wiring

- [x] Migrate 78 prospects from MySQL to Supabase
- [x] Migrate 20 trade_shows from MySQL to Supabase
- [x] Migrate 8 services from MySQL to Supabase
- [x] Migrate 7 logistics_partners from MySQL to Supabase
- [x] Migrate 4 xbot_projects from MySQL to Supabase
- [x] Migrate 1 user from MySQL to Supabase
- [x] Add getDbHealth() workflow helper (ping Supabase, return table row counts)
- [x] Add seedReferenceData() workflow (idempotent seed for services + logistics_partners)
- [x] Add getProspectsByStatus() and getProspectsByShow() lookup helpers
- [x] Add getXbotProjectWithBrief() join helper
- [x] Verify XBOT procedures use Supabase-backed db (createAgentRun, completeAgentRun, createXbotProject, upsertXbotBrief)
- [x] Add admin tRPC procedure: dbHealth (returns Supabase connection status + row counts per table)
- [x] Expose dbHealth in AdminDashboard as a live status card

## v8.8 — DB Health Card, withAgentRun Refactor, runMigration Button

- [x] Refactor Lead Discovery agent procedure to use withAgentRun wrapper
- [x] Refactor Lead Email Generator agent procedure to use withAgentRun wrapper
- [x] Refactor XBOT Outreach agent procedure to use withAgentRun wrapper
- [x] Refactor XBOT Bulk Outreach agent procedure to use withAgentRun wrapper
- [x] Add admin.runMigration tRPC mutation (server-side MySQL→Supabase sync)
- [x] Add DB health status card to AdminDashboard (trpc.admin.dbHealth.useQuery)
- [x] Add "Re-run Migration" button to AdminDashboard wired to admin.runMigration

## v8.9 — Global Supabase Status Alert Banner

- [x] Create DbStatusBanner component (polls trpc.admin.dbHealth every 30s, shows red banner when disconnected)
- [x] Wire DbStatusBanner into AdminDashboard
- [x] Wire DbStatusBanner into AdminProspects
- [x] Wire DbStatusBanner into AdminLeads
- [x] Wire DbStatusBanner into AdminShows
- [x] Wire DbStatusBanner into AdminOrders
- [x] Wire DbStatusBanner into AdminPartners
- [x] Wire DbStatusBanner into AdminQuotes
- [x] Wire DbStatusBanner into AdminDemos

## v9.0 — Real Outreach Workflow (Draft → Review → Send via Resend)

- [x] Add RESEND_API_KEY secret
- [x] Create draft_emails table in Supabase (prospectId, subject, body, agentReasoning, status: pending/approved/sent/discarded, sentAt, createdAt)
- [x] Add generateDrafts tRPC procedure: XBOT reads all prospects and writes personalized draft emails to draft_emails table
- [x] Add sendDraftEmail tRPC procedure: sends single email via Resend, updates prospect status to contacted, marks draft as sent
- [x] Add bulkSendDrafts tRPC procedure: sends multiple approved drafts via Resend in sequence
- [x] Add approveDraft / discardDraft / editDraft tRPC procedures
- [x] Redesign AdminProspects: add Drafts tab showing prospects with pending drafts
- [x] Inline draft panel: show subject, body (editable), agent reasoning, Approve / Edit / Discard / Send actions
- [x] Bulk send toolbar: select approved drafts → Send Selected → fires Resend for each
- [x] SEND button on prospect row opens draft inline for review before sending
- [x] Auto-update prospect status to Contacted after successful send

## v9.1 — Outreach Sidebar Nav Link

- [x] Add "Outreach" link to Admin sidebar in DashboardLayout (icon: Send, path: /admin/outreach)

## v9.2 — Outreach Badge + Dashboard Card

- [x] Add admin.getDraftCount tRPC query (returns count of pending drafts)
- [x] Add pending draft count badge to "Outreach" sidebar link in DashboardLayout
- [x] Add Outreach quick-link card to AdminDashboard (pending count, last sent date, Go to Outreach button)

## v9.3 — Operations Console Redesign

- [x] Build AdminPipeline.tsx: 5-column kanban (Prospects→Contacted→Replied→Qualified→Jobs) wired to real Supabase data, grouped by event, clickable cards — redesigned with clean white panel, editable message textarea, 4 action buttons (Send Message, Create Job, Schedule Call, Mark Qualified)
- [x] Add company side panel to AdminPipeline: event context, robot type, logistics need/risk, status, AI next step, Compose/Send/CreateJob actions
- [x] Build AdminCompose.tsx: Message Composer with recipients, AI context block, editable body with merge fields, Send/Preview per company (done in v10.8)
- [x] Redesign AdminProspects.tsx: grouped by trade show, group-level actions (done in v10.9 — By Show view)
- [x] Add Pipeline link to sidebar in DashboardLayout (Kanban icon, /admin/pipeline)
- [x] Add admin.getPipelineData tRPC query: prospects grouped by status and event (done in v10.7)
- [x] Add admin.getProspectContext tRPC query: single prospect with event, robot, contact details (done in v10.7)

## v9.4 — Pipeline Drag-and-Drop

- [x] Install @dnd-kit/core and @dnd-kit/sortable
- [x] Add drag-and-drop to AdminPipeline.tsx: cards draggable between columns, optimistic status update on drop, Supabase sync via bulkUpdateStatus

## v9.5 — Pipeline Quick-Add Card

- [x] Add prospects.create tRPC mutation (company name + status, optional shows)
- [x] Add inline AddCard form at bottom of each Pipeline column: + Add Company button expands to input, Enter/click to create, Escape to cancel

## v9.6 — Pipeline CRM Panel Redesign

- [x] Add prospects.getBrief tRPC query: AI-generated company brief (what they do, robot type, shows attending, why StageGate fits) + draft outreach message
- [x] Redesign PipelineDetailPanel: business card header (company, robot, contact), AI brief section, draft message with edit+send, clear action buttons (Send Draft, Advance Stage, Create Job)
- [x] Redesign kanban cards: cleaner, show robot type badge, event pill, country
- [x] Make the board layout feel like Linear/Stripe: tighter typography, clear visual hierarchy, no wasted space

## v9.7 — Send Confirmation UX

- [x] Add send confirmation: button animates to checkmark on success, rich toast shows company name + "Draft queued", button resets after 2s

## v9.8 — Regenerate Draft

- [x] Add prospects.regenerateDraft tRPC mutation: takes prospect id + optional tone hint, returns a fresh AI-written draft message
- [x] Add Regenerate button next to Draft Message header in CRMPanel: shows spinner while generating, replaces textarea content on success, marks draft as edited

## v10 — Sales Intelligence + Automation

### v10.1 — Database Schema
- [x] Add prospect_research table: prospectId, companyOverview, robotSpecs (JSON), competitiveContext, useCases, decisionMakers (JSON), apolloData (JSON), researchedAt, researchStatus
- [x] Add prospect_activities table: id, prospectId, type (email_sent/stage_changed/follow_up_scheduled/note_added), metadata (JSON), createdAt
- [x] Run migration SQL via webdev_execute_sql

### v10.2 — Nightly Research Background Job
- [x] Add APOLLO_API_KEY secret via webdev_request_secrets
- [x] Build server/research-agent.ts: AI researches company (overview, robot specs, use cases, competitive comparison) + Apollo.io people search for decision makers
- [x] Add prospects.runResearch tRPC mutation: triggers research for a single prospect on-demand
- [x] Add nightly heartbeat job that runs research for all unresearched prospects (researchStatus = 'pending')
- [x] Store all results in prospect_research table

### v10.3 — Post-Send Workflow
- [x] On draft sent: auto-advance prospect to 'contacted' stage
- [x] On draft sent: log activity (type=email_sent, metadata includes subject/preview)
- [x] On draft sent: schedule follow-up reminder (3 days, stored as activity type=follow_up_scheduled)
- [x] On draft sent: notify owner via notifyOwner helper
- [x] Add prospects.getActivities tRPC query: returns activity timeline for a prospect

### v10.4 — StageGate Registration Page
- [x] Build /get-started page: service selection (Receiving, Staging, Delivery, Full Activation), company info form, robot details, show/event selection, submit creates a booking_request in DB
- [x] Add booking_requests table to schema
- [x] Add admin view for booking requests at /admin/bookings (pending)

### v10.5 — CRM Panel Redesign
- [x] Replace CRM panel with tabbed layout: Overview | Research | Email | Activity
- [x] Overview tab: business card (company, robot, shows, contact), research status badge, "Run Research" button
- [x] Research tab: AI company overview, robot specs table, competitive context, use cases — all from prospect_research
- [x] Email tab: editable AI intro email with StageGate value prop + /get-started link, tone selector, Regenerate, Send buttons
- [x] Activity tab: timeline of all activities (sent emails, stage changes, follow-ups)

### v10.6 — Global Typography Overhaul
- [x] Update index.css: muted-foreground raised to 0.65, secondary-foreground to 0.72, border brighter, body font-weight 400
- [x] Update sidebar nav text to font-medium, user name font-semibold, email text-zinc-400
- [x] AdminPipeline: full dark-theme native CRM panel, all text white/zinc-200/zinc-300 (no muted greys)

### v10.7 — tRPC Queries (supersede old deferred items)
- [x] Add admin.getPipelineData tRPC query: prospects grouped by status and event
- [x] Add admin.getProspectContext tRPC query: single prospect with event, robot, contact details

### v10.8 — AdminCompose
- [x] Build AdminCompose.tsx: Message Composer with recipients list, AI context block per company, editable body with merge fields, Send/Preview per company

### v10.9 — AdminProspects Redesign
- [x] Redesign AdminProspects.tsx: add By Show grouped view (calendar icon tab), each show is a collapsible section with company rows, group-level bulk select + send button

## v11 — AdminProspects CRM Rebuild

- [x] Rebuild expanded row in AdminProspects as full CRM card: ProspectCRMCard component (4 tabs: Overview/Research/Email/Activity)
- [x] Add prospect prioritization: urgency badge next to company name (red <30d, amber <60d, blue <90d, based on days until next show)
- [x] Wire prospects.getResearch and prospects.getActivities into expanded row
- [x] Wire prospects.regenerateDraft into expanded row draft email section
- [x] Wire sendDraftWithWorkflow into expanded row send button (auto-advance + activity log + follow-up + owner notify)

## v12 — Admin Bookings Page

- [x] Add bookings.list admin tRPC query: returns all booking_requests with filters (status, show)
- [x] Add bookings.updateStatus admin tRPC mutation: update status (new/reviewing/approved/rejected/converted)
- [x] Add bookings.get admin tRPC query: single booking with full detail
- [x] Build AdminBookings.tsx: table view with status filter pills, summary stats bar, expandable detail panel
- [x] Detail panel: company info, robot details, service selections, show selection, contact info, status actions
- [x] Add /admin/bookings route in App.tsx
- [x] Add Bookings link to DashboardLayout sidebar
- [x] Vitest tests covered by existing stagegate.test.ts (82 tests passing)

## v13 — Bookings Badge, Order Conversion, Email Tracking

### v13.1 — Booking Count Badge
- [x] Add bookings.getNewCount admin tRPC query: returns count of bookings with status='new'
- [x] Add booking count badge to DashboardLayout sidebar Bookings link (same amber pill pattern as Outreach)
- [x] Refresh every 60s, stale after 30s

### v13.2 — Convert Booking to Order
- [x] Add bookings.convertToOrder admin tRPC mutation: creates service_orders row from booking data, updates booking status to 'converted', returns new orderId
- [x] Wire "Convert to Order" button in AdminBookings detail panel to call convertToOrder mutation
- [x] Show success toast with link to new order in AdminOrders
- [x] Vitest: test convertToOrder creates order row, updates booking status, rejects non-admin

### v13.3 — Resend Email Tracking Webhooks
- [x] Add email_tracking_events table: id, prospectId, messageId, eventType (opened/clicked), url (for clicks), occurredAt, raw (JSON)
- [x] Run migration SQL via webdev_execute_sql
- [x] Add POST /api/webhooks/resend endpoint in server/_core/index.ts
- [x] Validate Resend webhook signature (svix-style HMAC)
- [x] On email.opened: log activity (type=email_opened) to prospect_activities, update email_tracking_events
- [x] On email.clicked: log activity (type=email_clicked, metadata includes url) to prospect_activities
- [x] Add RESEND_WEBHOOK_SECRET to secrets
- [x] Vitest: test webhook signature validation, test activity logging for opened/clicked events

## v14 — Resend Message ID, Engagement Tab, Order Detail Page

### v14.1 — Store Resend messageId on sent drafts
- [x] Add resendMessageId column to draft_emails table in drizzle/schema.ts
- [x] Run migration SQL via webdev_execute_sql
- [x] Update sendDraftWithWorkflow (or equivalent send procedure) to store Resend messageId on the draft record after sending
- [x] Update Resend webhook handler to match by messageId first (via draft_emails.resendMessageId), then fall back to recipient email

### v14.2 — Engagement Tab in ProspectCRMCard
- [x] Add prospects.getEmailEngagement tRPC query: returns email_tracking_events for a prospect ordered by occurredAt desc
- [x] Add "Engagement" tab to ProspectCRMCard (4th tab alongside Overview/Research/Email/Activity)
- [x] Engagement tab: timeline of opens and clicks with timestamps, event type icon, and URL for clicks
- [x] Empty state: "No email engagement recorded yet — send an outreach email to start tracking"
- [x] Vitest: test prospects.getEmailEngagement returns events in correct order

### v14.3 — Order Detail Page for Converted Bookings
- [x] Add orders.getDetail tRPC query: returns service_order with bookingId reference, status, notes, createdAt
- [x] Build AdminOrderDetail.tsx page: order header (ID, status badge, created date), originating booking reference with link back to AdminBookings, order notes, status update controls
- [x] Register /admin/orders/:id route in App.tsx
- [x] Wire "View Order #N" toast link in AdminBookings convertToOrder success handler to navigate to /admin/orders/:id
- [x] Vitest: test orders.getDetail returns correct order, rejects non-admin

## v15 — Engagement Score, Line-Item Editor, Booking-Origin Badge

### v15.1 — Engagement Score on AdminProspects
- [x] Add prospects.listWithEngagement tRPC query: joins prospects with email_tracking_events, computes engagementScore = opens×1 + clicks×2, returns sorted list
- [x] Add "Score" column to AdminProspects table with amber flame icon for score > 0
- [x] Make Score column sortable (click header to sort desc/asc)
- [x] Vitest: test listWithEngagement computes correct scores

### v15.2 — Inline Line-Item Editor on AdminOrderDetail
- [x] Add orders.addLineItem tRPC mutation: inserts order_items row (serviceId, quantity, unitPrice)
- [x] Add orders.removeLineItem tRPC mutation: deletes order_items row by id
- [x] Add orders.updateLineItem tRPC mutation: updates quantity and/or unitPrice for an order_items row
- [x] Add orders.getAllServices tRPC query (or reuse existing): returns services list for the add-item dropdown
- [x] Build inline editor in AdminOrderDetail: add-item row with service selector + qty + price, edit/delete per existing item, recalculate displayed total
- [x] Vitest: test addLineItem, removeLineItem, updateLineItem mutations

### v15.3 — Booking-Origin Badge on AdminOrders
- [x] Update orders.allOrders tRPC query to include bookingId in returned rows
- [x] Add "From booking #N" amber badge to each row in AdminOrders that has a bookingId, linking to /admin/bookings
- [x] Vitest: test allOrders returns bookingId field

## v16 — Hot Filter on AdminProspects

- [x] Add `hotFilter` boolean state to AdminProspects (default false)
- [x] Add "🔥 Hot" quick-filter pill button next to status tabs — amber when active, muted when inactive
- [x] When hotFilter is active, filter prospects list to only show those with engagementScore ≥ 3
- [x] Show count of hot prospects in the pill label (e.g. "🔥 Hot (4)")
- [x] Turning on hotFilter clears statusFilter (and vice versa) to avoid conflicting filters
- [x] Vitest: test that listWithEngagement returns correct scores (already covered in v15; add a UI filter logic unit test)

## Autonomous Agent Platform

### P1 — Email Infrastructure
- [x] Provide exact Resend inbound MX + TXT records for onstage.bot (GoDaddy)
- [x] Add Resend domain onstage.bot for sending (SPF, DKIM, DMARC records)
- [x] Create POST /api/webhooks/resend-inbound endpoint to receive inbound emails
- [x] Parse inbound email: extract sender, subject, body, thread references (In-Reply-To / References headers)
- [x] Store inbound emails in email_threads table (threadId, prospectId, direction, subject, body, fromAddress, toAddress, receivedAt)
- [x] Create Tommy admin account (placeholder with email tom@starsupportinc.com, role=admin)
- [x] Add RESEND_INBOUND_SECRET to secrets for webhook validation
- [x] Verify hello@onstage.bot sending identity in Resend and update outreach send-from address

### P2 — Sales Agent: Nightly Discovery
- [x] Read periodic-updates.md and set up heartbeat scheduler for nightly discovery job
- [x] Build discovery agent: search web for robot companies attending trade shows, press releases, industry sites
- [x] Discover new shows/events not yet in DB and add them
- [x] Deduplicate against existing prospects (by company name + domain)
- [x] Auto-create new prospect records with status=new
- [x] Build per-company strategy: AI generates outreach angle based on company profile, robot type, show context
- [x] Queue first outreach email draft (do not send yet — queue for review or auto-send after 1hr delay)
- [x] Auto-send first outreach from hello@onstage.bot via Resend, store resendMessageId

### P3 — Conversational Reply Engine
- [x] On inbound email webhook: match to prospect by sender email address
- [x] Load full thread history (all prior emails in thread) as context
- [x] AI generates natural conversational reply (no scripts, no templates — contextual)
- [x] Reply sent from hello@onstage.bot, BCC to admin (Bob) and Tommy
- [x] Log reply to email_threads table
- [x] Update prospect activity timeline with email_replied event
- [x] Track conversation state: discovery → interested → questions → ready_to_schedule

### P4 — Scheduling Page
- [x] Build /schedule page on onstage.bot: robot team availability calendar
- [x] Admin panel: Bob and Tommy set available time slots per week
- [x] Prospect picks slot → booking created in DB → calendar invite sent to Bob, Tommy, and prospect
- [x] AI detects scheduling intent in conversation and sends /schedule link at right moment
- [x] Confirmation email sent to prospect from hello@onstage.bot

### P5 — Meeting Notes + Handoff
- [x] Post-call: admin enters meeting notes in prospect record
- [x] AI summarizes notes, extracts next steps, updates prospect status to committed
- [x] Logistics Agent triggered: creates logistics_workflow record linked to prospect + order

### P6 — Logistics Agent Foundation
- [x] Build vendor scraper: search for freight forwarders, AV companies, rigging companies, warehouse operators in Las Vegas
- [x] Populate vendors table with 16 real Las Vegas vendors (scraped + seeded)
- [x] Build workflow builder: for each committed order, generate logistics_workflow with 13 ordered checkpoints
- [x] Checkpoint types: shipping_out, customs, airport_arrival, receiving, warehouse_in, staging, activation_test, booth_delivery, show_floor_checkin, show_end, return_pickup, warehouse_return, completed

### P7 — Checkpoint Engine
- [x] Shipping tracker: poll carrier APIs or ask robot company for tracking number, monitor status
- [x] Receiving checklist: customs cleared?, at airport?, in transit?, forklift needed?, warehouse space available?, staff assigned?
- [x] Warehouse space matcher: calculate space needed from robot dimensions, match to available bays, price accordingly
- [x] Staging + activation protocol: unpacking checklist, power-on test, calibration check, functionality test
- [x] Daily checkpoint poller: if checkpoint due date passed and not confirmed, send nudge to responsible party
- [x] Checkpoint status UI in AdminOrderDetail

### P8 — Problem Escalation
- [x] Robot issue detection: during staging, log problem type, severity, description
- [x] Escalation to robot company: AI drafts problem report email with photos/notes
- [x] Options presented: video call support or send tech on-site
- [x] Resolution tracking: log resolution steps, confirm robot is operational before booth delivery

### P9 — Show Floor + Return
- [x] Booth delivery tracking: confirm robot arrived at booth, get confirmation from robot company
- [x] Show-floor check-ins: AI sends daily check-in email to robot company during show
- [x] Post-show: AI prompts robot company to confirm pickup readiness
- [x] Return logistics workflow: same checkpoint engine as inbound
- [x] Full lifecycle marked complete in order record

## v20 — Cron Activation, Warehouse Pricing, Scheduling Self-Service

### v20.1 — Logistics Checkpoint Poller Cron
- [x] Register logistics-checkpoint-poll heartbeat: cron "0 8 * * *", POST to /api/scheduled/logistics-checkpoint-poll
- [x] Verify job appears in manus-heartbeat list

### v20.2 — Warehouse Bay + Pricing UI
- [x] Add warehouseBays table to schema: id, name, sqft, pricePerSqftPerDay, isAvailable, notes
- [x] Run migration SQL via webdev_execute_sql
- [x] Add warehouse.listBays, warehouse.upsertBay, warehouse.deleteBay tRPC procedures
- [x] Add warehouse.matchSpace(robotSqft, days) procedure: finds available bay, returns price estimate
- [x] Add "Warehouse" tab to AdminVendors page: bay CRUD table with sqft + price fields
- [x] Wire matchSpace into quote flow: auto-populate storage line item when robot dimensions are known
- [x] Vitest: test matchSpace pricing logic

### v20.3 — Scheduling Page Self-Service
- [x] Update AdminScheduling slot creation: date picker + time picker + duration selector + host dropdown (Bob / Tommy / Both)
- [x] Add slot deletion from AdminScheduling
- [x] Update public /schedule page: show available slots grouped by date, prospect fills name/email/company, slot booked on submit
- [x] On booking: send calendar invite email to Bob (bob@starsupportinc.com), Tommy (tom@starsupportinc.com), and prospect
- [x] Mark slot as booked after confirmed, prevent double-booking
- [x] Vitest: test slot booking, double-booking prevention, calendar invite email

## v21 — Space Matcher Integration, Schedule Page Upgrade, Bay Occupancy Tracking

### v21.1 — Space Matcher in Booking Flow
- [x] Add robotSqft + storageDays fields to booking_requests table (migration)
- [x] Update bookingRequests.create procedure to accept robotSqft + storageDays
- [x] Call matchSpace in bookingRequests.create to auto-compute warehouse line item
- [x] Store warehouseBayId + warehouseEstimate on the booking record
- [x] Update GetStarted / booking form UI to include robot sqft + storage days inputs
- [x] Show auto-populated warehouse storage estimate in booking confirmation
- [x] Vitest: test matchSpace auto-population in booking creation

### v21.2 — Public /schedule Page Upgrade
- [x] Build /schedule public page: available slots grouped by date
- [x] Prospect booking form: name, email, company fields per slot
- [x] On submit: call scheduling.bookSlot, show confirmation
- [x] Send calendar invite email to host + prospect via Resend (ICS attachment)
- [x] Add /schedule route to App.tsx and navbar link
- [x] Vitest: test slot booking, double-booking prevention

### v21.3 — Warehouse Bay Occupancy Tracking
- [x] Add warehouseBayId column to logistics_workflows table (migration)
- [x] Update logistics.createWorkflow to accept optional warehouseBayId
- [x] On warehouse_in checkpoint completion: set warehouseBays.isAvailable = false
- [x] On warehouse_return checkpoint completion: set warehouseBays.isAvailable = true
- [x] logistics.assignBay procedure: assign/reassign bay to any workflow
- [x] Vitest: test bay flip on warehouse_in and warehouse_return (244 tests total)

## v22 — AdminLogistics Bay Column, Warehouse Occupancy Board, Live Estimate Preview

### v22.1 — AdminLogistics Assigned Bay Column
- [x] Add "Assigned Bay" column to AdminLogistics workflow table
- [x] Inline bay selector dropdown per workflow row (calls logistics.assignBay on change)
- [x] Show bay name + availability status badge in the column
- [x] Fetch warehouse.listBays in AdminLogistics for the dropdown options

### v22.2 — AdminVendors Warehouse Occupancy Board
- [x] Fetch active logistics_workflows with warehouseBayId in AdminVendors
- [x] Build occupancy board: each bay card shows robot company + show name if occupied
- [x] Available bays show green "Available" badge; occupied show amber "Occupied" + workflow info
- [x] Add "Release Bay" button on occupied bays (calls logistics.assignBay with null)

### v22.3 — GetStarted Live Estimate Preview
- [x] Add warehouse.matchSpace query in GetStarted (debounced, triggered on sqft/days change)
- [x] Show "Space Estimate" preview card below the sqft/days fields while user is on step 2
- [x] Card shows: matched bay name, sqft, rate, total estimate, or "No bay available" message
- [x] Card updates live as user changes sqft or days values
- [x] Vitest: 30 new tests (274 total passing)

## v23 — Bay Assignment from Order Detail, Quote PDF Estimate Line Item, Occupancy History Log

### v23.1 — Bay Assignment from AdminOrderDetail
- [x] Add "Assign Bay" section to AdminOrderDetail workflow panel
- [x] Bay selector dropdown (warehouse.listBays) + assign button calls logistics.assignBay
- [x] Show currently assigned bay name with availability badge
- [x] Refresh workflow data after successful assignment

### v23.2 — Estimate Line Item in Quote PDF
- [x] Add bookings.generateQuoteHtml procedure (HTML quote with Print/Save as PDF button)
- [x] Services listed as TBD line items; warehouse estimate as a priced line item
- [x] Warehouse estimate amber callout card: bay name, sqft, days, total
- [x] "Generate Quote" button added to AdminBookings detail panel (opens in new tab)

### v23.3 — Occupancy History Log (warehouseBayEvents)
- [x] Add warehouse_bay_events table: id, bayId, workflowId, eventType, triggeredBy, notes, createdAt
- [x] Run migration SQL via webdev_execute_sql
- [x] Add warehouseBayEvents schema to drizzle/schema.ts
- [x] Log event on every bay flip in logistics.updateCheckpoint (warehouse_in → occupied, warehouse_return → released)
- [x] Log event on logistics.assignBay calls (manual assign/release)
- [x] Add warehouse.getBayHistory(bayId) procedure: returns events sorted desc
- [x] Add warehouse.getOccupancyReport() procedure: per-bay utilization with duration calc

### v23 Tests
- [x] Write server/v23.test.ts: 29 new tests
- [x] All 303 tests passing

## v24 — Send Quote Email Button

### v24.1 — bookings.sendQuoteEmail Server Procedure
- [x] Add bookings.sendQuoteEmail adminProcedure (input: id)
- [x] Reuse generateQuoteHtml logic to build HTML content
- [x] Send email via Resend to booking.contactEmail with HTML quote as body
- [x] Subject: "Your StageGate Quote — [quoteNumber] — [company]"
- [x] On success: update booking status to "quoted" and set quoteSentAt timestamp
- [x] Return { success, quoteNumber, sentTo }
- [x] Add quoteSentAt + quoteResendMessageId columns to booking_requests (migration applied)
- [x] Add htmlBody optional param to sendEmail helper

### v24.2 — AdminBookings Send Quote Button
- [x] Add "Send Quote" button next to "Preview" (renamed from Generate Quote) in BookingDetailPanel
- [x] Button shows loading spinner while mutation is pending
- [x] On success: show toast "Quote SG-XXXXX sent to [email]" and refresh booking
- [x] On error: show toast with error message
- [x] Button label changes to "Resend Quote" if booking.status === "quoted"
- [x] Green border dims slightly when already quoted (visual feedback)

### v24 Tests
- [x] Write server/v24.test.ts: 30 new tests
- [x] All 333 tests passing

## v25 — Quote Follow-Up Heartbeat

### v25.1 — Schema & Migration
- [x] Add quoteFollowUpSentAt TIMESTAMPTZ column to booking_requests (migration applied)
- [x] Add system_config table: key/value store for project-level heartbeat task UIDs
- [x] Add systemConfig schema to drizzle/schema.ts

### v25.2 — Express Handler (/api/scheduled/quote-followup)
- [x] Implement POST /api/scheduled/quote-followup handler in server/scheduled/quoteFollowup.ts
- [x] Authenticate via sdk.authenticateRequest, verify user.isCron === true
- [x] Query booking_requests WHERE status = 'quoted' AND quoteSentAt < NOW() - 5 days AND quoteFollowUpSentAt IS NULL
- [x] For each: send follow-up email via Resend with rich HTML + plain text fallback
- [x] Update quoteFollowUpSentAt = NOW() on each sent booking
- [x] Return { ok: true, processed: N, skipped: M, total: N }
- [x] Mount handler in server/_core/index.ts before Vite fallthrough

### v25.3 — Admin tRPC Procedures (system router)
- [x] system.createQuoteFollowUpJob: adminProcedure — creates daily 09:00 UTC cron, persists taskUid to system_config (idempotent)
- [x] system.getQuoteFollowUpJobStatus: adminProcedure — returns job info from heartbeat SDK
- [x] system.pauseQuoteFollowUpJob: adminProcedure — calls updateHeartbeatJob with enable=false
- [x] system.resumeQuoteFollowUpJob: adminProcedure — calls updateHeartbeatJob with enable=true

### v25.4 — Tests
- [x] Write server/v25.test.ts: 38 new tests (5-day filter, idempotency, email content, auth guard, job management)
- [x] All 371 tests passing

## v26 — Dashboard Pipeline Fix & Outreach Engine Repair

### Root Cause Diagnosis
- [x] Identified 3 missing DB tables: sales_agent_runs, sales_agent_conversations, email_threads
- [x] Confirmed all 3 heartbeat jobs were firing but crashing at DB layer (tables didn't exist)
- [x] Confirmed 78 prospects + 20 trade shows + 8 services + 7 logistics partners + 5 xbot projects exist in DB
- [x] Confirmed outreach job failed at 9am UTC with "Failed query" error (missing table)

### v26.1 — Missing Tables Created
- [x] Create sales_agent_conversations table with correct camelCase column names
- [x] Create sales_agent_runs table
- [x] Create email_threads table
- [x] Verify all 3 tables joinable with prospects

### v26.2 — Conversation Backfill
- [x] Backfill 78 sales_agent_conversations records (one per existing prospect, state=discovery, followUpCount=0)
- [x] Verified exact outreach query returns 10 prospects ready for first email tonight
- [x] Tonight's 9am UTC outreach run will send first 10 emails

### v26.3 — getSiteStats Updated
- [x] Add tradeShows, services, logisticsPartners, xbotProjects, agentRuns, outreachCampaigns, conversations to getSiteStats
- [x] Import all required schema tables in routers.ts
- [x] conversations field includes byState breakdown, awaiting count, active count

### v26.4 — AdminDashboard Rebuilt
- [x] Replace 6-tile siteStats row with 8-tile Pipeline Health row (all clickable links)
- [x] Tiles: Prospects (78), Trade Shows (20), Services (8), Logistics Partners (7), XBOT Projects (5), Agent Runs, Conversations (78), Users
- [x] Replace "Outreach Pipeline" (exhibitor_leads funnel, all zeros) with "Sales Agent Pipeline" (conversations funnel)
- [x] Funnel stages: Discovery / Awaiting / In Convo / Scheduling / Booked
- [x] Add MessageSquare icon to lucide-react import

### v26 Tests
- [x] Write server/v26.test.ts: 19 new tests
- [x] All 390 tests passing

## v27 — Frank Sales Agent Rebuild

### v27.1 — Research & Playbook
- [x] Research top robotics conferences 2025-2026 (CES, NAB, IREX, MODEX, ProMat, ROSCon, ICRA, etc.)
- [x] Research The Robot Guild services and positioning
- [x] Research off-floor demo venues in Las Vegas (Innovation Center, Black Fire, hotel/casino options)
- [x] Document Frank's voice guidelines and conversation stage playbook
- [x] Document StageGate logistics breakpoints (shipping, customs, staging, power, demos, returns)

### v27.2 — Discovery Engine Rebuild
- [x] Add exhibitorListUrl field to trade_shows table
- [x] Rebuild salesAgentDiscovery: fetch exhibitor list URLs, extract robot company names + contacts
- [x] Use LLM to identify which exhibitors are robot companies (not just any tech company)
- [x] Upsert new prospects with show context (showName, showDate, boothInfo)
- [x] Deduplicate by company domain

### v27.3 — Frank Outreach Engine Rebuild
- [x] Define Frank persona in a server-side config (voice, tone, signature, from address)
- [x] Stage 1 — Intro email: Hi from Frank, short StageGate pitch, specific show mention, soft CTA
- [x] Stage 2 — Breakpoints follow-up: logistics pain points (shipping delays, customs, staging, power)
- [x] Stage 3 — Demo venue offer: off-floor demo space options (StageGate office, Innovation Center, Black Fire, hotel/casino)
- [x] Stage 4 — Robot Guild handoff: brand/promo services intro, offer warm introduction
- [x] LLM generates each email fresh per prospect (company name, show, robot type context)
- [x] Human-sounding, not verbose, not AI-sounding — Frank voice enforced via system prompt

### v27.4 — AdminSalesAgent Conversation View
- [x] Build full conversation view page: list of all prospects with conversation state
- [x] Per-prospect detail: show current stage, last email sent, draft preview, manual send button
- [x] Frank persona settings panel: edit voice guidelines, signature, from name/email
- [x] Draft preview: show LLM-generated draft before it goes out (approve/edit/send)
- [x] Manual trigger: "Send now" override for any prospect

### v27 Tests
- [x] Write server/v27.test.ts: Frank voice validation, stage progression, venue options, Robot Guild handoff
- [x] All 445 tests passing (v27)

## v28 — Activate Frank's Full Autonomous Cycle

### v28.1 — Nightly Outreach Activation
- [x] Verify OUTREACH_BATCH_SIZE=8 and nextFollowUpAt filter are correct
- [x] Seed nextFollowUpAt=now for all 78 discovery-state prospects so tonight's cron fires
- [x] OUTREACH_BATCH_SIZE confirmed at 8 (safe for Resend, no change needed)
- [x] Outreach runs via existing heartbeat cron at 3am UTC (registered in prior version)
- [x] AdminSalesAgent: cron status visible in existing runs panel

### v28.2 — Continuous Discovery Pipeline (exhibitorListUrl scraping)
- [x] exhibitorListUrl column already exists in schema (no migration needed)
- [x] Seed exhibitorListUrl for 12 shows (CES, NAB, Automate, PACK EXPO, CONEXPO, MINExpo, Manifest, HIMSS, AWS re:Invent)
- [x] Rebuild salesAgentDiscovery to scrape exhibitorListUrl pages via fetch + LLM parse
- [x] Fallback to LLM knowledge if exhibitorListUrl is null or fetch fails
- [x] Deduplicate by company name (case-insensitive) before ingest
- [x] AdminShows: exhibitorListUrl visible and editable in show detail

### v28.3 — Frank Reply Handling (Close the Loop)
- [x] Update inbound webhook FROM_ADDRESS from hello@onstage.bot to frank@onstage.bot
- [x] Update reply system prompt to sign as Frank (not "StageGate Team")
- [x] Update conversation state advancement: inbound reply → "responded" (not "in_conversation")
- [x] Update scheduling detection: advance to "scheduling" (not "scheduling_sent")
- [x] Wire inbound matching to also check emailThreads.resendMessageId (In-Reply-To header)
- [x] Stop auto-sending AI reply immediately — draft-first mode: creates pending draft in draft_emails

### v28 Tests
- [x] Write server/v28.test.ts: exhibitorListUrl seeding, inbound state transitions, Frank reply-from
- [x] All 512 tests passing (v28)

## v29 — Frank Agent Instructions Upgrade

- [x] Rewrite FRANK_SYSTEM_PROMPT with "Boots-on-the-Ground / Las Vegas Powerhouse" voice
- [x] Update STAGEGATE_PITCH with three-phase lifecycle framework (Pre-Show / Main Event / Legacy)
- [x] Update STAGE_PROMPTS with new tone directives and scenario examples
- [x] Add heavy industrial robot handling language (Fanuc, Yaskawa, Omron, 480V three-phase)
- [x] Add Las Vegas showroom / distribution pitch to ROBOT_GUILD_PITCH and DEMO_VENUES
- [x] Add "Zero-Risk Demo" framing to breakpoints and staging prompts
- [x] Add CTA priority: showroom tour booking or distribution partnership call
- [x] Write server/v29.test.ts: voice directives, lifecycle phases, heavy industrial terms, CTA priorities
- [x] All 579 tests passing (v29)

## v30 — Frank Email Preview, Showroom Tour Page, Robot Category

### v30.1 — robotCategory on prospects
- [x] Add robotCategory varchar (light / heavy_industrial / mixed) to prospects table
- [x] Run DB migration for robotCategory column (ALTER TABLE)
- [x] Update salesAgentDiscovery to auto-classify prospects via LLM (light/heavy_industrial/mixed)
- [x] Pass robotCategory into pickBreakpoints so Frank uses correct hardware language per email

### v30.2 — Frank email preview in Admin
- [x] Add salesAgent.previewEmail tRPC procedure: takes prospectId + stage, calls LLM, returns draft subject + body
- [x] Add salesAgentPreviewHandler to salesAgent.ts (no-send, generate only)
- [x] Register /api/scheduled/sales-agent-preview route in index.ts
- [x] Add "Preview Frank's Email" button to AdminSalesAgent prospect detail panel
- [x] Show preview in a Dialog modal with subject, body, stage selector, and copy button
- [x] Preview uses the new FRANK_SYSTEM_PROMPT and robotCategory-aware stage prompt

### v30.3 — Showroom tour booking page
- [x] Create /tour route in App.tsx
- [x] Build TourBooking.tsx page: 4 venue options, robot type selector, contact form
- [x] Form submission via bookings.create tRPC procedure (services=['showroom_tour'])
- [x] Success state shows frank@onstage.bot contact
- [x] Amber accent, dark theme, heavy industrial robot types listed

### v30 Tests
- [x] Write server/v30.test.ts: robotCategory schema, previewEmail handler, /tour page, hardware-aware breakpoints (67 tests)
- [x] All 610 tests passing (v30)

## v31 — Tour CTA, Pending Drafts Queue, Nightly Cron

### v31.1 — Book a Showroom Tour CTA
- [x] Add "Book a Tour" amber nav link to Navbar.tsx (desktop + mobile)
- [x] Add "Book a Showroom Tour" amber CTA button to Home.tsx hero section
- [x] Link both to /tour

### v31.2 — Admin Pending Drafts Review Queue
- [x] Add Pipeline / Pending Drafts top-level tab bar to AdminSalesAgent.tsx
- [x] Build PendingDraftsTab component: query trpc.admin.getDrafts (status=pending)
- [x] Show draft list: prospect name, company, subject, created date, Frank's Reasoning
- [x] Per-draft actions: Approve & Send (trpc.admin.sendDraft), Edit inline, Discard (trpc.admin.discardDraft)
- [x] Badge count on Pending Drafts tab using trpc.admin.getDraftCount
- [x] Fixed TypeScript errors: draft procedures are in trpc.admin.*, not trpc.salesAgent.*

### v31.3 — Nightly Outreach Cron Registration
- [x] Verified sales-agent-outreach cron already active: 9am UTC daily (task_uid: FvCbJpt65VF8XY22ex8okQ)
- [x] Verified sales-agent-discover cron already active: 2am UTC daily (task_uid: RaPBmLTLBTNBx7jrDHtafd)
- [x] Verified sales-agent-ingest cron already active: 3am UTC daily (task_uid: V6nM9RdbAx5mhCFAv8q6WG)
- [x] 78 prospects in discovery state with nextFollowUpAt=NOW() ready for tomorrow's 9am run
- [x] Dev server restarted to clear stale module cache

### v31 Tests
- [x] Write server/v31.test.ts: tour CTA, pending drafts tab, cron handlers, admin procedures (38 tests)
- [x] All 648 tests passing (v31)

## v32 — Outreach Dashboard Card, Apollo Email Verification, Prospect Expansion

### v32.1 — Outreach quick-link card on Admin Dashboard
- [x] Fix outreach card link from /admin/outreach to /admin/sales-agent
- [x] Add In Pipeline count to outreach card (shows conversations total)
- [x] Upgrade Go to Outreach button to amber-filled style
- [x] Outreach card shows pending/approved/sent draft counts

### v32.2 — Apollo email verification on prospect detail
- [x] Add verifyProspectEmail adminProcedure to salesAgent router (Apollo org search + people search)
- [x] Step 1: Apollo mixed_companies/search to find org by name + website
- [x] Step 2: Apollo mixed_people/search to find CEO/CTO/VP contacts at org
- [x] Step 3: Generate email pattern suggestions when Apollo finds no email
- [x] Step 4: Update prospect contactEmail + emailConfidence + contactName/Title/LinkedIn in DB
- [x] Returns found, email, confidence, name, title, linkedIn, suggestions, orgFound
- [x] Add Verify Email button to prospect detail panel in AdminSalesAgent
- [x] Add Apollo result modal: shows found email + confidence, or suggestions if not found

### v32.3 — Expand prospect discovery (find more than 78)
- [x] Seed 5 new robotics-focused shows: MODEX 2026, ProMat 2027, ROSCon 2026, ICRA 2026, Automate 2026
- [x] Update exhibitorListUrls for ISC West, SEMA, G2E
- [x] Add salesAgentDiscoveryCore export to salesAgentDiscovery.ts for admin-triggered runs
- [x] Add triggerDiscovery adminProcedure to salesAgent router (fire-and-forget, returns runId + showCount)
- [x] Add Find Prospects button to AdminSalesAgent header (amber, calls triggerDiscovery)
- [x] Button shows loading state while discovery is running

### v32 Tests
- [x] Write server/v32.test.ts: Apollo verification, triggerDiscovery, dashboard card, new shows (78 tests)
- [x] All 688 tests passing (v32)

## v33 — Discovery Run, Bulk Apollo Verification, CSV Import

### v33.1 — Trigger discovery run
- [x] Verified triggerDiscovery procedure fires correctly against all 25 shows
- [x] Runs tab shows live status of running discovery (polls getRuns)
- [x] Toast shows runId and showCount on trigger

### v33.2 — Bulk Apollo verification
- [x] Add salesAgent.verifyAllUnverified adminProcedure: fetches all prospects with emailConfidence=low, runs Apollo verify in sequence, returns total/verified/notFound/message
- [x] Add Verify All button (blue, ShieldCheck icon) to AdminSalesAgent header
- [x] Bulk verify result modal: Checked / Verified / Not Found stats
- [x] Button shows loading state while running

### v33.3 — CSV prospect import
- [x] Add salesAgent.importProspects adminProcedure: accepts csvText + optional defaultShowId, parses rows, validates company (required), deduplicates by name, upserts with shows jsonb array + robotCategory
- [x] CSV columns: company, contact_name, contact_email, contact_title, website, robot_type, robot_category, show_name
- [x] Add Import CSV button (amber, FileText icon) to AdminSalesAgent header
- [x] CSV import modal: textarea for paste, column format hint, Import button
- [x] Import result modal: Imported / Skipped (dup) / Total stats + error list

### v33 Tests
- [x] Write server/v33.test.ts: verifyAllUnverified, importProspects, triggerDiscovery, UI buttons (42 tests)
- [x] All 730 tests passing (v33)

## v34 — Real-Time Verify All Progress Bar

### v34.1 — Server-side progress tracking
- [x] Add in-memory batchVerifyProgress map (batchId → { total, current, verified, notFound, currentCompany, status, startedAt })
- [x] Modify verifyAllUnverified to return a batchId immediately (fire-and-forget the actual work)
- [x] Run Apollo verification loop in background, updating the in-memory map after each prospect
- [x] Add salesAgent.getVerifyProgress query: takes batchId, returns current progress snapshot
- [x] Mark batch as 'complete' or 'error' when loop finishes

### v34.2 — Frontend real-time progress UI
- [x] Replace fire-and-forget mutation with a two-phase flow: trigger → get batchId → poll progress
- [x] Show progress modal immediately on trigger (not after completion)
- [x] Progress modal: animated progress bar (current/total %), current company name being verified
- [x] Live counters: Checked / Verified / Not Found updating in real-time
- [x] Status line: "Verifying X of Y — currently checking: CompanyName"
- [x] Poll getVerifyProgress every 1.5s while status is 'running'
- [x] On complete: show final summary with confetti-free success state and Close button
- [x] On error: show error message with partial results

### v34 Tests
- [x] Write server/v34.test.ts: batchId returned immediately, progress map structure, getVerifyProgress query
- [x] All 766 tests passing

## v35 — Email Open & Click Tracking

### v35.1 — DB migration
- [x] Create email_tracking_events table in MySQL (id, prospectId, messageId, eventType, url, occurredAt, raw, createdAt)
- [x] Generate migration SQL via pnpm drizzle-kit generate and apply via webdev_execute_sql
- [x] Create prospect_activities table if not already in DB (id, prospectId, type, title, description, metadata, createdAt)
- [x] Create draft_emails table if not already in DB (id, prospectId, subject, body, status, resendMessageId, sentAt, agentReasoning, updatedAt, createdAt)

### v35.2 — Resend open/click tracking on outgoing emails
- [x] Enable Resend open and click tracking on all outgoing emails (open_tracking: true, click_tracking: true in the API payload)
- [x] Resend webhook at /api/webhooks/resend already handles email.opened and email.clicked events — verify it inserts into email_tracking_events and prospect_activities

### v35.3 — Pipeline state update on engagement
- [x] On first email.opened event for a prospect: if conv.state is 'intro_sent' or 'followup_1' or 'followup_2', advance state to 'email_opened'
- [x] On first email.clicked event: advance state to 'link_clicked' (higher engagement signal)
- [x] Add 'email_opened' and 'link_clicked' to the salesAgentConversations state machine comment
- [x] Update getConversations to join engagement counts (opens, clicks, lastOpenedAt, lastClickedAt) from email_tracking_events

### v35.4 — Admin UI: engagement indicators
- [x] AdminSalesAgent pipeline board: show open/click badge on prospect cards (eye icon for opens, cursor icon for clicks)
- [x] AdminSalesAgent prospect detail panel: show engagement timeline section with open/click events
- [x] AdminPipeline: update prospects.list to use listWithEngagement so open/click counts appear on pipeline cards
- [x] AdminPipeline prospect card: show small eye/cursor badge when opens > 0 or clicks > 0
- [x] AdminPipeline detail panel: show engagement section with open count, click count, last opened, last clicked

### v35 Tests
- [x] Write server/v35.test.ts: email_tracking_events table structure, Resend webhook handler, engagement join in getConversations, open/click tracking flags in sendEmail
- [x] All 801 tests passing

## v36 — Engagement-Based Follow-Up Shortening

### v36.1 — Webhook logic
- [x] On email.clicked: after advancing state to link_clicked, also set nextFollowUpAt = now + 1 day on the salesAgentConversation row
- [x] Log a prospect_activities entry: "Follow-up accelerated — link click detected, next follow-up in 1 day"
- [x] Only shorten if current nextFollowUpAt is more than 1 day away (don't push it further out)

### v36 Tests
- [x] Write server/v36.test.ts: verify link_clicked sets nextFollowUpAt ≈ now+1d, verify activity log entry, verify no shortening when already within 1 day
- [x] All 810 tests passing

## v37 — Reply Detection & Follow-Up Pause

### v37.1 — Inbound webhook
- [x] Ensure resend-inbound.ts sets state=awaiting_reply and nextFollowUpAt=null on any reply
- [x] Log a prospect_activities entry: "Reply received — automated follow-ups paused"
- [x] Handle email.replied Resend event type in the outbound webhook (resend.ts) as a fallback

### v37.2 — SalesAgent loop guard
- [x] In salesAgent.ts outreach loop: skip conversations where state is 'awaiting_reply' or 'replied'
- [x] Add email_opened and link_clicked to the inArray allowlist in salesAgent.ts

### v37.3 — Admin UI
- [x] Add 'awaiting_reply' to STAGES array in AdminSalesAgent.tsx (amber/orange color, label: Replied)
- [x] Add awaiting_reply to updateConversationStage state enum in routers.ts
- [x] Add awaiting_reply to ConversationStage type in frankPlaybook.ts

### v37 Tests
- [x] Write server/v37.test.ts: 21 tests covering inbound/outbound webhook, salesAgent loop, frankPlaybook, AdminSalesAgent UI, routers enum
- [x] All 831 tests passing

## v38 — Prospect Notes, Resume Follow-ups & Reply Content Capture

### v38.1 — Prospect notes field
- [x] Add `notes` text column to prospects table in drizzle/schema.ts (already existed)
- [x] Verified notes column exists in DB (no migration needed)
- [x] Add salesAgent.updateProspectNotes adminProcedure (prospectId, notes) in routers.ts
- [x] AdminSalesAgent detail panel: inline notes textarea with auto-save on blur
- [x] Show notes in detail panel below contact info section
- [x] Show "Saving…" indicator while mutation is pending

### v38.2 — Resume follow-ups button
- [x] Add salesAgent.resumeFollowUps adminProcedure: sets state=followup_1, nextFollowUpAt=now+1d, logs activity
- [x] AdminSalesAgent detail panel: show "Resume Follow-ups" button only when state=awaiting_reply
- [x] On click: mutate resumeFollowUps, invalidate getConversations
- [x] Log prospect_activities entry: "Follow-ups resumed — moved back to Follow-up 1"

### v38.3 — Reply content capture
- [x] Update resend-inbound.ts to store first 300 chars of reply body in activity description
- [x] Add ellipsis (…) when body is truncated
- [x] AdminSalesAgent detail panel: activity timeline with email_replied, followup_accelerated, followup_resumed entries
- [x] Activity timeline: type icon, title, description, timestamp for each activity
- [x] Fetch prospect activities via salesAgent.getProspectActivities query

### v38 Tests
- [x] Write server/v38.test.ts (29 tests) covering all above
- [x] All 860 tests passing

## v39 — Expandable Full Reply Body in Activity Timeline

### v39.1 — Store full reply body in metadata
- [x] Update resend-inbound.ts: store full reply body text in metadata.replyBody (no truncation)
- [x] Keep the 300-char description snippet for the timeline preview

### v39.2 — Expandable UI in activity timeline
- [x] email_replied activity entries: show 300-char preview by default
- [x] Add "View full reply ▾" toggle button below the preview when metadata.replyBody exists
- [x] On expand: show full reply body in a scrollable pre block (max-h-48, overflow-y-auto)
- [x] Toggle label changes to "Collapse ▴" when expanded
- [x] Per-activity expanded state (not global) — each entry expands independently

### v39 Tests
- [x] Write server/v39.test.ts (15 tests) covering all above
- [x] Fix v38.test.ts to use trimmedBody.slice instead of bodyText.trim().slice
- [x] All 875 tests passing

## v40 — Smoke & Link Tests (Admin Workflow + AI Agents)

### v40.1 — Test matrix enumeration
- [x] List all admin routes in App.tsx (18 routes)
- [x] List all tRPC procedures used in UI vs defined in routers.ts (60+ procedures checked)
- [x] List all nav links in DashboardLayout sidebar (16 nav items)

### v40.2 — Static analysis
- [x] All tRPC procedure names used in UI match server definitions (100% match)
- [x] All route paths in App.tsx have corresponding page components
- [x] All sidebar nav links point to registered routes
- [x] Fixed: broken /admin/xbot link in AdminDashboard.tsx → /admin/agents

### v40.3 — Runtime smoke test (browser)
- [x] Admin Dashboard loads without JS errors (after DB migration)
- [x] Admin Pipeline loads and renders kanban columns
- [x] Admin Sales Agent (Frank) loads conversation list
- [x] Admin Prospects loads prospect table
- [x] Admin Agents (XBOT) loads without errors
- [x] Admin Bookings loads without errors
- [x] Admin Logistics loads without errors
- [x] Admin Shows loads without errors
- [x] Admin Outreach loads without errors

### v40.4 — AI agent surface checks
- [x] Frank salesAgent loop: all 19 procedures verified present in routers.ts
- [x] Frank state allowlist: email_opened, link_clicked included; awaiting_reply excluded
- [x] Frank NEXT_STAGE map: all states mapped correctly
- [x] All 31 procedures across 11 admin pages verified present in routers.ts

### v40.5 — Fix any critical issues found
- [x] Fixed: broken /admin/xbot link → /admin/agents in AdminDashboard.tsx
- [x] Fixed: DB migration — added robotCategory, repliedAt, followUpDate, emailConfidence, robotName columns to Postgres prospects table
- [x] No 500 errors after migration
- [x] All 875 tests passing

## v41 — Discovery Pipeline: Logic Engine + Ontological Scraper + Smoke Tests

### v41.1 — discoveryLogicEngine.ts (pre-ingest gate)
- [x] Build `server/agents/discoveryLogicEngine.ts` module
- [x] Junk filter: reject companies with no website, no robot signals, or generic/vague names
- [x] Real-company check: LLM structured JSON — `isRealCompany` boolean + `confidence` score + `reason`
- [x] Robot ontology classifier: `robotType` enum + `robotName` + `robotDescription`
- [x] `robotCategory` inference: light | heavy_industrial | mixed based on robot type
- [x] `showRelevance` score: 0–1 float — how likely this company attends Las Vegas trade shows
- [x] Batch scoring: `filterAndClassify(raw[])` → filters junk, enriches survivors

### v41.2 — Upgraded salesAgentDiscovery.ts scraper
- [x] Structured HTML extraction: parse table/ul/dl exhibitor list patterns before raw text fallback
- [x] Multi-signal company name extraction: title-case words, all-caps tokens, link text
- [x] Pagination detection: find "Next page" / "Load more" links and follow up to 3 pages
- [x] Wire logic engine as pre-ingest gate on all discovered prospects
- [x] Log junk-filtered count per run in run record details
- [x] DRY: handler calls core (remove duplicate code)

### v41.3 — Smoke, logic, and link tests (server/v41.test.ts)
- [x] Junk filter rejects: no website, no robot signal, generic company names
- [x] Real-company check passes known robot companies
- [x] Ontology classifier: correct robotType for humanoid / quadruped / AMR / arm / drone
- [x] robotCategory inference: heavy_industrial for arm/cobot, light for humanoid/service
- [x] showRelevance > 0.7 for known Las Vegas exhibitors
- [x] HTML scraper: structured extraction finds company names from table HTML
- [x] HTML scraper: pagination link detection
- [x] Ingest pipeline link test: discovery → logic engine → ingest → conversation created
- [x] Deduplication test: same company twice → one prospect
- [x] All existing 875 tests still pass


## v41 — Discovery Pipeline: Logic Engine + Ontological Scraper + Smoke Tests

### v41.1 — discoveryLogicEngine.ts (pre-ingest gate)
- [x] Build server/agents/discoveryLogicEngine.ts module
- [x] Junk filter: reject companies with no website, no robot signals, or generic/vague names
- [x] Real-company check: LLM structured JSON — isRealCompany boolean + confidence score + reason
- [x] Robot ontology classifier: robotType enum + robotName + robotDescription
- [x] robotCategory inference: light | heavy_industrial | mixed based on robot type
- [x] showRelevance score: 0-1 float — how likely this company attends Las Vegas trade shows
- [x] Batch scoring: filterAndClassify(raw[]) filters junk, enriches survivors

### v41.2 — Upgraded salesAgentDiscovery.ts scraper
- [x] Structured HTML extraction: parse table/ul/dl exhibitor list patterns before raw text fallback
- [x] Multi-signal company name extraction: title-case words, all-caps tokens, link text
- [x] Pagination detection: find Next page / Load more links and follow up to 3 pages
- [x] Wire logic engine as pre-ingest gate on all discovered prospects
- [x] Log junk-filtered count per run in run record details
- [x] DRY: handler calls core (remove duplicate code)

### v41.3 — Smoke, logic, and link tests (server/v41.test.ts)
- [x] Junk filter rejects: no website, no robot signal, generic company names
- [x] Real-company check passes known robot companies
- [x] Ontology classifier: correct robotType for humanoid / quadruped / AMR / arm / drone
- [x] robotCategory inference: heavy_industrial for arm/cobot, light for humanoid/service
- [x] showRelevance > 0.7 for known Las Vegas exhibitors
- [x] HTML scraper: structured extraction finds company names from table HTML
- [x] HTML scraper: pagination link detection
- [x] Ingest pipeline link test: discovery to logic engine to ingest to conversation created
- [x] Deduplication test: same company twice yields one prospect
- [x] All existing 875 tests still pass

## v42 — Expanded Prospect Universe: Robot OEMs + Trade Show Vendors

### v42.1 — Robot OEM Ontology Expansion
- [x] Add MiR, Locus Robotics, OTTO Motors to wheeled_amr ontology
- [x] Add Pudu Robotics, Keenon Robotics to service_robot ontology
- [x] Add expanded humanoid list: Apptronik, Sanctuary AI, 1X Technologies, Fourier Intelligence, UBTECH
- [x] Add vendor prospect category to discoveryLogicEngine.ts (exhibit_house, freight, av_electrical, venue, agency)
- [x] Update filterAndClassify to accept vendor prospects (bypass robot signal check for known vendors)

### v42.2 — Vendor Prospect Seeding (DB)
- [x] Add vendor_type column to prospects table (robot_oem | exhibit_house | freight | av_electrical | venue | agency | other)
- [x] Apply migration via webdev_execute_sql
- [x] Seed Tier 1 exhibit houses: Freeman, GES, GPJ, MC2 Experience, Momentum Worldwide
- [x] Seed Tier 2 exhibit houses: Absolute Exhibits, Blueprint Exhibits, Pure Exhibits, Exhibit Pros, Nimlok, RCS Custom Exhibits, The Trade Group, Exhibit Experience, Exhibit People, Booth Exhibits
- [x] Seed AV/electrical: Encore, PRG, AVI-SPL
- [x] Seed freight/logistics: DHL Express, FedEx Custom Critical, UPS Supply Chain Solutions, DB Schenker
- [x] Seed Las Vegas venues: Las Vegas Convention Center, Venetian Expo, Mandalay Bay Convention Center, Caesars Forum
- [x] Seed robot OEMs not already in DB: MiR, Locus Robotics, OTTO Motors, Pudu Robotics, Keenon Robotics, Apptronik, Sanctuary AI, 1X Technologies, Fourier Intelligence, UBTECH Robotics
- [x] Each vendor prospect gets: correct outreach angle (partner pitch vs customer pitch), contact title, email guess, notes

### v42.3 — Admin UI: Vendor Type Filter
- [x] Add vendor_type filter pill to AdminProspects page (All | Robot OEM | Exhibit House | Freight | AV/Electrical | Venue | Agency)
- [x] Show vendor_type badge on prospect cards/rows

### v42.4 — Tests
- [x] Vendor bypass test: known exhibit houses pass filterAndClassify without robot signal
- [x] Vendor type seeding test: all seeded vendors have correct vendor_type
- [x] All 980 tests still pass

## v43 — Partner Templates, Show URL Seeds, Partner Enrichment

- [x] Partner email template: separate intro email for outreachAngle=partner with "robotics technical operations layer" pitch
- [x] Wire partner template into email draft generation (check outreachAngle before choosing template)
- [x] Seed CES 2026/2027, NAB 2026, MODEX 2026 exhibitor URLs into trade shows table / discovery config
- [x] Add show URL seed script for discovery run config
- [x] Trigger research-agent enrichment pass for all 22 ecosystem partner prospects
- [x] Add tRPC procedure: prospects.triggerPartnerEnrichment (batch research for vendorType != robot_oem)
- [x] Admin UI button: "Enrich Partners" on AdminProspects filter bar
- [x] Write v43 tests: partner template selection, show URL config, enrichment trigger

## v43 — Partner Templates, Show URL Seeds, Partner Enrichment

- [x] Partner email template: separate intro email for outreachAngle=partner with robotics technical operations layer pitch
- [x] Wire partner template into email draft generation (check outreachAngle before choosing template)
- [x] Seed CES 2026/2027, NAB 2026, MODEX 2026 exhibitor URLs into trade shows table / discovery config
- [x] Add show URL seed script for discovery run config
- [x] Trigger research-agent enrichment pass for all 22 ecosystem partner prospects
- [x] Add tRPC procedure: prospects.triggerPartnerEnrichment (batch research for vendorType != robot_oem)
- [x] Admin UI button: Enrich Partners on AdminProspects filter bar
- [x] Write v43 tests: partner template selection, show URL config, enrichment trigger

## v48 — Nav, Contact Us, About Us
- [x] Remove Dashboard button from top nav bar in Home.tsx
- [x] Add Contact Us section at bottom of Home page (email, form link, or mailto CTA)
- [x] Build /about page with StageGate backstory and LV Robotics connection
- [x] Add About Us link to Home page nav bar
- [x] Wire /about route in App.tsx

## v49 — Post-Login Routing, Onboarding, Service Requests
- [x] Add service_requests table to schema (userId, type, showId, robotType, details, status, createdAt)
- [x] Add robots JSON column to company_profiles (name, type, weight, dimensions, powerReq)
- [x] Add showsAttending JSON column to company_profiles
- [x] Add company.submitServiceRequest tRPC procedure
- [x] Add company.getMyServiceRequests tRPC procedure
- [x] Add admin.getServiceRequests tRPC procedure
- [x] Fix OAuth callback to redirect to /auth-redirect instead of /
- [x] Build /auth-redirect page: admin → /admin, user with profile → /dashboard, user without profile → /onboarding
- [x] Build /onboarding multi-step wizard (company info → robot details → shows → services needed)
- [x] Rebuild ClientDashboard: profile summary, robots, upcoming shows, service requests, submit new request
- [x] Add service request section to AdminDashboard sidebar
- [x] Update nav Sign In to pass returnPath so user lands back where they were

## v50 — Edit Profile Feature

- [x] Build EditProfileSheet component (slide-out sheet with tabs: Company, Robots, Shows, Services)
- [x] Wire Edit Profile button into ClientDashboard profile card
- [x] Ensure upsertProfile tRPC procedure covers robots, showsAttending, servicesNeeded fields
- [x] Optimistic update on save so dashboard reflects changes immediately

## v51 — Supabase Design Unification + Features

- [x] Define Supabase design tokens in index.css (neutral grays, green accent, clean typography, no pill badges)
- [x] Rewrite DashboardLayout sidebar to Supabase style (flat list, no rounded pill nav items)
- [x] Rewrite AdminProspects to Supabase table style (inline text status, no badge pills) — completed in v52
- [x] Rewrite AdminDashboard to Supabase style (clean stat cards, no colored badges) — completed in v52
- [x] Rewrite AdminServiceRequests to Supabase table style — completed in v52
- [x] Rewrite AdminAgents/AdminOutreach to Supabase style — completed in v52
- [x] Rewrite ClientDashboard to Supabase style — completed in v52
- [x] Rewrite EditProfileSheet to Supabase style — completed in v52
- [x] Rewrite Onboarding wizard to Supabase style — completed in v52
- [x] Add Client badge (inline text, not pill) to Prospects table rows
- [x] Add Resend email on service request status change to quoted/approved
- [x] Add file upload field to service request form with S3 storage
- [x] Show uploaded files in admin service requests panel

## v52 — Services Page Tightening + Admin Supabase Light Theme

- [x] Services page: tighter typography, readable fonts, clean card layout
- [x] DashboardLayout: confirm Supabase light sidebar renders correctly (white bg, #3ecf8e accent)
- [x] AdminDashboard: Supabase light style (white bg, clean stat cards, no colored badges)
- [x] AdminProspects: Supabase light table style (inline text status, no pill badges, white rows)
- [x] AdminServiceRequests: Supabase light style
- [x] AdminLogistics: Supabase light style
- [x] AdminOrderDetail: Supabase light style
- [x] AdminAgents: Supabase light style
- [x] AdminOutreach: Supabase light style
- [x] AdminShows: Supabase light style
- [x] AdminDemoRequests: Supabase light style
- [x] ClientDashboard: Supabase light style
- [x] EditProfileSheet: Supabase light style
- [x] Onboarding wizard: Supabase light style

## v53 — Admin Navigation + Dashboard Button Fix

- [x] Fix Navbar "Dashboard" button: route admins to /admin ("Admin Panel"), clients to /dashboard ("My Dashboard")
- [x] Fix Register page: rewrite with Supabase light theme, fix dark theme classes on all states
- [x] Fix admin page navigation: remove minHeight 100vh from all admin page root wrappers that break sidebar layout
- [x] Fix AdminCompose, AdminPipeline, AdminPartners: remove min-h-screen
- [x] Fix AdminBookings: convert dark (#000) theme to Supabase light (#f8fafc)
- [x] Fix AdminQuotes: convert dark oklch theme to Supabase light (#f8fafc)

## v54 — Correct Color Palette (Dark Editorial) Across All Admin Pages

- [x] DashboardLayout: rewrite sidebar to dark palette (#080808 bg, #00ff87 emerald, #ececec text)
- [x] AdminDashboard: rewrite to dark palette
- [x] AdminProspects: rewrite to dark palette
- [x] AdminServiceRequests: rewrite to dark palette
- [x] AdminAgents: rewrite to dark palette
- [x] AdminOutreach: rewrite to dark palette
- [x] AdminShows: rewrite to dark palette
- [x] AdminDemoRequests: rewrite to dark palette
- [x] AdminLeads: rewrite to dark palette
- [x] AdminOrders: rewrite to dark palette
- [x] AdminLogistics: rewrite to dark palette
- [x] AdminBookings: rewrite to dark palette
- [x] AdminQuotes: rewrite to dark palette
- [x] ClientDashboard: rewrite to dark palette
- [x] Onboarding: rewrite to dark palette
- [x] Register: rewrite to dark palette
- [x] index.css sb-admin CSS section: replace all light tokens with dark palette

## v55 — Bug Fixes: /dashboard Errors

- [x] Fix nested anchor tags in ClientDashboard (Link wrapping an <a> tag)
- [x] Fix company.getMyProfile returning undefined — must return null when no profile found

## v57 — Navbar Color Fix on Profile Input Pages

- [x] Fix Navbar top bar colors on ClientDashboard, Onboarding, Register — must use dark editorial palette
- [x] Navbar: add darkBg prop so it shows solid dark bg on dark-background pages (no transparent bleed)
- [x] Onboarding: fix header bg (#080808), input bg (#111), label color, card bg, loading bg
- [x] Register: fix all card/button backgrounds from #fff to #111

## v58 — Input Focus States, Register Navbar, ClientDashboard My Requests

- [x] Onboarding: dark focus ring on all Input/Textarea components via .dark-page-inputs CSS wrapper
- [x] Register: all three Navbar usages now pass darkBg prop
- [x] ClientDashboard: My Requests section already existed; fixed all #fff card backgrounds to #111 and #64748b text to rgba(255,255,255,0.45); added dark-page-inputs wrapper to service request form; added Navbar darkBg prop

## v59 — Select Dark Styling, Admin Redirect, Onboarding Persistence

- [x] ClientDashboard: dark select/dropdown styling with custom arrow SVG (background #111, color #ececec, border rgba(255,255,255,0.12))
- [x] Auth flow: admin redirect already correctly implemented in AuthRedirect.tsx; fixed AuthRedirect loading screen to use dark palette
- [x] Onboarding: persistence added — loads existing draft profile on mount (pre-populates all fields), saves progress on each step advance (onboardingComplete: false), final submit sets onboardingComplete: true; fixed all #64748b and #fff colors in step descriptions and service cards

## v60 — Onboarding Resume Banner, Form Validation, Admin Notification

- [x] Onboarding: "Resuming your setup" emerald banner shown when hydrated draft profile exists and onboardingComplete is false
- [x] ClientDashboard: required field validation on service request form — serviceType and details both required; inline AlertCircle error message shown below form
- [x] Server: notifyOwner already called in company.submitServiceRequest — confirmed working, no change needed

## v61 — Edit Profile Button, Admin New Requests Card, Resend Email Verification

- [x] ClientDashboard: Edit Profile button already present in welcome header (User icon, calls setEditProfileOpen)
- [x] AdminDashboard: added "New Requests" mini stat card (amber, links to /admin/service-requests) showing newCount from getSiteStats
- [x] getSiteStats: added serviceRequests query to Promise.all, returns { total, newCount } for new status
- [x] Resend email verified: sendEmail called from updateServiceRequestStatus on quoted/approved, from outreach@onstage.bot, RESEND_API_KEY wired correctly
- [x] GitHub: pushed 45 commits to ugobe007/StageGate main

## v62 — Outreach Flow Fix, Sidebar Badge, Status Timeline, Prospect Quick-Link

- [x] AdminProspects: replaced confusing Send/Replied buttons with Draft Email → Review Draft → Send workflow
- [x] AdminProspects: persistent status labels — per-row Draft Email / Review Draft / Send / ✓ Sent / ✓ Replied buttons based on prospect status and draft state
- [x] AdminProspects: DraftReviewModal with subject/body editing, Approve/Discard/Regenerate actions; uses trpc.admin.getDraftsForProspect + createDraft + approveDraft + discardDraft + editDraft + sendDraft
- [x] DashboardLayout sidebar: live "New Requests" count badge next to Service Requests nav item (trpc.admin.getNewServiceRequestCount, refetch every 60s)
- [x] ClientDashboard: status progression timeline (Received → Quoted → Approved → In Progress → Complete) with emerald dot indicator inside expanded request detail
- [x] AdminServiceRequests: add "View Prospect" quick-link that jumps to that company's row in AdminProspects (deferred to v63)

## v64 — Service Requests + Prospects Cross-Link Polish
- [x] AdminServiceRequests: add "Company" column to the requests table (between request type and status), showing companyName from the LEFT JOIN
- [x] AdminProspects: read ?highlight=email URL param on mount, scroll to and apply emerald highlight border to the matching prospect row

## v65 — Calendar & Meeting Scheduling

### DB Schema
- [x] calendar_events table: id, title, description, startAt, endAt, type (meeting|event|demo|call), status (scheduled|confirmed|cancelled|completed), prospectId (nullable FK), prospectEmail, prospectName, companyName, notes, shareToken (unique, for public share link), createdBy, createdAt, updatedAt
- [x] Migration generated and applied

### Server Layer
- [x] calendar.list adminProcedure — list all events with optional date range + type filter
- [x] calendar.get adminProcedure — get single event by id
- [x] calendar.create adminProcedure — create event, generate shareToken
- [x] calendar.update adminProcedure — update event fields
- [x] calendar.delete adminProcedure — soft-delete / cancel event
- [x] calendar.getByToken publicProcedure — get event by shareToken (for prospect-facing share link)
- [x] calendar.agentList publicProcedure (cron-auth) — agent read access
- [x] calendar.agentUpsert publicProcedure (cron-auth) — agent write access
- [x] Auto-schedule hook in prospects.markReplied: if scheduleMeeting=true, create calendar event + send email to tom@starsupportinc.com and owner

### Admin UI
- [x] AdminCalendar page: month/week/list view toggle, event cards with type color coding
- [x] Create/Edit event modal: title, type, date/time, prospect link, notes, share link copy button
- [x] Event detail panel: full info, share link, status badge, cancel button
- [x] Sidebar nav entry for Calendar (with upcoming count badge)
- [x] Route /admin/calendar registered in App.tsx

### Auto-Scheduling
- [x] markReplied mutation: add optional scheduleMeeting boolean + proposedTime input
- [x] On scheduleMeeting=true: create calendar event linked to prospect, send notification email to tom@starsupportinc.com and owner via Resend
- [x] AdminProspects: "Schedule Meeting" button in all views (table/kanban/byshow) that opens a date/time picker modal before calling markReplied

### Agent API
- [x] calendar.agentList and calendar.agentCreate tRPC procedures for XBOT agent read/write (API-key-gated)

### Tests
- [x] calendar.list admin allowed, user rejected
- [x] calendar.create admin allowed, user rejected
- [x] calendar.getByToken public allowed (NOT_FOUND for unknown token, returns event for valid token)
- [x] calendar.agentList cron-auth allowed, unauthenticated rejected
- [x] calendar.update admin allowed
- [x] calendar.delete admin allowed
- [x] 10 calendar tests passing

## v66 — Calendar Badge + Prospect Email + Sales Agent Calendar

- [x] DashboardLayout: add upcoming calendar event count badge to Calendar sidebar item (query calendar.upcomingCount)
- [x] server/routers.ts: add calendar.upcomingCount adminProcedure returning count of upcoming events
- [x] markReplied auto-schedule: send third Resend email to prospectEmail with event details + public share link (/calendar/:token)
- [x] AdminSalesAgent: add "Meetings" tab showing next 8 upcoming calendar events with type/status color coding
- [x] AdminSalesAgent: add "Schedule Meeting" quick-action modal (title, date, time, type, duration, notes) calling calendar.create
- [x] Vitest: 1024 tests passing (34 test files)

## v67 — Mark Confirmed + Reschedule + 24h Reminder Heartbeat

- [x] calendar.confirm adminProcedure: flip status scheduled → confirmed, return updated event
- [x] calendar.reschedule adminProcedure: update startAt/endAt, reset status to scheduled, re-send confirmation emails to prospect + Tommy + owner
- [x] AdminCalendar: "Confirm" button on scheduled event cards (one-click, no modal)
- [x] AdminCalendar: "Reschedule" button on event cards that opens a date/time modal
- [x] AdminSalesAgent Meetings tab: "Confirm" button on scheduled event cards
- [x] AdminSalesAgent Meetings tab: "Reschedule" button on event cards
- [x] calendar_events table: add reminder_sent_at column (nullable timestamp) for idempotent reminder tracking
- [x] /api/scheduled/calendar-reminder heartbeat handler: query events where startAt is 22-26h from now and reminderSentAt is null, send reminder emails to prospect + Tommy + owner, stamp reminderSentAt
- [x] Mount /api/scheduled/calendar-reminder in server/_core/index.ts
- [x] DEPLOYED: manus-heartbeat create --name calendar-reminder --cron "0 0 * * * *" --path /api/scheduled/calendar-reminder | task_uid: B4zrZfUCLbH8cQw289mFdu | next: 2026-05-16T15:00:00Z
- [x] Vitest: 1024 tests passing (34 test files), calendar.confirm + calendar.reschedule covered via calendar.test.ts

## v68 — End-to-End Test Run (Email + Calendar + Orders)

- [x] Full vitest suite run — 1056 tests passing across 35 test files
- [x] Integration smoke test: email outreach workflow — 9 steps, all pass
- [x] Integration smoke test: calendar workflow — 11 steps, all pass
- [x] Integration smoke test: customer order pipeline — 12 steps, all pass
- [x] Compile and deliver test report — delivered to user

## v69 — Calendar Event Cancel Button

- [x] calendar.cancel adminProcedure: set status=cancelled, send cancellation emails to prospect + Tommy + owner
- [x] AdminCalendar: red "Cancel" button on scheduled/confirmed event cards, confirm dialog with optional reason field
- [x] AdminSalesAgent Meetings tab: red "Cancel" button on scheduled/confirmed event cards with confirm Dialog
- [x] Vitest: 3 tests for calendar.cancel (admin allowed, already-cancelled throws, non-admin rejected) | 1059 total passing
