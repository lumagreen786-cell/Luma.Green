---
name: luma-imai-forms
description: Build or redesign login, signup and recycling forms with task grouping, clear choices and recoverable states.
---

# Luma Imai Forms

Use React Hook Form, shared Zod contracts and existing shadcn controls. Group related questions with a visible label; use radio groups for one choice and checkboxes for several. Keep labels visible, connect hints/errors with aria-describedby, and retain keyboard focus. Use 44px minimum controls and 48px primary actions.

A phone prefix and its input read as one field; keep phone digits LTR inside RTL pages. Show the current step, a clear next action and a usable back path. Never hide required fields merely to shorten the form. Keep submission errors next to the action; do not clear values on failure or advance before success. Show honest pending and unavailable states. Public signup and booking can be full pages; do not force IMAI's dialog-only create pattern.

Source: `convex/products/ai/skills/skills/imai_ui/components/forms.md`, `patterns/app-form.md`, and principles/states.md in imai-dev. Replace @imai/ui with local shadcn composition; no IMAI SDK imports.

IMAI dev-studio source revision d66c35ae5f5087cc927cb94c3341df6a461ce546, inspected 15 October 2026. Adapted guidance, not a copy of the IMAI runtime.
