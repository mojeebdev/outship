"use client";

import { useState } from "react";
import { useAccount } from "wagmi";
import { connect, writeContract, waitForTransactionReceipt } from "wagmi/actions";
import { injected } from "wagmi/connectors";
import { decodeEventLog, zeroHash, type Hex } from "viem";
import { SchemaEncoder } from "@ethereum-attestation-service/eas-sdk";
import { Web3Provider } from "@/components/web3-provider";
import { wagmiConfig, activeChain } from "@/lib/web3/config";
import {
  EAS_CONTRACT_ADDRESS,
  SHIP_ATTESTATION_SCHEMA,
  SHIP_ATTESTATION_SCHEMA_UID,
  isAttestationConfigured,
} from "@/lib/web3/eas";
import { AttestationBadge } from "@/components/attestation-badge";
import { IconSeal } from "@/components/icons";

const EAS_ABI = [
  {
    inputs: [
      {
        components: [
          { name: "schema", type: "bytes32" },
          {
            components: [
              { name: "recipient", type: "address" },
              { name: "expirationTime", type: "uint64" },
              { name: "revocable", type: "bool" },
              { name: "refUID", type: "bytes32" },
              { name: "data", type: "bytes" },
              { name: "value", type: "uint256" },
            ],
            name: "data",
            type: "tuple",
          },
        ],
        name: "request",
        type: "tuple",
      },
    ],
    name: "attest",
    outputs: [{ name: "", type: "bytes32" }],
    stateMutability: "payable",
    type: "function",
  },
  {
    anonymous: false,
    inputs: [
      { indexed: true, name: "recipient", type: "address" },
      { indexed: true, name: "attester", type: "address" },
      { indexed: false, name: "uid", type: "bytes32" },
      { indexed: true, name: "schemaUID", type: "bytes32" },
    ],
    name: "Attested",
    type: "event",
  },
] as const;

export type ShipInput = {
  id: string;
  repo: string;
  shipType: "RELEASE" | "MERGE";
  identifier: string;
  commitSha: string;
  shippedAtIso: string;
};

type Status = "idle" | "attesting" | "saving" | "done" | "error";

function AttestFlow({ ship, score }: { ship: ShipInput; score: number }) {
  const { address } = useAccount({ config: wagmiConfig });
  const [status, setStatus] = useState<Status>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [attestedUid, setAttestedUid] = useState<string | null>(null);

  async function handleClick() {
    setErrorMessage(null);
    try {
      let account = address;
      if (!account) {
        const result = await connect(wagmiConfig, { connector: injected() });
        account = result.accounts[0];
      }
      if (!account) throw new Error("no wallet account available");

      setStatus("attesting");

      const encoder = new SchemaEncoder(SHIP_ATTESTATION_SCHEMA);
      const data = encoder.encodeData([
        { name: "repo", value: ship.repo, type: "string" },
        { name: "shipType", value: ship.shipType === "RELEASE" ? 0 : 1, type: "uint8" },
        { name: "identifier", value: ship.identifier, type: "string" },
        { name: "commitSha", value: ship.commitSha, type: "string" },
        {
          name: "timestamp",
          value: BigInt(Math.floor(new Date(ship.shippedAtIso).getTime() / 1000)),
          type: "uint64",
        },
        { name: "scoreSnapshot", value: score, type: "uint16" },
      ]) as Hex;

      const hash = await writeContract(wagmiConfig, {
        address: EAS_CONTRACT_ADDRESS,
        abi: EAS_ABI,
        functionName: "attest",
        args: [
          {
            schema: SHIP_ATTESTATION_SCHEMA_UID as Hex,
            data: {
              recipient: account,
              expirationTime: BigInt(0),
              revocable: true,
              refUID: zeroHash,
              data,
              value: BigInt(0),
            },
          },
        ],
        chainId: activeChain.id,
      });

      const receipt = await waitForTransactionReceipt(wagmiConfig, { hash });

      let easUid: string | null = null;
      for (const log of receipt.logs) {
        try {
          const decoded = decodeEventLog({
            abi: EAS_ABI,
            data: log.data,
            topics: log.topics,
          });
          if (decoded.eventName === "Attested") {
            easUid = decoded.args.uid;
            break;
          }
        } catch {
          // not the Attested log, skip
        }
      }
      if (!easUid) throw new Error("couldn't read the attestation UID from the transaction");

      setStatus("saving");

      const response = await fetch(`/api/ships/${ship.id}/attest`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ easUid, txHash: hash, chain: activeChain.name }),
      });
      if (!response.ok) throw new Error(await response.text());

      setAttestedUid(easUid);
      setStatus("done");
    } catch (error) {
      setStatus("error");
      setErrorMessage(error instanceof Error ? error.message : "attestation failed");
    }
  }

  if (status === "done" && attestedUid) {
    return <AttestationBadge chain={activeChain.name} easUid={attestedUid} />;
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        onClick={handleClick}
        disabled={status === "attesting" || status === "saving"}
        className="flex shrink-0 items-center gap-1.5 rounded-full border border-base-blue px-3 py-1 text-xs font-medium text-base-blue transition hover:bg-blue-tint disabled:opacity-50"
      >
        <IconSeal className="h-3 w-3" />
        {status === "attesting"
          ? "confirm in wallet…"
          : status === "saving"
            ? "saving…"
            : "attest onchain"}
      </button>
      {status === "error" && errorMessage && (
        <span className="max-w-[180px] text-right text-xs text-text-muted-2">
          {errorMessage}
        </span>
      )}
    </div>
  );
}

export function AttestShipButton({ ship, score }: { ship: ShipInput; score: number }) {
  if (!isAttestationConfigured()) {
    return (
      <span className="text-xs text-text-muted-2">attestations coming soon</span>
    );
  }

  return (
    <Web3Provider>
      <AttestFlow ship={ship} score={score} />
    </Web3Provider>
  );
}
