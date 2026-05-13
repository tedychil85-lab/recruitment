# Pertacareer — Recruitment Realtime Tracker

## Original problem statement
Add "Progress Rekrutmen Kandidat Realtime" feature to the applicant dashboard, similar to Pertamina-style BUMN recruitment systems. Applicant can see selection stages in realtime and communicate directly with HR. Includes timeline (8 stages), status realtime, interview scheduling, HR chat, notifications, and SAW ranking on HR side.

## Stack chosen
- **Backend:** FastAPI + MongoDB (motor), JWT auth (bcrypt + PyJWT) — cookie + Bearer
- **Frontend:** React 19 + react-router 7 + Tailwind + shadcn/ui + framer-motion + sonner + lucide-react
- **Realtime:** Polling (4–7s) for messages, status, notifications.

## Roles & demo accounts
- HR / Admin: `hr@pertacareer.id` / `hr123456`
- Pelamar A: `pelamar@pertacareer.id` / `pelamar123`
- Pelamar B: `budi@pertacareer.id` / `pelamar123`

## Implemented (2026-02)
- Auth: register (pelamar only), login (both roles), logout, /me. Token in httpOnly cookie + localStorage Bearer.
- Pelamar dashboard:
  - Hero current-status card with gradient header, animated progress bar, stage badge.
  - Horizontal animated **RecruitmentTimeline** (8 stages, distinct colors per design spec) with pulsing active node and staggered entrance.
  - My applications list, history feed, scheduled interviews tab, in-app chat tab.
  - Apply dialog with position select + education / age / experience / certifications / cover letter.
- HR dashboard:
  - Sidebar layout (Overview, Kandidat, Ranking SAW, Lowongan) + top bar with notification bell.
  - Overview: 4 stat tiles + funnel chart per stage + recent activity.
  - Kandidat: table with search + stage filter, "Kelola" opens detail dialog with 5 tabs (Stage, Scores, Schedule, Chat, Profile).
  - SAW ranking with 6 criteria + weights (Pendidikan 20, Pengalaman 20, Tes 25, Interview 20, Usia 5, Sertifikasi 10) and rank medals.
  - Position CRUD (create / delete).
- Cross-cutting: notifications bell with unread count + mark all read; toast feedback; data-testid coverage on all interactive + key info elements.
- Seed data: 1 HR + 2 pelamar + 3 positions (Petroleum Engineer / Refinery Operator / Data Analyst) + 4 sample applications across stages.

## Testing
- `iteration_1.json`: 23/23 backend pytest passed, full E2E Playwright flow passed (after testing agent's null-safety fix on CandidateDetailDialog).
- Backend tests stored at `/app/backend/tests/backend_test.py`.

## Backlog (P0 / P1 / P2)
- **P1**: Split HRDashboard.jsx (~800 LOC) into smaller files per tab.
- **P1**: Add `DialogDescription` to all DialogContent for a11y.
- **P1**: Move SAW recompute side-effect out of GET /api/saw/ranking into POST /api/saw/recompute.
- **P2**: WebSocket-based realtime (replace polling) using FastAPI + websockets.
- **P2**: Email & WhatsApp notification (Resend / Twilio) — requires API keys.
- **P2**: CV upload + signed URL via object storage.
- **P2**: Bulk stage change, CSV export of ranking.

## Next tasks
- Address P1 backlog items if user requests.
- Optional: Add public job board (no login) + share-link for applications.
