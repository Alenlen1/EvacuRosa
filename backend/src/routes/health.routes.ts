import { Router } from "express";

export const healthRouter = Router();

healthRouter.get("/", (_req, res) => {
  res.json({
    status: "ok",
    service: "evacurosa-backend",
    phase: "11 - testing + deployment",
    timestamp: new Date().toISOString(),
  });
});
