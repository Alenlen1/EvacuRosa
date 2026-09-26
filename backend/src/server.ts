import express from "express";
import cors from "cors";
import { env } from "./config/environment";
import { healthRouter } from "./routes/health.routes";
import { routeRouter } from "./routes/route.routes";
import { evacuationCentersRouter } from "./routes/evacuationCenters.routes";
import { evacuationRouteRouter } from "./routes/evacuationRoute.routes";
import { floodRouter } from "./routes/flood.routes";
import { fireRouter } from "./routes/fire.routes";
import { earthquakeRouter } from "./routes/earthquake.routes";
import { roadRouter } from "./routes/road.routes";
import { adminRouter } from "./routes/admin.routes";
import { errorHandler } from "./middleware/error.middleware";
import { postAssistance } from "./controllers/assistance.controller";

const app = express();

app.use(
  cors({
    origin: env.allowedOrigins,
  })
);
app.use(express.json());

app.use("/api/health", healthRouter);
app.use("/api/route", routeRouter);
app.use("/api/evacuation-centers", evacuationCentersRouter);
app.use("/api/evacuation-route", evacuationRouteRouter);
app.use("/api/floods", floodRouter);
app.use("/api/fires", fireRouter);
app.use("/api/earthquakes", earthquakeRouter);
app.use("/api/roads", roadRouter);
app.use("/api/admin", adminRouter);
app.post("/api/assistance-requests", postAssistance);

app.use(errorHandler);

app.listen(env.port, () => {
  console.log(`EvacuRosa backend listening on http://localhost:${env.port}`);
});

export default app;
