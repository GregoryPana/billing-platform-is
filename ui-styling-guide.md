# UI Styling & Layout Guide

## Overview

This document defines a clean, modern user interface styling system focused on clarity, consistency, and usability.  
It intentionally avoids any domain-specific or functional assumptions and describes **visual structure only**.

The goal is to achieve a neutral, professional interface that works well for data-heavy screens and administrative workflows.

---

## Visual Principles

### 1. Minimal & Neutral
- White and light gray surfaces dominate the layout
- Visual separation is achieved through spacing, not heavy borders
- Decorative elements are avoided

### 2. Consistent Hierarchy
- Typography weight and spacing establish importance
- Primary information is visually dominant
- Secondary information is muted but readable

### 3. Subtle Feedback
- Hover, focus, and active states are gentle
- Color is used sparingly and meaningfully

---

## Color System

### Background Colors
- Primary background: very light gray (`#F8FAFC` or similar)
- Content surfaces (cards, tables): white (`#FFFFFF`)
- Dividers: light gray (`#E5E7EB`)

### Text Colors
- Primary text: near-black (`#0F172A`)
- Secondary text: muted gray (`#64748B`)
- Placeholder / helper text: lighter gray (`#94A3B8`)

### Semantic Accent Colors
Used for labels, indicators, or statuses:
- Success: soft green background with darker green text
- Warning: soft yellow background with darker yellow/orange text
- Error: soft red background with darker red text

Accents should always use **light background + darker foreground**.

---

## Typography

### Font Family
- Modern sans-serif (e.g., Inter, Roboto, SF Pro)
- No serif or decorative fonts

### Font Scale
| Usage | Size | Weight |
|-----|------|--------|
| Page heading | 20–24px | 600 |
| Section heading | 16–18px | 500 |
| Body text | 14px | 400 |
| Secondary text | 12–13px | 400 |

- Sentence case preferred
- Avoid all-caps labels

---

## Layout & Spacing

### Structure
- Fixed navigation area on the left
- Primary content area on the right
- Horizontal control bar above main content

### Spacing Rules
- Use consistent padding (16–24px)
- Vertical rhythm is more important than lines
- Avoid dense layouts; allow content to breathe

---

## Surfaces & Containers

### Cards / Panels
- White background
- Rounded corners (8–12px)
- Very subtle shadow or 1px border

### Tables & Lists
- No heavy grid lines
- Light row separators or hover highlights
- Hover background: light gray (`#F1F5F9`)

---

## Controls & Inputs

### Buttons
- Primary:
  - Solid accent color
  - White text
  - Rounded corners
- Secondary:
  - White background
  - Light gray border
  - Neutral text

### Inputs & Dropdowns
- Rounded edges
- Light border
- Clear focus state
- No heavy outlines

---

## Badges & Indicators

- Rounded pill shape
- Small padding
- Light background color
- Medium-weight text
- Used for statuses, tags, or labels

---

## Iconography

- Thin, outline-style icons
- Consistent stroke width
- Neutral color by default
- Accent color on hover or active

Recommended style: simple, geometric icons without fills.

---

## Action Menus

- Contextual actions hidden by default
- Revealed via icon (e.g., three dots)
- Floating menu with soft shadow
- Clear vertical grouping of actions

---

## Navigation Styling

- Vertical list layout
- Icon + text
- Active item highlighted with:
  - Slight background tint
  - Accent-colored text or icon

Inactive items remain neutral.

---

## Pagination & Utility Controls

- Compact buttons
- Rounded corners
- Clear active state
- Muted inactive states

---

## Interaction Feedback

- Hover states use light background change
- Click states slightly darken
- Transitions are fast and subtle (100–150ms)

---

## Accessibility Considerations

- Maintain sufficient color contrast
- Do not rely on color alone to convey meaning
- Click targets ≥ 40px height

---

## Example Prompt for UI Generation

> “Apply a clean, modern UI style using neutral colors, white surfaces, soft shadows, rounded components, subtle borders, consistent spacing, clear typography hierarchy, pill-style indicators, icon-based actions, and restrained accent colors. Focus on readability and clarity.”

---

## Final Notes

This styling system prioritizes:
- Clarity over decoration
- Consistency over novelty
- Usability over visual complexity

