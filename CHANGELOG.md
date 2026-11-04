# Changelog

## v1.1.2 - 2026-11-04

- Redesigned the panel UI to read as part of Illustrator: colors now follow Illustrator's user interface brightness (four levels) and update when it changes, instead of a fixed navy theme.
- Merged the severity summary tiles and severity filter into one row; the completion notice no longer repeats counts.
- Moved settings into a separate view opened from the header. Settings that change results are labeled "次のチェックから反映". Large print mode is shown next to the CMYK / RGB selector when enabled.
- Replaced result cards with dense rows. The impact and fix text is shown once per check group in an inset box with 影響 / 対処 tags, and each row shows object and layer names (plus the item's own message when it differs, e.g. dpi values).
- Shows severities as 要修正 / 要確認 / 参考 with distinct shapes (● ▲ ○). Internal severity values and message keys are unchanged.
- Combined notices into a single status line next to the check button; errors remain a separate alert.
- Replaced text toolbar buttons in the preview with icons and themed the preview canvas.
- Fixed garbled Japanese messages from the host script (e.g. the saved-version notice) by escaping all non-ASCII characters in the bundled jsx, which ExtendScript does not read as UTF-8 without a BOM. A test keeps the built bundle ASCII-only.

## v1.1.1 - 2026-11-04

- Added an always-visible submission profile selector (CMYK / RGB). The RGB profile targets RGB printing services such as Graphic's RGB print (sRGB / Adobe RGB).
- RGB profile: requires an RGB document (`COLOR_DOC_MODE_RGB_01`), accepts RGB / grayscale / bitmap images, warns on CMYK images (`IMG_COLOR_SPACE_CMYK_IN_RGB_01`), errors on other image modes (`IMG_COLOR_SPACE_RGB_01`), and skips ink-total / CMYK-decimal checks and the Acrobat TAC helper.
- Settings, including the selected profile, are now persisted across panel restarts.
- Fixed resolution detail texts that did not match the actual thresholds (ERROR < 300dpi, WARNING < 350dpi, large print < 200dpi).
- Applied the selected submission profile to per-artboard checks as well as the legacy whole-document check.
- Fixed the host script failing to load in Illustrator (`SyntaxError: Expected: :`) by removing a nested conditional and an object literal in a conditional true branch, and added a syntax guard test for the bundled host script.

## v1.1.0 - 2026-09-18

- Added metadata-only multi-artboard tabs with lazy, per-artboard scanning and cached results.
- Added active-artboard-safe preview export and stale-scan protection for target actions.
- Improved trim-mark scoping and bleed evaluation, including interval coverage, guide exclusion, and large-print Information handling.
- Added saved-version checking with an explicit adapter boundary; unknown host compatibility metadata is reported as Information rather than inferred.
- Updated the reviewed specification and distribution metadata for the 1.1.0 release.
- Stopped offering swatch deletion from the panel, because spot colors used in appearance fills, patterns, or symbols cannot be detected and deleting an in-use spot swatch converts it to process color.
- Limited unused swatch detection to spot swatches and counted spot colors used in live text characters and gradient stops as in use.
- Added detection of registration color used outside trim marks.
- Treated gray 0% and spot tint 0% as white for white overprint detection, and corrected the README severity for white overprint to ERROR.

## v1.0.8 - 2026-09-08 (release preparation)

- Collect checker inputs in one shared traversal, with UUID-based deduplication where available.
- Correct PNG color detection, missing-link checks, and transformed image DPI thresholds; reuse linked-image color reads within each scan.
- Report unknown DPI for placed vector containers and isolate scope-filter failures.
- Distinguish filtered-empty results and partial failures; add filter reset, recheck guidance, keyboard access, and narrow-panel layout.
- Serialize panel operations and reject target actions after switching documents.
- See [the refactoring report](docs/refactoring-2026-09-08.md) for validation and limitations.

## v1.0.7 - 2026-08-07

- Unified the latest local feature implementation with the public-release security hardening.
- Added confirmation, backup, staged replacement, and restoration to the private development installer.
- Removed signing, certificate, installer, and environment-template tooling from the public source tree.
- Added public distribution guidance, SHA-256 verification instructions, and `SECURITY.md`.
- Updated the dependency lockfiles for the release build.

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
