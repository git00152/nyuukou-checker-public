# Nyuukou Checker (Print-Ready File Checker)

[日本語](README.md) | English

A CEP panel for Adobe Illustrator that checks the quality of files before they are sent to print. It detects issues such as text not converted to outlines, low image resolution, and insufficient bleed, and shows them as overlays on a preview and in a result list.

> [!IMPORTANT]
> This project is an independent personal project. It is not affiliated with, endorsed by, or maintained by Adobe, its affiliates, or my employer.

Adobe and Illustrator are either registered trademarks or trademarks of Adobe in the United States and/or other countries.

> [!NOTE]
> The panel's user interface is currently available in Japanese only, and its check criteria assume Japanese print production practices (for example, 3 mm bleed). Panel labels below are given in Japanese with an English description.

Current version: v1.1.2

## Requirements

| Item | Requirement |
|------|-------------|
| Adobe Illustrator | Configured for 25.3 or later. Verify on the Illustrator version you use before distributing. |
| OS | macOS |
| CEP version | 11.0+ |
| TAC check | Adobe Acrobat Pro recommended |

## Distribution and verification

The signed ZXP for v1.1.2 is distributed only through this repository's GitHub Releases.

- Release: <https://github.com/git00152/nyuukou-checker-public/releases/tag/v1.1.2>
- File: `nyuukou-checker-v1.1.2.zxp`
- SHA-256: `b7f919b33b31cdfce523994fca05ef4b304b9b7b1154149950498a2c29003e00`

The ZXP in this release is signed with a self-signed certificate. It is not a trusted signature from a certificate authority, so a warning may appear in some environments.

After downloading, check that the file matches the value listed in the release.

```bash
shasum -a 256 nyuukou-checker-v1.1.2.zxp
```

The hash confirms that the downloaded file is identical to the one published on the release page. Do not run or install files obtained anywhere other than the release page.

The current source contains no telemetry, and the extension does not update, download, or install anything by itself. Illustrator files and temporary previews and PDFs are handled locally, only when you take an action.

## Installation

### Install the ZXP file

Download `nyuukou-checker-v1.1.2.zxp` from GitHub Releases and install it as follows.

1. Quit Adobe Illustrator completely.
2. Launch ZXP Installer.
3. Drag and drop `nyuukou-checker-v1.1.2.zxp` onto ZXP Installer.
4. If you are asked for a password or permission, follow the macOS prompts.
5. When installation finishes, launch Adobe Illustrator.
6. Open **Window > Extensions > 入稿データチェッカー**.

### If you do not have ZXP Installer yet

ZXP Installer is a third-party application and is not bundled with this project. Obtain and install it according to its provider's official instructions.

1. Open <https://aescripts.com/learn/zxp-installer/> and confirm the provider.
2. Download and install the macOS version of ZXP Installer.
3. Drag and drop `nyuukou-checker-v1.1.2.zxp` onto the ZXP Installer window.

If macOS shows a security warning and you cannot confirm the provider or the legitimacy of the file, stop the installation instead of disabling the protection.

### Uninstall

Use ZXP Installer's uninstall function. To remove it manually, delete this folder:

```text
~/Library/Application Support/Adobe/CEP/extensions/com.git00152.nyuukochecker
```

## Usage

1. Open the Illustrator file you want to check.
2. Click **チェック実行** (Run check) in the panel.
3. Results are shown in three levels: **要修正** (Must fix), **要確認** (Review), and **参考** (Info). These correspond to the internal severities ERROR / WARNING / INFO.
4. Use the severity buttons and **項目…** (Items…) to filter the results.
5. You can zoom the preview in and out, view it at 100%, fit it to the panel, and move to the selected item.
6. Expand a result group to see the impact and how to fix it. Click an item to highlight its location on the preview.
7. Use the settings button at the top right to switch large-format print mode, detection targets, and behavior settings.
8. The panel's colors follow the brightness of Illustrator's User Interface preference.

### Submission profile (CMYK / RGB)

Before running a check, use the CMYK / RGB switch at the top of the panel to choose the criteria that match your print provider. The selected profile is kept the next time the panel starts.

- **CMYK入稿** (CMYK submission, default): Checks against common criteria for CMYK print submissions.
- **RGB入稿** (RGB submission): Checks against criteria for submitting in RGB (sRGB / Adobe RGB), such as RGB printing services offered by some Japanese print providers.
  - ERROR if the document color mode is not RGB, because a CMYK document does not benefit from RGB printing.
  - RGB, grayscale, and monochrome images are not errors. CMYK images are WARNING; anything else (indexed color, Lab, and so on) is ERROR.
  - Total ink coverage (over 350%), decimal CMYK values, and the TAC check in Acrobat are skipped.

Color profiles embedded in images (for example, a mix of sRGB and Adobe RGB) are not checked at this time. Confirm separately that they match the color space you choose when ordering.

### Check scope and reviewing results

Checks on the position of paths, text, and images apply only to the selected artboard. If the document has several artboards, switch the tab above the preview before running the check. Document color mode, rasterize effects, and hidden layers are checked as common checks, and hidden objects are limited to the selected artboard. Document-wide checks such as unused swatches are not run automatically by the current artboard check.

**すべて表示** (Show all) clears the filters. The panel distinguishes between "no results match the filter" and "nothing was detected." If some checks fail, a warning is shown on completion, and if you change the check settings, the panel prompts you to run the check again.

Placed AI, PDF, EPS, and SVG files can contain vector art or several images, so their resolution is not judged from the placement matrix alone; resolution is shown as a manual check. Bleed and safe-zone checks are estimates based on bounding boxes and do not guarantee the printed result with clipping, transparency, or overlaps.

### Large-format print mode

For large-format print files, turn on **大判印刷モード** (Large-format print mode) in the settings panel before running the check. The image resolution criteria are relaxed for large-format printing, and 200 dpi or more but less than 300 dpi is treated as INFO.

### Settings panel

The settings panel lets you choose whether to detect open paths, open paths with a fill, and trim mark layers, whether the preview moves automatically when you select a result, and whether to confirm before deleting. Guides are always excluded from checks. Changes to check settings take effect from the next **チェック実行** (Run check). Display and behavior settings take effect immediately.

### Selecting targets and safe deletion

For some results, **編集画面で選択** (Select in document) in the card selects the target object in Illustrator. For safety, deletion is limited to stray points. Just before deleting, the panel identifies and checks the target again, and does not delete it if the target cannot be found, more than one candidate remains, or the target is locked.

Unused swatches are only detected; the panel does not delete them. It cannot detect spot colors used in additional appearance fills or inside patterns, and deleting a spot color that is in use converts it to a process color. To clean them up, use **Select All Unused** in the Swatches panel menu.

### TAC check in Acrobat

**AcrobatでTAC確認** (Check TAC in Acrobat) saves the current AI file, saves a temporary PDF for checking in Acrobat, and opens it in Adobe Acrobat. If Adobe Acrobat cannot be opened, it also tries Adobe Acrobat Reader.

The current method uses Illustrator's Save As, so the save location of the document you are working on switches to the temporary PDF. To keep editing after the check, reopen the original AI file.

This feature does not fully evaluate total ink coverage within the extension. Check TAC that involves images and overlaps in the Output Preview of Acrobat Pro.

When you no longer need the temporary PDF, delete it with **一時PDFを削除** (Delete temporary PDF).

## Checks

| Category | Check | Severity |
|----------|-------|----------|
| Text | Live text not converted to outlines | ERROR |
| Path | Empty path (no fill, no stroke) | WARNING |
| Path | Stray point | WARNING |
| Path | Thin line (under 0.28 pt) | WARNING |
| Path | Open path | WARNING |
| Path | Open path with a fill | WARNING |
| Path | Text overflow | ERROR |
| Layer | Hidden layer | WARNING |
| Layer | Hidden object | WARNING |
| Image | Insufficient resolution (under 300 dpi) | ERROR |
| Image | Resolution caution (300 dpi or more, under 350 dpi) | WARNING |
| Image | Resolution caution in large-format mode (200 dpi or more, under 300 dpi) | INFO |
| Image | Resolution unavailable | INFO |
| Image | Missing link | ERROR |
| Image | Placed image other than CMYK / grayscale / monochrome (CMYK submission) | ERROR |
| Image | Placed image other than RGB / grayscale / monochrome (RGB submission) | ERROR |
| Image | CMYK images mixed in (RGB submission) | WARNING |
| Image | Color mode could not be detected | INFO |
| Image | Insufficient rasterize effect resolution | WARNING |
| Color | Document color mode (RGB or other in CMYK submission) | ERROR |
| Color | Document color mode (CMYK or other in RGB submission) | ERROR |
| Color | CMYK total over 350% (path fills and strokes) | WARNING |
| Color | Decimal CMYK values | INFO |
| Color | Unintended overprint | WARNING |
| Color | Overprint on white objects (CMYK 0% / gray 0% / spot 0%) | ERROR |
| Color | Registration color used outside trim marks | ERROR |
| Color | Unused spot color swatch (document-wide check; not run by the current artboard check) | INFO |
| Color | Spot color in use | WARNING |
| Bleed | Insufficient bleed (does not reach 3 mm) | WARNING |
| Bleed | Safe-zone violation | WARNING |

## Development

```bash
npm install
npm run build
npm test
```

See `package.json` for the available scripts.

## Support Policy

This repository is a personal project. Responses to issues and pull requests, and ongoing maintenance, are not guaranteed.

## License

MIT
