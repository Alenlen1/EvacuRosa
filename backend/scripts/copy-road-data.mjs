import { copyFile, mkdir } from "node:fs/promises";
await mkdir("dist/data", { recursive: true });
await copyFile(
  "src/data/santaRosaRoadGraph.json",
  "dist/data/santaRosaRoadGraph.json",
);
