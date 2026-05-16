---
name: Technical Design System
colors:
  surface: '#f9f9ff'
  surface-dim: '#d9d9df'
  surface-bright: '#f9f9ff'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#f3f3f9'
  surface-container: '#ededf3'
  surface-container-high: '#e8e8ee'
  surface-container-highest: '#e2e2e8'
  on-surface: '#1a1c20'
  on-surface-variant: '#3b494b'
  inverse-surface: '#2f3035'
  inverse-on-surface: '#f0f0f6'
  outline: '#6a7a7b'
  outline-variant: '#b9cacb'
  surface-tint: '#006970'
  primary: '#006970'
  on-primary: '#ffffff'
  primary-container: '#00f0ff'
  on-primary-container: '#006970'
  inverse-primary: '#00dbe9'
  secondary: '#7b24dc'
  on-secondary: '#ffffff'
  secondary-container: '#9547f7'
  on-secondary-container: '#fffbff'
  tertiary: '#006b5f'
  on-tertiary: '#ffffff'
  tertiary-container: '#56f0da'
  on-tertiary-container: '#006b5f'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
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
  background: '#f9f9ff'
  on-background: '#1a1c20'
  surface-variant: '#e2e2e8'
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

The visual style is a hybrid of **Minimalism** and **Glassmorphism**. It utilizes a light-first architectural approach to provide a clean, high-clarity workspace, accented by high-energy neon highlights that signal interactivity and state changes. The atmosphere is intended to feel premium and "pro-grade," evoking the sensation of working within a cutting-edge laboratory or a refined white-label command center.

## Colors

The palette is anchored in a crisp, layered light theme. The base is a clean, neutral white, while surface layers use subtle greys and cool-toned whites to define structural containers and logical separation without the weight of heavy shadows.

Accents provide high-contrast focal points:
- **Neon Cyan (#00F0FF):** Used for primary actions, success states, and progress indicators.
- **Electric Purple (#9D50FF):** Reserved for advanced features, AI-driven insights, and secondary branding elements.
- **Soft Teal (#2DD4BF):** Applied to informative badges, validation states, and supportive UI elements.

Semantic colors (Success, Warning, Error) are tuned for maximum legibility against light surfaces, ensuring critical information is never missed.

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

In this light-themed environment, depth is achieved through **tonal layering** and **subtle blurs** rather than heavy shadows, maintaining a "light and airy" technical feel.

1.  **Base Layer:** The primary background, a crisp white or near-white neutral.
2.  **Surface Layer:** Semi-transparent white with a 12px-24px backdrop blur (e.g., `rgba(255, 255, 255, 0.7)`) and a very fine 1px light-grey border.
3.  **Accent Elevation:** Interactive elements feature a **Subtle Glow**. This is a 1px solid border with 30% opacity of the accent color, accompanied by a soft, low-opacity shadow of the same hue to suggest activity.

When an element is hovered, the backdrop blur intensifies and the border contrast increases, creating a "clarity" effect. High-priority cards use an abstract grid pattern background at 3% opacity to add texture without compromising content readability.

## Shapes

The shape language is "Hard-Soft." Elements use **sharp, precise corners** with minimal rounding to maintain a serious, architectural feel. 

- **Base Radius:** 4px (applied to inputs, small buttons, and tags).
- **Container Radius:** 8px (applied to cards, modals, and primary layout sections).
- **Interactive States:** Hovering over elements should never change the border radius, only the border intensity and internal fill. 

Avoid circles or large pills unless specifically used for status indicators. The goal is to feel constructed and industrial, not organic.

## Components

### Buttons
Primary buttons use a solid Neon Cyan fill with dark text for maximum visibility. Secondary buttons utilize a "Ghost" style: transparent background, 1px Cyan border, and Cyan text. On hover, they gain a subtle outer glow and a light cyan tint.

### Cards & Containers
Cards must use the glassmorphic style. This includes a 1px light-grey border and a backdrop-filter blur. For technical content, cards can include a subtle top-border accent in Electric Purple.

### Inputs & Editors
Input fields are light with monospaced text. The active state is signaled by a Neon Cyan bottom border and a very subtle inner tint. Error states replace Cyan with a high-saturation Red, maintaining the same glow properties.

### Chips & Badges
Small, rectangular badges with 2px corner radius. Use the "Label Caps" typography style. Backgrounds should be low-opacity versions of the accent colors (e.g., 15% Cyan) with 100% opacity text.

### Code Blocks
The core of the platform. Use a custom syntax highlighting theme that matches the primary/secondary/tertiary colors, optimized for legibility on a light background.

### Navigation
Vertical sidebars are preferred to mimic IDE structures. Icons should be thin-stroke (1.5px) and linear, avoiding filled states unless active.