import { Router } from "express";
import { publicComputeLimiters } from "../middleware/publicComputeLimit.middleware";
import {
  getNearestRoads,
  getRoadSection,
  getEarthquakeArea,
} from "../controllers/road.controller";

export const roadRouter = Router();

// Public and read-only — road geometry isn't sensitive, and this is what
// lets the admin hazard-placement map turn "clicked here" into "nearest
// road is X" without anyone needing to know or type a raw roadId.
roadRouter.get("/nearest", publicComputeLimiters.roadPreview, getNearestRoads);
roadRouter.get("/section", publicComputeLimiters.roadPreview, getRoadSection);
roadRouter.get(
  "/earthquake-area",
  publicComputeLimiters.roadPreview,
  getEarthquakeArea,
);
