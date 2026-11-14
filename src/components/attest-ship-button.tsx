"use client";

import { useState } from "react";
import {
  connect,
  getAccount,
  simulateContract,
  switchChain,
  waitForTransactionReceipt,
  writeContract,
} from "wagmi/actions";
import { injected } from "wagmi/connectors";
import {
  BaseError,
  ContractFunctionRevertedError,
  UserRejectedRequestError,
  type Address,
  type Hex,
} from "viem";
import { Web3Provider } from "@/components/web3-provider";
import { wagmiConfig, activeChain } from "@/lib/web3/config";
import { EAS_ABI } from "@/lib/web3/eas-abi";
import { EAS_CONTRACT_ADDRESS, isAttestationConfigured } from "@/lib/web3/eas";
import { AttestationBadge } from "@/components/attestation-badge";
import { IconSeal } from "@/components/icons";

type Authorization = {
  chainId: number;
  deadline: number;
  request: {
    schema: Hex;
    data: {
      recipient: Address;
      expirationTime: string;
      revocable: boolean;
      refUID: Hex;
      data: Hex;
      value: string;
    };
  };
};

type Phase =
  | { kind: "idle" }
  | { kind: "busy"; label: string }
  | { kind: "wrong-network" }
  | { kind: "rejected" }
  | { kind: "expired" }
  | { kind: "error"; message: string }
  | { kind: "done"; uid: string };

class ExpiredError extends Error {}

const revertName = (error: unknown): string | undefined => {
  if (!(error instanceof BaseError)) return undefined;
  const reverted = error.walk((e) => e instanceof ContractFunctionRevertedError);
  return reverted instanceof ContractFunctionRevertedError ? reverted.data?.errorName : undefined;
};

const isUserRejection = (error: unknown) =>
  error instanceof BaseError
    ? Boolean(error.walk((e) => e instanceof UserRejectedRequestError))
    : (error as { code?: number } | null)?.code === 4001;

async function postJson(url: string, body: unknown) {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const json = (await response.json().catch(() => ({}))) as Record<string, unknown>;
  return { status: response.status, ok: response.ok, json };
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function AttestFlow({ shipId }: { shipId: string }) {
  const [phase, setPhase] = useState<Phase>({ kind: "idle" });

  async function ensureWallet(): Promise<Address> {
    let account = getAccount(wagmiConfig);
    if (!account.address) {
      setPhase({ kind: "busy", label: "connect your wallet…" });
      await connect(wagmiConfig, { connector: injected() });
      account = getAccount(wagmiConfig);
    }
    if (!account.address) throw new Error("no wallet account available");

    if (account.chainId !== activeChain.id) {
      setPhase({ kind: "busy", label: `switch to ${activeChain.name}…` });
      try {
        await switchChain(wagmiConfig, { chainId: activeChain.id });
      } catch (error) {
        if (isUserRejection(error)) throw error;
        throw Object.assign(new Error("wrong network"), { wrongNetwork: true });
      }
    }
    return account.address;
  }

  async function authorize(recipient: Address): Promise<Authorization> {
    setPhase({ kind: "busy", label: "signing with outship…" });
    const { ok, json } = await postJson(`/api/ships/${shipId}/attest/authorize`, { recipient });
    if (!ok) throw new Error(typeof json.error === "string" ? json.error : "couldn't authorize this attestation");
    return json as unknown as Authorization;
  }

  async function submit(auth: Authorization, account: Address): Promise<Hex> {
    // Leave a margin for the wallet prompt and block inclusion.
    if (auth.deadline - 30 < Date.now() / 1000) throw new ExpiredError();
    const args = [
      {
        schema: auth.request.schema,
        data: {
          ...auth.request.data,
          expirationTime: BigInt(auth.request.data.expirationTime),
          value: BigInt(auth.request.data.value),
        },
      },
    ] as const;

    // Simulate first, so a resolver refusal (an expired signature, say) shows
    // up here with its reason instead of as a failed transaction.
    try {
      await simulateContract(wagmiConfig, {
        address: EAS_CONTRACT_ADDRESS,
        abi: EAS_ABI,
        functionName: "attest",
        args,
        account,
        chainId: activeChain.id,
      });
    } catch (error) {
      if (revertName(error) === "SignatureExpired") throw new ExpiredError();
      throw error;
    }

    setPhase({ kind: "busy", label: "confirm in wallet…" });
    // The builder's wallet sends it and pays the gas; the receipt is theirs.
    return writeContract(wagmiConfig, {
      address: EAS_CONTRACT_ADDRESS,
      abi: EAS_ABI,
      functionName: "attest",
      args,
      account,
      chainId: activeChain.id,
    });
  }

  async function save(txHash: Hex): Promise<string> {
    setPhase({ kind: "busy", label: "verifying onchain…" });
    // The server reads the tx back from Base; its RPC can lag the wallet's by
    // a few seconds, so a "not found yet" is retried rather than reported.
    for (let attempt = 0; attempt < 10; attempt++) {
      const { status, ok, json } = await postJson(`/api/ships/${shipId}/attest`, { txHash });
      const attestation = json.attestation as { easUid?: string } | undefined;
      if (ok && attestation?.easUid) return attestation.easUid;
      if (status !== 202) throw new Error(typeof json.error === "string" ? json.error : "couldn't save the attestation");
      await sleep(1500 + attempt * 500);
    }
    throw new Error("saved onchain, but outship couldn't confirm it yet — refresh in a minute");
  }

  async function run() {
    try {
      const account = await ensureWallet();
      const auth = await authorize(account);
      const hash = await submit(auth, account);
      setPhase({ kind: "busy", label: "waiting for base…" });
      const receipt = await waitForTransactionReceipt(wagmiConfig, { hash, chainId: activeChain.id });
      if (receipt.status !== "success") throw new Error("the transaction failed onchain");
      setPhase({ kind: "done", uid: await save(hash) });
    } catch (error) {
      if (error instanceof ExpiredError) setPhase({ kind: "expired" });
      else if (isUserRejection(error)) setPhase({ kind: "rejected" });
      else if ((error as { wrongNetwork?: boolean }).wrongNetwork) setPhase({ kind: "wrong-network" });
      else {
        const message =
          error instanceof BaseError ? error.shortMessage : error instanceof Error ? error.message : "attestation failed";
        setPhase({ kind: "error", message });
      }
    }
  }

  if (phase.kind === "done") return <AttestationBadge chain={activeChain.name} easUid={phase.uid} schemaVersion={2} />;

  const busy = phase.kind === "busy";
  const label = busy
    ? phase.label
    : phase.kind === "expired"
      ? "re-authorize"
      : phase.kind === "idle"
        ? "attest onchain"
        : "try again";
  const note =
    phase.kind === "wrong-network"
      ? `switch your wallet to ${activeChain.name}, then try again.`
      : phase.kind === "rejected"
        ? "you rejected it in your wallet. nothing was sent."
        : phase.kind === "expired"
          ? "outship's signature expired before it was sent. it's good for 15 minutes; get a fresh one."
          : phase.kind === "error"
            ? phase.message
            : null;

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        onClick={run}
        disabled={busy}
        className="flex shrink-0 items-center gap-1.5 rounded-full border border-base-blue px-3 py-1 text-xs font-medium text-base-blue transition hover:bg-blue-tint disabled:opacity-50"
      >
        <IconSeal className="h-3 w-3" aria-hidden="true" />
        {label}
      </button>
      {note && (
        <span role="status" className="max-w-[220px] text-right text-xs text-text-muted-2">
          {note}
        </span>
      )}
    </div>
  );
}

export function AttestShipButton({ shipId }: { shipId: string }) {
  if (!isAttestationConfigured()) {
    return <span className="text-xs text-text-muted-2">attestations coming soon</span>;
  }

  return (
    <Web3Provider>
      <AttestFlow shipId={shipId} />
    </Web3Provider>
  );
}
