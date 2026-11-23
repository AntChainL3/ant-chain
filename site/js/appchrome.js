// Shared chrome for the app pages: live ANT price in the header, read from the mainnet fee pricer
// on Robinhood Chain (kept in line with the market by the keeper). Read-only.
import { viem } from "./wallet.js";
import { PRICE_SOURCE } from "./config.js";

const { createPublicClient, http, fallback, parseAbi } = viem;
const client = createPublicClient({ transport: fallback(PRICE_SOURCE.rpcs.map((u) => http(u, { timeout: 15_000 }))) });
const abi = parseAbi(["function antUsd() view returns (uint256)"]);
const els = [...document.querySelectorAll("[data-app-price]")];

async function price() {
  try {
    const v = await client.readContract({ address: PRICE_SOURCE.pricer, abi, functionName: "antUsd" });
    const t = `$${(Number(v) / 1e18).toFixed(2)}`;
    els.forEach((el) => { el.textContent = t; });
  } catch {
    els.forEach((el) => { if (el.textContent === "…") el.textContent = "—"; });
  }
}
price();
setInterval(price, 30_000);
