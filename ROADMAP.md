# Bastion Law — Product Roadmap

_Last updated: 2026-06-14_

Legend: ✅ done · 🟡 partial · ❌ missing · 🚫 will not build

---

## 0. Hard exclusions (do not build, ever)

- 🚫 **JazzCash / Easypaisa** and any in-app **mobile-wallet payment gateway**. Invoices are settled offline (bank transfer) and marked paid by the owner. (Card payments via Stripe _may_ be revisited later; mobile wallets are out for good.)

---

## Part A — Finish what we started

### A1. Broken / incomplete
- [ ] Lawyer-side **per-case chat reply** (client can message a case; lawyer can't yet reply from the lawyer app — only legacy matter-messages). **Closes the comms loop. Top priority.**
- [ ] **Propose-new-time** appointment flow — today it creates a *new* appointment instead of countering; lawyer has no propose option at all. Needs proper back-and-forth resolution.
- [ ] Owner portal: **create users** (currently needs Supabase dashboard) and **create matters** in-app.

### A2. Depth (enrich existing)
- [ ] **Push notifications** (Expo) — data exists, nothing fires. Without this clients never know an action/message arrived.
- [ ] **Document e-signature** (`requires_esign` already in schema, no flow).
- [ ] **Invoice PDF** generation + client-visible invoice view.
- [ ] In-app **document viewer/preview** (read without downloading).
- [ ] **Message search** (full-text across a matter's messages).
- [ ] **Time-tracking timer** (start/stop → auto time entry) in lawyer app.
- [ ] **Case-stage push** + document due-date reminders (48h/24h).

### A3. Breadth (new areas — excluding 🚫)
- [ ] **WhatsApp** alerts (SLA breach, hearing reminders, appointment confirmations).
- [ ] **Offline mode** (cache last-known state; graceful error states).
- [ ] Owner **revenue analytics** + lawyer **performance dashboard**.
- [ ] **Video consultations** (Jitsi/Whereby room per appointment).

### A4. Security / infra (none done yet)
- [ ] **MFA** for owner + lawyer accounts (TOTP).
- [ ] **Append-only audit log** policy (revoke update/delete).
- [ ] **CNIC encryption** at app layer (pgcrypto).
- [ ] **Sentry** crash/error tracking in all three apps.
- [ ] **Session revocation** UI (revoke all sessions for a user).
- [ ] **Staging vs production** Supabase projects.
- [ ] Region **Tokyo → Mumbai** (latency + data residency).
- [ ] Rate-limit uploads + messages.

---

## Part B — Competitive gap analysis vs Clio

Clio's four pillars mapped to where we stand. "Adopt" = build for the Pakistan/Bastion context.

### Manage Your Firm
| Clio feature | Us | Action |
|---|---|---|
| Calendaring | 🟡 events + lawyer calendar | Add firm-wide calendar, recurring events, **court-rules date calculator** (compute deadlines from a hearing date) |
| Case Management | ✅ matters, stages, detail | Strong — keep enriching |
| Collaboration | 🟡 team + private notes | Add internal staff **task assignment**, @mentions |
| Contact Management | ❌ | **Adopt** — non-user `contacts` (opposing counsel, judges, witnesses, experts) linked to matters |
| Firm Insights | ❌ | **Adopt** — reporting/analytics layer (revenue, utilization, matter age, SLA) |
| Task Management | 🟡 client action-items only | Extend `tasks` to **internal staff tasks** + a lawyer task board |
| Document Management | 🟡 per-matter upload | **Adopt depth** — versioning, folders, full-text search, viewer |
| Mobile App for Firms | ✅ lawyer app | — |
| Medical Records / Legal Aid | ❌ | Skip (niche / not relevant to PK firm now) |

### Track Finances
| Clio feature | Us | Action |
|---|---|---|
| Legal Billing | 🟡 invoices + line items | Add **retainers**, payment plans, write-offs |
| Time & Expense Tracking | 🟡 manual time entries | Add **timer** + `expenses` table (disbursements: court fees, travel) |
| Trust Account Management | ❌ | **Adopt** — client-funds trust ledger (`trust_accounts`, `trust_transactions`). Legal-compliance necessity |
| Online Payments | 🚫 wallets / 🟡 offline | Offline + owner mark-paid only. Stripe-for-cards is the only future option |
| Accounting / Financial Reporting | ❌ | Reporting yes (Firm Insights); full GL → integrate later, don't build |

### Engage Clients
| Clio feature | Us | Action |
|---|---|---|
| Legal Client Portal | ✅ the client app | Strong — our core |
| Client Communications | ✅ per-case + firm chat | Add email + WhatsApp channels |
| Appointment Booking | 🟡 appointments | Finish propose-time + **availability/self-scheduling links** |
| Client Intake | ❌ | **Adopt** — intake forms for new/prospective clients |
| Questionnaires | ❌ | **Adopt** — dynamic forms (ties to intake) |
| CRM (leads/pipeline) | ❌ | **Adopt (light)** — lead → matter pipeline |
| Email Marketing / LSA / Website Builder | ❌ | Skip (marketing tools, out of scope) |
| Legal Workflow Automation | ❌ | **Adopt** — rules engine (stage change → auto-create tasks/events/notifications) |

### Accelerate Legal Work
| Clio feature | Us | Action |
|---|---|---|
| AI for Legal Analysis & Strategy | ❌ | **Adopt — biggest differentiator.** Claude-powered case summarization, document analysis, drafting, and research over Pakistani case law |
| Advanced Document Automation | ❌ | **Adopt** — generate Vakalatnama / Power of Attorney / pleadings from templates auto-filled with matter+client data |
| Template Building | ❌ | **Adopt** — reusable document/form templates |
| Court Forms | ❌ | **Adopt (PK)** — Pakistani court form templates |
| Court E-Filing | ❌ | Later — depends on PK e-courts API availability |
| 300+ Integrations | ❌ | Later — open an integration/webhook layer once core is done |

---

## Part C — Architecture changes these imply

Current stack: Supabase (Postgres + RLS + Realtime + Storage + Auth), 2× React Native (Expo) apps, 1× Next.js owner portal.

### C1. New tables (migrations)
- `contacts` (non-auth people) + `matter_contacts` (role: opposing_counsel, judge, witness, expert…)
- `document_templates` + `document_versions` (versioning) + folders (a `parent_id`/`path` on documents)
- `expenses` (matter disbursements, billable flag)
- `trust_accounts` + `trust_transactions` (deposits/withdrawals, per-client ledger, never commingled)
- `intake_forms` + `form_submissions` (JSON schema-driven questionnaires)
- `leads` + pipeline stage (light CRM)
- `workflows` + `workflow_runs` (automation rules)
- `push_tokens` (Expo device tokens per user)
- `ai_threads` + `ai_messages` (assistant history, scoped to matter/firm)
- `document_embeddings` (pgvector) for RAG

### C2. Extensions / DB capabilities
- **pgvector** — embeddings for AI retrieval over case documents + (later) PK case law.
- **Full-text search** — `tsvector` columns + GIN indexes on `documents`, `messages` (pg_trgm already enabled).
- **pg_cron** — scheduled jobs: hearing/due reminders, SLA escalation, overdue-invoice sweeps.

### C3. Supabase Edge Functions (server-side; keep secrets off-device)
- **AI gateway** → calls Claude API (Anthropic SDK). Holds the API key server-side. Used for analysis, drafting, summarization, RAG. Use **prompt caching** for large matter context.
- **Document generation** → render templates → PDF (invoices, Vakalatnama, pleadings) → Storage.
- **Push dispatch** → send Expo push on new message/task/event (triggered by DB events).
- **Email** → transactional email (intake links, invoice delivery, notifications) via Resend/SMTP.
- **E-sign callback / e-filing webhooks** (when those land).

### C4. AI stack (the differentiator)
- **Models (default to latest Claude):** Opus 4.8 (`claude-opus-4-8`) for legal analysis/strategy & complex drafting; Sonnet 4.6 (`claude-sonnet-4-6`) for routine drafting/summaries; Haiku 4.5 (`claude-haiku-4-5-20251001`) for cheap classification/extraction (e.g. OCR field parsing, tagging).
- **RAG:** embed matter documents into `document_embeddings` (pgvector); retrieve + ground answers; cite sources.
- **Guardrails:** AI features are **lawyer/owner-only**, never client-facing; every AI action audit-logged; privileged/sensitive matters flagged before sending context.
- **OCR intake:** uploaded court notices/IDs → extract case number, date, party names (Claude vision or a vision API) → pre-fill matter fields.

### C5. Cross-cutting
- **Notifications/feed** already partly modeled (`notifications`, `audit_logs`) — formalize into a unified activity feed.
- **Search** surfaced in both mobile apps + web.
- **Integration/webhook layer** (later) for the "300+ integrations" story.

---

## Part D — Suggested phasing

**Phase 1 — Close the loop & make it usable (now)**
A1 (lawyer case chat, propose-time, owner create users/matters) · A2 push notifications · e-signature · invoice PDF.

**Phase 2 — Legal-grade depth**
Trust accounting · expenses + timer · document management depth (versions/folders/search/viewer) · contacts · firm insights/reporting.

**Phase 3 — The AI differentiator**
Edge Function AI gateway · pgvector RAG · document automation/templates · OCR intake · questionnaires/intake forms.

**Phase 4 — Growth & automation**
Workflow automation · light CRM/leads · WhatsApp + email channels · video consults · court forms.

**Always-on track — Security/infra (A4)**
MFA, append-only audit, CNIC encryption, Sentry, staging env, Mumbai region — interleave throughout, not last.
