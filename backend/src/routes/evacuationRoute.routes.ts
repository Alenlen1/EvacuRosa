import { Router } from "express";
import { postEvacuationRoute } from "../controllers/evacuationRoute.controller";

export const evacuationRouteRouter = Router();

evacuationRouteRouter.post("/", postEvacuationRoute);
