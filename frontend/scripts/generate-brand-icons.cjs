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
  // Keep the entire mark inside the maskable icon's central safe circle.
  const mark = await sharp(source)
    .resize(280, 280, { fit: "contain", background })
    .png()
    .toBuffer();
  const maskable = await sharp({
    create: { width: 512, height: 512, channels: 4, background },
  })
    .composite([{ input: mark, gravity: "centre" }])
    .png()
    .toBuffer();
  for (const directory of directories)
    fs.writeFileSync(
      path.join(directory, "evacurosa-shelter-clean-512-maskable.png"),
      maskable,
    );
  console.log(
    "Generated matching brand, favicon, Apple touch and PWA icons for both apps.",
  );
}
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
