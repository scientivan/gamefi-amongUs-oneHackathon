import { readFileSync, readdirSync, rmSync, existsSync } from "fs";
import { execSync } from "child_process";
import { SuiClient } from "@onelabs/sui/client";
import { Ed25519Keypair } from "@onelabs/sui/keypairs/ed25519";
import { decodeSuiPrivateKey } from "@onelabs/sui/cryptography";
import { Transaction } from "@onelabs/sui/transactions";

const RPC = "https://rpc-testnet.onelabs.cc:443";
const PRIVATE_KEY = process.env.PRIVATE_KEY || "suiprivkey1qzqnezul03hq028jptlufcwsw0540f8yw24zs95dka0acrnw8r3q7w43t35";

// ── Setup client & keypair ──────────────────────────────────────────────────
const keypair = PRIVATE_KEY.startsWith("suiprivkey")
  ? Ed25519Keypair.fromSecretKey(decodeSuiPrivateKey(PRIVATE_KEY).secretKey)
  : Ed25519Keypair.fromSecretKey(Buffer.from(PRIVATE_KEY.replace("0x", ""), "hex"));

const client = new SuiClient({ url: RPC });

console.log("Deploying with address:", keypair.toSuiAddress());

// ── Check balance ───────────────────────────────────────────────────────────
const coins = await client.getCoins({ owner: keypair.toSuiAddress() });
console.log("Available coins:", coins.data.length);
if (coins.data.length === 0) {
  console.error("No coins found. Request OCT from faucet first.");
  process.exit(1);
}

// ── Force recompile (clear cache + rebuild) ─────────────────────────────────
console.log("Recompiling Move package (clearing cache)...");
if (existsSync("./build")) rmSync("./build", { recursive: true, force: true });
execSync("sui move build --allow-dirty", { stdio: "inherit" });
console.log("Compile done.");

// ── Read bytecode from build directory ─────────────────────────────────────
console.log("Reading compiled bytecode from build/...");
const BUILD_DIR = "./build/amongNadsMove/bytecode_modules";

const modules = readdirSync(BUILD_DIR)
  .filter((f) => f.endsWith(".mv"))
  .map((f) => readFileSync(`${BUILD_DIR}/${f}`).toString("base64"));

// dependencies = package addresses on-chain (not bytecodes)
const dependencies = ["0x1", "0x2"];

console.log(`Modules: ${modules.length}, Dependencies: ${dependencies.length}`);

// ── Publish ─────────────────────────────────────────────────────────────────
console.log("Publishing to OneChain testnet...");
const tx = new Transaction();
const [upgradeCap] = tx.publish({ modules, dependencies });
tx.transferObjects([upgradeCap], keypair.toSuiAddress());

const result = await client.signAndExecuteTransaction({
  signer: keypair,
  transaction: tx,
  options: { showEffects: true, showObjectChanges: true },
});

if (result.effects?.status?.status !== "success") {
  console.error("Publish failed:", result.effects?.status?.error);
  console.error("Full result:", JSON.stringify(result, null, 2));
  process.exit(1);
}

// ── Extract IDs ─────────────────────────────────────────────────────────────
const allChanges = result.objectChanges ?? [];

// Published package: type = "published"
const packageObj = allChanges.find((c) => c.type === "published");
const packageId  = packageObj?.packageId;

// Created objects: type = "created"
const adminCap  = allChanges.find((c) => c.objectType?.includes("::game::AdminCap"));
const housePool = allChanges.find((c) => c.objectType?.includes("::game::HousePool"));

const adminCapId  = adminCap?.objectId;
const housePoolId = housePool?.objectId;

console.log("\n✅ Publish successful!\n");
console.log("PACKAGE_ID   =", packageId);
console.log("ADMIN_CAP_ID =", adminCapId);
console.log("HOUSE_POOL_ID=", housePoolId);
console.log("Tx digest    :", result.digest);

if (!packageId || !adminCapId || !housePoolId) {
  console.error("\n⚠️  Some IDs missing. Full objectChanges:");
  console.error(JSON.stringify(allChanges, null, 2));
  process.exit(1);
}

// ── Wait for chain to index the package ─────────────────────────────────────
console.log("\nWaiting 5s for chain to index package...");
await new Promise((r) => setTimeout(r, 5000));

// ── Deposit 1 OCT into HousePool ────────────────────────────────────────────
console.log("Depositing 1 OCT into HousePool...");
const depositTx = new Transaction();
const [depositCoin] = depositTx.splitCoins(depositTx.gas, [1_000_000_000n]);
depositTx.moveCall({
  target: `${packageId}::game::deposit`,
  arguments: [
    depositTx.object(adminCapId),
    depositTx.object(housePoolId),
    depositCoin,
  ],
});

const depositResult = await client.signAndExecuteTransaction({
  signer: keypair,
  transaction: depositTx,
  options: { showEffects: true },
});

if (depositResult.effects?.status?.status === "success") {
  console.log("✅ HousePool funded with 1 OCT\n");
} else {
  console.error("⚠️  Deposit failed:", depositResult.effects?.status?.error);
}

console.log("\n📋 Update your .env files with:");
console.log(`PACKAGE_ID=${packageId}`);
console.log(`ADMIN_CAP_ID=${adminCapId}`);
console.log(`HOUSE_POOL_ID=${housePoolId}`);
