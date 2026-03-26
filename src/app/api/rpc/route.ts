/**
 * Server-side proxy for OneChain RPC calls.
 * Avoids CORS issues when the browser calls the testnet RPC directly.
 * All JSON-RPC requests from the frontend hit /api/rpc → this handler → upstream RPC.
 */
import { NextRequest, NextResponse } from "next/server";

const UPSTREAM_RPC =
  process.env.RPC_URL ?? "https://rpc-testnet.onelabs.cc:443";

export async function POST(request: NextRequest) {
  const body = await request.text();
  const upstream = await fetch(UPSTREAM_RPC, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body,
  });
  const text = await upstream.text();
  return new NextResponse(text, {
    status: upstream.status,
    headers: { "Content-Type": "application/json" },
  });
}
