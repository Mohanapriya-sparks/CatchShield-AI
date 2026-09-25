# 🐟 CatchShield AI - Pitch Deck Outline

## Slide 1: The Problem
**Current Seafood Traceability is Blind to the Environment.**
- Standard systems track *where* a fish came from (vessel to market).
- They **do not** track the environmental reality of the ocean at that exact moment.
- If a toxic algal bloom (red tide) or oil spill occurs, standard systems don't automatically recall the fish caught there.

## Slide 2: The Solution
**CatchShield AI: Intersecting Time & Space.**
- An automated matching engine that connects fisher-reported catch coordinates directly to active environmental officer alerts.
- **Result:** We stop contaminated seafood before it reaches the consumer.

## Slide 3: How It Works
1. **Operator:** Registers a batch at the landing center (Offline-first PWA).
2. **Officer:** Monitors marine data and issues a Zone Alert.
3. **The Engine:** Algorithmic intersection flags any batches registered in that zone during the alert window.
4. **Consumer:** Scans the QR Code to see a privacy-safe, verified clearance timeline.

## Slide 4: Key Technologies
- **Frontend:** React 18, TypeScript, Vite PWA (Mobile-first, offline queue)
- **Backend:** FastAPI, Python, PostgreSQL (Async processing)
- **Security:** SHA-256 Fingerprinting & JWT Authentication
- **Integration:** Open-Meteo Marine APIs for live wave/wind conditions

## Slide 5: The Impact
- **Consumers:** Guaranteed environmental safety.
- **Fishers:** Protected privacy (exact coordinates redacted, zone-based clearance).
- **Authorities:** Zero manual delay between an environmental hazard and a supply chain recall.

---
*This is a textual representation of our pitch deck for the CodeGyaan'26 ChainCraft hackathon.*
