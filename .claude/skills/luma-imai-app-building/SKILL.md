---
name: luma-imai-app-building
description: Build complete Luma web workflows with real data, scoped access and explicit verification limits.
---

# Luma Imai App Building

Trace user action → validated server call → persisted record → visible result. Reuse existing Convex functions and permission owners; an attractive screen must not create a second workflow. Show people by display name, never internal IDs. Unknown values stay unavailable rather than becoming invented zeros. Keep money in paise and mass in grams.

Handle loading, empty, failed, denied, pending and completed states where applicable. Preserve phone OTP and TOTP requirements. Optional services stay off without configuration. Before release, run the repository checks and exercise the actual affected journey; separate mocked tests, real provider acceptance and deployment. No app init/app publish commands, @imai/sdk, IMAI harness or connector setup belongs in Luma.

Source: `convex/products/ai/skills/skills/app_building/quality.md`, principles/data.md and components/sdk.md in imai-dev. Native apps remain on hold.

IMAI dev-studio source revision d66c35ae5f5087cc927cb94c3341df6a461ce546, inspected 15 October 2026. Adapted guidance, not a copy of the IMAI runtime.
