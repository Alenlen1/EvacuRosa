import { Router } from "express";
import { postRoute } from "../controllers/route.controller";

export const routeRouter = Router();

routeRouter.post("/", postRoute);
