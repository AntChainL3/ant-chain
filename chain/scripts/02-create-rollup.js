// Deploys ANT CHAIN core contracts on the parent chain (Rollup mode, BoLD, RollupCreator v3.2),
// with ANT (mainnet/fork) or tANT (testnet) as the custom gas token.
import { readFileSync } from "node:fs";
import path from "node:path";
import { parseEther, formatEther } from "viem";
import { createRollup, createRollupPrepareDeploymentParamsConfig, prepareChainConfig } from "@arbitrum/chain-sdk";
import { NETWORK, S, ROOT, CHAIN_ID, erc20Abi, parentPublicClient, account, walletClient, env, loadDeployment, saveDeployment, confirmMainnet } from "./lib.js";

const dep = loadDeployment();
const nativeToken = S.nativeToken || dep.nativeToken;
if (!nativeToken) throw new Error("No gas token. On testnet run 01-deploy-tant.js first.");
if (dep.coreContracts) {
  console.log(`Rollup already created on ${NETWORK}. See ${S.deploymentFile}.`);
  process.exit(0);
}

const deployer = account("DEPLOYER");
const isProd = NETWORK !== "testnet";

// Pre-flight: balances must cover the deployment before anything is sent.
const eth = await parentPublicClient.getBalance({ address: deployer.address });
const tok = await parentPublicClient.readContract({ address: nativeToken, abi: erc20Abi, functionName: "balanceOf", args: [deployer.address] });
console.log(`Network ${NETWORK} | deployer ${deployer.address}`);
console.log(`  ETH ${formatEther(eth)} | gas token ${formatEther(tok)}`);
if (eth < parseEther("0.002")) throw new Error("Deployer needs at least 0.002 ETH on the parent chain.");
if (tok === 0n) throw new Error("Deployer holds no gas token; it pays the retryable fees that deploy factories on the new chain.");

const chainConfig = prepareChainConfig({
  chainId: CHAIN_ID,
  arbitrum: {
    InitialChainOwner: deployer.address, // moved to the Safe multisig by 05-transfer-ownership.js
    DataAvailabilityCommittee: false, // Rollup mode: all data posted to Robinhood Chain
  },
});

const config = createRollupPrepareDeploymentParamsConfig(parentPublicClient, {
  chainId: BigInt(CHAIN_ID),
  owner: deployer.address,
  chainConfig,
  // Mainnet/fork: SDK default for the parent chain (~6.4 days, same as Arbitrum One / nvdachain).
  ...(isProd ? {} : { confirmPeriodBlocks: 150n }),
  baseStake: parseEther(process.env.BASE_STAKE_WETH || (isProd ? "0.01" : "0.001")),
});

// Fee token pricer: required for a custom-gas-token Rollup chain. Without it the
// batch poster is never reimbursed for the ETH it spends posting batches.
const ethUsdFeed = S.ethUsdFeed || dep.ethUsdFeed;
if (!ethUsdFeed) throw new Error("No ETH/USD feed configured for this network (testnet: run 01b-deploy-mock-feed.js).");
const initialAntUsd = process.env.INITIAL_ANT_USD || (NETWORK === "fork" ? "105" : null);
if (!initialAntUsd) throw new Error("Set INITIAL_ANT_USD (USD per raw ANT, e.g. 97.17) before deploying.");

await confirmMainnet(`Deploy fee token pricer and create rollup ${CHAIN_ID} with gas token ${nativeToken}`);

let feeTokenPricer = dep.feeTokenPricer;
if (!feeTokenPricer) {
  const art = JSON.parse(readFileSync(path.join(ROOT, "out", "AntFeeTokenPricer.sol", "AntFeeTokenPricer.json"), "utf8"));
  const wallet = walletClient("DEPLOYER");
  console.log(`Deploying AntFeeTokenPricer (ETH/USD feed ${ethUsdFeed}, ANT $${initialAntUsd}) ...`);
  const hash = await wallet.deployContract({
    abi: art.abi,
    bytecode: art.bytecode.object,
    args: [deployer.address, env("KEEPER_ADDRESS"), ethUsdFeed, parseEther(initialAntUsd)],
  });
  const r = await parentPublicClient.waitForTransactionReceipt({ hash });
  if (r.status !== "success") throw new Error(`Pricer deploy failed: ${hash}`);
  feeTokenPricer = r.contractAddress;
  const rate = await parentPublicClient.readContract({ address: feeTokenPricer, abi: art.abi, functionName: "currentRate" });
  console.log(`  pricer ${feeTokenPricer} | ${formatEther(rate)} ANT per ETH`);
  saveDeployment({ feeTokenPricer, feeTokenPricerTx: hash });
}

console.log(`Creating rollup ${CHAIN_ID} (confirm period ${config.confirmPeriodBlocks} blocks, stake ${formatEther(config.baseStake)} WETH) ...`);

const { transactionReceipt, coreContracts } = await createRollup({
  params: {
    config,
    batchPosters: [env("BATCH_POSTER_ADDRESS")],
    validators: [env("VALIDATOR_ADDRESS")],
    nativeToken,
    feeTokenPricer,
  },
  account: deployer,
  parentChainPublicClient: parentPublicClient,
});

console.log("Core contracts:", coreContracts);
saveDeployment({
  network: NETWORK,
  chainId: CHAIN_ID,
  nativeToken,
  chainConfig,
  coreContracts,
  stakeToken: config.stakeToken,
  baseStake: config.baseStake,
  confirmPeriodBlocks: config.confirmPeriodBlocks,
  createRollupTx: transactionReceipt.transactionHash,
  createdAtBlock: transactionReceipt.blockNumber,
});
console.log(`Saved to ${S.deploymentFile}`);
