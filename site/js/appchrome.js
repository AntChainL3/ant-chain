// Shared chrome for the app pages: live ANT price in the header (from our fee pricer on Robinhood Chain).
import { l2, viem } from "./wallet.js";

import { ADDR } from "./config.js";
const PRICER = ADDR.pricer;
const abi = viem.parseAbi(["function antUsd() view returns (uint256)"]);
const els = [...document.querySelectorAll("[data-app-price]")];

async function price() {
  try {
    const v = await l2.readContract({ address: PRICER, abi, functionName: "antUsd" });
    const t = `$${(Number(v) / 1e18).toFixed(2)}`;
    els.forEach((el) => { el.textContent = t; });
  } catch {
    els.forEach((el) => { if (el.textContent === "…") el.textContent = "—"; });
  }
}
price();
setInterval(price, 30_000);
