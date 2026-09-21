import { Router } from "express";
import { listFloodReports } from "../controllers/flood.controller";

export const floodRouter = Router();

floodRouter.get("/", listFloodReports);
