# Demonstration Guide

This guide walks you through the interactive features of CatchShield AI.

## 1. Initial Setup

Make sure both the FastAPI backend and Vite frontend are running. Upon the first backend startup, the SQLite database is automatically seeded with sample data, including two active, confirmed environmental alerts for `Zone 03` and `Zone 04`.

## 2. Navigating the App

Click **Login as Admin** on the home screen. You'll see four main tabs:
- **Operator:** For registering new catch batches.
- **Env Officer:** For reviewing marine conditions, screening alerts, and officially confirming zone alerts.
- **Matching:** The system engine dashboard to cross-reference batches and alerts.
- **Inspector:** A dashboard to make decisions on flagged batches.

## 3. The Full Workflow

### Step A: View Zone Conditions
1. Go to the **Operator** tab.
2. In the "Catch Zone" dropdown, select different zones (e.g., Zone 01, Zone 03).
3. Notice how the marine forecast changes, and how Zone 03 instantly triggers a red ⚠️ environmental warning banner based on the seeded confirmed alert.

### Step B: Register a Batch
1. Still on the **Operator** tab, select `Zone 03`.
2. Fill out the fisher ID, species (e.g., Tuna), weight, and select a time that falls within the current date.
3. Submit the form. Note the **Batch ID** generated at the bottom along with the QR code.

### Step C: Confirm a New Alert (Optional)
1. Go to the **Env Officer** tab.
2. Under "Confirm Environmental Alert", select `Zone 02`.
3. Provide a start and end time that covers today's date, and a reason (e.g., "Demo Chemical Spill").
4. Submit the alert. It is now saved as a confirmed alert for Zone 02.

### Step D: Run Matching
1. Go to the **Matching** tab.
2. Click **Run Batch Matching**.
3. The system will scan all batches against confirmed alerts. Your newly registered batch from Zone 03 will appear in the flagged list, citing the environmental reason.

### Step E: Inspector Decision
1. Go to the **Inspector** tab.
2. Find your flagged batch.
3. Submit a demo decision (e.g., "Flag for Further Review").

### Step F: Public QR Lookup
1. Log out, then click **Login as Customer**.
2. Alternatively, manually type `http://localhost:5173/lookup/YOUR_BATCH_ID` in your URL bar.
3. You will see a privacy-safe timeline, showing that the batch is under environmental review or flagged, without revealing precise coordinates or the fisher's identity.
