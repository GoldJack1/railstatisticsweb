# Station Cards Full Audit (Design + Function)

This document audits the station cards implementation in the Android app so you can reproduce it as closely as possible on a website.

## 1) Source Of Truth Files

- Card container + composition:
  - `app/src/main/res/layout/item_station.xml`
- Card top section component:
  - `app/src/main/java/com/jw/railstatisticsandroid/StationCard.kt`
- Button row component:
  - `app/src/main/java/com/jw/railstatisticsandroid/StationButtonBar.kt`
- Visit status button logic + visuals:
  - `app/src/main/java/com/jw/railstatisticsandroid/BUTVisitStatusButton.kt`
  - `app/src/main/java/com/jw/railstatisticsandroid/util/VisitStatusButtonShadowDrawable.kt`
- Favorite/info square buttons:
  - `app/src/main/java/com/jw/railstatisticsandroid/BUTSquareButton.kt`
- Card shadow drawable:
  - `app/src/main/java/com/jw/railstatisticsandroid/util/StationCardShadowDrawable.kt`
- Shared style/color registry:
  - `app/src/main/java/com/jw/railstatisticsandroid/ButtonStyleRegistry.kt`
- Rendering and interaction wiring in list:
  - `app/src/main/java/com/jw/railstatisticsandroid/StationAdapter.kt`
  - `app/src/main/java/com/jw/railstatisticsandroid/StationsFragment.kt`
- Tokens:
  - `app/src/main/res/values/colors.xml`
  - `app/src/main/res/values-night/colors.xml`

---

## 2) Card Composition And Layout

## Outer Row (`item_station.xml`)

- Row wrapper width: full width (`match_parent`)
- Horizontal margin: `16dp`
- Vertical margin: `8dp`
- Vertical structure:
  1. `StationCard` (top content block)
  2. `StationButtonBar` (bottom controls block)

This makes a single visual "card" split into two stacked bars.

## Top Content Block (`StationCard`)

- Orientation: vertical
- Padding: `12dp` on all sides
- Corners: square (`0dp` radius)
- Background: custom shadow drawable (same style family as primary button)
- Internal vertical rhythm:
  - Operator text
  - `2dp` spacer
  - Station name
  - `2dp` spacer
  - Location text

### Typography in top block

- Font family: `geologica_variable`
- Operator:
  - `13sp`
  - weight axis: `wght 400`
- Station name:
  - `20sp`
  - weight axis: `wght 400`
- Location:
  - `13sp`
  - weight axis: `wght 200` (extra light)
- Text color (all three): `color_text_primary` (theme aware)

## Bottom Control Block (`StationButtonBar`)

- Horizontal row with 3 controls:
  1. Visit status button (fills remaining width)
  2. Favorite square button (`40dp x 40dp`)
  3. Info square button (`40dp x 40dp`)
- No gaps/margins between controls (they touch edge-to-edge)
- Forced height: `40dp` for all controls

---

## 3) Visual Tokens (Exact Values)

## Light mode (`values/colors.xml`)

- Text:
  - `color_text_primary`: `#000000`
  - `color_text_reversed_primary`: `#FFFFFF`
- Primary base (top card + default icon buttons):
  - active: `#FFFFFF`
  - pressed: `#C4C4C4`
- Visit status fills:
  - Not visited active: `#DD4B4B`
  - Not visited pressed: `#CE2727`
  - Visited active: `#29A354`
  - Visited pressed: `#248F49`
- Favorite fills:
  - active: `#D6C85C`
  - pressed: `#C6B539`
- Shared shadow tokens:
  - outer shadow color: `#50000000`
  - inner shadow color: `#4F000000`
  - stroke shadow color: `#40000000`

## Dark mode (`values-night/colors.xml`)

- Text:
  - `color_text_primary`: `#FFFFFF`
  - `color_text_reversed_primary`: `#000000`
- Primary base (top card + default icon buttons):
  - active: `#3D3D3D`
  - pressed: `#1E1E1E`
- Visit status fills:
  - Not visited active: `#800002`
  - Not visited pressed: `#570001`
  - Visited active: `#006122`
  - Visited pressed: `#003D15`
- Favorite fills:
  - active: `#7A6C00`
  - pressed: `#3D3600`
- Shared shadow tokens:
  - outer shadow color: `#50000000`
  - inner shadow color: `#4FFFFFFF`
  - stroke shadow color: `#40FFFFFF`

## Shadow geometry values

Used by top card and controls:

- Corner radius: `0`
- Outer shadow blur radius: `16`
- Outer shadow offset: `dx 0`, `dy 8`
- Inner shadow blur radius: `6`
- Stroke width (drawable): `5`
- Inner stroke width (pressed treatment on visit button): `12`

---

## 4) Interactive Behavior Audit

## A) Visit status button

### Text states

- Not visited:
  - `Not Visited`
- Visited with no date:
  - `Visited`
- Visited with date:
  - `Visited on dd/MM/yyyy`

### On press/click

- Haptic feedback is fired.
- State toggles between visited/not visited.
- Visual animation sequence:
  1. Immediately show new state's **pressed** color
  2. Wait `300ms`
  3. Return to new state's **active** color
- Listener callback emits new visited boolean.

### Data/date behavior in list screen

In `StationAdapter`, the visit callback sends:

- `visitStatus = "Visited"` or `"Not Visited"`
- `visitedDate` behavior:
  - if toggling to visited, keeps existing `station.visitedDate` (does not create date here)
  - if toggling to not visited, clears date (`""`)

In `StationsFragment.updateStationStatus()`:

- if status becomes visited:
  - keep existing date if already present
  - else if "disable auto date" setting is ON: keep empty
  - else set current date formatted `dd/MM/yyyy` (`Locale.UK`)
- if not visited:
  - force empty date

## B) Favorite button

- Uses two icon drawables:
  - normal: outlined star
  - favorited: filled star
- Also can switch to "favorite color style" when favorited.
- Press behavior includes haptics and delayed spring-back (`300ms`) similar to other controls.
- Adapter logic flips current boolean and emits updated station.

## C) Info button

- Uses info-circle icon.
- Click opens station detail screen from list (`navigateToStationDetail` in `StationsFragment`).

## D) RecyclerView recycling protections

During bind (`StationAdapter.bindStation`):

- Visit listener is cleared first.
- `setVisitedSilently(...)` is used to avoid stale callbacks.
- Listeners are attached only after state is fully set.

This avoids accidental callbacks caused by recycled rows.

---

## 5) Data Contract For The Card

From `Station` model:

- `name` -> station name line
- `county` -> location line
- `trainOperator` -> operator line
- `visitStatus` -> visited state (`"Visited"` vs `"Not Visited"`)
- `visitedDate` -> optional date text for visit button
- `favorite` -> favorite star state
- `id` -> DiffUtil identity

---

## 6) Exact Web Replication Spec

## HTML structure

Use one wrapper per row:

```html
<article class="station-row">
  <section class="station-card-top">
    <p class="station-operator">Transport for Wales</p>
    <h3 class="station-name">Station Name</h3>
    <p class="station-location">County</p>
  </section>
  <section class="station-controls">
    <button class="visit-status">Not Visited</button>
    <button class="favorite-btn" aria-label="Favorite"></button>
    <button class="info-btn" aria-label="Info"></button>
  </section>
</article>
```

## CSS geometry

- `.station-row`
  - margin: `8px 16px`
- `.station-card-top`
  - padding: `12px`
  - border-radius: `0`
  - stacked lines with `2px` separation
- `.station-controls`
  - display flex
  - height: `40px`
- `.visit-status`
  - flex: `1`
  - height: `40px`
  - text align left
  - left padding `12px`, right padding `18px`
  - top padding `4px`, bottom padding `6px`
- `.favorite-btn`, `.info-btn`
  - width: `40px`, height: `40px`
  - centered icon size `16px`

## CSS shadows (match Android style family)

Normal state:

- outer drop shadow: blur `16px`, y offset `8px`
- subtle inner/light stroke overlay
- square corners

Pressed state:

- remove outer shadow
- use pressed fill color
- keep inner depth treatment

## Typography

- Use Geologica variable if available.
- Operator: `13px`, weight `400`
- Name: `20px`, weight `400`
- Location: `13px`, weight `200`
- Visit button: `13px`, weight `500`

## Behavior logic (JavaScript)

1. On visit button click:
   - haptic (if supported)
   - toggle visited boolean
   - set immediate pressed visual for new state
   - after `300ms` transition to active visual
   - render text:
     - visited + date: `Visited on ${date}`
     - visited no date: `Visited`
     - not visited: `Not Visited`
2. On favorite click:
   - toggle favorite
   - swap icon outlined/filled
   - optionally switch fill colors to favorite palette
3. On info click:
   - navigate/open details for current station

---

## 7) Important Quirks To Mirror

If you need pixel/behavior parity, keep these:

- Entire card system is square-cornered (`0` radius).
- Control row intentionally has no inter-button spacing.
- All control blocks are exactly `40dp` tall.
- Pressed visual state has a deliberate `300ms` delay before springing back.
- Visit text includes exact phrases and title case:
  - `Not Visited`
  - `Visited`
  - `Visited on <date>`
- Date format is `dd/MM/yyyy`.
- Theme refresh rebinds/repaints card components on resume/theme change.

---

## 8) Optional Delta (If You Want "Web-Perfect" Instead Of "Code-Perfect")

If you prefer cleaner web behavior over strict fidelity:

- Replace manual pressed-delay animation with CSS transitions.
- Use semantic status enum instead of string values (`Visited` / `Not Visited`).
- Separate visual states from persisted data writes to avoid tight coupling.

These are improvements, not exact replicas.
