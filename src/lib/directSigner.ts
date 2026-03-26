/**
 * Direct signing with a raw keypair from env — bypasses wallet provider UI.
 * WARNING: NEXT_PUBLIC_ vars are visible in browser JS. Use only for demo/testing.
 *
 * Set NEXT_PUBLIC_DEMO_PRIVATE_KEY in .env.local to a hex private key (with or
 * without 0x prefix, 32 bytes = 64 hex chars).
 */
import { Ed25519Keypair } from "@onelabs/sui/keypairs/ed25519";

export function getKeypairFromEnv(): Ed25519Keypair | null {
  const pk = process.env.NEXT_PUBLIC_DEMO_PRIVATE_KEY;
  if (!pk) return null;
  try {
    const raw = pk.startsWith("0x") ? pk.slice(2) : pk;
    // Hex format: 64 chars = 32 bytes
    if (/^[0-9a-fA-F]{64}$/.test(raw)) {
      const bytes = Uint8Array.from(
        (raw.match(/.{2}/g) ?? []).map((b) => parseInt(b, 16)),
      );
      return Ed25519Keypair.fromSecretKey(bytes);
    }
    // Fallback: try as-is (base64 or bech32)
    return Ed25519Keypair.fromSecretKey(pk);
  } catch (e) {
    console.error("[directSigner] Invalid NEXT_PUBLIC_DEMO_PRIVATE_KEY:", e);
    return null;
  }
}
