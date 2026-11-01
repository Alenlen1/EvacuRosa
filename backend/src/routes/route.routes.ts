import { Router } from "express";
import { postRoute } from "../controllers/route.controller";
import { publicComputeLimiters } from "../middleware/publicComputeLimit.middleware";

export const routeRouter = Router();

routeRouter.post("/", publicComputeLimiters.routing, postRoute);
