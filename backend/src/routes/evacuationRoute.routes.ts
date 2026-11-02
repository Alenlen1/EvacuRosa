import { Router } from "express";
import { postEvacuationRoute } from "../controllers/evacuationRoute.controller";
import { publicComputeLimiters } from "../middleware/publicComputeLimit.middleware";

export const evacuationRouteRouter = Router();

evacuationRouteRouter.post(
  "/",
  publicComputeLimiters.routing,
  postEvacuationRoute,
);
