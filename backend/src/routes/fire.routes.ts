import { Router } from "express";
import { listFireIncidents } from "../controllers/fire.controller";

export const fireRouter = Router();

fireRouter.get("/", listFireIncidents);
