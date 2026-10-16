---
name: luma-imai-i18n-review
description: Find untranslated or clipped UI text in Luma forms and controls after a redesign.
---

# Luma Imai I18N Review

Classify static labels, validation messages, hints, action text and aria labels separately from user data. Put static copy in messages/*.json with next-intl; do not copy IMAI's feature-local TypeScript locale maps. Use the single locale registry, locale navigation and shared numeric parsers.

Review English, Kannada, a long translated script such as Tamil, and Arabic/Urdu RTL. Check 320px width, translated action fit, font loading and error wrapping. Never fix clipping by shrinking all text or hiding overflow. Run key-parity and affected flow tests.

Source: `.agents/skills/static-ui-i18n-sweep/SKILL.md` in imai-dev; storage and routing are adapted to Luma.

IMAI dev-studio source revision d66c35ae5f5087cc927cb94c3341df6a461ce546, inspected 15 October 2026. Adapted guidance, not a copy of the IMAI runtime.
