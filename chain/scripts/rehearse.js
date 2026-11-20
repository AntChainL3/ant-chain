// Fork rehearsal: runs the mainnet deployment against a local Anvil fork of
// Robinhood Chain mainnet, using the real ANT token and real RollupCreator,
// then verifies the result. Costs nothing. Mainnet scripts stay locked until it passes.
import { spawn, execFileSync } from "node:child_process";
import { existsSync, rmSync } from "node:fs";
import path from "node:path";
import { createTestClient, createPublicClient, http, parseEther, parseAbi, formatEther } from "viem";

process.env.NETWORK = "fork";
const { ROOT, FORK_RPC, ANT_TOKEN, S, env, erc20Abi, loadDeployment, saveForkRehearsal, parentChain } = await import("./lib.js");

const UPSTREAM = process.env.FORK_UPSTREAM_RPC || "https://robinhood.drpc.org"; // DNS-safe public RPC
const ANT_DONOR = process.env.ANT_DONOR || "0x6f02324d20cc679d0e585290caa6b16bacbc0f77"; // holds ANT on mainnet (fork only)

const checks = [];
function check(name, ok, detail = "") {
  checks.push({ name, ok: !!ok, detail: String(detail) });
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? `  (${detail})` : ""}`);
}

// 1. start the fork
console.log(`Starting Anvil fork of Robinhood Chain mainnet via ${UPSTREAM} ...`);
const anvil = spawn("anvil", ["--fork-url", UPSTREAM, "--chain-id", "4663", "--port", "8545", "--silent", "--no-rate-limit"], { stdio: "ignore" });
const stop = () => { if (process.env.KEEP_FORK) return; try { anvil.kill(); } catch {} };
process.on("exit", stop);

const transport = http(FORK_RPC, { timeout: 180_000 });
const pub = createPublicClient({ chain: parentChain, transport });
const test = createTestClient({ chain: parentChain, mode: "anvil", transport });
for (let i = 0; ; i++) {
  try { await pub.getBlockNumber(); break; } catch { if (i > 60) throw new Error("Anvil did not start"); await new Promise((r) => setTimeout(r, 1000)); }
}
check("fork is up", true, `block ${await pub.getBlockNumber()}`);

try {
  // 2a. Anvil lacks Arbitrum precompiles; install a stand-in ArbSys at 0x64 (fork only).
  const { readFileSync } = await import("node:fs");
  const arbSys = JSON.parse(readFileSync(path.join(ROOT, "out", "ArbSysMock.sol", "ArbSysMock.json"), "utf8"));
  await test.setCode({ address: "0x0000000000000000000000000000000000000064", bytecode: arbSys.deployedBytecode.object });
  check("ArbSys stand-in installed on fork", true, "arbOSVersion 116 = ArbOS 61, as on Robinhood mainnet");
  const arbGas = JSON.parse(readFileSync(path.join(ROOT, "out", "ArbGasInfoMock.sol", "ArbGasInfoMock.json"), "utf8"));
  await test.setCode({ address: "0x000000000000000000000000000000000000006C", bytecode: arbGas.deployedBytecode.object });
  check("ArbGasInfo stand-in installed on fork", true, "L1 base fee estimate 0, min gas price 0.02 gwei");

  // 2. fund operator wallets on the fork only
  // Use the wallets' REAL mainnet balances whenever they are funded, so the rehearsal
  // fails exactly where mainnet would (e.g. not enough ANT). Only empty wallets get test funds.
  let usedRealBalances = true;
  for (const role of ["DEPLOYER", "BATCH_POSTER", "VALIDATOR", "KEEPER"]) {
    const a = env(`${role}_ADDRESS`);
    if ((await pub.getBalance({ address: a })) === 0n) {
      usedRealBalances = false;
      await test.setBalance({ address: a, value: parseEther("1") });
    }
  }
  await test.setBalance({ address: ANT_DONOR, value: parseEther("1") });
  await test.impersonateAccount({ address: ANT_DONOR });
  const deployerAnt = await pub.readContract({ address: ANT_TOKEN, abi: erc20Abi, functionName: "balanceOf", args: [env("DEPLOYER_ADDRESS")] });
  const donorBal = await pub.readContract({ address: ANT_TOKEN, abi: erc20Abi, functionName: "balanceOf", args: [ANT_DONOR] });
  // Real ANT balance present: only move a dust amount to prove transfers work, then
  // send it back so the deployer keeps exactly its mainnet balance.
  const amount = deployerAnt > 0n ? 1n : (donorBal < parseEther("2") ? donorBal : parseEther("2"));
  if (deployerAnt === 0n) usedRealBalances = false;
  const { createWalletClient } = await import("viem");
  const donor = createWalletClient({ chain: parentChain, transport, account: ANT_DONOR });
  const tx = await donor.writeContract({ address: ANT_TOKEN, abi: erc20Abi, functionName: "transfer", args: [env("DEPLOYER_ADDRESS"), amount] });
  const rcpt = await pub.waitForTransactionReceipt({ hash: tx });
  await test.stopImpersonatingAccount({ address: ANT_DONOR });
  check("real ANT transfers work (not paused, deployer not blocked)", rcpt.status === "success", `${formatEther(amount)} ANT`);
  if (deployerAnt > 0n) {
    await test.impersonateAccount({ address: env("DEPLOYER_ADDRESS") });
    const back = createWalletClient({ chain: parentChain, transport, account: env("DEPLOYER_ADDRESS") });
    await pub.waitForTransactionReceipt({ hash: await back.writeContract({ address: ANT_TOKEN, abi: erc20Abi, functionName: "transfer", args: [ANT_DONOR, 1n] }) });
    await test.stopImpersonatingAccount({ address: env("DEPLOYER_ADDRESS") });
  }
  check("rehearsal uses real mainnet wallet balances", usedRealBalances, usedRealBalances ? "exact" : "some wallets empty: test funds used, mainnet stays locked");

  // 3. run the real deployment scripts against the fork
  const depFile = path.join(ROOT, S.deploymentFile);
  if (existsSync(depFile)) rmSync(depFile);
  const run = (script) => execFileSync(process.execPath, [path.join(ROOT, "scripts", script)], { env: { ...process.env, NETWORK: "fork" }, stdio: "inherit" });
  run("02-create-rollup.js");
  run("03-node-config.js");
  const dep = loadDeployment();
  check("rollup created", !!dep.coreContracts, dep.createRollupTx);

  // 4. verify what was deployed
  const c = dep.coreContracts;
  for (const k of ["rollup", "inbox", "outbox", "bridge", "sequencerInbox", "upgradeExecutor"]) {
    const code = await pub.getBytecode({ address: c[k] });
    check(`${k} has code`, code && code.length > 2, c[k]);
  }
  const pricerOnInbox = await pub.readContract({ address: c.sequencerInbox, abi: parseAbi(["function feeTokenPricer() view returns (address)"]), functionName: "feeTokenPricer" });
  check("sequencer inbox uses our fee token pricer", pricerOnInbox.toLowerCase() === String(dep.feeTokenPricer).toLowerCase(), pricerOnInbox);
  const rate = await pub.readContract({ address: dep.feeTokenPricer, abi: parseAbi(["function currentRate() view returns (uint256)"]), functionName: "currentRate" });
  check("pricer returns a sane ANT-per-ETH rate from live Chainlink ETH/USD", rate > parseEther("1") && rate < parseEther("1000"), `${formatEther(rate)} ANT/ETH`);
  const bridgeToken = await pub.readContract({ address: c.bridge, abi: parseAbi(["function nativeToken() view returns (address)"]), functionName: "nativeToken" });
  check("bridge gas token is real ANT", bridgeToken.toLowerCase() === ANT_TOKEN.toLowerCase(), bridgeToken);
  const isPoster = await pub.readContract({ address: c.sequencerInbox, abi: parseAbi(["function isBatchPoster(address) view returns (bool)"]), functionName: "isBatchPoster", args: [env("BATCH_POSTER_ADDRESS")] });
  check("batch poster authorised", isPoster);
  const isValidator = await pub.readContract({ address: c.rollup, abi: parseAbi(["function isValidator(address) view returns (bool)"]), functionName: "isValidator", args: [env("VALIDATOR_ADDRESS")] });
  check("validator allowlisted", isValidator);
  const blocked = await pub.readContract({ address: "0xe10b6f6b275de231345c20d14ab812db62151b00", abi: parseAbi(["function isBlocked(address) view returns (bool)"]), functionName: "isBlocked", args: [c.bridge] });
  check("bridge escrow not blocked by Robinhood registry", !blocked);
  const chainId = await pub.readContract({ address: c.rollup, abi: parseAbi(["function chainId() view returns (uint256)"]), functionName: "chainId" });
  check("rollup chain ID", Number(chainId) === S.chainId, chainId);
  check("node config written", existsSync(path.join(ROOT, "nodeConfig.fork.json")));
} catch (e) {
  check("rehearsal completed without errors", false, e.shortMessage || e.message);
}

const passed = checks.every((x) => x.ok);
saveForkRehearsal({ passed, at: new Date().toISOString(), checks });
console.log(`\nRehearsal ${passed ? "PASSED - mainnet scripts unlocked" : "FAILED - mainnet stays locked"}`);
stop();
process.exit(passed ? 0 : 1);
