# CatchShield AI — How It Works (High-Level Architecture)

CatchShield AI is designed to be simple, resilient, and privacy-focused. Below is a high-level look at how the different pieces of the system fit together to ensure seafood safety.

## 🌊 The Big Picture

```mermaid
graph TD
    %% Define Styling
    classDef physical fill:#e1f5fe,stroke:#0288d1,stroke-width:2px;
    classDef system fill:#f3e5f5,stroke:#8e24aa,stroke-width:2px;
    classDef db fill:#fff3e0,stroke:#f57c00,stroke-width:2px;
    classDef consumer fill:#e8f5e9,stroke:#388e3c,stroke-width:2px;

    %% Actors and Physical World
    A[🚢 Fisher catches seafood]:::physical --> B
    B[⚓ Landing Center Operator]:::physical -->|Registers Batch via Tablet/Web| C
    
    X[🛰️ Marine Satellites / Sensors]:::physical --> Y
    Y[👮 Environmental Officer]:::physical -->|Confirms Danger in Zone| Z

    %% The CatchShield System
    subgraph CatchShield AI Core System
        C[Catch Data: Zone, Time, Species]:::system --> DB[(Database)]:::db
        Z[Alert Data: Hazard, Zone, Time Window]:::system --> DB
        
        DB --> E{⚙️ Automated Matching Engine}:::system
        E -->|No Overlap| F[✅ Batch Cleared]:::system
        E -->|Overlap Detected!| G[⚠️ Batch Flagged for Review]:::system
    end

    %% Outcomes
    F --> H
    G -->|Inspector makes final decision| H
    
    H[📱 Public QR Code generated]:::system --> I[🛒 Consumer scans QR Code]:::consumer
```

---

## 🛠️ The 3 Main Pillars of CatchShield

To make this system work across remote coastal areas and public supermarkets, we split it into three logical pillars:

### 1. Data Ingestion (The Frontend)
**Technologies used: React, TypeScript, Vite**
*   **What it does:** This is the web application used by the people on the ground (Operators at the docks, Environmental Officers in offices). 
*   **Why it's built this way:** Landing centers often have terrible internet. The frontend is built to be extremely lightweight. It uses an "Offline Queue" system, meaning if an operator loses Wi-Fi while registering a batch of tuna, the app saves it locally and automatically uploads it when the connection returns.

### 2. The Brain (The Backend & Matching Engine)
**Technologies used: Python, FastAPI, SQLite**
*   **What it does:** This is the server that processes all the data. Its most important job is the **Automated Matching Engine**. 
*   **Why it's built this way:** Instead of humans trying to cross-reference thousands of catch records against PDF hazard warnings, the Python backend runs a fast algorithm. Every time a new batch is registered or a new alert is issued, it calculates if they overlap in **both location (Zone) and time**. If they do, it instantly flags the batch. 

### 3. Verification & Privacy (The Ledger & Lookup)
**Technologies used: SHA-256 Fingerprinting, (Simulated) Solidity Smart Contracts**
*   **What it does:** Ensuring that data isn't tampered with after the fact, while protecting the business secrets of the fishers.
*   **Why it's built this way:** If we just dumped all data publicly, fishers would refuse to use the system because competitors would steal their best fishing spots. Instead, CatchShield groups locations into broad "Zones". Furthermore, when a batch is created, a unique cryptographic "fingerprint" is generated. The consumer scanning the QR code sees a privacy-safe timeline of safety checks, but the fisher's exact coordinates and ID remain strictly confidential.
