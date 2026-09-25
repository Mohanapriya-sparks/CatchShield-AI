# Security and Limitations

CatchShield AI is built as a prototype for the CodeGyaan'26 ChainCraft Track. The following outlines its security boundaries and known limitations.

## ⚠️ Important Disclaimers

**1. No Alert Overlap Does Not Prove Food Safety**
If the system reports "No confirmed alert overlap found," this *only* means that no environmental alert was recorded in that specific zone during the self-reported catch time. It does **not** prove that the seafood is safe for consumption. CatchShield AI is a supplementary traceability tool, not a substitute for physical health inspections.

**2. Demo Decisions Only**
All inspector and officer decisions recorded in this system are demonstration actions and hold no official or legal weight.

## System Limitations

* **Self-Reported Origins:** In the current prototype, the catch zone and time are self-reported by the fisher/operator at the landing site. There is no automated IoT or GPS verification on the vessel itself in this version, meaning origins rely on the operator's truthfulness.
* **Hash Verification Scope:** The system generates a SHA-256 fingerprint of the batch details. This fingerprint ensures that the *recorded* data cannot be altered later without detection. However, it does not guarantee that the data was accurate when first entered ("Garbage In, Garbage Out").
* **AI Risk Scoring Model:** The system utilizes a legitimate machine learning component via `scikit-learn`. A Logistic Regression model predicts the probability (0-100%) of a future contamination alert based on sea surface temperature anomalies, days since the last alert, and historical zone contamination rates. For the hackathon, this model is trained on *synthetic historical data* during initialization to prove the architecture.
* **Blockchain Simulation:** While the `chain_tx` field and SHA-256 fingerprinting are real cryptographic proofs of data integrity, the live application currently uses PostgreSQL to simulate the distributed ledger. This allows the MVP to run cleanly on Render. True decentralization requires deploying the contracts (in a future iteration) to a testnet/mainnet and wiring the FastAPI backend to a Web3 provider.

## Privacy Model

CatchShield AI is designed to protect fisher privacy while ensuring public safety:
- **Public Lookup:** The QR code lookup intentionally redacts the exact GPS coordinates and the fisher's internal ID. It only exposes the general catch zone, species, and the high-level custody timeline.
- **Role-Based Access:** Only authorized Environmental Officers can confirm alerts, and only Inspectors can update batch review statuses.
