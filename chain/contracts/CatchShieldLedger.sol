// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title CatchShieldLedger
 * @notice Minimal on-chain ledger for CatchShield AI batch hashes and custody events.
 *
 * PURPOSE: Anchoring SHA-256 fingerprints of batch registration data on-chain so that
 * any later off-chain change is detectable by comparing the stored fingerprint to the
 * recomputed one. Custody events (status changes) are also logged.
 *
 * DISCLAIMER: This contract does NOT certify that fish is safe to eat.
 * On-chain anchoring provides tamper-evidence, not food-safety certification.
 *
 * SCOPE: Hackathon MVP prototype running on a local Hardhat node.
 * Photo data, fisher identity, and precise GPS are stored off-chain only.
 */
contract CatchShieldLedger {
    // -----------------------------------------------------------------------
    // Events
    // -----------------------------------------------------------------------
    event BatchAnchored(
        string indexed batchId,
        bytes32 fingerprint,
        uint256 timestamp,
        string landingCentre
    );

    event CustodyEvent(
        string indexed batchId,
        string eventType,
        string actorRole,
        uint256 timestamp
    );

    // -----------------------------------------------------------------------
    // State
    // -----------------------------------------------------------------------
    struct BatchRecord {
        bytes32 fingerprint;
        uint256 anchoredAt;
        string landingCentre;
        bool exists;
    }

    mapping(string => BatchRecord) private _batches;
    address public owner;

    // -----------------------------------------------------------------------
    // Constructor
    // -----------------------------------------------------------------------
    constructor() {
        owner = msg.sender;
    }

    // -----------------------------------------------------------------------
    // Functions
    // -----------------------------------------------------------------------

    /**
     * @notice Anchor a batch fingerprint on-chain.
     * @param batchId  Unique batch identifier (e.g. "CF-104")
     * @param fingerprint  SHA-256 hex digest as bytes32 (first 32 bytes)
     * @param landingCentre  Name of landing centre (no personal data)
     */
    function anchorBatch(
        string calldata batchId,
        bytes32 fingerprint,
        string calldata landingCentre
    ) external {
        require(!_batches[batchId].exists, "Batch already anchored");
        _batches[batchId] = BatchRecord({
            fingerprint: fingerprint,
            anchoredAt: block.timestamp,
            landingCentre: landingCentre,
            exists: true
        });
        emit BatchAnchored(batchId, fingerprint, block.timestamp, landingCentre);
    }

    /**
     * @notice Log a custody event for a batch.
     * @param batchId  Batch identifier
     * @param eventType  Event label (REGISTERED, ALERT_MATCHED, INSPECTOR_DECISION, etc.)
     * @param actorRole  Role performing the action (OPERATOR, OFFICER, INSPECTOR, SYSTEM)
     */
    function logCustodyEvent(
        string calldata batchId,
        string calldata eventType,
        string calldata actorRole
    ) external {
        emit CustodyEvent(batchId, eventType, actorRole, block.timestamp);
    }

    /**
     * @notice Retrieve the anchored fingerprint for a batch.
     * @return fingerprint  The stored bytes32 fingerprint
     * @return anchoredAt  Block timestamp when anchored
     * @return exists  Whether the batch has been anchored
     */
    function getBatch(string calldata batchId)
        external
        view
        returns (
            bytes32 fingerprint,
            uint256 anchoredAt,
            bool exists
        )
    {
        BatchRecord storage r = _batches[batchId];
        return (r.fingerprint, r.anchoredAt, r.exists);
    }
}
