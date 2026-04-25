# Custom Text Input Buttons Audit + Web Replication Guide

This guide documents all custom `TXTINPBUT*` components in the app and explains how to recreate them on the website by reusing your existing `BUT*` button primitives (shape, shadows, states, tokens) instead of inventing new styles.

## 1) Source Files (Complete Inventory)

## Core plain input variants

- `app/src/main/java/com/jw/railstatisticsandroid/TXTINPBUTWideButton.kt`
- `app/src/main/java/com/jw/railstatisticsandroid/TXTINPBUTLeftRoundedButton.kt`
- `app/src/main/java/com/jw/railstatisticsandroid/TXTINPBUTSquaredButton.kt`
- `app/src/main/java/com/jw/railstatisticsandroid/TXTINPBUTRightRoundedButton.kt`
- `app/src/main/java/com/jw/railstatisticsandroid/TXTINPBUTTopRoundedButton.kt`
- `app/src/main/java/com/jw/railstatisticsandroid/TXTINPBUTBottomRoundedButton.kt`

## Icon input variants

- `app/src/main/java/com/jw/railstatisticsandroid/TXTINPBUTIconWideButton.kt`
- `app/src/main/java/com/jw/railstatisticsandroid/TXTINPBUTIconLeftRoundedButton.kt`
- `app/src/main/java/com/jw/railstatisticsandroid/TXTINPBUTIconSquaredButton.kt`
- `app/src/main/java/com/jw/railstatisticsandroid/TXTINPBUTIconRightRoundedButton.kt`
- `app/src/main/java/com/jw/railstatisticsandroid/TXTINPBUTIconTopRoundedButton.kt`
- `app/src/main/java/com/jw/railstatisticsandroid/TXTINPBUTIconBottomRoundedButton.kt`

## Label input variants

- `app/src/main/java/com/jw/railstatisticsandroid/TXTINPBUTLabelWideButton.kt`
- `app/src/main/java/com/jw/railstatisticsandroid/TXTINPBUTLabelLeftRoundedButton.kt`
- `app/src/main/java/com/jw/railstatisticsandroid/TXTINPBUTLabelSquaredButton.kt`
- `app/src/main/java/com/jw/railstatisticsandroid/TXTINPBUTLabelRightRoundedButton.kt`
- `app/src/main/java/com/jw/railstatisticsandroid/TXTINPBUTLabelTopRoundedButton.kt`
- `app/src/main/java/com/jw/railstatisticsandroid/TXTINPBUTLabelBottomRoundedButton.kt`

## Special input variants

- `app/src/main/java/com/jw/railstatisticsandroid/TXTINPBUTWideButtonPrice.kt`
- `app/src/main/java/com/jw/railstatisticsandroid/TXTINPBUTLabelWideButtonPrice.kt`
- `app/src/main/java/com/jw/railstatisticsandroid/TXTINPBUTIconWideButtonSearch.kt`
- `app/src/main/java/com/jw/railstatisticsandroid/TXTINPBUTWideIconLabelBar.kt`

## Shared style/token infrastructure

- `app/src/main/java/com/jw/railstatisticsandroid/ButtonStyleRegistry.kt`
- `app/src/main/res/values/attrs.xml`
- `app/src/main/res/values/colors.xml`
- `app/src/main/res/values-night/colors.xml`
- Shadow drawables under `app/src/main/java/com/jw/railstatisticsandroid/util/*ShadowDrawable.kt`

---

## 2) Universal Behavior Contract (applies to almost all TXTINPBUT*)

- Fixed height is `40dp` across variants.
- Outer container is a button-like surface with two visual states:
  - normal: full 3D shadow
  - focused/active: flattened (outer shadow removed)
- Standard spacing:
  - container horizontal padding `12dp`
  - container vertical padding `6dp`
- Typography:
  - input text `16sp`, Geologica variable (`wght 400`)
  - label/currency typically `16sp`, Geologica variable (`wght 500`)
- Clear button behavior:
  - clear icon appears only when text is non-empty
  - clicking clear empties text and clears focus
  - icon touch area expanded beyond visual icon
- Input focus behavior:
  - clicking surface requests focus into EditText
  - enter/search action clears focus and hides keyboard
- Haptics:
  - touch feedback is triggered on surface interactions.
- Fill family and theme:
  - all variants map to `buttonStyle` -> fill family -> shared color/shadow tokens.

---

## 3) Shape System (how each component differs)

These are the core shapes to mirror on web. In Android they are implemented using different shadow drawable classes and corner radii arrays.

- `wide` (pill): corner radius `90f` on all corners
- `leftRounded`: left corners `90f`, right corners square
- `squared`: all corners square (`0f`)
- `rightRounded`: right corners `90f`, left corners square
- `topRounded`: top corners `45f`, bottom corners square
- `bottomRounded`: bottom corners `45f`, top corners square

---

## 4) Component Families And What They Add

## A) Plain family

- Base editable input + clear action.
- No leading icon or label.
- Files: `TXTINPBUTWideButton`, `TXTINPBUTLeftRoundedButton`, `TXTINPBUTSquaredButton`, `TXTINPBUTRightRoundedButton`, `TXTINPBUTTopRoundedButton`, `TXTINPBUTBottomRoundedButton`.
- Notable extra:
  - `TXTINPBUTWideButton` has `setOfferCodeInputMode(enabled)` for uppercase/no-spaces offer codes.

## B) Icon family

- Adds a leading icon before input.
- Icon is tint-aware and clickable (focuses input).
- Files: `TXTINPBUTIcon*` variants.

## C) Label family

- Adds static leading label text before input.
- Best for key/value style rows (for example: "Name:", "Code:", "Operator:").
- Files: `TXTINPBUTLabel*` variants.

## D) Price family

- Numeric input (`TYPE_CLASS_NUMBER | TYPE_NUMBER_FLAG_DECIMAL`).
- Currency prefix (`£` by default) and optional label variant.
- Files: `TXTINPBUTWideButtonPrice`, `TXTINPBUTLabelWideButtonPrice`.
- Exposes parsed value callbacks (`Double?`).

## E) Search-focused family

- `TXTINPBUTIconWideButtonSearch`:
  - search-specific API (`setSearchQuery`, `clearSearch`, etc.)
  - optional local broadcast on query changes.
- `TXTINPBUTWideIconLabelBar`:
  - dual mode control:
    - icon mode (idle)
    - label-prefix mode (active search)
  - supports prefixes like `"Name:"`, `"CRS:"`, `"TIPLOC:"`
  - supports forced uppercase mode.

---

## 5) Mapping To Existing BUT-Style Website Primitives

Use this mapping when building web versions so visuals stay consistent with your existing button ecosystem.

## Surface primitive mapping

- `TXTINPBUTWide*` -> reuse your web `BUTWideButton` surface tokens.
- `TXTINPBUTLeftRounded*` -> reuse left-rounded `BUT` shape primitive.
- `TXTINPBUTSquared*` -> reuse square `BUT` shape primitive.
- `TXTINPBUTRightRounded*` -> reuse right-rounded `BUT` shape primitive.
- `TXTINPBUTTopRounded*` -> reuse top-rounded `BUT` shape primitive.
- `TXTINPBUTBottomRounded*` -> reuse bottom-rounded `BUT` shape primitive.

## State mapping

- Android `normalShadow` -> web `--surface-state: normal`
- Android `focusedShadow` -> web `--surface-state: active/flat`
- Android `setEnabled(false)` -> web disabled state with disabled text tokens and non-interactive clear button.

## Color mapping

Use same style families already used by your `BUT*` components:

- primary / secondary / red_action / green_action / accent / favorite

Then apply to input-shell tokens:

- shell fill normal
- shell fill focused
- text normal
- text disabled
- hint
- icon normal
- icon hint
- shadow outer / inner / stroke

---

## 6) Recommended Web Architecture

Build one shared "input shell" and compose variants, instead of writing 22 separate components.

## Core shared component

`InputButtonShell` props:

- `shape`: `wide | leftRounded | squared | rightRounded | topRounded | bottomRounded`
- `styleFamily`: `primary | secondary | red_action | green_action | accent | favorite`
- `prefixType`: `none | icon | label | currency | label+currency | iconOrLabel`
- `icon`
- `label`
- `currencySymbol`
- `value`
- `placeholder`
- `disabled`
- `uppercase`
- `numeric`
- `onChange`
- `onClear`
- `onSubmit`

## Composed variants

Create wrappers that mirror Android names:

- `TxtInpButWide`
- `TxtInpButIconWide`
- `TxtInpButLabelWide`
- `TxtInpButWidePrice`
- and so on

Each wrapper only sets shape/prefix/input-mode defaults.

---

## 7) CSS Blueprint (token-driven)

```css
.txtinpbut {
  height: 40px;
  display: flex;
  align-items: center;
  padding: 6px 12px;
  transition: box-shadow 120ms ease, background 120ms ease;
}

.txtinpbut--normal {
  box-shadow:
    0 8px 16px var(--shadow-outer),
    inset 0 0 6px var(--shadow-inner),
    inset 0 0 0 1px var(--shadow-stroke);
  background: var(--fill-active);
}

.txtinpbut--focused,
.txtinpbut:focus-within {
  box-shadow:
    inset 0 0 6px var(--shadow-inner),
    inset 0 0 0 1px var(--shadow-stroke);
  background: var(--fill-pressed);
}

.txtinpbut__input {
  flex: 1;
  border: 0;
  outline: 0;
  background: transparent;
  color: var(--text-normal);
  font: 400 16px "Geologica", sans-serif;
}

.txtinpbut__prefix {
  font: 500 16px "Geologica", sans-serif;
  color: var(--text-normal);
}

.txtinpbut__clear {
  width: 40px;
  height: 40px;
  opacity: 0;
  pointer-events: none;
}

.txtinpbut--has-value .txtinpbut__clear {
  opacity: 1;
  pointer-events: auto;
}
```

Add shape classes for border radius:

- `--wide`: `999px`
- `--left-rounded`: `999px 0 0 999px`
- `--squared`: `0`
- `--right-rounded`: `0 999px 999px 0`
- `--top-rounded`: `45px 45px 0 0`
- `--bottom-rounded`: `0 0 45px 45px`

---

## 8) JavaScript Behavior Rules To Match Android

- Always toggle clear icon visibility from value emptiness.
- On shell click, focus input.
- On Enter/Search:
  - blur input
  - close keyboard where applicable.
- `offer code mode`:
  - uppercase all input
  - strip spaces.
- `price mode`:
  - decimal numeric input only
  - expose parsed number callback (`number | null`).
- `search bar mode`:
  - emit query-changed callback on every edit
  - optional compatibility broadcast/event bus.
- `icon/label bar mode`:
  - show icon in idle mode
  - switch to label-prefix mode on focus
  - support `forceUppercase` for CRS/TIPLOC style use.

---

## 9) Exact Component Matrix

Use this as the implementation checklist.

- `TXTINPBUTWideButton` -> plain + wide shape + offer-code mode support
- `TXTINPBUTLeftRoundedButton` -> plain + leftRounded
- `TXTINPBUTSquaredButton` -> plain + squared
- `TXTINPBUTRightRoundedButton` -> plain + rightRounded
- `TXTINPBUTTopRoundedButton` -> plain + topRounded
- `TXTINPBUTBottomRoundedButton` -> plain + bottomRounded
- `TXTINPBUTIconWideButton` -> icon + wide
- `TXTINPBUTIconLeftRoundedButton` -> icon + leftRounded
- `TXTINPBUTIconSquaredButton` -> icon + squared
- `TXTINPBUTIconRightRoundedButton` -> icon + rightRounded
- `TXTINPBUTIconTopRoundedButton` -> icon + topRounded
- `TXTINPBUTIconBottomRoundedButton` -> icon + bottomRounded
- `TXTINPBUTLabelWideButton` -> label + wide
- `TXTINPBUTLabelLeftRoundedButton` -> label + leftRounded
- `TXTINPBUTLabelSquaredButton` -> label + squared
- `TXTINPBUTLabelRightRoundedButton` -> label + rightRounded
- `TXTINPBUTLabelTopRoundedButton` -> label + topRounded
- `TXTINPBUTLabelBottomRoundedButton` -> label + bottomRounded
- `TXTINPBUTWideButtonPrice` -> currency + numeric + wide
- `TXTINPBUTLabelWideButtonPrice` -> label + currency + numeric + wide
- `TXTINPBUTIconWideButtonSearch` -> icon + wide + search APIs
- `TXTINPBUTWideIconLabelBar` -> icon/label switcher + wide + prefix mode + optional uppercase

---

## 10) Suggested Delivery Plan For Website

- Step 1: implement `InputButtonShell` with one shape (`wide`) and one style family (`primary`).
- Step 2: add all 6 shapes.
- Step 3: add prefix modes (`icon`, `label`, `currency`).
- Step 4: add `price` and `search` logic.
- Step 5: add `iconOrLabel` mode (for `WideIconLabelBar`).
- Step 6: run visual regression against Android screenshots for each family.

---

## 11) QA Checklist (Web)

- Height always `40px`.
- Placeholder and text colors match style family.
- Focus state flattening is visible and consistent.
- Clear icon appears/disappears exactly on empty/non-empty transitions.
- Disabled state blocks edits and clear-click.
- Uppercase modes enforce in real time.
- Price parsing returns `null` when invalid.
- Search callbacks fire every input change.
- Icon/label mode switches correctly on focus/clear/blur.

---

## 12) Notes

- Android code uses separate classes per shape/family; web should centralize this to reduce maintenance.
- Keep style tokens shared with your existing `BUT*` components so buttons and input-buttons remain visually unified.
