// Sends parent-chain ETH from the deployer to the batch poster and validator (amounts in ETH via env).
import { parseEther, formatEther } from "viem";
import { NETWORK, parentPublicClient, walletClient, env, confirmMainnet } from "./lib.js";

const plan = [
  ["BATCH_POSTER", process.env.FUND_BATCH_POSTER || "0.002"],
  ["VALIDATOR", process.env.FUND_VALIDATOR || "0.003"],
];
await confirmMainnet(`Fund operators: ${plan.map(([r, a]) => `${r} ${a} ETH`).join(", ")}`);
const w = walletClient("DEPLOYER");
for (const [role, amt] of plan) {
  const to = env(`${role}_ADDRESS`);
  const have = await parentPublicClient.getBalance({ address: to });
  if (have >= parseEther(amt)) { console.log(`${role} already has ${formatEther(have)} ETH`); continue; }
  const hash = await w.sendTransaction({ to, value: parseEther(amt) - have });
  await parentPublicClient.waitForTransactionReceipt({ hash });
  console.log(`${role} ${to} topped up to ${amt} ETH (${hash})`);
}
console.log(`[${NETWORK}] done`);
