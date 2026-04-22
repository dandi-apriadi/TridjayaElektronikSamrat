# UI/UX Pro Max - Master Design Principles

This document serves as the high-fidelity design intelligence for the Tridjaya Samrat project. All UI components and layouts generated must adhere to these standards.

## 1. Pixel Perfection & Spacing
- **Rule of 8/4**: Use 8pt (0.5rem) or 4pt (0.25rem) increments for all spacing, padding, and margins.
- **Micro-alignment**: Ensure all text, icons, and containers are optically centered and aligned.
- **Consistent Radius**: Use a fixed set of border-radii (e.g., 8px for buttons, 24-32px for sections/cards).

## 2. Visual Hierarchy (The 6-3-1 Rule)
- **60% Primary Surface**: Neutral, breathable whitespace (Warm Mist #F2F2F2).
- **30% Secondary Layer**: Tonal surface layering (Elevated glass panels, subtle shadows).
- **10% Accent**: Precise use of Sophisticated Indigo (#3F51B5) or Electric Cyan for high-impact CTA and indicators.

## 3. Motion & Interactivity (Framer Motion)
- **Entrance**: Use staggered entry animations for grid items (Initial: y: 20, opacity: 0; Animate: y: 0, opacity: 1).
- **Hover**: Subtle scaling (1.02x) and shadow elevation changes on interactive cards.
- **Scroll**: Implement scroll-triggered reveals for long-page engagement.
- **Transitions**: Ease-in-out quint or spring config for natural movement.

## 4. Typography Scale
- **Display**: Space Grotesk, 700+ weight, tracking -0.05em (for Hero titles).
- **Body**: Manrope, 400-500 weight, line-height 1.6 (for readability).
- **Micro-copy**: Uppercase, tracking 0.2em, font-weight 800 (for labels/tags).

## 5. Glassmorphism & Tonal Layering
- **No-Line Rule**: Avoid 1px borders unless strictly necessary for contrast. Use backdrop-blur (16px-64px) and subtle variations in background alpha to define containers.
- **Tonal Shadows**: Use soft, colored shadows (e.g., indigo shadows for indigo buttons) to create depth without "dirty" gray shadows.

## 6. Accessibility (WCAG AA)
- Minimum contrast ratio 4.5:1 for body text.
- Focus states must be visible and distinct.
- Interactive elements must have unique, descriptive IDs.
