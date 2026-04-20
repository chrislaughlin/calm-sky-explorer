🧭 PRD — “Calm Sky Explorer”
1. Objective

A calming, mobile-first web app that allows users to:

See live air traffic above them
Understand where flights are going
Experience it through a minimal, peaceful UI (Calm Sky Mode)

The app should feel:

✨ Curious, not technical
🧘 Calm, not overwhelming
🌍 Exploratory, not surveillance
2. Core Features
2.1 Live Map (Primary Entry Point)
7

Description

Full-screen map using OpenStreetMap (via Mapbox GL / Leaflet)
User location centered by default
Light, desaturated “calm” theme

Data Sources

Map tiles: OpenStreetMap
Planes: OpenSky Network /states/all (bbox around user)

Rendering

Planes shown as:
✈️ Soft, paper-plane style icons
Direction based on true_track
Smooth, slow movement (interpolated)
2.2 “What’s Above Me?” (Core UX)

Description

Detect and highlight the most relevant plane overhead

Logic

Filter planes by:
Distance from user (lat/lon)
Altitude (ignore very high or very low noise)
Rank by:
Closest horizontal distance
Lowest altitude (more visible)
Direction alignment (optional enhancement)

UI

Floating bottom card:
“✈️ Passing overhead now”
Airline + flight number
Route preview (NUE → GRO style)
2.3 “Where Are They Going?” (Signature Feature)
6

Trigger

Tap plane OR auto-highlight “overhead” plane

Card UI (inspired by your screenshots)

Large, clean card

Route:

LHR → BCN
Labels:
Origin + destination cities
Estimated arrival time
Progress bar (simple line with plane icon)

Enhancements

Destination info:
Weather (optional API)
“Fun fact” (static or AI-generated)
Tone:
“This flight lands in Barcelona in 1h 20m ☀️”
2.4 Calm Sky Mode (Design System)
7

Principles

No harsh radar visuals
No dense data tables
No aggressive animations

Design عناصر

Soft gradients (sky blues, purples)
Glassmorphism cards
Paper plane icons (not realistic aircraft)
Slow easing animations

Typography

Large, readable
Minimal metadata
2.5 Plane Details View

Expanded card (modal or full screen)

Airline + flight number
Route (origin → destination)
Aircraft type (if available)
Speed, altitude (lightly shown)
Timeline:
Departed
Estimated arrival

Keep it light — avoid overloading

3. Data & APIs
3.1 OpenSky Network
Endpoint: /states/all

Use bounding box:

lamin, lomin, lamax, lomax
Poll every:
10–15 seconds (respect limits)

Important

Cache via Next.js API route (Vercel)
Do NOT hit OpenSky directly from client
3.2 Map Provider

Options:

Mapbox (best UX, requires token)
Leaflet + OSM tiles (free, simpler)
3.3 Optional APIs
Weather (destination):
Open-Meteo (free)
Airport metadata:
Static dataset or API (later)
4. System Architecture
Frontend (Next.js)
App Router
Client components:
Map
Plane layer
Bottom card
Backend (Next.js API routes)
/api/planes
Fetch OpenSky
Cache (10–15s)
Normalize response
Data Flow
Client → /api/planes → OpenSky
       ← cached response
5. UX Flows
Flow 1: Open App
Ask for location
Center map
Show nearby planes
Flow 2: Passive Discovery
Highlight overhead plane
Show card automatically
Flow 3: Explore
Tap plane
View route + destination
6. MVP Scope (Be disciplined here)

Must have

Map with planes
Overhead detection
Route card (Where are they going)
Calm UI

Nice to have (later)

Destination weather
Fun facts
Plane “personality”
7. WebXR / AR (Future Placeholder)
🚧 TODO: AR Sky View

Goal

Point phone at sky → see planes overlaid in real space

Notes

WebXR support is limited (especially iOS)
Likely approach:
Compass + orientation fallback
True AR later (possibly native wrapper)

Placeholder UI

Button:
“🔭 Sky View (Beta)”
For now:
Opens directional compass view
8. Risks & Constraints
Technical
OpenSky rate limits → must cache
Incomplete flight metadata (routes may need enrichment later)
Sensor permissions friction on mobile
UX
Accuracy of “overhead plane” is approximate
Must avoid clutter → aggressive filtering needed
9. Success Criteria
User opens app outdoors → immediately sees a relevant plane

Can answer:

“Where is that plane going?” in < 2 seconds

UI feels:
Calm
Smooth
Not overwhelming
10. Build Order (Do this, don’t overthink it)
Map + plane rendering
Backend caching layer
Overhead detection logic
Bottom card UI
Route display
Polish (Calm UI)
Optional enrichment
