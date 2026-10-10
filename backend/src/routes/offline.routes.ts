import { Router } from "express";
import {
  getOfflineGraphResponse,
  getOfflineSnapshot,
} from "../services/offlineRouting.service";

export const offlineRouter = Router();
offlineRouter.get("/snapshot", async (_req, res) => {
  res.setHeader("Cache-Control", "no-store");
  res.json(await getOfflineSnapshot());
});
offlineRouter.get("/graph", (req, res) => {
  const graph = getOfflineGraphResponse();
  res.setHeader("ETag", `"${graph.version}"`);
  res.setHeader("Cache-Control", "public, max-age=0, must-revalidate");
  res.setHeader("Vary", "Accept-Encoding");
  if (req.headers["if-none-match"] === `"${graph.version}"`) {
    res.status(304).end();
    return;
  }
  res.type("application/json");
  if (req.acceptsEncodings("gzip")) {
    res.setHeader("Content-Encoding", "gzip");
    res.send(graph.gzip);
  } else res.send(graph.json);
});
