# Custom Toggle Audit and Web Implementation Guide

## Overview
This document audits the current custom toggle implementation used in the iOS app and defines how to reproduce the same design and behavior on the web.

The app currently uses three custom SwiftUI toggle variants:
- `TOGToggle` (base/default track color)
- `TOGToggleVisited` (state-driven red/green track color)
- `TOGToggleTheme` (operator/theme-driven track color)

All three share the same geometry, motion, and core interaction pattern.

## Source of Truth in Codebase

### Core Components
- `Railstats/Componemnets/Buttons/TOGToggle.swift`
- `Railstats/Componemnets/Buttons/TOGToggleVisited.swift`
- `Railstats/Componemnets/Buttons/TOGToggleTheme.swift`

### Supporting Interaction Utility
- `Railstats/5 Settings/Dev Stuff/CoreHapticsTester.swift` (used via `CoreHapticsTester.playTransient(...)`)

## Design Specification (Current App)

## 1) Geometry
- Track width: `45`
- Track height: `20`
- Track corner radius: `32` (capsule-like)
- Knob diameter: `25`
- Knob travel offset:
  - Off: `x = 0`
  - On: `x = trackWidth - knobSize = 20`
- Overall frame used by component: `45 x 25` (height follows knob size)

## 2) Visual Styling

### Track
- Shape: rounded rectangle (capsule)
- Inner shadow effect:
  - Stroke width: `3.0`
  - Stroke color:
    - Light mode: `black` at `0.2` opacity
    - Dark mode: `white` at `0.2` opacity
  - Blur: `strokeWidth * 0.5` (effectively `1.5`)
  - Masked to track shape

### Knob
- Shape: circle
- Fill:
  - Color asset (`ActiveToggleKnob` or `ActiveToggleKnobColourless` depending on variant)
  - Plus `.ultraThinMaterial` overlay effect
- Outer shadow:
  - Base toggle: `black` at `0.2`, radius `2`, y offset `2`
  - Theme/Visited toggles: `black` at `0.3`, radius `3`, y offset `3`
- Inner shadow:
  - Stroke width: `2.0`
  - Color:
    - Light mode: `black` at `0.2` opacity
    - Dark mode: `white` at `0.2` opacity
  - Blur: `1.0`
  - Masked to knob circle

## 3) Color Logic by Variant

### `TOGToggle` (default)
- Track: `Color("PrimaryPressed")`
- Knob: `Color("ActiveToggleKnobColourless")`

### `TOGToggleVisited`
- Track:
  - `isOn == true`: `Color("GreenActionActive")`
  - `isOn == false`: `Color("RedActionActive")`
- Knob: `Color("ActiveToggleKnob")`

### `TOGToggleTheme`
- Track: `Color(theme.colorAssetName)` where `theme` is one of:
  - `LNER`
  - `MerseyRail`
  - `Northern`
  - `TfW`
  - `TPE`
- Knob: `Color("ActiveToggleKnob")`

## 4) Motion and Interaction
- Trigger: `.onTapGesture`
- State change: `isOn.toggle()`
- Knob animation: `.spring(response: 0.3, dampingFraction: 0.7)`
- Hit target: entire component frame via `.contentShape(Rectangle())`
- Haptics (optional, default on):
  - `CoreHapticsTester.playTransient(intensity: 0.6, sharpness: 0.5)`

## Functional Behavior in App
The toggle UI itself only flips a bound boolean value. Business behavior is attached at usage sites via bindings or `onChange`.

Examples:
- `StationDetailView`: toggling visited state also manages `visitedDates`.
- `FilterSheet`: toggles immediately re-apply filters via `onApply()`.
- `AppSettingsView`: toggles map to persisted settings (`@AppStorage`) and service flags.
- Ticket flows (`Step3TravelDates`, `Step5Reservations`, `Step6DelayInfo`, etc.): toggles gate optional form sections and decision paths.

## Usage Audit (Current References)

### `TOGToggle` usages
- `Railstats/2 Tickets (In Beta for V2 release)/Ticket Adding Process/Single & Return/Step3TravelDates.swift`
- `Railstats/2 Tickets (In Beta for V2 release)/Ticket Adding Process/Single & Return/Step5Reservations.swift`
- `Railstats/2 Tickets (In Beta for V2 release)/Ticket Adding Process/Single & Return/Step6DelayInfo.swift`
- `Railstats/2 Tickets (In Beta for V2 release)/Ticket Adding Process/Single & Return/Step7LoyaltySchemes.swift`
- `Railstats/2 Tickets (In Beta for V2 release)/Ticket Adding Process/RRT/RRTDayToggleView.swift`
- `Railstats/5 Settings/RangerRoverDatebaseView/RangerRoverFormWizardView.swift`
- `Railstats/Componemnets/Overlays/StationExportOptionsSheet.swift`
- `Railstats/5 Settings/Dev Stuff/ButtonDemoView.swift` (demo/previews)

### `TOGToggleVisited` usages
- `Railstats/1 Stations/StationDetailView.swift`
- `Railstats/1 Stations/Overlays/FilterSheet.swift`
- `Railstats/5 Settings/AppSettingsView.swift`
- `Railstats/5 Settings/WidgetSmallVariationEdit.swift`
- `Railstats/5 Settings/Dev Stuff/ButtonDemoView.swift` (demo/previews)

### `TOGToggleTheme` usages
- `Railstats/5 Settings/Dev Stuff/ButtonDemoView.swift` (theme demo/previews)

## Web Implementation: Match the Same Design

This implementation reproduces:
- same geometry (`45x20` track, `25` knob, `20` travel)
- same inner-shadow/outer-shadow feel
- same spring-like motion approximation
- same variant-based track colors

```html
<button class="rs-toggle rs-toggle--visited is-on" type="button" role="switch" aria-checked="true" aria-label="Visited">
  <span class="rs-toggle__track"></span>
  <span class="rs-toggle__knob"></span>
</button>
```

```css
:root {
  --rs-track-w: 45px;
  --rs-track-h: 20px;
  --rs-track-r: 32px;
  --rs-knob: 25px;
  --rs-offset-on: 20px;

  /* Replace with your real app tokens */
  --rs-primary-pressed: #d4d4d4;
  --rs-active-toggle-knob: rgba(255, 255, 255, 0.9);
  --rs-active-toggle-knob-colourless: rgba(255, 255, 255, 0.9);
  --rs-green-action-active: #32a852;
  --rs-red-action-active: #d14444;
}

.rs-toggle {
  position: relative;
  width: var(--rs-track-w);
  height: var(--rs-knob); /* match Swift frame height */
  border: 0;
  padding: 0;
  background: transparent;
  cursor: pointer;
  -webkit-tap-highlight-color: transparent;
}

.rs-toggle__track {
  position: absolute;
  left: 0;
  top: calc((var(--rs-knob) - var(--rs-track-h)) / 2);
  width: var(--rs-track-w);
  height: var(--rs-track-h);
  border-radius: var(--rs-track-r);
  background: var(--rs-primary-pressed);
  box-shadow: inset 0 0 1.5px rgba(0, 0, 0, 0.2); /* approx Swift inner stroke+blur */
}

.rs-toggle__knob {
  position: absolute;
  left: 0;
  top: 0;
  width: var(--rs-knob);
  height: var(--rs-knob);
  border-radius: 50%;
  background: var(--rs-active-toggle-knob-colourless);
  backdrop-filter: blur(8px) saturate(130%); /* approximation of ultraThinMaterial */
  box-shadow:
    0 2px 2px rgba(0, 0, 0, 0.2), /* outer shadow */
    inset 0 0 1px rgba(0, 0, 0, 0.2); /* inner shadow */
  transform: translateX(0);
  transition: transform 300ms cubic-bezier(0.2, 0.9, 0.35, 1.2);
}

.rs-toggle.is-on .rs-toggle__knob {
  transform: translateX(var(--rs-offset-on));
}

/* Visited variant */
.rs-toggle--visited .rs-toggle__knob {
  background: var(--rs-active-toggle-knob);
  box-shadow:
    0 3px 3px rgba(0, 0, 0, 0.3),
    inset 0 0 1px rgba(0, 0, 0, 0.2);
}
.rs-toggle--visited .rs-toggle__track {
  background: var(--rs-red-action-active);
}
.rs-toggle--visited.is-on .rs-toggle__track {
  background: var(--rs-green-action-active);
}

/* Theme variant examples */
.rs-toggle--theme-lner .rs-toggle__track { background: var(--theme-lner); }
.rs-toggle--theme-merseyrail .rs-toggle__track { background: var(--theme-merseyrail); }
.rs-toggle--theme-northern .rs-toggle__track { background: var(--theme-northern); }
.rs-toggle--theme-tfw .rs-toggle__track { background: var(--theme-tfw); }
.rs-toggle--theme-tpe .rs-toggle__track { background: var(--theme-tpe); }

@media (prefers-color-scheme: dark) {
  .rs-toggle__track {
    box-shadow: inset 0 0 1.5px rgba(255, 255, 255, 0.2);
  }
  .rs-toggle__knob {
    box-shadow:
      0 2px 2px rgba(0, 0, 0, 0.2),
      inset 0 0 1px rgba(255, 255, 255, 0.2);
  }
  .rs-toggle--visited .rs-toggle__knob {
    box-shadow:
      0 3px 3px rgba(0, 0, 0, 0.3),
      inset 0 0 1px rgba(255, 255, 255, 0.2);
  }
}
```

```js
function wireRailstatsToggle(button, { onChange } = {}) {
  const setState = (nextOn) => {
    button.classList.toggle("is-on", nextOn);
    button.setAttribute("aria-checked", String(nextOn));
    if (onChange) onChange(nextOn);
  };

  button.addEventListener("click", () => {
    const next = button.getAttribute("aria-checked") !== "true";
    setState(next);

    // Optional haptic hint on supported devices
    if (navigator.vibrate) navigator.vibrate(10);
  });

  return { setState };
}
```

## Implementation Notes for Exact Parity
- Keep the `45/20/25` dimensions unchanged, otherwise it stops matching the current app.
- Preserve knob travel at exactly `20px`.
- Use separate variants for:
  - default pressed-color track
  - visited (red/off, green/on)
  - theme/operator track colors
- Apply business logic outside the toggle component, same as SwiftUI usage.
- For accessibility, keep:
  - `role="switch"`
  - `aria-checked`
  - keyboard support (Space/Enter toggle if not using `<button>`)
- iOS `.ultraThinMaterial` does not have a perfect CSS equivalent; `backdrop-filter` with a subtle translucent fill is the closest practical match.

## Recommended Web API Shape
- `RailstatsToggle` base primitive
- Props/options:
  - `checked: boolean`
  - `onChange(checked)`
  - `variant: "default" | "visited"`

This mirrors the main Swift API pattern (`isOn` + variant-driven visuals) while keeping the web implementation minimal.

## React + TypeScript Single-File Component

Use this as a drop-in reference implementation for the exact API shape:
- `variant`
- `checked`
- `onChange`

```tsx
import React from "react";

type ToggleVariant = "default" | "visited";

type RailstatsToggleProps = {
  checked: boolean;
  onChange: (next: boolean) => void;
  variant?: ToggleVariant;
  ariaLabel?: string;
  className?: string;
};

export function RailstatsToggle({
  checked,
  onChange,
  variant = "default",
  ariaLabel = "Toggle",
  className = "",
}: RailstatsToggleProps) {
  const variantClass = variant === "visited" ? "rs-toggle--visited" : "";

  const handleToggle = () => {
    const next = !checked;
    onChange(next);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLButtonElement>) => {
    if (e.key === " " || e.key === "Enter") {
      e.preventDefault();
      handleToggle();
    }
  };

  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={ariaLabel}
      onClick={handleToggle}
      onKeyDown={handleKeyDown}
      className={[
        "rs-toggle",
        variantClass,
        checked ? "is-on" : "",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <span className="rs-toggle__track" />
      <span className="rs-toggle__knob" />
    </button>
  );
}
```

### Usage Example

```tsx
import React from "react";
import { RailstatsToggle } from "./RailstatsToggle";

export function Example() {
  const [visited, setVisited] = React.useState(false);

  return (
    <RailstatsToggle
      checked={visited}
      onChange={setVisited}
      variant="visited"
      ariaLabel="Visited status"
    />
  );
}
```
