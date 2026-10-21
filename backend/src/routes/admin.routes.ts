import { Router } from "express";
import {
  deleteAssistance,
  listAssistance,
  updateAssistanceStatus,
  adminAssistanceEvents,
  getAdminAssistance,
} from "../controllers/assistance.controller";
import { requireAuth } from "../middleware/auth.middleware";
import { attachProfile, requireRole } from "../middleware/role.middleware";
import {
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

import {
  listBarangays,
  signInBarangay,
} from "../controllers/barangayAccess.controller";
import {
  listAdminCenters,
  createCenter,
  updateCenter,
  deleteCenter,
} from "../controllers/centerManagement.controller";

export const adminRouter = Router();
adminRouter.get("/barangays", listBarangays);
adminRouter.post("/barangay-login", signInBarangay);
adminRouter.get(
  "/evacuation-centers",
  requireAuth,
  attachProfile,
  requireRole("SUPER_ADMIN", "BARANGAY_ADMIN"),
  listAdminCenters,
);
adminRouter.post(
  "/evacuation-centers",
  requireAuth,
  attachProfile,
  requireRole("SUPER_ADMIN"),
  createCenter,
);
adminRouter.delete(
  "/evacuation-centers/:id",
  requireAuth,
  attachProfile,
  requireRole("SUPER_ADMIN"),
  deleteCenter,
);
adminRouter.get(
  "/assistance-requests/events",
  requireAuth,
  attachProfile,
  requireRole("SUPER_ADMIN"),
  adminAssistanceEvents,
);
adminRouter.get(
  "/assistance-requests/:id",
  requireAuth,
  attachProfile,
  requireRole("SUPER_ADMIN"),
  getAdminAssistance,
);
adminRouter.patch(
  "/assistance-requests/:id",
  requireAuth,
  attachProfile,
  requireRole("SUPER_ADMIN"),
  updateAssistanceStatus,
);
adminRouter.get(
  "/assistance-requests",
  requireAuth,
  attachProfile,
  requireRole("SUPER_ADMIN"),
  listAssistance,
);
adminRouter.delete(
  "/assistance-requests/:id",
  requireAuth,
  attachProfile,
  requireRole("SUPER_ADMIN"),
  deleteAssistance,
);

adminRouter.put(
  "/evacuation-centers/:id",
  requireAuth,
  attachProfile,
  requireRole("BARANGAY_ADMIN", "SUPER_ADMIN"),
  updateCenter,
);

// Flood, fire, and earthquake data are all citywide/CDRRMO-managed —
// SUPER_ADMIN only, unlike evacuation centers which barangay admins can
// also touch.
adminRouter.post(
  "/floods",
  requireAuth,
  attachProfile,
  requireRole("SUPER_ADMIN"),
  createFloodReport,
);
adminRouter.put(
  "/floods/:id",
  requireAuth,
  attachProfile,
  requireRole("SUPER_ADMIN"),
  updateFloodReport,
);
adminRouter.delete(
  "/floods/:id",
  requireAuth,
  attachProfile,
  requireRole("SUPER_ADMIN"),
  deleteFloodReport,
);

adminRouter.post(
  "/fires",
  requireAuth,
  attachProfile,
  requireRole("SUPER_ADMIN"),
  createFireIncident,
);
adminRouter.put(
  "/fires/:id",
  requireAuth,
  attachProfile,
  requireRole("SUPER_ADMIN"),
  updateFireIncident,
);
adminRouter.delete(
  "/fires/:id",
  requireAuth,
  attachProfile,
  requireRole("SUPER_ADMIN"),
  deleteFireIncident,
);

adminRouter.put(
  "/earthquakes/:id",
  requireAuth,
  attachProfile,
  requireRole("SUPER_ADMIN"),
  updateEarthquakeEvent,
);
adminRouter.delete(
  "/earthquakes/:id",
  requireAuth,
  attachProfile,
  requireRole("SUPER_ADMIN"),
  deleteEarthquakeEvent,
);
adminRouter.post(
  "/earthquake-road-impacts",
  requireAuth,
  attachProfile,
  requireRole("SUPER_ADMIN"),
  createEarthquakeRoadImpact,
);
adminRouter.delete(
  "/earthquake-road-impacts/:id",
  requireAuth,
  attachProfile,
  requireRole("SUPER_ADMIN"),
  deleteEarthquakeRoadImpact,
);
