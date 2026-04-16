You are a senior frontend engineer and design system implementer.
Build a production-ready mobile-first application interface using the following exact design system and layout constraints.

This is not a creative exercise. Follow specifications precisely.

1. GLOBAL DESIGN INTENT

The application must feel like a dimly lit professional kitchen workspace:

- Warm

- Calm

- Operational

- Controlled

- Refined

- No futuristic or cyber aesthetics

- No cool tones

- No high contrast visuals

- No saturated orange

- No neon glow

- No glass overuse

This interface is designed for long operational use. Eye comfort and clarity take priority over visual drama.

2. LAYOUT CONSTRAINTS (MOBILE FIRST)
Viewport

- Max content width: 480px

- Horizontal padding: 16px

- Vertical rhythm: 12–16px spacing system

- Minimum touch target height: 44px

- No horizontal scroll

- Avoid long infinite scroll pages

- Prefer progressive disclosure

- Use stacked layouts only (no desktop grid behavior)

- Structure per Screen

- Each screen must contain:

- Header (minimal, 56px height max)

- Primary content section (card-based stacking)

- One clearly defined primary action

- Optional secondary action (visually subdued)

- No floating action button unless explicitly required.

3. COLOR SYSTEM (EXACT TOKENS)

Use CSS variables exactly as defined:

:root {
  --bg-primary: #2E2723;
  --bg-surface: #3A312C;
  --bg-elevated: #453A33;

  --accent-primary: #C46A3A;
  --accent-soft: rgba(196, 106, 58, 0.12);
  --accent-glow: rgba(196, 106, 58, 0.18);

  --text-primary: #F1E6DA;
  --text-secondary: #BFAF9F;
  --text-disabled: #8C7B6F;

  --border-subtle: rgba(255, 235, 220, 0.06);
  --border-strong: rgba(255, 235, 220, 0.10);
}

Rules:

- Never use pure black (#000000)

- Never introduce cool gray tones

- Accent usage must not exceed 10% of visible interface

- No gradients unless extremely subtle and low contrast

4. TYPOGRAPHY

Font style:

- Clean humanist sans-serif (e.g., Inter, SF Pro, or equivalent)

- No futuristic or condensed fonts

Hierarchy:

| Type           | Size  | Weight | Color           |
|---------------|-------|--------|-----------------|
| Page Title    | 20px  | 600    | text-primary    |
| Section Title | 16px  | 600    | text-primary    |
| Body          | 14px  | 400    | text-primary    |
| Secondary     | 13px  | 400    | text-secondary  |
| Labels        | 12px  | 500    | text-secondary  |
| Disabled      | 14px  | 400    | text-disabled   |

- Line height: 1.4–1.5
- No ultra-tight tracking.

5. ELEVATION SYSTEM

Use warm diffused shadows only.

--shadow-1: 0 4px 12px rgba(60, 40, 25, 0.25);
--shadow-2: 0 6px 18px rgba(60, 40, 25, 0.30);
--shadow-3: 0 10px 28px rgba(50, 30, 18, 0.35);

Rules:

- No sharp drop shadows

- No cool shadow colors

- No heavy elevation stacking

6. COMPONENT IMPLEMENTATION
6.1 Cards

Used for grouped content.

.card {
  background: var(--bg-elevated);
  border: 1px solid var(--border-subtle);
  border-radius: 16px;
  padding: 16px;
  box-shadow: var(--shadow-1);
}

Spacing:

16px margin between cards

No nested card inside card.

6.2 Buttons
Primary Button
.button-primary {
  background: var(--accent-primary);
  color: var(--text-primary);
  border-radius: 14px;
  padding: 12px 16px;
  min-height: 44px;
  border: none;
}

Hover:

box-shadow: var(--shadow-2);

Active:

background: rgba(196, 106, 58, 0.85);
Secondary Button
.button-secondary {
  background: var(--bg-surface);
  border: 1px solid var(--border-strong);
  color: var(--text-primary);
  border-radius: 14px;
}
Ghost Button
.button-ghost {
  background: transparent;
  color: var(--text-secondary);
}

Hover:

background: var(--accent-soft);
6.3 Inputs
.input {
  background: var(--bg-surface);
  border: 1px solid var(--border-subtle);
  border-radius: 14px;
  padding: 12px;
  min-height: 44px;
  color: var(--text-primary);
}

Focus:

.input:focus {
  border-color: rgba(196,106,58,0.35);
  box-shadow: 0 0 0 3px rgba(196,106,58,0.15);
  outline: none;
}

Placeholder:

color: var(--text-disabled);
6.4 Tables (Mobile)

Do NOT create horizontal scroll tables.

Convert table rows into stacked card rows:

Structure:

Label (12px uppercase, secondary text)

Value (14px primary text)

Divider optional using border-subtle

Each row:

14px padding

12px spacing between rows

Rounded 14px

bg-surface background

7. GLASS PANEL RULES

Only use glass effect for:

Modal

Bottom sheet

Floating overlay panel

Glass styling:

.glass {
  background: rgba(255, 230, 210, 0.06);
  backdrop-filter: blur(6px);
  border: 1px solid rgba(255, 230, 210, 0.08);
  border-radius: 18px;
}

Rules:

Max blur: 8px

Max transparency: 10%

Never stack glass over glass

Never use cool tint

8. INTERACTION STATES

Hover:

Slight elevation increase

Soft pumpkin glow (very subtle)

Glow example:

box-shadow: 0 0 10px var(--accent-glow);

Active:

background: var(--accent-soft);

Focus:

box-shadow: 0 0 0 3px rgba(196,106,58,0.18);

Disabled:

60% opacity

No glow

text-disabled color

9. ACCESSIBILITY REQUIREMENTS

Minimum contrast 4.5:1 for primary text

Accent buttons must meet WCAG AA

All tap targets minimum 44px height

Avoid pure white text blocks

Avoid visual flicker or blinking

10. SAMPLE INITIAL SCREEN STRUCTURE

Implement a sample dashboard screen with:

Header:

Title: “Kitchen Overview”

Secondary text subtitle

Content:

2 summary metric cards

1 list section (stacked row style)

1 primary button at bottom

All content stacked vertically with 16px rhythm.

11. ABSOLUTE DO NOTS

No gradients with visible contrast shifts

No blue glassmorphism

No saturated orange

No neon glow

No sharp corners

No hard black (#000)

No large empty hero sections

No excessive visual layering

Build clean semantic HTML + CSS (or Tailwind equivalent if specified).
Ensure responsive behavior prioritizes mobile and scales up gracefully.

The result must feel warm, subtle, grounded, and suitable for extended operational usage.