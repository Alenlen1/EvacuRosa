import { UsgsEarthquakeProvider } from "../src/integrations/earthquake/usgsEarthquakeProvider";
import { upsertEarthquakeEvents } from "../src/services/earthquake.service";

/**
 * Pulls recent Philippine-region earthquakes from USGS and upserts them
 * into Supabase (deduped by externalEventId — see earthquake.service.ts).
 * Requires SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in backend/.env; run
 * this periodically (e.g. a scheduled job) once that's set up, not on
 * every request — earthquake events don't need per-request freshness the
 * way a route request does.
 */
async function main() {
  console.log("Fetching recent Philippine-region earthquakes from USGS...");

  const provider = new UsgsEarthquakeProvider();
  const events = await provider.fetchRecentEarthquakes();

  console.log(`Fetched ${events.length} events from USGS.`);

  const { inserted, updated } = await upsertEarthquakeEvents(events);
  console.log(`Inserted ${inserted} new event(s), updated ${updated} existing event(s).`);
  console.log(
    "New events default to status UNREVIEWED and have zero effect on routing until CDRRMO records a verified road impact for them."
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
