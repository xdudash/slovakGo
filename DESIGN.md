---
name: SlovakGO iOS native UI
description: Native learner interface; excludes the existing web and landing identity.
colors:
  light-bg: "#f4f4f2"
  light-surface: "#ffffff"
  light-surface-soft: "#eaeae6"
  light-fg: "#242624"
  light-muted: "#646862"
  light-border: "#d9dcd6"
  light-accent: "#805b16"
  light-accent-soft: "#f5ead3"
  light-action: "#e9bb66"
  light-action-ink: "#282111"
  light-success: "#347454"
  light-success-soft: "#e5f1e9"
  light-error: "#a43b43"
  light-error-soft: "#f9e9eb"
  light-orange: "#935321"
  light-orange-soft: "#f5e9df"
  dark-bg: "#171918"
  dark-surface: "#222522"
  dark-surface-soft: "#2d312d"
  dark-fg: "#f0f1ed"
  dark-muted: "#b0b7ae"
  dark-border: "#3a4039"
  dark-accent: "#e4ba70"
  dark-accent-soft: "#373124"
  dark-action: "#e4ba70"
  dark-action-ink: "#242116"
  dark-success: "#9ac9ad"
  dark-success-soft: "#24372c"
  dark-error: "#edaaae"
  dark-error-soft: "#40292d"
  dark-orange: "#dbb28f"
  dark-orange-soft: "#382e25"
typography:
  headline:
    fontFamily: "-apple-system, BlinkMacSystemFont, sans-serif"
    fontSize: "1.6rem"
    fontWeight: 600
    lineHeight: 1.2
    letterSpacing: "-0.025em"
  title:
    fontSize: "1.5rem"
    lineHeight: 1.25
    letterSpacing: "-0.02em"
  body:
    fontFamily: "-apple-system, BlinkMacSystemFont, sans-serif"
    fontSize: "1rem"
    lineHeight: 1.65
  label:
    fontSize: "11px"
    fontWeight: 500
    lineHeight: 1.15
rounded:
  pill: "999px"
  status: "8px"
  language: "10px"
  field: "11px"
  button: "12px"
  lesson-node: "14px"
  surface: "16px"
spacing:
  compact: "8px"
  control-gap: "12px"
  field-inset: "16px"
  card-inset: "18px"
  exercise-inset: "20px"
  page-gap: "22px"
  page-bottom: "24px"
components:
  button-primary:
    backgroundColor: "{colors.light-action}"
    textColor: "{colors.light-action-ink}"
    rounded: "{rounded.button}"
    padding: "13px 18px"
  button-primary-dark:
    backgroundColor: "{colors.dark-action}"
    textColor: "{colors.dark-action-ink}"
    rounded: "{rounded.button}"
    padding: "13px 18px"
  button-secondary:
    backgroundColor: "{colors.light-accent-soft}"
    textColor: "{colors.light-accent}"
    rounded: "{rounded.button}"
  button-ghost:
    textColor: "{colors.light-accent}"
  button-danger:
    backgroundColor: "{colors.light-error-soft}"
    textColor: "{colors.light-error}"
    rounded: "{rounded.button}"
    padding: "13px 18px"
  card:
    backgroundColor: "{colors.light-surface}"
    textColor: "{colors.light-fg}"
    rounded: "{rounded.surface}"
    padding: "18px"
  input:
    backgroundColor: "{colors.light-surface}"
    textColor: "{colors.light-fg}"
    rounded: "{rounded.field}"
  navigation-item:
    typography: "{typography.label}"
    height: "52px"
  chip:
    backgroundColor: "{colors.light-surface}"
    textColor: "{colors.light-fg}"
---

# Design System: SlovakGO iOS native UI

## Overview

**Creative North Star: "The practical learning route"**

The native learner interface uses a quiet, practical learning-route direction: neutral layers, clear reading order, and restrained amber actions. It serves Ukrainian adults learning Slovak through everyday situations, with content and exercise feedback taking visual priority.

This contract applies explicitly to the Capacitor iOS native UI, scoped by the native app root. Common cards and buttons cover both the learner frame and modal portals outside that frame. The existing web application and landing identity remain outside this palette contract. The implementation in `src/styles/native.css` is the color and component source; this document records the built state, not a formal release-readiness verdict.

**Key Characteristics:**
- Neutral light and graphite dark surfaces.
- System iOS typography with scalable content.
- Flat controls, clear semantic feedback, and bespoke small pictograms.

Process informed by unslop by Damir Sokolovsky (@heydamir), CC BY 4.0.

## Colors

The frontmatter records both native theme sets; light is the default and dark follows the system color-scheme preference. Keys preserve the implemented CSS roles, prefixed by theme.

### Primary
- **Restrained amber:** `accent` colors active tabs, focus outlines, progress and secondary text; `accent-soft` marks selected surfaces. `action` and `action-ink` pair the primary action background with its readable label.

### Secondary
- **Semantic green and rose:** `success` / `success-soft` and `error` / `error-soft` distinguish correct and incorrect answers and feedback.
- **Warm streak brown:** `orange` / `orange-soft` serve streak and risk messaging.

### Neutral
- **Paper and graphite:** `bg` is the app canvas, `surface` the card/control layer, and `surface-soft` the inset or inactive layer.
- **Reading ink:** `fg` carries primary text, `muted` secondary copy and placeholders, and `border` separators and outlines.

## Typography

**Display and Body Font:** iOS system stack (`-apple-system, BlinkMacSystemFont, sans-serif`), rooted in `font: -apple-system-body`. No separate display or mono family is introduced.

### Hierarchy
- **Headline:** screen headings use the frontmatter headline role.
- **Title:** learning hero headings use the title role; exercise headings use a smaller size (1.35rem) with line-height (1.4).
- **Body:** lesson copy uses the body role. Supporting page copy uses a smaller size (.94rem) and line-height (1.5).
- **Label:** tab captions use the fixed label role; status numbers use tabular numerals.

Dynamic Type scales rem-based content. Runtime marks large text when the computed root size exceeds (22px), updating on resize and resume. Controls can grow with copy; the tab label remains fixed. Native text-entry controls use at least (16px), and placeholders explicitly inherit the muted role at full opacity.

## Layout

The iPhone shell spans the viewport and scrolls naturally. Learner content has a maximum width (800px), side gutters (18px), page gaps (22px), and safe-area-aware edges. Lesson content caps at (720px); auth content at (520px). Below (359px), page gutters reduce to (12px). From (768px), vocabulary cards use two columns.

Five labelled tabs sit in a fixed bottom bar. Each item is (52px) tall; the bar additionally reserves the actual `env(safe-area-inset-bottom, 0px)` home inset. Main content reserves that bar, inset and (12px) clearance. Lessons hide tabs and use a sticky action footer with bottom padding `calc(12px + env(safe-area-inset-bottom, 0px))`. The keyboard hides tabs and reduces main bottom padding to (20px).

The language picker uses two columns normally and one under the native large-text class. Long names and lesson copy wrap rather than forcing horizontal scrolling.

## Elevation & Depth

Native cards, buttons, lesson nodes and navigation have no decorative shadows. Text fields retain the shared accent-soft focus glow (0 0 0 4px). Tonal layers and thin borders establish separation; the tab bar is opaque, without backdrop blur. Native modal overlays use a neutral black scrim (`rgba(0,0,0,.52)`). Correct and incorrect answers retain semantic borders while removing legacy ledge shadows.

## Shapes

Rounded surfaces use the frontmatter surface radius; controls use the smaller field, language and button radii. Borders are generally thin (1px). Touch controls use minimum heights (44px) for small icon actions, (48px) for standard buttons and fields, and (52px) for answer options and settings rows.

## Components

### Buttons

Full-width lesson actions are calm and direct. Primary uses the action pair, secondary uses the soft accent pair, and ghost labels use accent on a transparent fill with the theme border. Danger actions use the soft error background, error text and an error border (1px), including modal actions. Standard padding is (13px 18px), with explicit semibold weight (600) and normal letter spacing. Hover adds no lift; a pressed button uses opacity (.78) and scale (.99). Focus uses an accent outline (2px) with offset (3px). Reduced motion removes button transitions and the pressed scale.

### Chips

Neutral surfaces and borders carry inactive chips; selected chips use the soft accent background, accent text and border. Chips retain the inherited pill radius (999px), horizontal padding (13px) and border (1.5px). Touch height is at least (44px). Native chips have no bounce, shadow or transform.

### Cards / Containers

Surface-colored cards use a thin border and standard card inset. Hero and exercise containers use the larger exercise inset. Settings cards omit the border. All remain flat.

### Inputs / Fields

Surface-filled controls use the field radius and a thin border, foreground input text, muted placeholders and an accent caret. Search and standard fields have a minimum height (48px). Focus shifts the border to accent and retains the shared soft accent glow (0 0 0 4px); keyboard focus adds the visible outline.

### Navigation

Tabs pair small icons (24px) with fixed captions and a small gap (4px). Inactive items use muted ink; the active item uses accent without a filled background. Captions remain single-line with ellipsis when necessary. Lesson screens and keyboard-open states hide the bar.

### Learning pictograms

`LearningIcons.tsx` supplies original route, book, practice, ranking, profile, streak, XP and freeze drawings. They use a shared view box (24 × 24), round caps/joins and default stroke (1.7); active tab icons use stroke (2). No new raster assets were introduced by this refinement. Existing brand and lesson media predate it.

## Do's and Don'ts

### Do:
- Do apply this palette contract only to the iOS native UI.
- Do retain the actual home safe-area inset beneath fixed tabs and sticky lesson actions.
- Do allow content to wrap and grow for Dynamic Type, including a single-column large-text language picker.
- Do use success and error tokens for answer feedback and keep labels alongside navigation icons.

### Don't:
- Don't extend this native palette to the existing web or landing identity without a separate design decision.
- Don't substitute a hard-coded device home-inset value for the safe-area environment value.
- Don't enlarge the fixed tab chrome with content text scaling or show it over the keyboard.
