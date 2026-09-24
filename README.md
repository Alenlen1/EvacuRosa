# EvacuRosa

EvacuRosa is a multi-hazard evacuation decision-support web application for Santa Rosa City, Laguna, Philippines. It combines a fuzzy-logic risk assessment engine with A* pathfinding to recommend safer routes and available evacuation centers based on road conditions, active hazards, distance, and evacuation-center availability.

The system is designed as a responsive web application with support for desktop and mobile browsers. It also includes offline viewing for previously cached hazard and evacuation-center data through IndexedDB and PWA support.

EvacuRosa is a decision-support system. It does not guarantee that a route is completely safe and should not replace official emergency instructions from the City Disaster Risk Reduction and Management Office (CDRRMO), barangay officials, or other authorized emergency agencies.

---

## Key Features

### Public Map and Routing

- Interactive Santa Rosa City map using Leaflet and OpenStreetMap.
- Browser geolocation for the user's current location.
- Tap the map to select a destination.
- Safer-route calculation using hybrid fuzzy logic and A*.
- Route distance reporting.
- Route risk-level reporting.
- Detection of affected or restricted road segments.
- Automatic nearest evacuation-center recommendation.
- Evacuation centers are filtered based on availability and occupancy.
- Route recommendations consider risk as well as physical distance.

### Multi-Hazard Support

EvacuRosa currently models three hazard types:

- Flood
- Fire
- Earthquake

Flood reports can include:

- Severity
- Water level
- Road affected
- Road impassability
- Active/inactive status
- Barangay association
- Notes

Fire incidents can include:

- Severity
- Location
- Influence radius
- Confirmed blocked roads
- Active/inactive status
- Barangay association
- Notes

Earthquake information includes:

- Event location
- Magnitude
- Depth
- Occurrence time
- External event ID
- Source
- Review status
- CDRRMO-verified road impacts

### Administration

The system supports two administrative roles:

#### BARANGAY_ADMIN

Barangay administrators can manage evacuation-center occupancy for their assigned barangay.

#### SUPER_ADMIN

The super administrator represents citywide/CDRRMO-level management and can manage:

- Flood reports
- Fire incidents
- Earthquake road impacts
- Citywide evacuation-center management

The admin dashboard includes map-based evacuation-center management and a hazard-placement map.

### Offline Support

The frontend caches the following data in IndexedDB:

- Evacuation centers
- Flood reports
- Fire incidents
- Earthquake events
- Earthquake road impacts

When the network is unavailable, the application can display previously cached data together with its last-updated timestamp.

Route calculation remains online-only because the routing engine runs on the backend.

### PWA Support

The frontend includes:

- Web app manifest
- PWA icons
- Service worker
- App-shell caching
- Mobile-friendly layout

The service worker intentionally does not cache API responses or admin pages. Hazard and evacuation-center offline data is handled through IndexedDB instead.

---

## System Architecture

EvacuRosa uses a monorepo containing separate frontend and backend applications.

```text
EvacuRosa/
├── frontend/                  # Next.js web application
│   ├── src/
│   │   ├── app/               # Public and admin pages
│   │   ├── components/        # Map and UI components
│   │   ├── hooks/             # Geolocation and online-status hooks
│   │   ├── lib/               # Supabase, map, and offline utilities
│   │   └── services/          # Frontend API client
│   └── public/                # PWA manifest, service worker, icons
│
├── backend/                   # Express + TypeScript API
│   ├── src/
│   │   ├── algorithms/
│   │   │   ├── astar/         # A* road-network pathfinding
│   │   │   └── fuzzy/         # Fuzzy inference engine
│   │   ├── controllers/       # HTTP request handlers
│   │   ├── database/          # Supabase server client
│   │   ├── data/              # Generated OpenStreetMap road graph
│   │   ├── middleware/        # Authentication, roles, errors
│   │   ├── routes/            # Express API routes
│   │   ├── services/          # Routing, hazards, evacuation logic
│   │   └── types/             # TypeScript domain types
│   └── scripts/               # Road and earthquake data utilities
│
├── supabase/
│   ├── migrations/             # Database schema and RLS policies
│   └── seed.sql                # Barangay reference data
│
└── package.json
```

---

## Technology Stack

### Frontend

- Next.js 16
- React 19
- TypeScript
- Tailwind CSS 4
- Leaflet
- React Leaflet
- Lucide React
- Supabase JavaScript client
- Vitest

### Backend

- Node.js 24+
- Express 5
- TypeScript
- Supabase JavaScript client
- Vitest
- TSX

### Database and Authentication

- Supabase
- PostgreSQL
- Supabase Auth
- PostgreSQL Row Level Security

### Mapping

- Leaflet
- OpenStreetMap road/map data

---

## Hybrid Fuzzy Logic and A* Routing

The core routing process combines fuzzy risk evaluation with A* pathfinding.

```text
User location
     |
     v
Destination / evacuation center
     |
     v
Find nearest road-graph nodes
     |
     v
Load current hazard information
     |
     +--------------------+
     |                    |
     v                    v
Flood reports       Fire incidents
     |                    |
     +----------+---------+
                |
                v
       Verified earthquake
          road impacts
                |
                v
        Fuzzy risk engine
                |
                v
      Risk score for each edge
                |
                v
        Risk-weighted A*
                |
                v
          Selected route
                |
                v
     Route risk + distance
```

### A* Pathfinding

The A* implementation is located in:

```text
backend/src/algorithms/astar/
```

The algorithm uses:

```text
f(n) = g(n) + h(n)
```

where:

- `g(n)` is the accumulated routing cost.
- `h(n)` is the straight-line distance heuristic.
- The edge cost can include hazard risk.
- Blocked roads are excluded from traversal.

The road graph supports:

- Road nodes
- Road edges
- Bidirectional traversal
- Road status overrides
- Nearest-node lookup
- Nearest-road lookup
- Spatial indexing for faster nearest-node searches

The backend requires the generated Santa Rosa OpenStreetMap road graph and fails clearly if it is missing.

---

## Fuzzy Logic Engine

The fuzzy-logic implementation is located in:

```text
backend/src/algorithms/fuzzy/
```

The system uses overlapping membership functions instead of simple hard thresholds.

Current fuzzy inputs include:

- Flood water level
- Fire severity
- Road condition
- Distance
- Hazard exposure
- Verified earthquake impact

Risk levels are:

```text
VERY_LOW
LOW
MODERATE
HIGH
VERY_HIGH
```

### Membership Functions

The engine uses:

- Triangular membership functions
- Trapezoidal membership functions

This allows a value to partially belong to neighboring categories.

For example, a flood water level can have partial membership in both `MODERATE` and `HIGH` instead of being forced into only one category.

### Fuzzy Rules

The project currently contains 18 fuzzy rules.

Examples include:

```text
IF flood is HIGH AND road condition is POOR
THEN risk is VERY_HIGH

IF flood is SEVERE
THEN risk is VERY_HIGH

IF road condition is POOR
THEN risk is at least MODERATE

IF earthquake impact is HIGH
THEN risk is at least HIGH
```

The inference process:

1. Fuzzification
2. Rule evaluation
3. Mamdani-style minimum composition
4. Max-membership defuzzification
5. Conversion to a risk score

---

## Risk-Weighted A*

The system does not use physical distance as the only routing cost.

Each road edge receives a fuzzy risk result and a risk-weighted cost.

The current formula is:

```text
cost = distance × (1 + RISK_WEIGHT × normalizedRisk)
```

The current implementation uses:

```text
RISK_WEIGHT = 2
```

Therefore, higher-risk road segments become more expensive to A* without automatically being treated as completely blocked.

This allows the router to choose a longer route when it provides a lower risk score, while explicitly blocked roads remain unavailable.

The actual physical distance returned by the route is calculated from the road-edge distances, independently of the risk-weighted search cost.

---

## Hazard Handling Rules

### Flood

Flood severity contributes to fuzzy risk.

A road is hard-blocked only when the flood report explicitly marks the road as impassable.

A severe flood does not automatically make a road completely blocked.

```text
Flood report
    |
    +-- road_impassable = true  -> BLOCKED
    |
    +-- otherwise                -> FLOODED + fuzzy risk
```

### Fire

Fire risk is calculated using the distance between the fire incident and road segments.

The system uses point-to-segment proximity rather than only checking a road midpoint.

Fire risk decreases with distance from the incident.

A road is hard-blocked only when an administrator explicitly confirms the road as blocked.

### Earthquake

Earthquake handling is intentionally stricter.

Raw earthquake magnitude, depth, and geographic proximity do not automatically modify routing.

Only a CDRRMO-verified road impact can affect the route.

Verified earthquake impacts can:

- Increase fuzzy risk
- Mark a road as blocked when `confirmedBlocked` is true

This prevents an earthquake event from automatically declaring nearby roads unsafe without human verification.

---

## Evacuation-Center Recommendation

The endpoint:

```text
POST /api/evacuation-route
```

evaluates available evacuation centers.

Centers that are full or closed are excluded.

For each remaining center:

1. Calculate a route from the user's location.
2. Evaluate route distance.
3. Evaluate route risk.
4. Calculate a risk-weighted candidate score.
5. Compare candidates.
6. Return the selected evacuation center and route.

The candidate score follows the same risk-weighting concept used by the routing engine:

```text
score = distance × (1 + RISK_WEIGHT × normalizedRisk)
```

This prevents the recommendation from being based only on which evacuation center is geographically closest.

---

## Data Sources

Evacuation centers and hazard records come from Supabase. When Supabase is
not configured, those endpoints return empty collections; the application
does not invent operational data.

Routing uses the generated Santa Rosa road graph from OpenStreetMap.

Run:

```powershell
npm run fetch:roads --workspace=backend
```

The backend loads the generated road graph after restart.

---

## Earthquake Data

The project includes a script for obtaining earthquake data:

```powershell
npm run fetch:earthquakes --workspace=backend
```

The earthquake integration uses USGS as the external earthquake data provider.

The project does not automatically treat raw earthquake data as a confirmed road hazard. Routing changes require an explicit verified road-impact record.

---

## Supabase Setup

Supabase is required for:

- Real evacuation-center persistence
- Admin authentication
- Admin updates
- Hazard persistence
- Role-based access
- Row Level Security

Create a Supabase project and run the migrations in this order:

```text
supabase/migrations/0001_evacuation_centers.sql
supabase/migrations/0002_flood_reports.sql
supabase/migrations/0003_fire_incidents.sql
supabase/migrations/0004_earthquake_events.sql
supabase/migrations/0005_unique_constraints.sql
supabase/migrations/0006_citywide_evacuation_admin.sql
supabase/migrations/0007_remove_placeholder_data.sql
supabase/migrations/0008_superadmin_delete_earthquake_events.sql
supabase/migrations/0009_barangay_only_center_management.sql
```

Seed the official barangay reference list:

```text
supabase/seed.sql
```

For detailed database setup, see:

```text
supabase/README.md
```

---

## Environment Variables

### Frontend

Create:

```text
frontend/.env.local
```

based on:

```text
frontend/.env.example
```

Example:

```env
NEXT_PUBLIC_API_URL=http://localhost:4000
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
```

### Backend

Create:

```text
backend/.env
```

based on:

```text
backend/.env.example
```

Example:

```env
PORT=4000
ALLOWED_ORIGINS=http://localhost:3000

SUPABASE_URL=
SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
```

Never place `SUPABASE_SERVICE_ROLE_KEY` in frontend environment variables.

The service-role key must remain on the backend.

---

## Installation

### Requirements

Install:

- Node.js 24 or newer
- npm
- Git
- A modern web browser

Verify Node.js:

```powershell
node --version
```

Verify npm:

```powershell
npm --version
```

### Install Dependencies

From the project root:

```powershell
npm install
```

Because the repository uses npm workspaces, the root installation installs the frontend and backend dependencies.

---

## Running the Application

### Start the Frontend

From the project root:

```powershell
npm run dev:frontend
```

Frontend:

```text
http://localhost:3000
```

### Start the Backend

Open another PowerShell terminal:

```powershell
npm run dev:backend
```

Backend:

```text
http://localhost:4000
```

Health check:

```text
http://localhost:4000/api/health
```

Both frontend and backend should be running at the same time for route calculation.

---

## Useful Development Commands

### Frontend

```powershell
npm run dev --workspace=frontend
npm run build --workspace=frontend
npm run start --workspace=frontend
npm run test --workspace=frontend
```

### Backend

```powershell
npm run dev --workspace=backend
npm run build --workspace=backend
npm run start --workspace=backend
npm run test --workspace=backend
```

### Fetch Real Road Data

```powershell
npm run fetch:roads --workspace=backend
```

### Fetch Earthquake Data

```powershell
npm run fetch:earthquakes --workspace=backend
```

---

## API Endpoints

### Health

```http
GET /api/health
```

Checks whether the backend is running.

### Routing

```http
POST /api/route
```

Request:

```json
{
  "start": {
    "latitude": 14.2691,
    "longitude": 121.1115
  },
  "destination": {
    "latitude": 14.2840,
    "longitude": 121.1090
  }
}
```

Returns:

- Route coordinates
- Physical distance
- Number of affected road segments
- Risk level
- Warnings
- Update timestamp

### Evacuation Routing

```http
POST /api/evacuation-route
```

Request:

```json
{
  "start": {
    "latitude": 14.2691,
    "longitude": 121.1115
  }
}
```

Returns:

- Recommended evacuation center
- Route coordinates
- Distance
- Route risk level
- Warnings
- Last update timestamp

### Evacuation Centers

```http
GET /api/evacuation-centers
```

Returns available evacuation-center information.

### Flood Reports

```http
GET /api/floods
```

Returns active flood reports.

### Fire Incidents

```http
GET /api/fires
```

Returns active fire incidents.

### Earthquakes

```http
GET /api/earthquakes
```

Returns earthquake events and verified earthquake-road impacts.

### Nearby Roads

```http
GET /api/roads/nearest?lat=<latitude>&lng=<longitude>&limit=3
```

Finds roads near a selected map location.

### Admin Endpoints

Authenticated endpoints include:

```text
PUT    /api/admin/evacuation-centers/:id

POST   /api/admin/floods
PUT    /api/admin/floods/:id
DELETE /api/admin/floods/:id

POST   /api/admin/fires
PUT    /api/admin/fires/:id
DELETE /api/admin/fires/:id

PUT    /api/admin/earthquakes/:id

POST   /api/admin/earthquake-road-impacts
DELETE /api/admin/earthquake-road-impacts/:id
```

Authentication uses a Supabase access token.

Role restrictions are enforced through backend middleware.

---

## Authentication and Authorization

The backend uses:

```text
Supabase Auth
        |
        v
Bearer access token
        |
        v
requireAuth middleware
        |
        v
Profile lookup
        |
        v
Role authorization
```

The two supported roles are:

```text
BARANGAY_ADMIN
SUPER_ADMIN
```

Evacuation-center updates can be performed by authenticated administrators according to their assigned scope and database Row Level Security policies.

Flood, fire, and earthquake management endpoints require:

```text
SUPER_ADMIN
```

The service-role Supabase key is used only by the backend and must never be exposed to the browser.

---

## Offline Behavior

When online:

```text
API
 |
 v
Frontend
 |
 v
IndexedDB cache
```

When offline:

```text
IndexedDB cache
 |
 v
Frontend
 |
 v
Cached hazard and center information
```

The interface displays an offline indicator and the age of cached information.

The application does not pretend that cached information is current.

Route calculation is disabled while offline because A* runs on the backend and there is no client-side copy of the complete routing engine.

---

## Testing

The repository contains automated tests for:

- A* pathfinding
- Weighted routing
- Blocked roads
- Unreachable routes
- Nearest-road calculations
- Fuzzy membership functions
- Fuzzy rule evaluation
- Defuzzification
- Risk-weighted routing
- Flood handling
- Fire handling
- Earthquake handling
- Evacuation-center filtering
- Evacuation-center ranking
- Authentication middleware
- Role middleware
- Offline cache fallback

The current source tree contains 63 individual `it`/`test` cases across the backend and frontend test files.

Run backend tests:

```powershell
npm run test --workspace=backend
```

Run frontend tests:

```powershell
npm run test --workspace=frontend
```

For manual testing requirements and limitations, see:

```text
TESTING.md
```

Important functionality still benefits from testing against a real Supabase project and a real mobile/browser environment, particularly:

- Supabase Row Level Security
- Supabase Auth login
- Admin persistence
- IndexedDB browser behavior
- PWA installation
- Production deployment

---

## Deployment

The intended deployment architecture is:

```text
User
 |
 v
Vercel
Next.js Frontend
 |
 v
Render or Railway
Express Backend
 |
 v
Supabase
PostgreSQL + Auth
```

### Frontend

Recommended deployment target:

```text
Vercel
```

Set the frontend root directory to:

```text
frontend
```

Configure:

```env
NEXT_PUBLIC_API_URL=<backend-url>
NEXT_PUBLIC_SUPABASE_URL=<supabase-url>
NEXT_PUBLIC_SUPABASE_ANON_KEY=<supabase-anon-key>
```

### Backend

Recommended deployment targets:

```text
Render
```

or:

```text
Railway
```

Set the backend root directory to:

```text
backend
```

Configure:

```env
SUPABASE_URL=<supabase-url>
SUPABASE_ANON_KEY=<supabase-anon-key>
SUPABASE_SERVICE_ROLE_KEY=<service-role-key>
ALLOWED_ORIGINS=<frontend-url>
```

For the full deployment procedure, see:

```text
DEPLOYMENT.md
```

---

## Project Limitations

The following limitations should be understood before presenting EvacuRosa as a production emergency system:

1. The system is a decision-support tool and cannot guarantee route safety.
2. Route quality depends on the availability and accuracy of road-network data.
3. Hazard information is only as current as the reports or external data available to the system.
4. Offline mode can display cached information but cannot calculate a new backend route.
5. Earthquake routing changes require explicit human verification of road impacts.
6. The development road graph is not suitable for real-world routing until real OpenStreetMap road data has been generated.
7. Supabase is required for real authenticated administration and persistent hazard/center management.
8. Fire proximity is modeled as a risk factor and does not automatically block roads.
9. Flood severity does not automatically block a road unless the report explicitly marks it as impassable.
10. The current fuzzy membership thresholds and risk weight are modeling parameters that should be validated and tuned using domain expertise and project evaluation results.

---

## Security Notes

- Never commit `.env` or `.env.local` files containing real credentials.
- Never expose `SUPABASE_SERVICE_ROLE_KEY` to the frontend.
- Use Supabase Row Level Security for database-level authorization.
- Keep `ALLOWED_ORIGINS` restricted to the actual frontend origins in production.
- Enter only verified evacuation-center and hazard data.
- Do not use the application as a replacement for official emergency response instructions.

---

## Map and Data Attribution

EvacuRosa uses Leaflet for interactive map rendering and OpenStreetMap data for the road network and map information.

When deploying or distributing the application, retain the required OpenStreetMap attribution and comply with the applicable OpenStreetMap data usage and attribution requirements.

---

## Project Documentation

Additional documentation is available in:

```text
supabase/README.md
TESTING.md
DEPLOYMENT.md
```

These documents contain database setup, testing details, and deployment instructions respectively.

---

## Development Status

The current implementation includes:

- Public evacuation map
- Browser geolocation
- Destination selection
- A* routing
- Fuzzy risk assessment
- Risk-weighted routing
- Flood hazard handling
- Fire hazard handling
- Earthquake event and verified road-impact handling
- Evacuation-center recommendation
- Occupancy-based center filtering
- Admin authentication
- Role-based administration
- Map-based hazard placement
- IndexedDB offline caching
- PWA support
- Automated tests
- Deployment configuration

The application should still be treated as a capstone/research prototype until its data sources, fuzzy parameters, routing behavior, security configuration, and deployment environment have been formally validated for the intended real-world use case.
