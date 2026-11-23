// Deploys ANTcStaking (stake $ANTc on Robinhood Chain, earn gas credits for ANT CHAIN).
//   node scripts/06-antc-staking.js --testnet                     rehearsal: tANT stands in for $ANTc, then stake/unstake check
//   ANTC_TOKEN=0x... node scripts/06-antc-staking.js --mainnet    real deployment on Robinhood Chain (asks you to type "deploy mainnet")
// The owner is the DEPLOYER key. The owner can only choose the redeemer and pause NEW stakes;
// it can never move staked tokens or block unstaking.
import { readFileSync } from "node:fs";
import path from "node:path";
import { parseAbi, formatEther, parseEther, isAddress, getAddress } from "viem";
import { NETWORK, ROOT, parentPublicClient as pub, walletClient, account, loadDeployment, saveDeployment, confirmMainnet } from "./lib.js";

if (!["mainnet", "testnet"].includes(NETWORK)) throw new Error("Run with --testnet (rehearsal) or --mainnet.");
const dep = loadDeployment();
const me = account("DEPLOYER");
const w = walletClient("DEPLOYER");
const art = JSON.parse(readFileSync(path.join(ROOT, "out", "ANTcStaking.sol", "ANTcStaking.json"), "utf8"));
const erc = parseAbi([
  "function name() view returns (string)", "function symbol() view returns (string)", "function decimals() view returns (uint8)",
  "function balanceOf(address) view returns (uint256)", "function approve(address,uint256) returns (bool)",
]);

let tokenAddr;
if (NETWORK === "mainnet") {
  if (!isAddress(process.env.ANTC_TOKEN || "")) throw new Error("Set ANTC_TOKEN to the $ANTc contract address on Robinhood Chain.");
  tokenAddr = getAddress(process.env.ANTC_TOKEN);
} else {
  tokenAddr = getAddress(process.env.ANTC_TOKEN || dep.nativeToken); // tANT stands in for $ANTc on testnet
}
const code = await pub.getBytecode({ address: tokenAddr });
if (!code || code === "0x") throw new Error(`No contract at ${tokenAddr} on ${NETWORK}.`);
const [name, symbol, decimals] = await Promise.all(["name", "symbol", "decimals"].map((f) => pub.readContract({ address: tokenAddr, abi: erc, functionName: f })));
console.log(`network ${NETWORK} | staking token ${tokenAddr} = "${name}" (${symbol}), ${decimals} decimals`);
if (Number(decimals) !== 18) throw new Error("Expected an 18-decimal token; credits are reported with 18 decimals.");
console.log(`deployer/owner ${me.address}: ${formatEther(await pub.getBalance({ address: me.address }))} ETH for gas`);

if (dep.antcStaking?.address && dep.antcStaking.token?.toLowerCase() === tokenAddr.toLowerCase()) {
  throw new Error(`Already deployed for this token at ${dep.antcStaking.address}. Remove antcStaking from deployment.${NETWORK}.json to deploy again.`);
}

await confirmMainnet(`deploy ANTcStaking for ${symbol} at ${tokenAddr}, owned by ${me.address}`);

const hash = await w.deployContract({ abi: art.abi, bytecode: art.bytecode.object, args: [tokenAddr, me.address] });
const r = await pub.waitForTransactionReceipt({ hash });
if (r.status !== "success") throw new Error(`deploy reverted: ${hash}`);
const staking = r.contractAddress;
console.log(`ANTcStaking deployed at ${staking} (tx ${hash})`);
saveDeployment({ antcStaking: { address: staking, token: tokenAddr, owner: me.address, tx: hash, deployedAt: new Date().toISOString() } });

// read back what the chain holds
const read = (f, args = []) => pub.readContract({ address: staking, abi: art.abi, functionName: f, args });
const [onToken, onOwner, open] = await Promise.all([read("token"), read("owner"), read("stakingOpen")]);
const ok = (cond, msg) => { if (!cond) throw new Error(`check failed: ${msg}`); console.log(`  ✓ ${msg}`); };
ok(onToken.toLowerCase() === tokenAddr.toLowerCase(), "token is the one requested");
ok(onOwner.toLowerCase() === me.address.toLowerCase(), "owner is the deployer");
ok(open === true, "staking is open");

if (NETWORK === "testnet") {
  // live rehearsal: stake 1 tANT, watch credits grow, unstake it all
  const amt = parseEther("1");
  const bal0 = await pub.readContract({ address: tokenAddr, abi: erc, functionName: "balanceOf", args: [me.address] });
  ok(bal0 >= amt, "deployer holds at least 1 test token");
  await pub.waitForTransactionReceipt({ hash: await w.writeContract({ address: tokenAddr, abi: erc, functionName: "approve", args: [staking, amt] }) });
  await pub.waitForTransactionReceipt({ hash: await w.writeContract({ address: staking, abi: art.abi, functionName: "stake", args: [amt] }) });
  ok((await read("stakedOf", [me.address])) === amt, "stake recorded");
  await new Promise((res) => setTimeout(res, 20_000));
  const earned = await read("earnedOf", [me.address]);
  ok(earned > 0n, `credits grow while staked (${formatEther(earned)} token-days after ~20 s)`);
  await pub.waitForTransactionReceipt({ hash: await w.writeContract({ address: staking, abi: art.abi, functionName: "unstake", args: [amt] }) });
  ok((await read("stakedOf", [me.address])) === 0n, "unstake returned everything");
  const bal1 = await pub.readContract({ address: tokenAddr, abi: erc, functionName: "balanceOf", args: [me.address] });
  ok(bal1 === bal0, "token balance back to where it started");
  ok((await read("creditsOf", [me.address])) >= earned, "credits kept after unstaking");
}
console.log("done");
