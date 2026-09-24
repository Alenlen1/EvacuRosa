import { Router } from "express";
import { requireAuth } from "../middleware/auth.middleware";
import { attachProfile, requireRole } from "../middleware/role.middleware";
import {
  updateEvacuationCenter,
  createFloodReport,
  updateFloodReport,
  deleteFloodReport,
  createFireIncident,
  updateFireIncident,
  deleteFireIncident,
  updateEarthquakeEvent,
  deleteEarthquakeEvent,
  createEarthquakeRoadImpact,
  deleteEarthquakeRoadImpact,
} from "../controllers/admin.controller";

export const adminRouter = Router();

adminRouter.put(
  "/evacuation-centers/:id",
  requireAuth,
  attachProfile,
  requireRole("BARANGAY_ADMIN"),
  updateEvacuationCenter
);

// Flood, fire, and earthquake data are all citywide/CDRRMO-managed —
// SUPER_ADMIN only, unlike evacuation centers which barangay admins can
// also touch.
adminRouter.post(
  "/floods",
  requireAuth,
  attachProfile,
  requireRole("SUPER_ADMIN"),
  createFloodReport
);
adminRouter.put(
  "/floods/:id",
  requireAuth,
  attachProfile,
  requireRole("SUPER_ADMIN"),
  updateFloodReport
);
adminRouter.delete(
  "/floods/:id",
  requireAuth,
  attachProfile,
  requireRole("SUPER_ADMIN"),
  deleteFloodReport
);

adminRouter.post(
  "/fires",
  requireAuth,
  attachProfile,
  requireRole("SUPER_ADMIN"),
  createFireIncident
);
adminRouter.put(
  "/fires/:id",
  requireAuth,
  attachProfile,
  requireRole("SUPER_ADMIN"),
  updateFireIncident
);
adminRouter.delete(
  "/fires/:id",
  requireAuth,
  attachProfile,
  requireRole("SUPER_ADMIN"),
  deleteFireIncident
);

adminRouter.put(
  "/earthquakes/:id",
  requireAuth,
  attachProfile,
  requireRole("SUPER_ADMIN"),
  updateEarthquakeEvent
);
adminRouter.delete(
  "/earthquakes/:id",
  requireAuth,
  attachProfile,
  requireRole("SUPER_ADMIN"),
  deleteEarthquakeEvent
);
adminRouter.post(
  "/earthquake-road-impacts",
  requireAuth,
  attachProfile,
  requireRole("SUPER_ADMIN"),
  createEarthquakeRoadImpact
);
adminRouter.delete(
  "/earthquake-road-impacts/:id",
  requireAuth,
  attachProfile,
  requireRole("SUPER_ADMIN"),
  deleteEarthquakeRoadImpact
);
