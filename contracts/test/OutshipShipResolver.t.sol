// SPDX-License-Identifier: Apache-2.0
pragma solidity 0.8.27;

import { Test } from "forge-std/Test.sol";
import {
    IEAS,
    Attestation,
    AttestationRequest,
    AttestationRequestData,
    RevocationRequest,
    RevocationRequestData
} from "@ethereum-attestation-service/eas-contracts/contracts/IEAS.sol";
import { ISchemaRegistry } from "@ethereum-attestation-service/eas-contracts/contracts/ISchemaRegistry.sol";
import { ISchemaResolver } from "@ethereum-attestation-service/eas-contracts/contracts/resolver/ISchemaResolver.sol";
import { OutshipShipResolver } from "../src/OutshipShipResolver.sol";

/// Runs the resolver behind the real EAS v1.3.0 contracts (the logic Base's predeploy uses),
/// so every check goes through EAS.attest exactly as a builder's wallet would call it.
contract OutshipShipResolverTest is Test {
    string internal constant SCHEMA =
        "string repo,uint8 shipType,string identifier,string commitSha,uint64 timestamp,uint16 scoreSnapshot,"
        "string githubLogin,string shipId,uint64 deadline,bytes outshipSig";

    // A fixed address, so the EIP-712 digest below can be compared with one viem computed.
    address internal constant RESOLVER_ADDRESS = 0x00000000000000000000000000000000000057a1;

    IEAS internal eas;
    ISchemaRegistry internal registry;
    OutshipShipResolver internal resolver;
    bytes32 internal schemaUid;

    address internal owner = makeAddr("owner");
    uint256 internal signerKey;
    address internal signer;
    address internal builder = makeAddr("builder");
    address internal stranger = makeAddr("stranger");

    function setUp() public {
        vm.warp(1_790_000_000);
        (signer, signerKey) = makeAddrAndKey("outship-signer");

        registry = ISchemaRegistry(deployCode("SchemaRegistry.sol:SchemaRegistry"));
        eas = IEAS(deployCode("EAS.sol:EAS", abi.encode(registry)));

        deployCodeTo("OutshipShipResolver.sol:OutshipShipResolver", abi.encode(eas, owner, signer), RESOLVER_ADDRESS);
        resolver = OutshipShipResolver(payable(RESOLVER_ADDRESS));

        schemaUid = registry.register(SCHEMA, ISchemaResolver(address(resolver)), false);
    }

    // ── helpers ──────────────────────────────────────────────────────────────

    function _ship() internal view returns (OutshipShipResolver.Ship memory ship) {
        ship.repo = "mojeebdev/outship";
        ship.shipType = 0;
        ship.identifier = "v1.2.0";
        ship.commitSha = "5bcce31f00000000000000000000000000000000";
        ship.timestamp = 1_789_990_000;
        ship.scoreSnapshot = 142;
        ship.githubLogin = "mojeebdev";
        ship.shipId = "cmship0000000000000000001";
        ship.deadline = uint64(block.timestamp + 15 minutes);
    }

    function _sign(uint256 key, address recipient, address attester, OutshipShipResolver.Ship memory ship)
        internal
        view
        returns (bytes memory)
    {
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(key, resolver.shipDigest(recipient, attester, ship));
        return abi.encodePacked(r, s, v);
    }

    function _encode(OutshipShipResolver.Ship memory ship) internal pure returns (bytes memory) {
        return abi.encode(
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
        );
    }

    function _request(address recipient, bytes memory data) internal view returns (AttestationRequest memory) {
        return AttestationRequest({
            schema: schemaUid,
            data: AttestationRequestData({
                recipient: recipient,
                expirationTime: 0,
                revocable: false,
                refUID: bytes32(0),
                data: data,
                value: 0
            })
        });
    }

    /// A ship signed by outship for `builder`, ready to submit.
    function _signedShip() internal view returns (OutshipShipResolver.Ship memory ship) {
        ship = _ship();
        ship.outshipSig = _sign(signerKey, builder, builder, ship);
    }

    function _attestAs(address from, address recipient, bytes memory data) internal returns (bytes32) {
        vm.prank(from);
        return eas.attest(_request(recipient, data));
    }

    // ── the happy path ───────────────────────────────────────────────────────

    function test_ValidSignatureAttests() public {
        OutshipShipResolver.Ship memory ship = _signedShip();
        bytes32 uid = _attestAs(builder, builder, _encode(ship));

        Attestation memory attestation = eas.getAttestation(uid);
        assertEq(attestation.schema, schemaUid);
        assertEq(attestation.attester, builder);
        assertEq(attestation.recipient, builder);
        assertEq(attestation.data, _encode(ship));
        assertFalse(attestation.revocable);
        assertTrue(resolver.usedDigests(resolver.shipDigest(builder, builder, ship)));
    }

    function test_ConcurrentSignaturesDontCollide() public {
        // The reason this is a resolver and not delegated attestation: many signatures can
        // be outstanding at once and land in any order.
        address other = makeAddr("other-builder");
        OutshipShipResolver.Ship memory a = _ship();
        OutshipShipResolver.Ship memory b = _ship();
        b.shipId = "cmship0000000000000000002";
        b.githubLogin = "someone";
        a.outshipSig = _sign(signerKey, builder, builder, a);
        b.outshipSig = _sign(signerKey, other, other, b);

        _attestAs(other, other, _encode(b));
        _attestAs(builder, builder, _encode(a));
    }

    // ── what it refuses ──────────────────────────────────────────────────────

    function test_RevertWhen_WrongSigner() public {
        (, uint256 impostorKey) = makeAddrAndKey("impostor");
        OutshipShipResolver.Ship memory ship = _ship();
        ship.outshipSig = _sign(impostorKey, builder, builder, ship);

        vm.expectRevert(OutshipShipResolver.InvalidOutshipSignature.selector);
        _attestAs(builder, builder, _encode(ship));
    }

    function test_RevertWhen_SignatureIsGarbage() public {
        OutshipShipResolver.Ship memory ship = _ship();
        ship.outshipSig = hex"deadbeef";

        vm.expectRevert(OutshipShipResolver.InvalidOutshipSignature.selector);
        _attestAs(builder, builder, _encode(ship));
    }

    function test_RevertWhen_DeadlinePassed() public {
        OutshipShipResolver.Ship memory ship = _signedShip();
        vm.warp(ship.deadline + 1);

        vm.expectRevert(OutshipShipResolver.SignatureExpired.selector);
        _attestAs(builder, builder, _encode(ship));
    }

    function test_DeadlineItselfStillCounts() public {
        OutshipShipResolver.Ship memory ship = _signedShip();
        vm.warp(ship.deadline);
        _attestAs(builder, builder, _encode(ship));
    }

    function test_RevertWhen_DigestReplayed() public {
        bytes memory data = _encode(_signedShip());
        _attestAs(builder, builder, data);

        vm.expectRevert(OutshipShipResolver.DigestAlreadyUsed.selector);
        _attestAs(builder, builder, data);
    }

    function test_RevertWhen_RecipientIsNotTheAttester() public {
        // The builder's signed payload, submitted by someone else on the builder's behalf.
        bytes memory data = _encode(_signedShip());
        vm.expectRevert(OutshipShipResolver.RecipientNotAttester.selector);
        _attestAs(stranger, builder, data);

        // The builder pointing the receipt at another wallet.
        vm.expectRevert(OutshipShipResolver.RecipientNotAttester.selector);
        _attestAs(builder, stranger, data);
    }

    function test_RevertWhen_SomeoneElseUsesTheSignature() public {
        // A stranger who copies the payload from the mempool and attests it to themselves:
        // the signature was over the builder's address, so it doesn't recover to outship.
        bytes memory data = _encode(_signedShip());
        vm.expectRevert(OutshipShipResolver.InvalidOutshipSignature.selector);
        _attestAs(stranger, stranger, data);

        // ...and the builder can still use it afterwards.
        _attestAs(builder, builder, data);
    }

    function test_RevertWhen_DataTampered() public {
        for (uint256 field = 0; field < 9; field++) {
            OutshipShipResolver.Ship memory ship = _signedShip();
            if (field == 0) ship.repo = "mojeebdev/other";
            if (field == 1) ship.shipType = 1;
            if (field == 2) ship.identifier = "v9.9.9";
            if (field == 3) ship.commitSha = "0000000000000000000000000000000000000000";
            if (field == 4) ship.timestamp += 1;
            if (field == 5) ship.scoreSnapshot = 9_999;
            if (field == 6) ship.githubLogin = "someone-else";
            if (field == 7) ship.shipId = "cmship-forged";
            if (field == 8) ship.deadline += 1 days;

            vm.expectRevert(OutshipShipResolver.InvalidOutshipSignature.selector);
            _attestAs(builder, builder, _encode(ship));
        }
    }

    function test_RevertWhen_AttestationWouldExpire() public {
        AttestationRequest memory request = _request(builder, _encode(_signedShip()));
        request.data.expirationTime = uint64(block.timestamp + 365 days);

        vm.prank(builder);
        vm.expectRevert(OutshipShipResolver.ExpiringAttestation.selector);
        eas.attest(request);
    }

    function test_RevertWhen_ValueSent() public {
        AttestationRequest memory request = _request(builder, _encode(_signedShip()));
        request.data.value = 1;
        vm.deal(builder, 1 ether);

        vm.prank(builder);
        vm.expectRevert();
        eas.attest{ value: 1 }(request);
        assertFalse(resolver.isPayable());
    }

    function test_AttestationsCantBeRevoked() public {
        // The real schema is registered non-revocable, so EAS refuses before asking us.
        bytes32 uid = _attestAs(builder, builder, _encode(_signedShip()));
        vm.prank(builder);
        vm.expectRevert(bytes4(keccak256("Irrevocable()")));
        eas.revoke(RevocationRequest({ schema: schemaUid, data: RevocationRequestData({ uid: uid, value: 0 }) }));

        // Even under a revocable schema pointed at this resolver, onRevoke says no.
        bytes32 revocableSchema = registry.register(
            string.concat(SCHEMA, ",bool spare"), ISchemaResolver(address(resolver)), true
        );
        OutshipShipResolver.Ship memory ship = _ship();
        ship.shipId = "cmship-revocable";
        ship.outshipSig = _sign(signerKey, builder, builder, ship);
        AttestationRequest memory request = _request(builder, _encode(ship));
        request.schema = revocableSchema;
        request.data.revocable = true;
        vm.prank(builder);
        bytes32 revocableUid = eas.attest(request);

        vm.prank(builder);
        vm.expectRevert(bytes4(keccak256("InvalidRevocation()")));
        eas.revoke(
            RevocationRequest({ schema: revocableSchema, data: RevocationRequestData({ uid: revocableUid, value: 0 }) })
        );
    }

    // ── signer rotation ──────────────────────────────────────────────────────

    function test_SignerRotation() public {
        (address nextSigner, uint256 nextKey) = makeAddrAndKey("next-signer");
        OutshipShipResolver.Ship memory signedByOld = _signedShip();

        vm.expectEmit(true, true, false, false, address(resolver));
        emit OutshipShipResolver.OutshipSignerRotated(signer, nextSigner);
        vm.prank(owner);
        resolver.setOutshipSigner(nextSigner);
        assertEq(resolver.outshipSigner(), nextSigner);

        // Signatures from the old key stop working at once, even unused ones.
        vm.expectRevert(OutshipShipResolver.InvalidOutshipSignature.selector);
        _attestAs(builder, builder, _encode(signedByOld));

        OutshipShipResolver.Ship memory signedByNew = _ship();
        signedByNew.outshipSig = _sign(nextKey, builder, builder, signedByNew);
        _attestAs(builder, builder, _encode(signedByNew));
    }

    function test_RevertWhen_StrangerRotatesSigner() public {
        vm.prank(stranger);
        vm.expectRevert("Ownable: caller is not the owner");
        resolver.setOutshipSigner(stranger);
    }

    function test_RevertWhen_RotatingToZero() public {
        vm.prank(owner);
        vm.expectRevert(OutshipShipResolver.ZeroAddress.selector);
        resolver.setOutshipSigner(address(0));
    }

    function test_OwnershipTransferIsTwoStep() public {
        address nextOwner = makeAddr("next-owner");
        vm.prank(owner);
        resolver.transferOwnership(nextOwner);
        assertEq(resolver.owner(), owner);
        assertEq(resolver.pendingOwner(), nextOwner);

        vm.prank(nextOwner);
        resolver.acceptOwnership();
        assertEq(resolver.owner(), nextOwner);
    }

    function test_DeployerIsNotOwner() public view {
        assertEq(resolver.owner(), owner);
        assertEq(resolver.outshipSigner(), signer);
    }

    // ── agreement with the server's signer ───────────────────────────────────

    /// The same inputs as src/lib/attest/__tests__/typed-data.test.ts, so a change on either
    /// side that alters the digest fails one of the two suites.
    function test_DigestMatchesViem() public {
        vm.chainId(84_532);
        address wallet = 0x1111111111111111111111111111111111111111;
        OutshipShipResolver.Ship memory ship;
        ship.repo = "mojeebdev/outship";
        ship.shipType = 1;
        ship.identifier = "42";
        ship.commitSha = "5bcce31f5bcce31f5bcce31f5bcce31f5bcce31f";
        ship.timestamp = 1_790_000_000;
        ship.scoreSnapshot = 77;
        ship.githubLogin = "mojeebdev";
        ship.shipId = "cmship123";
        ship.deadline = 1_790_000_900;

        assertEq(
            resolver.shipDigest(wallet, wallet, ship),
            0x05aaee51f6778d3aca0f0874eb975176b87d40245cff08143cfdd128fdd577c6
        );
    }
}
