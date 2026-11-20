// Deploys the TestANT (tANT) gas token on Robinhood Chain Testnet.
import { readFileSync } from "node:fs";
import path from "node:path";
import { parseEther } from "viem";
import { NETWORK, ROOT, parentPublicClient, walletClient, account, loadDeployment, saveDeployment } from "./lib.js";

if (NETWORK !== "testnet") {
  console.log("tANT is testnet-only. Mainnet uses the real ANT Stock Token.");
  process.exit(0);
}

const existing = loadDeployment().nativeToken;
if (existing) {
  console.log(`tANT already deployed at ${existing}. Delete it from deployment.json to redeploy.`);
  process.exit(0);
}

const artifact = JSON.parse(readFileSync(path.join(ROOT, "out", "TestANT.sol", "TestANT.json"), "utf8"));
const deployer = account("DEPLOYER");
const wallet = walletClient("DEPLOYER");

console.log(`Deploying tANT from ${deployer.address} ...`);
const hash = await wallet.deployContract({
  abi: artifact.abi,
  bytecode: artifact.bytecode.object,
  args: [deployer.address],
});
const receipt = await parentPublicClient.waitForTransactionReceipt({ hash });
if (receipt.status !== "success") throw new Error(`Deploy failed: ${hash}`);
const tant = receipt.contractAddress;
console.log(`tANT deployed: ${tant} (tx ${hash})`);

// Seed the deployer: rollup creation and token bridge creation pay retryable
// fees on the new chain in the native token.
const mintHash = await wallet.writeContract({
  address: tant,
  abi: artifact.abi,
  functionName: "mint",
  args: [deployer.address, parseEther("1000000")],
});
await parentPublicClient.waitForTransactionReceipt({ hash: mintHash });
console.log("Minted 1,000,000 tANT to deployer.");

saveDeployment({ nativeToken: tant, nativeTokenTx: hash });
