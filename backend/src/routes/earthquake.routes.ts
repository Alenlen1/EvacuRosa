import { Router } from "express";
import { listEarthquakes } from "../controllers/earthquake.controller";

export const earthquakeRouter = Router();

earthquakeRouter.get("/", listEarthquakes);
