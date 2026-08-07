# Changelog

## v1.0.7 - 2026-08-07

- Unified the latest local feature implementation with the public-release security hardening.
- Removed maintainer-only signing, certificate, installer, and environment-template tooling from the public source tree.
- Added release-source, SHA-256 verification, and third-party-installer safety guidance.
- Added `SECURITY.md`.
- Updated the dependency lockfile for the release build.

## v1.0.6 - 2026-06-04

- Extended direct Illustrator selection to path, text, placed image, and raster image detection results with target references.
- Improved TextFrame selection by adding a text-range selection fallback.
- Improved text overflow detection so it can detect overset text without relying only on an Illustrator `overflows` property.
- Added a project rule to bump the patch version whenever code fixes, feature additions, or distribution behavior changes are made.

## v1.0.5 - 2026-06-04

- Changed Illustrator object selection so any path-based detection result with a target reference can select the object, regardless of the detection result type.
- Kept delete actions limited to explicitly supported cleanup targets.

## v1.0.4 - 2026-06-04

- Added a settings panel for check options, preview behavior, deletion confirmation, and Acrobat helper actions.
- Added open path and filled open path checks with configurable detection.
- Added target references and Illustrator selection actions for path-based results.
- Added guarded deletion for stray points and unused swatches with re-identification and failure reasons.
- Added guide and trim-mark-layer inclusion toggles while preserving the default exclusion behavior.

## v1.0.3 - 2026-06-03

- Excluded Illustrator guide path items from shared path-based checks.
- Added preview zoom controls, keyboard zoom/pan, full-view reset, and selected-result navigation.
- Added messageKey-level result filtering in addition to severity filtering.
- Kept preview background and overlay geometry on the same SVG surface while zooming.

## v1.0.2 - 2026-06-01

- Prevented build-time environment references from leaking into the CEP runtime bundle.
- Reduced CEP startup Node.js imports to the modules used by the panel.
- Added Adobe Acrobat Reader fallback when Adobe Acrobat cannot be opened.
- Added sanitized ZXP staging and stricter distribution verification for debug artifacts, source maps, runtime config references, and absolute user paths.

## v1.0.0 - 2026-05-29

Initial stable release.

- Added Illustrator preflight checks for common print-data issues.
- Added grouped result navigation with collapsible accordions.
- Added result filtering by severity.
- Added on-canvas preview overlays for detected objects.
- Added Acrobat TAC handoff workflow with confirmation before saving.
- Added temporary Acrobat-check PDF cleanup.
- Added in-panel status notifications for checking, completion, TAC export, and cleanup.
- Revised result hint text to avoid brittle Illustrator menu-path instructions.
