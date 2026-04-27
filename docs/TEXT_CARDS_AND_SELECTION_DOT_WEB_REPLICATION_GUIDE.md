# Text Cards + Selection Dot Web Replication Guide

This guide audits where text cards are used across the Android codebase, then specifies how to reproduce them for web with behavior and visual parity.

## Scope

- Text card system (`TextCardView`) used in:
  - App Tour
  - Message Centre
  - Setup flow (same component family and behavior contract)
- Selection dot used in:
  - `ChoosePlanSheet`
  - `ManageSubscriptionSheet`

---

## 1) Core Text Card Component

### Canonical implementation

- `app/src/main/java/com/jw/railstatisticsandroid/TextCardView.kt`
- `app/src/main/res/layout/layout_text_card.xml`

### What it is

`TextCardView` is a reusable interactive card with:

- Title
- Description
- Trailing chevron icon
- Station-style square card shell (same shadow model as station cards)
- Pressed-state spring-back behavior
- Haptic feedback on click

### Visual spec

- Container padding: `start 12dp`, `top 12dp`, `bottom 12dp`, `end 16dp`
- Text column right reserve for chevron: `40dp` (`layout_marginEnd`)
- Corner radius: `0dp` (square)
- Chevron: `16dp x 16dp`, end-aligned, vertically centered

Typography:

- Title: `18sp`, Geologica variable, `wght 500`, primary text color
- Description: `14sp`, Geologica variable, `wght 400`, primary text color
- Title/description spacing: `2dp` bottom margin under title

Shadow/fill behavior (via `StationCardShadowDrawable` + style registry):

- Normal: active fill + outer shadow + inner shadow
- Pressed: pressed fill, no outer shadow, no inner shadow

### Interaction behavior

- `setOnClickListener` injects haptics before forwarding callback.
- Press state uses delayed release:
  - On press: immediate pressed background
  - On release: normal background after `300ms`
- Theme refresh support via `refreshTheme()`
- Supports semantic state colors via `setStateColor(...)`:
  - `DEFAULT`
  - `RED_ACTION`
  - `GREEN_ACTION`
  - (also used with `ACCENT` in message center)

---

## 2) Full Codebase Usage Audit (Text Cards)

This section lists all places where the reusable text card component is actually used.

## App Tour

### A) App Tour main menu cards

- `app/src/main/java/com/jw/railstatisticsandroid/components/AppGuideMainPageFragment.kt`
- `app/src/main/res/layout/fragment_app_guide_main.xml`

Cards:

- `appGuideCardStations`
- `appGuideCardStationDetails`
- `appGuideCardStatisticsMap`

Behavior:

- Each card sets title/description in fragment code.
- Each card navigates to an onboarding walkthrough fragment on click.
- Uses default card state colors.

## Message Centre

### B) Message list cards

- `app/src/main/java/com/jw/railstatisticsandroid/MessageCenterFragment.kt`
- `app/src/main/res/layout/fragment_message_center.xml`

Behavior:

- Cards are created programmatically per message: `TextCardView(requireContext())`.
- Title/description bound from message content.
- Read/unread style:
  - Unread: `ButtonColorFill.ACCENT`
  - Read: `ButtonColorFill.DEFAULT`
- Swipe-to-dismiss layer wraps each card in a swipe container.
- Tap opens message detail and marks message as read.

Important parity note:

- Card appearance is still from `TextCardView`; swipe behavior is external container logic.

## Setup flow (same text-card system)

### C) Setup Step 1 - Getting Started

- `app/src/main/java/com/jw/railstatisticsandroid/components/setup/SetupStep1GettingStartedFragment.kt`
- `app/src/main/res/layout/fragment_setup_step1_getting_started.xml`

Cards:

- `setupStep1CardYes`
- `setupStep1CardNo`

Behavior:

- Card taps branch setup flow navigation.

### D) Setup Step 2 - File Migration

- `app/src/main/java/com/jw/railstatisticsandroid/components/setup/SetupStep2FileMigrationFragment.kt`
- `app/src/main/res/layout/fragment_setup_step2_file_migration.xml`

Cards:

- `setupStep2CardMigrate`
- `setupStep2CardReady`

Behavior:

- One opens migration URL; one advances flow (after reminder dialog).

### E) Setup Step 6 - Permissions

- `app/src/main/java/com/jw/railstatisticsandroid/components/setup/SetupStep6PermissionFragment.kt`
- `app/src/main/res/layout/fragment_setup_step6_permission.xml`

Cards:

- `setupStep6CardNotifications`
- `setupStep6CardLocation`
- `setupStep6CardAds`

Behavior:

- Each card triggers permission/consent action.
- Card state color flips red/green using:
  - incomplete: `RED_ACTION`
  - complete: `GREEN_ACTION`

---

## 3) Selection Dot Audit (Choose Plan + Manage Subscription)

This is the selectable indicator shown on subscription option cards.

### Component + shape files

- Host layout:
  - `app/src/main/res/layout/subscription_option_card.xml`
- Dot view ID:
  - `@id/subscription_option_dot`
- Drawables:
  - `app/src/main/res/drawable/subscription_dot_unselected.xml`
  - `app/src/main/res/drawable/subscription_dot_selected.xml`

### Geometry

- Dot container size: `18dp x 18dp`
- Unselected:
  - transparent fill
  - `2dp` stroke in `@color/color_text_primary`
- Selected:
  - same 18dp outer ring
  - centered `9dp` filled inner circle
  - inset `4.5dp` each side

### Where it is used

## Choose Plan

- `app/src/main/java/com/jw/railstatisticsandroid/components/ChoosePlanSheet.kt`
- `app/src/main/res/layout/bottom_sheet_choose_plan_content.xml`

Logic:

- `setNoPlanSelected()` -> both dots unselected drawable.
- `selectPlan(standardPremium: Boolean)` -> selected drawable on chosen card, unselected on other.
- Selected card also switches to pressed card shell style.
- Tapping selected plan toggles off selection.

## Manage Subscription

- `app/src/main/java/com/jw/railstatisticsandroid/components/ManageSubscriptionSheet.kt`
- `app/src/main/res/layout/bottom_sheet_manage_subscription_content.xml`

Logic:

- `setPlanCardSelectionDots(...)` applies selected/unselected drawables.
- Disabled-card mode applies secondary-color tint to dot:
  - `.setColorFilter(secondary, SRC_IN)` when disabled
  - `.clearColorFilter()` when enabled
- Dot selection and disabled state are both re-applied after theme/plan changes.

---

## 4) Theme Tokens Relevant to Web Port

From `values/colors.xml` and `values-night/colors.xml`:

- Text:
  - `color_text_primary`: light `#000000`, dark `#FFFFFF`
  - `color_text_secondary`: light `#3F3F3F`, dark `#BFBFBF`
- Primary card fills:
  - active: light `#FFFFFF`, dark `#3D3D3D`
  - pressed: light `#C4C4C4`, dark `#1E1E1E`
- Action fills (used by card state color variants):
  - accent/red/green families with theme-specific active/pressed values

The dot uses `color_text_primary` for both stroke and selected inner fill.

---

## 5) Web Replication Blueprint

## A) TextCard web primitive

Build one reusable primitive, then compose it for App Tour / Message Centre / Setup.

Suggested API:

- `title: string`
- `description: string`
- `state: "default" | "accent" | "redAction" | "greenAction"`
- `onClick: () => void`
- `trailingIcon?: ReactNode` (default chevron)
- `disabled?: boolean`

DOM structure:

- Root clickable card div/button
- Text column (title + description)
- End icon container

CSS parity essentials:

- Square corners (`border-radius: 0`)
- Padding `12 16 12 12`
- Preserve `40px` text-to-icon reserve
- Title `18px/500`, description `14px/400`
- Press model:
  - pointer down -> pressed style immediately
  - pointer up -> delay return to normal by `300ms`

Behavior parity:

- Keep delayed spring-back visual even for keyboard click if possible.
- Expose state-color mode so permission/message surfaces can reuse one component.

## B) Subscription selection dot primitive

Suggested API:

- `selected: boolean`
- `disabled?: boolean`

CSS parity essentials:

- Outer: `18px` circle with `2px` stroke
- Inner selected dot: `9px` filled circle, centered
- Use primary text token for normal state
- Use secondary text token when disabled

State matrix:

- `selected=false, disabled=false` -> hollow ring (primary)
- `selected=true, disabled=false` -> hollow ring + filled center (primary)
- `selected=false, disabled=true` -> hollow ring (secondary)
- `selected=true, disabled=true` -> hollow ring + center (secondary)

## C) Subscription option card composition

Use existing web button/card shell primitives where possible, then mount:

- Title
- Price
- Trial text
- End-aligned selection dot

Selection behavior parity:

- Single-select between Standard and First Class.
- Tapping selected card toggles off (important; this is not radio-only behavior).
- Selected card should also visually use pressed card style.

---

## 6) Conversion Checklist

- Implement one shared web `TextCard` primitive; do not fork per page.
- Implement one shared `SelectionDot` primitive and reuse in both Choose Plan and Manage Sub.
- Match card press timing (`300ms`) and state-color variants.
- Match dot geometry exactly (`18/2/9`).
- Support disabled tint override for Manage Subscription scenario.
- Verify light + dark themes for text, fill, shadow, and dot contrast.
- Verify toggle-off behavior for already selected subscription card.

---

## 7) Quick File Index

Text card core:

- `app/src/main/java/com/jw/railstatisticsandroid/TextCardView.kt`
- `app/src/main/res/layout/layout_text_card.xml`

App Tour:

- `app/src/main/java/com/jw/railstatisticsandroid/components/AppGuideMainPageFragment.kt`
- `app/src/main/res/layout/fragment_app_guide_main.xml`

Message Centre:

- `app/src/main/java/com/jw/railstatisticsandroid/MessageCenterFragment.kt`
- `app/src/main/res/layout/fragment_message_center.xml`

Setup flow:

- `app/src/main/java/com/jw/railstatisticsandroid/components/setup/SetupStep1GettingStartedFragment.kt`
- `app/src/main/java/com/jw/railstatisticsandroid/components/setup/SetupStep2FileMigrationFragment.kt`
- `app/src/main/java/com/jw/railstatisticsandroid/components/setup/SetupStep6PermissionFragment.kt`
- `app/src/main/res/layout/fragment_setup_step1_getting_started.xml`
- `app/src/main/res/layout/fragment_setup_step2_file_migration.xml`
- `app/src/main/res/layout/fragment_setup_step6_permission.xml`

Selection dot + subscription cards:

- `app/src/main/res/layout/subscription_option_card.xml`
- `app/src/main/res/drawable/subscription_dot_unselected.xml`
- `app/src/main/res/drawable/subscription_dot_selected.xml`
- `app/src/main/java/com/jw/railstatisticsandroid/components/ChoosePlanSheet.kt`
- `app/src/main/java/com/jw/railstatisticsandroid/components/ManageSubscriptionSheet.kt`
- `app/src/main/res/layout/bottom_sheet_choose_plan_content.xml`
- `app/src/main/res/layout/bottom_sheet_manage_subscription_content.xml`
