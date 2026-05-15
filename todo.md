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
