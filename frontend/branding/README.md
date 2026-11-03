# EvacuRosa logo

`evacurosa-original.png` is the artwork supplied by the project owner as
`Red Shelter Location Icon (1).png`. The original is preserved without design
changes, including its background, colors, and proportions.

`evacurosa-clean.png` is the production source. The built-in imagegen tool replaced
the black outer canvas with warm white while preserving the white rounded tile
and logo artwork. The final source is opaque; the website frames it with rounded
corners. The original artwork remains unchanged in `evacurosa-original.png`.

The final edit prompt is recorded in [logo-edit-prompt.txt](logo-edit-prompt.txt).

Regenerate the optimized header, browser, Apple touch, and installed-app icons
for both frontends from the repository root:

```powershell
node frontend/scripts/generate-brand-icons.cjs
```

The header uses a 128-pixel asset instead of downloading the full original.
Dedicated Android maskable icons use the full canvas, with an opaque background
and no additional inset. The shelter pin, family and siren stay within the central
safe circle (40% radius); decorative landscape can be cropped by the launcher.
Both 192-pixel and 512-pixel Android icons are declared separately from regular
icons in the public manifest. This follows the
[maskable icon guidance](https://web.dev/articles/maskable-icon).

Do not shrink the whole logo to fit the entire tile inside that safe circle:
that adds padding around padding and makes the installed icon look too small.

The old seal assets remain available separately; application branding uses the
`evacurosa-shelter-clean-*.png` files, with `evacurosa-android-*.png` for Android
launchers. New Android filenames and the public app's versioned shell cache
prevent the old padded Android icon from being reused.
