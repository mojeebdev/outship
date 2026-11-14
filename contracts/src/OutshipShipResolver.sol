// SPDX-License-Identifier: Apache-2.0
pragma solidity 0.8.27;

import { IEAS, Attestation } from "@ethereum-attestation-service/eas-contracts/contracts/IEAS.sol";
import { SchemaResolver } from "@ethereum-attestation-service/eas-contracts/contracts/resolver/SchemaResolver.sol";
import { Ownable2Step } from "@openzeppelin/contracts/access/Ownable2Step.sol";
import { ECDSA } from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import { EIP712 } from "@openzeppelin/contracts/utils/cryptography/EIP712.sol";

/// @title OutshipShipResolver
/// @notice The EAS resolver for outship's ship schema (v2). It makes the schema accept only
///         attestations whose data outship signed, so a public schema can't be used to mint a
///         convincing receipt for a ship that never happened.
///
///         The builder still submits the attestation from their own wallet and pays the gas:
///         outship's key only signs, it never sends transactions and never needs funds.
///
///         Why a resolver and not EAS delegated attestations: delegated requests are signed
///         by the *attester* against a sequential per-attester nonce (`_nonces[attester]++`
///         in EIP1271Verifier). With outship as the one attester, two builders attesting at
///         the same moment would race for the same nonce and one would fail. Here the replay
///         guard is the digest itself, so any number of signatures can be in flight at once.
/// @dev Schema (decode order matters, append-only):
///      string repo,uint8 shipType,string identifier,string commitSha,uint64 timestamp,
///      uint16 scoreSnapshot,string githubLogin,string shipId,uint64 deadline,bytes outshipSig
contract OutshipShipResolver is SchemaResolver, EIP712, Ownable2Step {
    /// @notice The EIP-712 struct outship signs. `recipient` and `attester` are the attestation's
    ///         own top-level fields, so the signature is bound to the builder's wallet.
    bytes32 public constant SHIP_TYPEHASH = keccak256(
        "Ship(address recipient,address attester,string repo,uint8 shipType,string identifier,"
        "string commitSha,uint64 timestamp,uint16 scoreSnapshot,string githubLogin,string shipId,"
        "uint64 deadline)"
    );

    /// @notice The only key whose signatures this resolver accepts.
    address public outshipSigner;

    /// @notice EIP-712 digests that already produced an attestation. One signature, one receipt.
    mapping(bytes32 digest => bool used) public usedDigests;

    /// @notice The attestation each ship already has, keyed by keccak256(bytes(shipId)). One ship,
    ///         one receipt: a fresh signature for an attested ship is refused, so a builder can't
    ///         collect a second receipt by attesting, skipping outship's save and authorizing again.
    ///         Public, so outship can find (and record) a receipt whose save never happened.
    mapping(bytes32 shipKey => bytes32 uid) public attestationForShip;

    event OutshipSignerRotated(address indexed previousSigner, address indexed newSigner);

    error ZeroAddress();
    error SignatureExpired();
    error InvalidOutshipSignature();
    error RecipientNotAttester();
    error DigestAlreadyUsed();
    error ExpiringAttestation();
    error ShipAlreadyAttested(bytes32 uid);

    /// @dev Everything in the signed data, kept in memory so onAttest stays readable.
    struct Ship {
        string repo;
        uint8 shipType;
        string identifier;
        string commitSha;
        uint64 timestamp;
        uint16 scoreSnapshot;
        string githubLogin;
        string shipId;
        uint64 deadline;
        bytes outshipSig;
    }

    constructor(IEAS eas, address initialOwner, address initialSigner)
        SchemaResolver(eas)
        EIP712("outship", "1")
    {
        if (initialOwner == address(0) || initialSigner == address(0)) revert ZeroAddress();
        // OpenZeppelin 4.x's Ownable starts with msg.sender; hand it to the real owner now so
        // the deployer key never holds the right to rotate the signer.
        _transferOwnership(initialOwner);
        outshipSigner = initialSigner;
        emit OutshipSignerRotated(address(0), initialSigner);
    }

    /// @notice Replace the signing key, e.g. after a leak or on a schedule. Signatures from the
    ///         old key stop working immediately, including ones not yet submitted.
    function setOutshipSigner(address newSigner) external onlyOwner {
        if (newSigner == address(0)) revert ZeroAddress();
        emit OutshipSignerRotated(outshipSigner, newSigner);
        outshipSigner = newSigner;
    }

    /// @notice The digest outship signs for a given attestation. Public so the server's viem
    ///         signTypedData output can be checked against the contract in tests and scripts.
    function shipDigest(address recipient, address attester, Ship memory ship) public view returns (bytes32) {
        return _hashTypedDataV4(
            keccak256(
                abi.encode(
                    SHIP_TYPEHASH,
                    recipient,
                    attester,
                    keccak256(bytes(ship.repo)),
                    ship.shipType,
                    keccak256(bytes(ship.identifier)),
                    keccak256(bytes(ship.commitSha)),
                    ship.timestamp,
                    ship.scoreSnapshot,
                    keccak256(bytes(ship.githubLogin)),
                    keccak256(bytes(ship.shipId)),
                    ship.deadline
                )
            )
        );
    }

    /// @notice The EIP-712 domain separator (name "outship", version "1", this chain, this contract).
    function domainSeparator() external view returns (bytes32) {
        return _domainSeparatorV4();
    }

    function onAttest(Attestation calldata attestation, uint256 /* value */ ) internal override returns (bool) {
        Ship memory ship = _decode(attestation.data);

        // Reverting (rather than returning false) bubbles a specific error up through EAS, so
        // the builder's wallet shows why, e.g. an expired signature that needs re-authorizing.
        if (block.timestamp > ship.deadline) revert SignatureExpired();
        // The receipt is the builder's: whoever pays for it is who it's about.
        if (attestation.attester != attestation.recipient) revert RecipientNotAttester();
        // Ships are permanent records; an attestation that lapses would say otherwise.
        if (attestation.expirationTime != 0) revert ExpiringAttestation();

        bytes32 digest = shipDigest(attestation.recipient, attestation.attester, ship);
        (address signer, ECDSA.RecoverError recoverError) = ECDSA.tryRecover(digest, ship.outshipSig);
        if (recoverError != ECDSA.RecoverError.NoError || signer != outshipSigner) revert InvalidOutshipSignature();

        if (usedDigests[digest]) revert DigestAlreadyUsed();
        usedDigests[digest] = true;

        bytes32 shipKey = keccak256(bytes(ship.shipId));
        bytes32 existing = attestationForShip[shipKey];
        if (existing != bytes32(0)) revert ShipAlreadyAttested(existing);
        attestationForShip[shipKey] = attestation.uid;

        return true;
    }

    /// @notice Ship attestations are permanent. (The schema is also registered non-revocable.)
    function onRevoke(Attestation calldata, uint256) internal pure override returns (bool) {
        return false;
    }

    function _decode(bytes calldata data) private pure returns (Ship memory ship) {
        (
            ship.repo,
            ship.shipType,
            ship.identifier,
            ship.commitSha,
            ship.timestamp,
            ship.scoreSnapshot,
            ship.githubLogin,
            ship.shipId,
            ship.deadline,
            ship.outshipSig
        ) = abi.decode(data, (string, uint8, string, string, uint64, uint16, string, string, uint64, bytes));
    }
}
