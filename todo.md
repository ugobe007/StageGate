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
- [ ] DB: `quoteRequests` table (id, name, email, company, robotType, robotCount, showId, serviceIds, notes, status, createdAt)
- [ ] Migration applied
- [ ] Backend: `quotes.submit` public tRPC procedure (saves quote, notifies owner)
- [ ] Backend: `quotes.list` admin-only tRPC procedure
- [ ] Backend: `quotes.updateStatus` admin-only tRPC procedure
- [ ] Multi-step modal: Step 1 — Robot details (type, count, dimensions, weight)
- [ ] Multi-step modal: Step 2 — Show selection (searchable dropdown of upcoming shows)
- [ ] Multi-step modal: Step 3 — Services checklist (all 8 service lines with descriptions)
- [ ] Multi-step modal: Step 4 — Contact info (name, email, company, notes)
- [ ] Step progress indicator at top of modal
- [ ] Success confirmation screen after submit
- [ ] "Get a Quote" CTA button in Navbar and hero section
- [ ] Admin Dashboard: Quote Requests panel with status management
- [ ] Vitest tests for quotes.submit and quotes.list procedures
