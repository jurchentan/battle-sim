# App.js Split Plan (No Feature Loss)

## Objective

Break the single `app.js` file into focused files while preserving behavior, simulation outputs, UI interactions, and scenario data compatibility.

## Rules for This Refactor

- Do not change game logic during extraction.
- Keep function names/signatures identical where possible.
- Preserve turn sequencing and RNG usage exactly.
- Preserve DOM IDs, CSS classes, and event wiring behavior.
- Preserve scenario payload shape and scenario API routes.

## Target File Layout

- `src/core.js`
  - Constants, state object, DOM references, canvas context, geometry constants.
  - Shared helpers (`rngFactory`, speed/duration helpers, portrait loader).
- `src/setup.js`
  - Boot and setup (`init`, map build, army build, default placement, hydrate helpers).
- `src/ui-controls.js`
  - UI wiring, mode tabs/tool panel renderers, canvas input handlers, army editor, wing assignment UI.
- `src/render.js`
  - Render loop and all drawing/HUD helpers.
- `src/sim.js`
  - Turn engine, action selection, movement, combat, routing, battle end logic.
- `src/scenarios.js`
  - Scenario CRUD/import/export, API request helper, logging helper.
- `src/main.js`
  - Startup call only (`init()`).

## Migration Sequence

1. Move constants/state/shared helpers to `src/core.js`.
2. Move setup and unit/map construction to `src/setup.js`.
3. Move UI wiring and interaction handlers to `src/ui-controls.js`.
4. Move rendering and canvas drawing to `src/render.js`.
5. Move simulation engine and battle logic to `src/sim.js`.
6. Move scenario library/API/logging to `src/scenarios.js`.
7. Create `src/main.js` with the startup call.
8. Update `index.html` script tags to load modules in dependency order.

## No-Loss Verification Checklist

- App boots and map renders.
- Terrain painting works.
- Unit place/select/move/delete works.
- Wing drag-select + assignment works.
- Commander selection works.
- Simulate/pause/resume/step/reset works.
- Reels mode + side controls work.
- Major order popups/highlights still appear.
- Battle can end and post-battle overlay appears.
- Scenario save/load/delete/export/import works.
- Seed randomization works.

## Repository Organization Cleanup

- Keep planning and specification documents under `docs/`.
- Keep screenshot images under `screenshots/`.
