import type { Response } from "express";
import type { RoleAwareRequest } from "../middleware/role.middleware";
import { barangayForEntrance } from "../geography/barangayBoundary";
import { isInsideSantaRosa } from "../geography/santaRosa";
import { deriveStatus } from "../services/evacuation.service";

const metadataFields = [
  "barangayId",
  "name",
  "address",
  "latitude",
  "longitude",
  "capacity",
  "contactInformation",
  "notes",
];
const centerRecordFields =
  "id,barangay_id,name,address,latitude,longitude,capacity,current_occupancy,status,contact_information,notes,created_at,updated_at,updated_by";
export function centerUpdates(
  body: unknown,
  superAdmin: boolean,
): Record<string, unknown> {
  if (!body || typeof body !== "object" || Array.isArray(body))
    throw new Error("Provide center details.");
  const values = body as Record<string, unknown>;
  const allowed = superAdmin ? metadataFields : ["currentOccupancy", "status"];
  if (Object.keys(values).some((key) => !allowed.includes(key)))
    throw new Error("This account cannot update these fields.");
  const updates: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(values)) {
    if (["currentOccupancy", "capacity"].includes(key)) {
      if (
        !Number.isSafeInteger(value) ||
        (value as number) < 0 ||
        (value as number) > 1_000_000
      )
        throw new Error(
          "Occupancy and capacity must be nonnegative whole numbers up to 1000000.",
        );
      updates[key === "capacity" ? "capacity" : "current_occupancy"] = value;
    } else if (key === "status") {
      if (value !== "AVAILABLE" && value !== "CLOSED")
        throw new Error(
          "Select accepting IDPs or closed. Fullness is calculated from occupancy.",
        );
      updates.status = value;
    } else if (key === "barangayId") {
      if (typeof value !== "string" || !/^[0-9a-f-]{36}$/i.test(value))
        throw new Error("Select a barangay.");
      updates.barangay_id = value;
    } else if (key === "latitude" || key === "longitude") {
      if (typeof value !== "number" || !Number.isFinite(value))
        throw new Error("Provide valid coordinates.");
      updates[key] = value;
    } else {
      if (
        typeof value !== "string" ||
        value.length > (key === "notes" ? 3000 : 500) ||
        (["name", "address"].includes(key) && !value.trim())
      )
        throw new Error("Provide a valid center name, address and details.");
      updates[key === "contactInformation" ? "contact_information" : key] =
        value.trim();
    }
  }
  if (!Object.keys(updates).length) throw new Error("No fields were provided.");
  return updates;
}
export async function listAdminCenters(req: RoleAwareRequest, res: Response) {
  if (
    !req.userSupabase ||
    !req.profile ||
    (req.profile.role === "BARANGAY_ADMIN" && !req.profile.barangay_id)
  ) {
    res.status(403).json({ error: "A valid barangay assignment is required." });
    return;
  }
  let query = req.userSupabase
    .from("evacuation_centers")
    .select(`${centerRecordFields},barangays(name)`)
    .order("name");
  if (req.profile.role === "BARANGAY_ADMIN")
    query = query.eq("barangay_id", req.profile.barangay_id);
  const { data, error } = await query;
  if (error) {
    res.status(503).json({ error: "Could not load assigned centers." });
    return;
  }
  let barangayName: string | null = null;
  if (req.profile.barangay_id) {
    const { data: barangay, error: barangayError } = await req.userSupabase
      .from("barangays")
      .select("name")
      .eq("id", req.profile.barangay_id)
      .maybeSingle();
    if (!barangayError) barangayName = barangay?.name ?? null;
  }
  res.setHeader("Cache-Control", "no-store");
  res.json({
    centers: (data ?? []).map((row) => ({
      ...row,
      status: deriveStatus(row.current_occupancy, row.capacity, row.status),
    })),
    profile: {
      role: req.profile.role,
      barangay_id: req.profile.barangay_id,
      barangay_name: barangayName,
    },
  });
}
async function verifyEntranceBarangay(
  req: RoleAwareRequest,
  updates: Record<string, unknown>,
  latitude: number,
  longitude: number,
  existingBarangayId?: string,
) {
  const selectedId = updates.barangay_id ?? existingBarangayId;
  if (typeof selectedId !== "string")
    throw new Error(
      "Select an assigned barangay before choosing the entrance.",
    );
  const name = barangayForEntrance(latitude, longitude);
  const { data, error } = await req
    .userSupabase!.from("barangays")
    .select("id")
    .eq("name", name)
    .maybeSingle();
  if (error || !data)
    throw new Error(
      "Could not verify the entrance barangay. Reload and try again.",
    );
  if (selectedId.toLowerCase() !== data.id.toLowerCase())
    throw new Error(
      `This entrance is in ${name}. Select an entrance inside the assigned barangay.`,
    );
  updates.barangay_id = data.id;
}
export async function createCenter(req: RoleAwareRequest, res: Response) {
  if (!req.userSupabase || req.profile?.role !== "SUPER_ADMIN") {
    res.status(403).json({ error: "CDRRMO access required." });
    return;
  }
  let updates: Record<string, unknown>;
  try {
    updates = centerUpdates(req.body, true);
    if (
      ["name", "address", "latitude", "longitude", "capacity"].some(
        (key) => updates[key] === undefined,
      )
    )
      throw new Error("Name, address, coordinates and capacity are required.");
    if (
      !isInsideSantaRosa(
        updates.latitude as number,
        updates.longitude as number,
      )
    )
      throw new Error("Select a location inside Santa Rosa City.");
    await verifyEntranceBarangay(
      req,
      updates,
      updates.latitude as number,
      updates.longitude as number,
    );
  } catch (error) {
    res.status(400).json({ error: (error as Error).message });
    return;
  }
  const { data, error } = await req.userSupabase
    .from("evacuation_centers")
    .insert({
      ...updates,
      current_occupancy: 0,
      status: "AVAILABLE",
      updated_by: req.profile.id,
    })
    .select(centerRecordFields)
    .single();
  if (error) {
    res.status(error.code === "23505" ? 409 : 400).json({
      error:
        error.code === "23505"
          ? "A center with this name already exists in that barangay."
          : "Could not register the center. Check its details and database setup.",
    });
    return;
  }
  res.status(201).json({ center: data });
}
export async function updateCenter(req: RoleAwareRequest, res: Response) {
  const { profile, userSupabase: client } = req;
  if (
    !client ||
    !profile ||
    (profile.role === "BARANGAY_ADMIN" && !profile.barangay_id)
  ) {
    res
      .status(403)
      .json({ error: "An authorized, assigned account is required." });
    return;
  }
  let updates: Record<string, unknown>;
  try {
    updates = centerUpdates(req.body, profile.role === "SUPER_ADMIN");
  } catch (error) {
    res.status(400).json({ error: (error as Error).message });
    return;
  }
  let existing = client
    .from("evacuation_centers")
    .select("id,barangay_id,latitude,longitude,capacity,current_occupancy")
    .eq("id", req.params.id);
  if (profile.role === "BARANGAY_ADMIN")
    existing = existing.eq("barangay_id", profile.barangay_id);
  const { data: center, error: readError } = await existing.maybeSingle();
  if (readError || !center) {
    res.status(404).json({ error: "Center not found in your workspace." });
    return;
  }
  if (
    ((updates.current_occupancy ?? center.current_occupancy) as number) >
    ((updates.capacity ?? center.capacity) as number)
  ) {
    res.status(400).json({
      error:
        "Occupancy cannot exceed capacity. Adjust the values before saving.",
    });
    return;
  }
  if (
    !isInsideSantaRosa(
      (updates.latitude ?? center.latitude) as number,
      (updates.longitude ?? center.longitude) as number,
    )
  ) {
    res
      .status(400)
      .json({ error: "Select a location inside Santa Rosa City." });
    return;
  }
  if (profile.role === "SUPER_ADMIN") {
    try {
      await verifyEntranceBarangay(
        req,
        updates,
        (updates.latitude ?? center.latitude) as number,
        (updates.longitude ?? center.longitude) as number,
        center.barangay_id,
      );
    } catch (error) {
      res.status(400).json({ error: (error as Error).message });
      return;
    }
  }
  let query = client
    .from("evacuation_centers")
    .update({ ...updates, updated_by: profile.id })
    .eq("id", req.params.id);
  if (profile.role === "BARANGAY_ADMIN")
    query = query.eq("barangay_id", profile.barangay_id);
  const { data, error } = await query.select(centerRecordFields).single();
  if (error) {
    res.status(error.code === "23505" ? 409 : 403).json({
      error:
        error.code === "23505"
          ? "This center name already exists in the selected barangay."
          : "Update rejected. Refresh the center and check your permissions.",
    });
    return;
  }
  res.json({ center: data });
}
export async function deleteCenter(req: RoleAwareRequest, res: Response) {
  if (!req.userSupabase || req.profile?.role !== "SUPER_ADMIN") {
    res.status(403).json({ error: "CDRRMO access required." });
    return;
  }
  const { data, error } = await req.userSupabase
    .from("evacuation_centers")
    .delete()
    .eq("id", req.params.id)
    .select("id")
    .maybeSingle();
  if (error) {
    res.status(409).json({ error: "Could not delete this center." });
    return;
  }
  if (!data) {
    res.status(404).json({ error: "Center not found." });
    return;
  }
  res.status(204).end();
}
