---
name: Technical Design System - Dark
colors:
  surface: '#111318'
  surface-dim: '#111318'
  surface-bright: '#37393e'
  surface-container-lowest: '#0c0e12'
  surface-container-low: '#1a1c20'
  surface-container: '#1e2024'
  surface-container-high: '#282a2e'
  surface-container-highest: '#333539'
  on-surface: '#e2e2e8'
  on-surface-variant: '#b9cacb'
  inverse-surface: '#e2e2e8'
  inverse-on-surface: '#2f3035'
  outline: '#849495'
  outline-variant: '#3b494b'
  surface-tint: '#00dbe9'
  primary: '#dbfcff'
  on-primary: '#00363a'
  primary-container: '#00f0ff'
  on-primary-container: '#006970'
  inverse-primary: '#006970'
  secondary: '#d8b9ff'
  on-secondary: '#450086'
  secondary-container: '#6e06d0'
  on-secondary-container: '#d5b5ff'
  tertiary: '#d1fff5'
  on-tertiary: '#003731'
  tertiary-container: '#56f0da'
  on-tertiary-container: '#006b5f'
  error: '#ffb4ab'
  on-error: '#690005'
  error-container: '#93000a'
  on-error-container: '#ffdad6'
  primary-fixed: '#7df4ff'
  primary-fixed-dim: '#00dbe9'
  on-primary-fixed: '#002022'
  on-primary-fixed-variant: '#004f54'
  secondary-fixed: '#eddcff'
  secondary-fixed-dim: '#d8b9ff'
  on-secondary-fixed: '#290055'
  on-secondary-fixed-variant: '#6200bc'
  tertiary-fixed: '#62fae3'
  tertiary-fixed-dim: '#3cddc7'
  on-tertiary-fixed: '#00201c'
  on-tertiary-fixed-variant: '#005047'
  background: '#111318'
  on-background: '#e2e2e8'
  surface-variant: '#333539'
typography:
  display-lg:
    fontFamily: Space Grotesk
    fontSize: 48px
    fontWeight: '700'
    lineHeight: '1.1'
    letterSpacing: -0.02em
  headline-md:
    fontFamily: Space Grotesk
    fontSize: 32px
    fontWeight: '600'
    lineHeight: '1.2'
  headline-sm:
    fontFamily: Space Grotesk
    fontSize: 24px
    fontWeight: '600'
    lineHeight: '1.3'
  body-lg:
    fontFamily: Inter
    fontSize: 18px
    fontWeight: '400'
    lineHeight: '1.6'
  body-md:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: '400'
    lineHeight: '1.6'
  code-md:
    fontFamily: Space Grotesk
    fontSize: 14px
    fontWeight: '400'
    lineHeight: '1.5'
  label-caps:
    fontFamily: Space Grotesk
    fontSize: 12px
    fontWeight: '700'
    lineHeight: '1'
    letterSpacing: 0.05em
rounded:
  sm: 0.125rem
  DEFAULT: 0.25rem
  md: 0.375rem
  lg: 0.5rem
  xl: 0.75rem
  full: 9999px
spacing:
  base: 8px
  xs: 4px
  sm: 12px
  md: 24px
  lg: 48px
  xl: 80px
  container-max: 1440px
  gutter: 24px
---

## Brand & Style

This design system is engineered for high-stakes technical environments. It targets developers and engineers who value precision, performance, and a "focused" atmosphere. The aesthetic is inspired by modern Integrated Development Environments (IDEs) and advanced AI interfaces, prioritizing visual clarity and technical sophistication over playfulness.

The visual style is a hybrid of **Minimalism** and **Glassmorphism**. It utilizes a dark-first architectural approach to reduce eye strain during long coding sessions, accented by high-energy neon highlights that signal interactivity and state changes. The atmosphere is intended to feel premium and "pro-grade," evoking the sensation of working within a cutting-edge command center.

## Colors

The palette is anchored in a deep, layered dark theme. The base is a "Total Black" navy (#0A0C10) for maximum contrast, while the surface layer uses a slightly lighter charcoal (#121721) to define structural containers. 

Accents are used sparingly but with high impact:
- **Neon Cyan (#00F0FF):** Used for primary actions, success states, and progress indicators.
- **Electric Purple (#9D50FF):** Reserved for advanced features, AI-driven insights, and secondary branding elements.
- **Soft Teal (#2DD4BF):** Applied to informative badges, validation states, and supportive UI elements.

Semantic colors (Success, Warning, Error) should maintain high saturation to remain legible against the dark background.

## Typography

The typography strategy balances technical precision with editorial authority. 

**Space Grotesk** is used for headlines and labels to provide a geometric, futuristic feel that mirrors engineering schematics. It should be used for data points and headers to reinforce the high-tech narrative.

**Inter** is utilized for all body copy and prose. Its neutral, systematic design ensures readability for long problem descriptions and technical documentation. 

For actual code blocks, a monospaced font is mandatory to maintain vertical alignment of characters. Headlines should use tight tracking and bold weights to command attention, while body copy maintains generous line height for clarity.

## Layout & Spacing

This design system employs a **Fixed Grid** model within a maximum 1440px container for marketing and dashboard views, switching to a **Fluid Grid** for the actual interview IDE interface to maximize screen real estate.

The rhythm is based on an **8px linear scale**. Use 24px (md) for standard component margins and 48px (lg) for section spacing. In the IDE view, spacing should be condensed to 12px (sm) and 16px to mimic the information density found in professional developer tools. 

Layouts should be strictly structured, utilizing a 12-column grid to ensure all technical elements are perfectly aligned, conveying a sense of order and reliability.

## Elevation & Depth

Depth is achieved through **Glassmorphism** and tonal layering rather than traditional drop shadows. 

1.  **Base Layer:** The deepest background (#0A0C10).
2.  **Surface Layer:** Semi-transparent charcoal with a 12px-24px backdrop blur (e.g., `rgba(18, 23, 33, 0.8)`).
3.  **Accent Elevation:** Interactive elements feature a **Subtle Glow**. This is a 1px solid border with 20% opacity of the accent color, accompanied by a very soft outer glow (spread 10px, opacity 0.1) of the same color.

When an element is hovered, the border opacity increases and the backdrop blur intensifies, creating a "lifting" effect. High-priority cards use an abstract grid pattern background at 5% opacity to add texture without distracting from the content.

## Shapes

The shape language is "Hard-Soft." Elements use **sharp, precise corners** with minimal rounding to maintain a serious, architectural feel. 

- **Base Radius:** 4px (applied to inputs, small buttons, and tags).
- **Container Radius:** 8px (applied to cards, modals, and primary layout sections).
- **Interactive States:** Hovering over elements should never change the border radius, only the border intensity and internal fill. 

Avoid circles or large pills unless specifically used for status indicators. The goal is to feel constructed and industrial, not organic.

## Components

### Buttons
Primary buttons use a solid Neon Cyan fill with black text for maximum visibility. Secondary buttons utilize a "Ghost" style: transparent background, 1px Cyan border, and Cyan text. On hover, they gain a subtle outer glow.

### Cards & Containers
Cards must use the glassmorphic style. This includes a 1px border (`rgba(255, 255, 255, 0.1)`) and a backdrop-filter blur. For technical content, cards can include a "Scanning" animation or a subtle top-border accent in Electric Purple.

### Inputs & Editors
Input fields are dark with monospaced text. The active state is signaled by a Neon Cyan bottom border and a subtle inner glow. Error states replace Cyan with a high-saturation Red, maintaining the same glow properties.

### Chips & Badges
Small, rectangular badges with 2px corner radius. Use the "Label Caps" typography style. Backgrounds should be low-opacity versions of the accent colors (e.g., 10% Cyan) with 100% opacity text.

### Code Blocks
The core of the platform. Use a custom syntax highlighting theme that matches the primary/secondary/tertiary colors. The container should have a "copy" button that only appears on hover to keep the interface clean.

### Navigation
Vertical sidebars are preferred to mimic IDE structures. Icons should be thin-stroke (1.5px) and linear, avoiding filled states unless active.