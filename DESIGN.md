# Flowvero AI Lead Dashboard Design System & Tokens

This document serves as the visual source of truth (extracted from the Stitch project "Flowvero AI Lead Dashboard") for the **Flowvero Lead Dashboard** application.

---

## 🎨 Theme & Color Palette

The visual style is a **Corporate / Modern minimalism** focusing on high-fidelity utility and high-density information without cognitive overload. It uses a **Deep Emerald** primary core, signaling growth and financial health, combined with a high-contrast neutral scale for accessibility.

### 1. Color Palette (Fidelity Light Mode)
*   **Primary (Green)**: `#005f3c` / `#0f7a4f`
*   **Secondary (Purple)**: `#712ae2` / `#8a4cfc`
*   **Tertiary (Red/Rust)**: `#8b383b` / `#a94f52`
*   **Background (Canvas)**: `#f9f9ff`
*   **On-Background (Text Primary)**: `#141b2b`
*   **Page Background**: `#F6F7FB`
*   **Card Background**: `#FFFFFF`
*   **Border**: `#E5E7EB`
*   **Text Muted**: `#6B7280`

### 2. Functional & Status Accents
*   **Success**: `#10B981` (Interested / Booked)
*   **Warning**: `#F59E0B` (Follow Up)
*   **Danger**: `#EF4444` (Not Interested)
*   **Status Orange**: `#F97316` (Wrong Number)
*   **Brand Blue**: `#2563EB` (Called)
*   **Brand Purple**: `#7C3AED` (New)

### 3. Surface & Depth Levels
*   **Level 0 (Canvas)**: `#F6F7FB` background.
*   **Level 1 (Cards)**: Pure white `#FFFFFF` with a 1px solid border (`#E5E7EB`). Soft ambient shadow: `0px 1px 3px rgba(0,0,0,0.05)`.
*   **Level 2 (Overlays/Filters)**: Glassmorphism with background blur of 8px and a 70% opaque white fill.
*   **Level 3 (Popovers/Modals)**: Soft shadow `0px 10px 25px -5px rgba(0,0,0,0.1)`.

---

## 📐 Layout & Spacing

*   **Sidebar Width**: Fixed `260px` sidebar on the left. Uses a 1px border (`#E5E7EB`) on the right rather than a shadow to maintain clean lines.
*   **Container Max Width**: `1440px` for main content grids.
*   **Gutter Spacing**: `24px` page margins.
*   **Grid Gap**: `16px` (1rem) for stat cards and grids.
*   **Section Padding**: `32px` for breathing room around tables.
*   **Border Radius**:
    *   **Main Cards**: `16px` (`rounded-2xl`) for a premium, friendly feel.
    *   **Input Fields & Buttons**: `8px` (`rounded-lg`) for a professional, clickable look.
    *   **Badges/Chips**: Full pill-shape (`rounded-full`) for status indicators.
    *   **Selection States**: `4px` (`rounded-sm`) for row highlights.

---

## ✨ Typography

*   **Primary Font Family**: `'Inter', sans-serif`
*   **Code / Mono Font Family**: `'JetBrains Mono', monospace` (for metadata, IDs, numbers, and timestamps)

### Typography Hierarchy:
*   **Display Large**: `fontSize: 36px`, `fontWeight: 700`, `lineHeight: 44px`, `letterSpacing: -0.02em`
*   **Headline Medium**: `fontSize: 24px`, `fontWeight: 600`, `lineHeight: 32px`, `letterSpacing: -0.01em`
*   **Headline Small**: `fontSize: 18px`, `fontWeight: 600`, `lineHeight: 28px`
*   **Body Large**: `fontSize: 16px`, `fontWeight: 400`, `lineHeight: 24px`
*   **Body Medium**: `fontSize: 14px`, `fontWeight: 400`, `lineHeight: 20px`
*   **Body Small**: `fontSize: 13px`, `fontWeight: 400`, `lineHeight: 18px` (used for lead table rows)
*   **Label Caps**: `fontSize: 12px`, `fontWeight: 600`, `lineHeight: 16px`, `letterSpacing: 0.05em` (uppercase, for headers/categories)
*   **Mono Data**: `fontSize: 13px`, `fontWeight: 400`, `lineHeight: 18px`

---

## 💎 Visual Component Spec

*   **Gradients**:
    *   *Brand Flare*: Linear gradient from `Primary Green` to `Accent Blue` (135deg) for high-level progress bars and primary actions.
    *   *Surface Depth*: Subtle `page-bg` to `White` transitions.
*   **Status Badges**: Soft low-opacity fill (10-15%) with 100% opacity text of the same color (e.g., *New* uses light purple background with dark purple text).
*   **Input Fields**: 1px border with a 2px focus ring using `Accent Blue` at 20% opacity.
*   **AI Action Bar**: Floating bottom bar with a subtle purple glow indicating AI-powered recommendation actions.
