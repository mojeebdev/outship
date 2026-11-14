// SPDX-License-Identifier: Apache-2.0
pragma solidity 0.8.19;

// Nothing to run here. Importing the real EAS contracts makes Foundry compile them
// with the compiler they pin (0.8.19), so the tests can deploy them with deployCode
// and exercise the resolver through EAS exactly as Base's predeploy calls it.
import { EAS } from "@ethereum-attestation-service/eas-contracts/contracts/EAS.sol";
import { SchemaRegistry } from "@ethereum-attestation-service/eas-contracts/contracts/SchemaRegistry.sol";
