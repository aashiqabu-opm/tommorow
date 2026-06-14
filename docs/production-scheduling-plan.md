# Production Scheduling — Cinema-Grade Facility (Plan)

Status: **plan for approval — not built yet.** Replaces the simple shoot-day list with
a professional scheduling pipeline modelled on standard film practice (script
breakdown → stripboard → Day-Out-of-Days → call sheets), adapted for an Indian/
Malayalam unit.

## How professional film scheduling actually works (the model we'll follow)
1. **Script breakdown** — every scene is broken into *elements*: cast, junior
   artists (background), stunts, props, wardrobe, makeup/hair (incl. special
   makeup/prosthetics), set dressing, vehicles, animals, SFX, VFX, special
   equipment, sound, location, INT/EXT, DAY/NIGHT, page count (in eighths).
2. **Breakdown sheet** — one per scene, listing those elements + a one-line synopsis.
3. **Stripboard** — each scene becomes a colour-coded *strip* (colour = INT/EXT ×
   DAY/NIGHT). Strips are reordered into the most efficient shoot order (group by
   location, by cast availability, by day/night) → that ordering *is* the schedule.
4. **Day-Out-of-Days (DOOD)** — a grid of every cast/artist across shoot days with
   Start-Work-Hold-Finish (SW/W/H/F) codes — shows who's needed which day and
   minimises costly "hold" days. Auto-derived from the schedule + breakdown.
5. **Shooting schedule** — the day-by-day plan: scenes, pages, cast, location,
   est. units of time.
6. **Call sheet (daily)** — generated per shoot day: unit/general call, per-cast &
   per-dept call times, scene order, location + map, sunrise/sunset & weather,
   meal breaks, and the day's *requirements* (junior artists count, technicians by
   dept, special equipment, special makeup, props, vehicles, action/VFX), plus
   nearest hospital & emergency contacts. Distributed to the unit.
7. **Daily Production Report (DPR)** — actuals vs plan (already exists in the app as
   production_reports — we'll link it to the scheduled day).

## Data model (proposed tables)
- `scenes` — project_id, scene_no, int_ext (INT/EXT), day_night (D/N), location_id,
  page_eighths, synopsis, status.
- `scene_elements` — scene_id, category (cast | junior_artists | prop | wardrobe |
  makeup | special_makeup | equipment | vehicle | stunt | vfx | sfx | animal |
  sound | set_dressing | other), ref (links to a character/crew/equipment where
  applicable), label, qty, notes.
- `schedule_days` — project_id, day_number, shoot_date, unit, location_id,
  call_time, est_wrap, status, weather, sunrise, sunset, notes. (upgrades the
  current project_schedule)
- `schedule_day_scenes` — schedule_day_id, scene_id, sort_order (which scenes,
  in what order, that day).
- `day_requirements` — schedule_day_id, category, label, qty, dept, status
  (the per-day checklist: junior artists, technicians, special equipment, special
  makeup, etc. — auto-seeded from the scenes' elements, then editable).
- `day_checklist` — schedule_day_id, item, done, owner_dept (tick-off checklist).
- `locations` — project_id, name, address, map_link, contact, permit_status,
  nearest_hospital.
- `call_sheets` — schedule_day_id, generated_at, pdf_path, sent_at (snapshot +
  distribution record). DOOD is computed on the fly from schedule + scene cast.

## Where the people/things come from (no double entry)
- **Cast/artists** ← `project_characters` (+ cast_actor) and the cast ledger
  (`project_crew`).
- **Technicians / crew** ← `project_crew` + the project core team (`project_members`).
- **Junior artists** ← a count + supplier/coordinator per day (they're not named).
- **Special equipment / makeup / props** ← scene elements, rolled up per day.

## The AI advantage (ties into what we already built)
- The **screenplay is already uploaded + AI-read**. Extend that engine to do a
  full **auto script-breakdown**: scenes → elements (cast, props, locations, INT/
  EXT, D/N, page eighths) → draft `scenes` + `scene_elements`. Human reviews/edits.
- From the breakdown + a few constraints (cast availability, location grouping),
  AI proposes an **optimised shooting order** (a first stripboard) and the **DOOD**.
- AI **drafts the daily call sheet** from the day's scenes + requirements; human
  approves; we render a **PDF** and **WhatsApp it to the unit** (we already have the
  channel) — and log it.
- Ask OPM can then answer "who's needed on day 7", "how many junior artists this
  week", "which scenes still unscheduled".

## UI (replaces the simple Schedule tab with a real module)
- **Breakdown** — scene list with elements; AI "Break down screenplay" button.
- **Schedule / Stripboard** — drag scenes into days (colour strips); per-day est.
- **Day detail** — scenes, requirements checklist, artists & technicians needed,
  special equipment/makeup, locations, weather; "Generate call sheet".
- **Call sheets** — generated PDFs, send-to-unit (WhatsApp/email), history.
- **DOOD report** — cast × day grid (SW/W/H/F), exportable.

## Permissions
Edit limited to **director / chief AD / associate AD / production controller +
founder/EP/GM** (the AD department owns scheduling). Everyone on the project views.
Reuses the same role-gating pattern as documents/casting.

## Phased build
- **Phase 1 — Schedule core:** locations, scenes + breakdown elements (manual),
  schedule days + day-scenes, per-day requirements & checklist, day detail UI.
- **Phase 2 — Call sheets:** AI-drafted call sheet → PDF → WhatsApp/email to unit + history.
- **Phase 3 — AI breakdown + DOOD + auto-order:** screenplay → scenes/elements,
  Day-Out-of-Days grid, AI-optimised shoot order (stripboard).

## Decisions to confirm
1. **Depth now** — full pipeline (breakdown→stripboard→DOOD→call sheets) phased as
   above, or start with a strong "Schedule + per-day requirements + call sheet"
   and add stripboard/DOOD later?
2. **Call-sheet delivery** — PDF + WhatsApp to the unit (recommended), email too?
3. **AI auto-breakdown of the screenplay** — yes (build it) or keep breakdown manual
   for v1?
