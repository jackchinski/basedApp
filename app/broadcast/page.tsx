"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

export default function BroadcastPage() {
  const [displayPayload, setDisplayPayload] = useState<string>("");
  const [rawTx, setRawTx] = useState<string>("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [txHash, setTxHash] = useState<string | null>(null);
  const router = useRouter();

  useEffect(() => {
    try {
      const value = sessionStorage.getItem("decodedPayload") || "";
      if (!value) {
        setDisplayPayload("");
        setRawTx("");
        return;
      }
      // Pretty-print JSON for display; extract rawTx if present
      try {
        const parsed = JSON.parse(value);
        setDisplayPayload(JSON.stringify(parsed, null, 2));
        const maybeRaw = parsed?.data?.raw;
        if (typeof maybeRaw === "string" && maybeRaw.startsWith("0x")) {
          setRawTx(maybeRaw.trim());
        } else if (value.startsWith("0x")) {
          setRawTx(value.trim());
        } else {
          setRawTx("");
        }
      } catch {
        setDisplayPayload(value);
        setRawTx(value.startsWith("0x") ? value.trim() : "");
      }
    } catch {
      setDisplayPayload("");
      setRawTx("");
    }
  }, []);

  const handleReject = useCallback(() => {
    router.back();
  }, [router]);

  const handleBroadcast = useCallback(() => {
    setError(null);
    setTxHash(null);
    setIsSubmitting(true);
    (async () => {
      try {
        const res = await fetch("/api/broadcast", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ rawTx: rawTx.trim() }),
          cache: "no-store",
        });
        const json = await res.json();
        if (!res.ok) {
          throw new Error(json?.error || "Broadcast failed");
        }
        setTxHash(json.txHash);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Broadcast failed");
      } finally {
        setIsSubmitting(false);
      }
    })();
  }, [rawTx]);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="w-full max-w-md mx-auto px-4 py-8">
        <h1 className="text-2xl font-bold mb-4">Decoded Payload</h1>
        {displayPayload ? (
          <div className="mb-4 p-3 border border-[var(--app-card-border)] rounded-lg bg-[var(--app-card-bg)]">
            <pre className="whitespace-pre-wrap break-words text-sm">
              {displayPayload}
            </pre>
          </div>
        ) : (
          <div className="mb-4 text-[var(--app-foreground-muted)] text-sm">
            No payload found.
          </div>
        )}
        {error && <div className="mb-3 text-red-500 text-sm">{error}</div>}
        {txHash && (
          <div className="mb-3 text-sm">
            Broadcasted. Tx Hash: <span className="break-all">{txHash}</span>
          </div>
        )}
        <div className="flex items-center justify-between gap-3">
          <button
            type="button"
            className="border border-[var(--app-card-border)] text-[var(--app-foreground)] px-4 py-2 rounded-lg bg-[var(--app-gray)] hover:bg-[var(--app-gray-dark)]"
            onClick={handleReject}
          >
            Reject
          </button>
          <button
            type="button"
            className="bg-[var(--app-accent)] hover:bg-[var(--app-accent-hover)] text-white px-4 py-2 rounded-lg"
            onClick={handleBroadcast}
            disabled={!rawTx || isSubmitting}
          >
            {isSubmitting ? "Broadcasting..." : "Broadcast"}
          </button>
        </div>
        <div className="mt-6 text-xs text-[var(--app-foreground-muted)]">
          <Link href="/">Back to Home</Link>
        </div>
      </div>
    </div>
  );
}
