# Admin login photos

The admin login uses these three local photos:

- `flood.jpeg` — people walking through the flooded street
- `fire-enhanced.webp` — AI-enhanced waterfront fire image for the slideshow
- `earthquake.jpg` — the damaged building

The slideshow uses local assets, advances every 10 seconds, and crossfades
under a transparent maroon gradient. Keep these filenames when replacing a
photo, or update the paths in `LoginSlideshow.tsx` to match the new files.

Use the pause button to stop the slideshow or the three indicators to choose
a photo. Reduced motion preferences pause automatic playback and disable the
fade. Playback also pauses while the browser tab is hidden.

## Fire image enhancement

`fire.jpg` is the unchanged 545 × 366 source. The slideshow uses a 1531 × 1027
restoration produced with the built-in imagegen tool and encoded as WebP for
delivery. AI enhancement reconstructs detail; the original is retained here.

Final edit prompt:

> Use case: identity-preserve. Asset type: website login slideshow photograph.
> Edit target: the provided low-resolution waterfront fire photograph. Primary
> request: carefully restore and upscale this exact photograph to approximately
> 2048 pixels wide at its original landscape aspect ratio, reducing JPEG
> artifacts and blur and improving natural photographic clarity for a desktop
> background. Preserve the original framing and composition, every person's
> position, appearance, clothing and pose, the raft, the water, the stilt houses,
> roof shapes, fire and smoke arrangement, original colors and lighting. Do not
> add, remove or move people, objects or buildings. Improve only image fidelity
> and resolution; avoid invented prominent features, exaggerated flames, plastic
> skin, halos, oversharpening, illustration or stylization. Do not add any text,
> logo, watermark, tint or red overlay; the website applies its own overlay.
