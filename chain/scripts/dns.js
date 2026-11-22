// Cloudflare DNS for antchain.tech: creates or updates the records ANT CHAIN needs.
// Records are DNS only (not proxied) so Railway can verify the domain and issue certificates.
// Env (.env): CLOUDFLARE_API_TOKEN (scoped to Zone.DNS:Edit on antchain.tech only), optional CLOUDFLARE_ZONE=antchain.tech
// Usage: node scripts/dns.js            show what would change
//        node scripts/dns.js --apply    write the changes
import { config } from "dotenv";
import { fileURLToPath } from "node:url";
config({ path: fileURLToPath(new URL("../../.env", import.meta.url)), quiet: true });

const ZONE = process.env.CLOUDFLARE_ZONE || "antchain.tech";
const TOKEN = process.env.CLOUDFLARE_API_TOKEN;
if (!TOKEN) throw new Error("Set CLOUDFLARE_API_TOKEN in .env (Cloudflare → My Profile → API Tokens → Edit zone DNS, zone antchain.tech).");
const APPLY = process.argv.includes("--apply");

// name is relative to the zone ("@" = root). Values come from `railway domain status`.
const RECORDS = [
  // website (service: website)
  { type: "CNAME", name: "@", content: "yvzkgiem.up.railway.app" },
  { type: "TXT", name: "_railway-verify", content: "railway-verify=b48d494fa1078edeb633e0af71451246e0aeb8c8b0c35239bccffe671df0b7fe" },
  { type: "CNAME", name: "www", content: "mteg1gcw.up.railway.app" },
  { type: "TXT", name: "_railway-verify.www", content: "railway-verify=bdd271b000c9ead77d42964f59570212e3cc7517881e776fabaee0fb7bf4bdf3" },
  // testnet RPC (service: nitro-testnet, port 8449)
  { type: "CNAME", name: "rpc.testnet", content: "wz8dnhbe.up.railway.app" },
  { type: "TXT", name: "_railway-verify.rpc.testnet", content: "railway-verify=27a2fefefd4edb356cd15557a34d43da80fdb082f289e94971fe8316fba8caab" },
  // mainnet RPC (service: nitro-node, port 8449; answers once mainnet is running again)
  { type: "CNAME", name: "rpc", content: "5jm7j1gk.up.railway.app" },
  { type: "TXT", name: "_railway-verify.rpc", content: "railway-verify=141040543cbe44cff3fc0df7a9948d9b5485ea636755259382ab34ffe45c7a03" },
];

const api = async (path, init = {}) => {
  const r = await fetch(`https://api.cloudflare.com/client/v4${path}`, {
    ...init, headers: { authorization: `Bearer ${TOKEN}`, "content-type": "application/json" },
  });
  const j = await r.json();
  if (!j.success) throw new Error(`${init.method || "GET"} ${path}: ${JSON.stringify(j.errors)}`);
  return j.result;
};

const [zone] = await api(`/zones?name=${ZONE}`);
if (!zone) throw new Error(`Zone ${ZONE} not found for this token.`);
const fqdn = (n) => (n === "@" ? ZONE : `${n}.${ZONE}`);
const norm = (t, c) => (t === "TXT" ? c.replace(/^"|"$/g, "") : c.replace(/\.$/, "").toLowerCase());

let changes = 0;
for (const want of RECORDS) {
  const name = fqdn(want.name);
  const existing = await api(`/zones/${zone.id}/dns_records?name=${name}&per_page=100`);
  const same = existing.filter((r) => r.type === want.type);
  // CNAME cannot coexist with other records on the same name: old A/AAAA/CNAME there are replaced
  const conflicts = want.type === "CNAME" ? existing.filter((r) => ["A", "AAAA", "CNAME"].includes(r.type)) : [];
  const match = same.find((r) => norm(r.type, r.content) === norm(want.type, want.content) && (want.type === "TXT" || !r.proxied));
  if (match) { console.log(`ok       ${want.type.padEnd(5)} ${name}`); continue; }
  changes++;
  const body = JSON.stringify({ type: want.type, name, content: want.content, ttl: 1, ...(want.type === "CNAME" ? { proxied: false } : {}) });
  const target = want.type === "CNAME" ? conflicts[0] : same.find((r) => r.content.includes("railway-verify"));
  console.log(`${target ? "update" : "create"}   ${want.type.padEnd(5)} ${name} -> ${want.content.slice(0, 60)}`);
  if (!APPLY) continue;
  if (target) await api(`/zones/${zone.id}/dns_records/${target.id}`, { method: "PUT", body });
  else await api(`/zones/${zone.id}/dns_records`, { method: "POST", body });
  for (const extra of conflicts.slice(target ? 1 : 0)) {
    console.log(`delete   ${extra.type.padEnd(5)} ${name} (${extra.content}) conflicts with the CNAME`);
    await api(`/zones/${zone.id}/dns_records/${extra.id}`, { method: "DELETE" });
  }
}
console.log(changes ? (APPLY ? `${changes} change(s) written.` : `${changes} change(s) pending; run with --apply to write them.`) : "Everything is already in place.");
