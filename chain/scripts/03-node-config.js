// Writes nodeConfig.<network>.json for the Nitro node (sequencer + batch poster + validator).
// The file contains private keys: it is gitignored and must never be shared.
import { writeFileSync } from "node:fs";
import path from "node:path";
import { prepareNodeConfig } from "@arbitrum/chain-sdk";
import { NETWORK, S, ROOT, CHAIN_NAME, parentChain, env, loadDeployment } from "./lib.js";

const dep = loadDeployment();
if (!dep.coreContracts) throw new Error("Run 02-create-rollup.js first.");

const nodeConfig = prepareNodeConfig({
  chainName: CHAIN_NAME,
  chainConfig: dep.chainConfig,
  coreContracts: dep.coreContracts,
  batchPosterPrivateKey: env("BATCH_POSTER_PRIVATE_KEY"),
  validatorPrivateKey: env("VALIDATOR_PRIVATE_KEY"),
  stakeToken: dep.stakeToken,
  parentChainId: parentChain.id,
  // The node runs on Railway, which has normal DNS, so it uses the official RPC.
  parentChainRpcUrl: process.env.NODE_PARENT_RPC || parentChain.rpcUrls.default.http[0],
});

const out = path.join(ROOT, `nodeConfig.${NETWORK}.json`);
writeFileSync(out, JSON.stringify(nodeConfig, null, 2));
console.log(`Wrote ${out}`);
