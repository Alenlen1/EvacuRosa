import { Router } from "express";
import {
  postAssistance,
  getTrackedAssistance,
  cancelTrackedAssistance,
  publicAssistanceEvents,
  recoverTrackedAssistance,
  allowSubmission,
} from "../controllers/assistance.controller";
export const assistanceRouter = Router();
assistanceRouter.post("/", postAssistance);
assistanceRouter.use((req, res, next) => {
  if (!allowSubmission(`tracking:${req.ip ?? "unknown"}`, Date.now(), 3000)) {
    res.setHeader("Cache-Control", "private, no-store");
    res
      .status(429)
      .json({
        error:
          "Too many status checks. Please wait briefly before reconnecting.",
      });
    return;
  }
  next();
});
assistanceRouter.post("/:id/recover", recoverTrackedAssistance);
assistanceRouter.get("/:id/events", publicAssistanceEvents);
assistanceRouter.get("/:id", getTrackedAssistance);
assistanceRouter.post("/:id/cancel", cancelTrackedAssistance);
