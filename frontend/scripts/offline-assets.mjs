import { readdir, writeFile } from "node:fs/promises";
import path from "node:path";

const root = path.resolve(".next/static");
async function collect(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const assets = await Promise.all(
    entries.map(async (entry) => {
      const file = path.join(directory, entry.name);
      if (entry.isDirectory()) return collect(file);
      if (!/\.(js|css|woff2?)$/.test(entry.name)) return [];
      return [
        "/_next/static/" + path.relative(root, file).split(path.sep).join("/"),
      ];
    }),
  );
  return assets.flat();
}
await writeFile(
  "public/offline-assets.json",
  JSON.stringify({ assets: await collect(root) }),
);
