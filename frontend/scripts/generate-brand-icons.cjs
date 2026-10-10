// Regenerate app icons from the supplied SVG; no design changes or external calls.
const fs = require("node:fs");
const path = require("node:path");
const sharp = require("sharp");

async function main() {
  const directory = path.resolve(__dirname, "../public/icons");
  const source = path.join(directory, "evacurosa.svg");
  const svg = fs.readFileSync(source, "utf8");
  if (
    /<(script|foreignObject|image)\b|\bon\w+\s*=|\b(?:href|src)\s*=|url\(|<!ENTITY/i.test(
      svg,
    )
  ) {
    throw new Error(
      "The brand SVG must be self-contained, without scripts or external resources.",
    );
  }
  console.log(svg.match(/<svg[^>]*>/)?.[0]);
  console.log(
    "SVG elements:",
    [
      ...new Set([...svg.matchAll(/<([a-zA-Z][\w:-]*)\b/g)].map((m) => m[1])),
    ].join(", "),
  );
  // Match the artwork's corner color when padding to square icon sizes.
  const corner = await sharp(source)
    .extract({ left: 0, top: 0, width: 1, height: 1 })
    .removeAlpha()
    .raw()
    .toBuffer();
  const background = { r: corner[0], g: corner[1], b: corner[2], alpha: 1 };
  for (const [name, size] of [
    ["evacurosa-32.png", 32],
    ["evacurosa-180.png", 180],
    ["evacurosa-192.png", 192],
    ["evacurosa-512.png", 512],
  ]) {
    await sharp(source, { density: 192 })
      .resize(size, size, { fit: "contain", background })
      .flatten({ background })
      .png()
      .toFile(path.join(directory, name));
  }
  // Keep the entire mark inside the maskable icon's central safe circle.
  const mark = await sharp(source, { density: 192 })
    .resize(280, 280, { fit: "contain", background })
    .png()
    .toBuffer();
  await sharp({ create: { width: 512, height: 512, channels: 4, background } })
    .composite([{ input: mark, gravity: "centre" }])
    .png()
    .toFile(path.join(directory, "evacurosa-512-maskable.png"));
  console.log("Generated favicon, Apple touch and PWA icons.");
}
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
