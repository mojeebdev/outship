// SPDX-License-Identifier: Apache-2.0
pragma solidity 0.8.27;

import { Script, console2 } from "forge-std/Script.sol";
import { IEAS } from "@ethereum-attestation-service/eas-contracts/contracts/IEAS.sol";
import { ISchemaRegistry } from "@ethereum-attestation-service/eas-contracts/contracts/ISchemaRegistry.sol";
import { ISchemaResolver } from "@ethereum-attestation-service/eas-contracts/contracts/resolver/ISchemaResolver.sol";
import { OutshipShipResolver } from "../src/OutshipShipResolver.sol";

/// Deploys OutshipShipResolver against Base's EAS predeploy and, unless told not to,
/// registers schema v2 with it (non-revocable) in the same broadcast.
///
/// No key ever lives in this file or in env vars it reads: the deploying wallet comes from
/// forge's own flags (--account <keystore>, --ledger, ...). Env:
///   OUTSHIP_OWNER    address that may rotate the signer (use a wallet you hold offline)
///   OUTSHIP_SIGNER   address of OUTSHIP_ATTESTER_PRIVATE_KEY (signs only, needs no funds)
///   REGISTER_SCHEMA  optional, "false" to deploy without registering
///
///   forge script script/Deploy.s.sol --rpc-url https://sepolia.base.org --account deployer --broadcast
contract Deploy is Script {
    // OP-stack predeploys: the same addresses on Base mainnet and Base Sepolia.
    IEAS internal constant EAS = IEAS(0x4200000000000000000000000000000000000021);
    ISchemaRegistry internal constant REGISTRY = ISchemaRegistry(0x4200000000000000000000000000000000000020);

    // Must equal SHIP_ATTESTATION_SCHEMA in src/lib/web3/eas.ts, character for character.
    string internal constant SCHEMA =
        "string repo,uint8 shipType,string identifier,string commitSha,uint64 timestamp,uint16 scoreSnapshot,"
        "string githubLogin,string shipId,uint64 deadline,bytes outshipSig";

    function run() external returns (OutshipShipResolver resolver, bytes32 schemaUid) {
        address owner = vm.envAddress("OUTSHIP_OWNER");
        address signer = vm.envAddress("OUTSHIP_SIGNER");
        bool register = vm.envOr("REGISTER_SCHEMA", true);

        vm.startBroadcast();
        resolver = new OutshipShipResolver(EAS, owner, signer);
        if (register) schemaUid = REGISTRY.register(SCHEMA, ISchemaResolver(address(resolver)), false);
        vm.stopBroadcast();

        console2.log("OutshipShipResolver:", address(resolver));
        console2.log("owner:", owner);
        console2.log("outshipSigner:", signer);
        if (register) {
            console2.log("schema v2 UID:");
            console2.logBytes32(schemaUid);
        }
    }
}
