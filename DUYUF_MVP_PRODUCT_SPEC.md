# Duyuf MVP Product Spec

## 1) Product summary

Duyuf is a Hajj and Umrah operations suite built for Saudi service companies, airports, and government stakeholders. The first minimum viable product focuses on the operational bottlenecks that create risk during arrival and movement of pilgrims: delays, crowding, missing support equipment, and poor visibility for teams working on the ground.

This MVP is designed to show value inside a single Hajj season and prove the concept before expanding to the wider travel journey and AI wellness features.

### Product vision

Give every airport and operations team a single operating picture of pilgrim arrivals and needs, so they can predict demand, assign resources in advance, and respond to issues before they escalate.

### MVP product goal

Reduce congestion, improve staff readiness, and increase safety during arrival and transfer by giving GACA and airport teams a shared decision-support layer that combines flight data, pilgrim profiles, resource planning, and live operational incidents.

---

## 2) Use cases and stakeholders

### Primary users

1. GACA operations lead
   - Monitors airport and flow risk across the next 48 hours
   - Needs early warnings on capacity gaps
   - Wants scenario comparisons and recommended actions

2. Airport arrival desk / immigration operations
   - Needs flight-by-flight staff preparation
   - Must assign lanes, buses, wheelchairs, and interpreters before passengers land

3. Ground handling coordinator
   - Manages equipment allocation across flights and gates
   - Needs live updates when delays or surges occur

4. Group leader / field supervisor
   - Works with pilgrims on the ground
   - Needs fast incident visibility and immediate assistance routes

5. Health / safety officer
   - Monitors risk signals such as heat stress, age profile, mobility needs, and incident trends

### Key pain points

- Flight demand is known late and unevenly distributed
- Pilgrims have different needs but are often grouped only by flight or package
- Wheelchair, bus, interpreter, and immigration staffing are assigned reactively
- Leaders cannot answer basic Arabic and English questions using live data
- Incident response is fragmented across groups and airport teams

---

## 3) MVP scope

### Included in Phase 1

#### A. Arrival Wave Orchestrator
- Forecasts arrivals over the next 48 hours by airport, flight, and time window
- Aggregates pilgrim totals by:
  - flight
  - age band (75+)
  - mobility requirements
  - language needs
  - medical or dietary flags
  - Makkah Route clearance status
- Provides estimated demand for:
  - immigration lanes
  - wheelchairs
  - interpreters
  - buses
  - Zamzam allocation planning

#### B. Arabic/English AI analyst
- Enables natural-language questions over live operational data
- Responds in Arabic or English
- Gives answers with summary charts and recommended actions
- Uses only trusted operational data sources

#### C. Rafeeq pilot (voice-first pilgrim companion)
- Works in six languages in the first pilot: English, Arabic, Indonesian, Urdu, Turkish, and French
- Supports a simple, low-data ritual and safety flow
- Includes:
  - SOS button
  - “I am lost” button
  - basic heat-risk guidance
  - spoken Q&A and voice input
- Focused on the Hajj terminal / arrival experience before full journey coverage

#### D. Pilgrim incident feed
- Pilgrim app sends live incidents to the operations console
- Console shows event stream with actions like:
  - Dispatch team
  - Resolve
- Creates immediate operational feedback and accountability

### Out of scope for MVP

- Full GPS tracking throughout the pilgrimage
- Full AI religious rulings engine
- End-to-end baggage or return-leg optimization
- Advanced heat-stroke predictive system beyond a pilot
- Full digital twin simulation across the whole season

---

## 4) North star metrics

The product should prove value in three dimensions: speed, readiness, and safety.

### Operational efficiency
- Reduce time from flight arrival to staff assignment
- Reduce queueing at immigration and bus handoff points
- Improve equipment utilization without shortages

### Resource readiness
- Increase percent of flights with pre-assigned support resources before landing
- Reduce last-minute allocations and ad hoc manual coordination

### Safety and trust
- Lower time-to-assist for distressed pilgrims
- Improve visibility of vulnerable pilgrims (elderly, mobility needs, heat exposure)
- Increase usage of support flows among pilgrims who need them

### Example KPI targets
- 90% of flights have a pre-arrival resource brief before wheels down
- 50% reduction in emergency dispatches caused by poor pre-planning
- 30% faster incident routing from pilgrim to operations team
- 80% of flights show demand-capacity gaps identified before arrival

---

## 5) Core user flows

### Flow 1: Arrival wave planning

1. System ingests flight, visa, group, and pilgrim data
2. Forecast engine predicts arrivals for the next 48 hours
3. Dashboard groups flights by demand profile and capacity risk
4. Operations team reviews resource gaps and suggested actions
5. Team applies or adjusts planned staffing and bus allocations
6. Live brief is distributed to airport handling teams

### Flow 2: Natural-language operational analysis

1. User asks in Arabic or English: “How many Nigerian pilgrims over 70 land in Madinah tomorrow between 2am and 5am?”
2. System queries data lake and operational tables in real time
3. Response includes:
   - totals
   - risk summary
   - staffing gaps
   - recommended action
4. User can drill into the exact flight or group list

### Flow 3: Pilgrim incident handling

1. Pilgrim presses SOS or reports a problem in the app
2. Incident enters live operations feed
3. Dispatcher assigns team or route
4. Resolver marks the case as handled
5. System records event, time, and actor for follow-up

### Flow 4: Rafeeq arrival support

1. Pilgrim opens voice flow on phone or basic device
2. System identifies language and context
3. Pilgrim receives spoken instructions or SOS options
4. Safety flow triggers alerts if the pilgrim is lost, ill, or at risk
5. Group leader or operations center receives notification if needed

---

## 6) Functional requirements

### 6.1 Arrival Wave Orchestrator

- Show totals over next 48 hours by airport and arrival window
- Group by flight and by time bucket
- Highlight older pilgrims and mobility needs
- Show capacity-risk heat map for immigration, bus, wheelchair, and baggage capacity
- Show ranked list of gaps with recommended staffing actions
- Allow scenario simulation such as:
  - delay all flights from one country by 3 hours
  - add or remove counters / wheelchairs / buses
  - compare current plan and simulated plan

### 6.2 AI Analyst

- Accept Arabic and English questions
- Answer from operational data only, not from free-form hallucinated reasoning
- Support summary cards, charts, and actionable insights
- Make reasoning auditable through source references and data slices
- Flag if data is insufficient or incomplete

### 6.3 Pilgrim incident feed

- Real-time feed of pilgrim issues and alerts
- Dispatch team assignment
- Resolve state tracking
- Assignment to group or airport team
- Search and filter by incident type and status

### 6.4 Rafeeq pilot

- Voice-first interface for basic devices
- Six-language pilot coverage
- SOS and lost-pilgrim flows
- Small set of safety prompts adapted to the airport arrival and transfer context
- Clear religious guardrails: only approved content is used

---

## 7) Data model and integration plan

### Source data

- Flight manifests
- Visa records
- Group records
- Pilgrim profile data
- Mobility and medical requirements
- Makkah Route clearance status
- Airport staffing and equipment availability
- Live incident events from the pilgrim app

### Core entities

- Flight
- Pilgrim
- Pilgrim group
- Arrival wave
- Resource allocation
- Incident
- Capacity gap
- Scenario run

### Data standards

- All operational records should be stored in a Kingdom-hosted data lake or governed warehouse
- Data access should be tenant- and role-scoped
- Data retention and access should respect privacy and regulatory requirements
- Pilgrim consent and data-use controls must be explicit and auditable

---

## 8) Technical architecture (MVP)

### Layer 1: Data
- Kingdom-hosted data lake / warehouse
- Feeds from GACA, airports, airlines, Nusuk, immigration, and transport providers

### Layer 2: Intelligence
- Arrival forecasting engine
- Scenario simulator
- AI analyst using approved operational data only
- Voice pipeline for Rafeeq pilot

### Layer 3: Edge experience
- Pilgrim app and voice interface
- Airport operational console
- Event stream for live dispatch

### Layer 4: Trust and governance
- Consent management
- Scholar review board for religious content
- PDPL and SDAIA/NCA compliance controls
- Role-based access to sensitive fields

---

## 9) MVP product assumptions

- GACA or a major airport sponsor will provide at least one real operational data feed in the first season
- Flight and pilgrim data are already partly available through existing systems
- Pilgrim identity and passenger profile data can be reconciled without full platform overhaul
- The first pilot can focus on high-volume arrivals and one airport corridor rather than the entire national network
- The product is judged first on operational decision support, not on fully autonomous AI actions

---

## 10) Risks and mitigations

### Risk: Data quality is inconsistent
Mitigation:
- Start with the highest-confidence data feeds
- Use confidence flags and data-quality warnings in the UI
- Focus on visible operational decisions rather than perfect forecasting

### Risk: Pilgrim-facing product creates trust or religious concerns
Mitigation:
- Keep all religious content inside an approved library
- Require scholar review and explicit content governance
- Present Rafeeq as an assistant, not a religious authority

### Risk: Operational teams won’t trust AI-recommended actions
Mitigation:
- Keep the AI analyst advisory, not autonomous
- Include source-backed answers and visible assumptions
- Require a human in the loop for operational changes

### Risk: Overbuilding before proving value
Mitigation:
- Ship a pilot that solves a narrow but painful set of tasks for one season
- Measure value before expanding to the broader Hajj journey

---

## 11) Product roadmap

### MVP (one season)
- Arrival Wave Orchestrator
- AI analyst for Arabic/English questions
- Rafeeq pilot in 6 languages
- Pilgrim incident live feed and dispatch workflow

### Phase 2
- Ummah Mesh / lost-pilgrim tracing in crowd-dense areas
- Heat-stroke risk for pilgrims and supervisors
- Dua Delegation pilot

### Phase 3
- Full rehearsal engine / digital twin
- Return Health Bridge
- Longer-term return-leg optimization and baggage planning

---

## 12) Success criteria for MVP approval

The project should move forward if it can show:

- clear value for airport operations staff within the first season
- visible reduction in delay-driven congestion and manual coordination
- high-quality answers from the AI analyst over live operational data
- a strong pilot with Rafeeq in a limited, real environment
- enough trust and governance to satisfy airport and ministry stakeholders

---

## 13) Recommendation

The best initial product is not the full “AI Hajj suite.” It is a focused operational decision-support layer for arrivals and live pilgrim support. This MVP solves a real problem that airport teams already feel, shows quick ROI, and creates the trust foundation needed for wider deployment.

This is the right first product to pitch to GACA and the Ministry because it is mission-critical, visible, and measurable within one season.

---

## 14) Next artifact to produce

The next step should be a leadership-ready pitch deck with:
- problem statement
- why now
- system overview
- Cargo / staffing / queue pain points
- MVP scope
- KPI outcomes
- phased roadmap
- trust and compliance stance

This spec is the source material for that deck.
