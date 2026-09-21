import { Router } from "express";
import { getNearestRoads } from "../controllers/road.controller";

export const roadRouter = Router();

// Public and read-only — road geometry isn't sensitive, and this is what
// lets the admin hazard-placement map turn "clicked here" into "nearest
// road is X" without anyone needing to know or type a raw roadId.
roadRouter.get("/nearest", getNearestRoads);
