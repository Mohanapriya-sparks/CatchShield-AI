# CatchShield AI — How It Works (High-Level Architecture)

CatchShield AI is designed to be simple, resilient, and privacy-focused. Below is a high-level look at how the different pieces of the system fit together to ensure seafood safety.

## 🧭 System Architecture Workflow

```mermaid
graph LR
    %% Styling Definitions
    classDef physical fill:#e1f5fe,stroke:#0288d1,stroke-width:2px,color:#01579b,font-weight:bold
    classDef coreSystem fill:#f3e5f5,stroke:#8e24aa,stroke-width:2px,stroke-dasharray: 5 5,color:#4a148c
    classDef dataBox fill:#e8eaf6,stroke:#3f51b5,stroke-width:2px,color:#1a237e
    classDef db fill:#fff3e0,stroke:#f57c00,stroke-width:2px,color:#e65100,font-weight:bold
    classDef engine fill:#f3e5f5,stroke:#9c27b0,stroke-width:2px,color:#4a148c,font-weight:bold
    classDef success fill:#e8f5e9,stroke:#2e7d32,stroke-width:2px,color:#1b5e20,font-weight:bold
    classDef danger fill:#ffebee,stroke:#c62828,stroke-width:2px,color:#b71c1c,font-weight:bold
    classDef qrBox fill:#f3e5f5,stroke:#8e24aa,stroke-width:2px,color:#4a148c
    classDef consumer fill:#e8f5e9,stroke:#2e7d32,stroke-width:2px,color:#1b5e20,font-weight:bold

    %% Physical World (Catch)
    subgraph Catch ["Physical World (Catch Workflow)"]
        direction LR
        A["🚢<br/>Fisher<br/>catches seafood"]:::physical --> B["👷<br/>Landing Center<br/>Operator<br/><br/>Registers Batch"]:::physical
    end

    %% External World (Alerts)
    subgraph Alerts ["External / Physical World (Alerts)"]
        direction LR
        C["🛰️<br/>Marine Satellites<br/>Sensors"]:::physical --> D["👮<br/>Environmental<br/>Officer<br/><br/>Confirms Danger"]:::physical
    end

    %% Core System
    subgraph Core ["CatchShield AI Core System"]
        direction TB
        subgraph Inputs [" "]
            direction LR
            E["📄<br/>Catch Data:<br/>Zone, Time, Species"]:::dataBox
            F["⚠️<br/>Alert Data:<br/>Hazard, Zone, Window"]:::dataBox
        end
        
        DB[("🛢️ Database")]:::db
        
        Inputs --> DB
        DB --> Engine["⚙️ Automated Matching Engine"]:::engine
        
        Engine -- "No Overlap" --> Ok["✅ Batch Cleared"]:::success
        Engine -- "Overlap Detected!" --> Flag["🚨 Batch Flagged<br/>for Review"]:::danger
    end

    %% Consumer
    subgraph EndUser ["Consumer"]
        direction LR
        Scan["📱<br/>Consumer scans<br/>QR Code"]:::consumer
    end

    %% Connections
    B --> E
    D --> F
    
    QR["🔳<br/>Public QR Code<br/>generated"]:::qrBox
    
    Ok --> QR
    Flag -. "Inspector makes<br/>final decision" .-> QR
    
    QR --> Scan
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
