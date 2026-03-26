const SUBGRAPH_URL =
  "https://api.goldsky.com/api/public/project_cmf7w213gukw101tb0u5m7760/subgraphs/among-nads-v2-mainnet/1.0.0/gn";

export async function querySubgraph<T = any>(
  query: string,
  variables?: Record<string, any>,
): Promise<T> {
  const res = await fetch(SUBGRAPH_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query, variables }),
  });

  const json = await res.json();

  if (json.errors) {
    console.error("[Subgraph] Query error:", json.errors);
    throw new Error(json.errors[0]?.message || "Subgraph query failed");
  }

  return json.data as T;
}
