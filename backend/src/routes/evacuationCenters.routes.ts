import { Router } from "express";
import { listEvacuationCenters } from "../controllers/evacuation.controller";

export const evacuationCentersRouter = Router();

evacuationCentersRouter.get("/", listEvacuationCenters);
