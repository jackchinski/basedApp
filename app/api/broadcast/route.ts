export async function POST(request: Request) {
  try {
    const body = await request.json();
    const rawTx = typeof body.rawTx === "string" ? body.rawTx : "";

    if (!rawTx) {
      return Response.json({ error: "Missing rawTx" }, { status: 400 });
    }

    const rpcUrl =
      process.env.NEXT_PUBLIC_BASE_RPC_URL || "https://base.llamarpc.com";

    const payload = {
      jsonrpc: "2.0",
      id: Date.now(),
      method: "eth_sendRawTransaction",
      params: [rawTx],
    };

    const rpcResponse = await fetch(rpcUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      // Avoid Next.js caching for RPC calls
      cache: "no-store",
    });

    const contentType = rpcResponse.headers.get("content-type") || "";
    const bodyText = await rpcResponse.text();

    let responseJson: { result?: string; error?: { message?: string } } | null =
      null;
    if (contentType.includes("application/json")) {
      try {
        responseJson = JSON.parse(bodyText);
      } catch {
        // fall through to text error handling
      }
    }

    if (rpcResponse.ok && responseJson && responseJson.result) {
      return Response.json({ txHash: responseJson.result });
    }

    const errorMessage =
      responseJson?.error?.message || bodyText || "Broadcast failed";
    return Response.json({ error: errorMessage }, { status: 500 });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 },
    );
  }
}
