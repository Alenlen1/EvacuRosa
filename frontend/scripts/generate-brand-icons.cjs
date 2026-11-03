// Resize the cleaned artwork for both apps; no design changes or external calls.
const fs = require("node:fs");
const path = require("node:path");
const sharp = require("sharp");

async function main() {
  const source = path.resolve(__dirname, "../branding/evacurosa-clean.png");
  const directories = [
    path.resolve(__dirname, "../public/icons"),
    path.resolve(__dirname, "../../admin-frontend/public/icons"),
  ];
  const background = "#fffdf9";
  for (const directory of directories)
    fs.mkdirSync(directory, { recursive: true });

  for (const [name, size] of [
    ["evacurosa-shelter-clean-32.png", 32],
    ["evacurosa-shelter-clean-128.png", 128],
    ["evacurosa-shelter-clean-180.png", 180],
    ["evacurosa-shelter-clean-192.png", 192],
    ["evacurosa-shelter-clean-512.png", 512],
  ]) {
    const icon = await sharp(source)
      .resize(size, size, { fit: "contain", background: "transparent" })
      .png()
      .toBuffer();
    for (const directory of directories)
      fs.writeFileSync(path.join(directory, name), icon);
  }
  // Android supplies the launcher mask. Fill its canvas rather than shrinking
  // the complete rounded tile into another padded tile. The pin, family and
  // siren fit within the central safe circle (radius: 40% of the canvas);
  // the landscape outside that circle can be cropped by launcher shapes.
  for (const size of [192, 512]) {
    const maskable = await sharp(source)
      .resize(size, size, { fit: "cover" })
      .flatten({ background })
      .png()
      .toBuffer();
    for (const directory of directories)
      fs.writeFileSync(
        path.join(directory, `evacurosa-android-${size}.png`),
        maskable,
      );
  }
  console.log(
    "Generated matching brand, favicon, Apple touch and PWA icons for both apps.",
  );
}
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
