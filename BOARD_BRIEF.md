# Bastion Law — Board Brief
**Prepared for:** Board Presentation
**Date:** June 2026
**Status:** Active Development — Core Platform Complete

---

## 1. What Problem We Are Solving

### The Karachi Legal Market Gap
Pakistan's legal industry — particularly in Karachi — runs almost entirely on WhatsApp groups, Excel sheets, and physical files. There is no dedicated software built for Pakistani law firms. Lawyers juggle client expectations, court deadlines, document requests, billing, and partner coordination across fragmented tools with no single source of truth.

### What Bastion Law Does
Bastion Law is a **full-stack legal practice management platform** built specifically for the Pakistani legal market. It gives every stakeholder — clients, lawyers, and firm owners — a dedicated, purpose-built interface that connects them in real time.

It replaces:
- WhatsApp (client communication, document sharing)
- Excel (billing, time tracking, partner revenue tracking)
- Physical files (matter records, document storage)
- Verbal coordination (task assignment, appointment scheduling)
- No-system status updates (case progress, court dates)

### Who It Is Built For
| Stakeholder | Pain Today | How Bastion Solves It |
|---|---|---|
| **Corporate Client** | No visibility into case status, documents shared over WhatsApp, invoices via email PDFs | Dedicated mobile app with real-time case updates, document portal, and chat |
| **Lawyer** | Tracking billable hours in their head, managing clients across WhatsApp, no structured task system | Native mobile app with matter management, timer, client actions, calendar |
| **Firm Owner / Managing Partner** | No analytics on revenue, no visibility into lawyer utilization, manual billing | Web portal with full firm oversight, billing, analytics, and user management |

---

## 2. The Platform — Three Apps, One Backend

### Architecture Overview
```
┌─────────────────────────────────────────────────────┐
│                   BASTION LAW                       │
├──────────────┬───────────────────┬──────────────────┤
│  CLIENT APP  │    LAWYER APP     │   OWNER PORTAL   │
│ React Native │  React Native     │    Next.js 14    │
│  (Expo SDK)  │  (Expo SDK)       │  (Web — Desktop) │
├──────────────┴───────────────────┴──────────────────┤
│                  SUPABASE BACKEND                   │
│  PostgreSQL · RLS · Realtime · Storage · Auth       │
└─────────────────────────────────────────────────────┘
```

**Design Language:** Burgundy `#6B1E2B` · Brass `#B68A4E` · Cream `#F6F1EA` · Hanken Grotesk

---

## 3. Screen Designs — File Locations

### Client Mobile App
`/apps/client-app/app/`

| Screen | File Path | What It Shows |
|---|---|---|
| Login | `(auth)/login.tsx` | Email + password auth, role-gated |
| Home Dashboard | `(tabs)/home.tsx` | Active matters, notifications, firm chat entry, support |
| My Cases | `(tabs)/case.tsx` | All matters list with stage progress |
| Case Detail | `case/[id].tsx` | Overview · Actions · Documents · Invoices · Chat tabs |
| Documents | `(tabs)/documents.tsx` | All documents across matters, upload, e-sign, view |
| Messages | `(tabs)/messages.tsx` | Matter-level chat threads |
| Schedule | `(tabs)/schedule.tsx` | Book appointments, counter-propose times, view confirmed, join video |
| Search | `(tabs)/search.tsx` | Full-text search across messages, documents, actions |
| Firm Chat | `firm-chat.tsx` | Firm-wide general chat channel |
| Notifications | `notifications.tsx` | All notifications feed |
| Support | `support.tsx` | Help and contact |

### Lawyer Mobile App
`/apps/lawyer-app/app/`

| Screen | File Path | What It Shows |
|---|---|---|
| Login | `(auth)/login.tsx` | Email + password auth, role-gated |
| Dashboard | `(tabs)/dashboard.tsx` | Active matters, SLA queue, today's events, quick stats |
| Board | `(tabs)/board.tsx` | Kanban view of all matters by stage |
| Clients | `(tabs)/clients.tsx` | Client list with matter counts |
| Calendar | `(tabs)/calendar.tsx` | Week/month view, appointment requests, confirm/reject/counter-propose, video links |
| Search | `(tabs)/search.tsx` | Full-text search across all assigned matters |
| Matter Detail | `matter/[id].tsx` | 9-tab deep-dive per matter (see below) |
| Security | `security.tsx` | 2FA / MFA enrollment |

**Matter Detail — 9 Tabs** (`matter/[id].tsx`):
1. **Overview** — parties, stage progress, upcoming events
2. **Actions** — assign tasks to client, track completion
3. **Documents** — review uploads, verify, accept e-signatures, view files
4. **Time & Billing** — running timer, all time entries, total hours
5. **Expenses** — log disbursements, billable vs non-billable, total
6. **Contacts** — opposing counsel, judges, witnesses, experts
7. **Notes** — private lawyer-only notes (not visible to client)
8. **Audit Trail** — append-only log of every action on the matter
9. **Chat** — real-time messaging with client, unread count badge

### Owner Web Portal
`/apps/web/app/`

| Page | File Path | What It Shows |
|---|---|---|
| Login | `login/page.tsx` | Owner-only login |
| Dashboard | `dashboard/page.tsx` | Live stats, SLA breach queue, upcoming events |
| Analytics | `analytics/page.tsx` | Revenue chart, matter pipeline, lawyer utilization, overdue invoices |
| Clients | `clients/page.tsx` | Create and manage client accounts |
| Lawyers | `lawyers/page.tsx` | Create and manage lawyer accounts |
| Matters | `matters/page.tsx` | All matters, create new matter, assign lawyer |
| Appointments | `appointments/page.tsx` | All appointment requests across firm |
| Billing | `billing/page.tsx` | Invoices, create invoice with line items, mark paid, PDF download, disbursements |
| Settings | `settings/page.tsx` | MFA enrollment, session revocation for any user |

---

## 4. User Journeys

### Client Journey

```
Download App
     │
     ▼
Login (credentials from firm)
     │
     ▼
Home Dashboard
  ├── See active matter(s) with stage progress
  ├── SLA badge if lawyer hasn't replied in 1h+
  ├── Notification feed (invoices, document requests, updates)
  └── Firm chat access

     │ Tap into a matter
     ▼
Case Detail
  ├── OVERVIEW: parties, stage pipeline, next court date
  ├── ACTIONS: pending tasks assigned by lawyer
  │     └── Complete task → lawyer notified
  ├── DOCUMENTS: lawyer-requested documents
  │     ├── Upload (camera or files)
  │     ├── E-sign documents in-app (typed signature + legal disclaimer)
  │     └── View uploaded files in-browser
  ├── INVOICES: all invoices, PKR amounts, due dates, paid status
  └── CHAT: direct message with assigned lawyer (real-time)

     │ Separate tabs
     ▼
  ├── SCHEDULE: book appointment (video or in-person)
  │     ├── Lawyer confirms / rejects / counter-proposes new time
  │     ├── Client accepts or proposes another time
  │     └── Confirmed video calls → one-tap Jitsi join
  ├── DOCUMENTS: cross-matter document view
  └── SEARCH: find any message, document, or action across all matters
```

### Lawyer Journey

```
Login
  │
  ▼
Dashboard
  ├── Active matter count, pending docs, today's events
  ├── SLA Queue — matters where client message is unanswered > 1 hour
  └── Quick-tap into any matter

  │ Kanban Board (Board tab)
  ▼
Drag matters across stages:
  Inquiry → Active → Pending Review → Closed

  │ Open a matter
  ▼
Matter Detail (9 tabs)
  ├── Assign tasks to client with due dates and priority
  ├── Request documents with due dates
  ├── Verify uploaded documents / accept e-signatures
  ├── Start timer → work → stop → log billable hours with description
  ├── Log disbursements (filing fees, courier, travel, expert fees)
  ├── Add case contacts (opposing counsel, judge, witnesses)
  ├── Write private notes (client cannot see)
  ├── Full audit trail (who did what, when)
  └── Real-time chat with client

  │ Calendar tab
  ▼
  ├── See week/month view of all court dates and hearings
  ├── Confirm / reject / counter-propose client appointments
  └── Join confirmed video calls directly

  │ Search tab
  ▼
  Full-text search across all messages, documents, and actions
  across all assigned matters
```

### Owner / Managing Partner Journey

```
Login (web portal, desktop)
  │
  ▼
Dashboard
  ├── Live firm stats (matters, pending docs, open appointments)
  ├── SLA breach queue (which clients have unanswered messages)
  └── Upcoming events this week

  │ Analytics
  ▼
  ├── 6-month revenue bar chart (billed vs collected)
  ├── Matter pipeline funnel by stage
  ├── Lawyer utilization (hours logged + matter count per lawyer)
  └── Overdue invoices with client names and days overdue

  │ Operations
  ▼
  ├── CLIENTS: create client accounts, onboard new clients
  ├── LAWYERS: create lawyer accounts
  ├── MATTERS: open new matters, assign lawyer, set stage
  └── APPOINTMENTS: view all pending appointment requests

  │ Billing
  ▼
  ├── Create invoices with line items
  ├── Download branded PDF invoices (PKR, Bastion Law header)
  ├── Mark invoices as paid (bank transfer confirmed)
  └── View all disbursements logged by lawyers

  │ Settings
  ▼
  ├── Enroll 2FA on owner account
  └── Force sign-out sessions for any lawyer or admin (security incident response)
```

---

## 5. Features Built — Complete List

### Core Infrastructure
- [x] PostgreSQL schema with 20+ tables, full relational integrity
- [x] Row Level Security (RLS) — every client only sees their own data, lawyers only see assigned matters
- [x] Supabase Auth (email + password, role-gated: client / lawyer / owner)
- [x] Supabase Realtime — live chat updates without polling
- [x] Supabase Storage — document file uploads with signed URLs
- [x] Push Notifications — Expo Push API via Edge Function (iOS + Android)
- [x] TypeScript types auto-generated from live DB schema

### Client App
- [x] Role-gated login (clients land here, lawyers and owner redirected away)
- [x] Home dashboard with matter summary, notification count, SLA badge
- [x] Matter list with visual stage progress pipeline
- [x] Matter detail: Overview, Actions, Documents, Invoices, Chat
- [x] Task completion — client marks action items done, lawyer notified
- [x] Document upload (camera + file picker)
- [x] In-app e-signature (typed name, legal disclaimer, date, audit log entry)
- [x] In-app document viewer (PDF/images open in-browser without leaving app)
- [x] Invoice view with PKR amounts, due dates, paid status
- [x] Real-time chat with lawyer (per matter)
- [x] Firm-wide general chat channel
- [x] Appointment booking (video or in-person)
- [x] Counter-propose meeting times (client ↔ lawyer negotiation)
- [x] One-tap Jitsi video call join for confirmed video appointments
- [x] Notification feed
- [x] Full-text search (messages, documents, actions)
- [x] Support screen

### Lawyer App
- [x] Role-gated login
- [x] Dashboard with SLA queue, stats, today's events
- [x] Kanban board (drag matters across stages)
- [x] Client list with matter counts
- [x] Calendar — week and month views, court dates, hearings, deadlines
- [x] Appointment management: confirm / reject / counter-propose / join video
- [x] Matter detail — 9 tabs:
  - [x] Overview with stage pipeline, parties, upcoming events
  - [x] Actions: assign tasks to client with type, priority, due date
  - [x] Documents: review, verify, accept e-signatures, view files
  - [x] Time & Billing: running timer + stop-to-log, all entries, total hours
  - [x] Expenses: log disbursements by category, billable flag, summary
  - [x] Contacts: add opposing counsel, judges, witnesses, experts
  - [x] Private Notes: lawyer-only notes
  - [x] Audit Trail: append-only log
  - [x] Chat: real-time client messaging with unread badge
- [x] Full-text search across assigned matters
- [x] 2FA / MFA enrollment (TOTP — Google Authenticator, Authy)
- [x] Navigation to security screen from dashboard

### Owner Web Portal
- [x] Dashboard: live KPIs, SLA queue, upcoming events
- [x] Analytics: revenue chart, pipeline funnel, lawyer utilization, overdue invoices
- [x] Client management: create accounts with credentials
- [x] Lawyer management: create accounts with credentials
- [x] Matter management: create matters, assign lawyers
- [x] Appointment overview
- [x] Billing: create invoices, line items, mark paid, PDF download
- [x] Disbursements view (all lawyer-logged expenses)
- [x] Settings: 2FA enrollment, session revocation for any user

### Security & Backend
- [x] Append-only audit logs (UPDATE + DELETE revoked at DB level)
- [x] Rate limiting: 30 messages/min, 10 document requests/min (DB triggers)
- [x] Session revocation API (owner can force sign-out any user)
- [x] MFA / TOTP on owner and lawyer accounts
- [x] Sentry error tracking in all three apps
- [x] pg_cron automated reminders: push notifications 48h and 24h before task/event due dates
- [x] Full-text search with GIN indexes on messages, documents, and tasks
- [x] Jitsi video rooms auto-generated on appointment confirmation (no third-party account needed)

---

## 6. What Is Coming Next

### Immediate Roadmap (Next Sprint)

| # | Feature | Why It Matters |
|---|---|---|
| 1 | **Transactional Email (Resend)** | 80% of clients are corporate — they need email for onboarding, invoice PDFs, reminders, status updates |
| 2 | **Lawyer TBA status** | Cases opened before lawyer assigned; client sees "Lawyer TBA" until assignment happens |
| 3 | **Custom billing rates per lawyer** | Freelance lawyers have their own quotation rates; time entries should auto-calculate using the assigned rate |
| 4 | **Partner activity log** | Partners log contributions per case (client origination, relationship management, meetings) so revenue share can be calculated |

### Medium-term Roadmap

| # | Feature | Why It Matters |
|---|---|---|
| 5 | **Partner revenue sharing ledger** | 80% to originating partner, 20% to firm — with multi-partner split logic based on logged activities |
| 6 | **Document templates** | Lawyers auto-fill standard contracts/agreements from matter fields, avoiding manual typing |
| 7 | **Custom fields on matters** | Firm defines its own metadata fields (jurisdiction, court name, case category, etc.) |
| 8 | **Conflict of interest check** | Before onboarding a new client, check name against existing clients and opposing parties |
| 9 | **Batch / recurring invoices** | Invoice multiple matters at once; set up monthly retainer invoices automatically |
| 10 | **Report export (CSV)** | Download billing, time entries, and matter lists to Excel for board reporting |

### Later Roadmap

| # | Feature | Why It Matters |
|---|---|---|
| 11 | **Client intake / CRM pipeline** | Manage potential clients before they are formally onboarded |
| 12 | **AI matter insights** | Summarise case history, flag risks, suggest next actions using LLM |
| 13 | **Public booking page** | Clients can self-schedule consultations without calling the firm |
| 14 | **SMS notifications** | Fallback for clients who miss push notifications |

---

## 7. Competitor Context — vs Clio (Market Leader)

Clio is the dominant legal practice management SaaS globally ($250M+ ARR). We have matched or exceeded it in several areas while being purpose-built for the Pakistani market.

| Area | Clio | Bastion Law |
|---|---|---|
| Client portal | Web only | **Native mobile app** |
| Lawyer app | Mobile (basic) | **Full-featured native app** |
| Video calls | Third-party only | **Built-in Jitsi (no account needed)** |
| Counter-propose appointments | No | **Yes** |
| SLA monitoring | No | **Yes (real-time queue)** |
| Partner revenue sharing | No | **Planned (unique differentiator)** |
| Pakistan market fit | None | **Built specifically for PK** |
| Document e-sign | Paid add-on (Clio Sign) | **Included** |
| Pricing | $49–$109/user/month USD | **TBD (PKR-based)** |

**Features Clio has that are in our roadmap:** document templates, email integration, custom fields, billing rates, batch invoices, report export, intake CRM, conflict of interest checks.

**Features Clio has that are out of scope for us:** IOLTA trust accounting, US court rules calculator, 200+ third-party integrations.

---

## 8. Technical Stack Summary

| Layer | Technology |
|---|---|
| Client Mobile App | React Native + Expo SDK 56, Expo Router |
| Lawyer Mobile App | React Native + Expo SDK 56, Expo Router |
| Owner Web Portal | Next.js 14 (App Router), Tailwind CSS v4 |
| Backend / Database | Supabase (PostgreSQL + RLS + Realtime + Storage + Auth) |
| State Management | Zustand (mobile apps) |
| Push Notifications | Expo Push API + Supabase Edge Functions (Deno) |
| Error Tracking | Sentry (all three apps) |
| PDF Generation | jsPDF (client-side, owner portal) |
| Video | Jitsi Meet (public, no account, deterministic room per appointment) |
| Scheduled Jobs | pg_cron (daily reminder dispatches) |
| Full-Text Search | PostgreSQL GIN indexes + `plainto_tsquery` |
| Type Safety | Auto-generated TypeScript types from live DB schema |

---

*Document last updated: June 2026*
*Prepared by: Engineering Team*
