"use client";

import {
  useMiniKit,
  useAddFrame,
  useOpenUrl,
} from "@coinbase/onchainkit/minikit";
import {
  Name,
  Identity,
  Address,
  Avatar,
  EthBalance,
} from "@coinbase/onchainkit/identity";
import {
  ConnectWallet,
  Wallet,
  WalletDropdown,
  WalletDropdownDisconnect,
} from "@coinbase/onchainkit/wallet";
import { useEffect, useMemo, useState, useCallback, useRef } from "react";
import { Button } from "./components/DemoComponents";
import { Icon } from "./components/DemoComponents";
import { Features } from "./components/DemoComponents";
import Link from "next/link";
import { useRouter } from "next/navigation";

// Minimal typings for the BarcodeDetector API to avoid 'any'
type QRDetector = {
  detect: (source: HTMLVideoElement) => Promise<Array<{ rawValue?: string }>>;
};
declare global {
  interface Window {
    BarcodeDetector?: new (options: { formats: string[] }) => QRDetector;
  }
}

export default function App() {
  const { setFrameReady, isFrameReady, context } = useMiniKit();
  const [frameAdded, setFrameAdded] = useState(false);
  const [activeTab, setActiveTab] = useState("home");
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const rafIdRef = useRef<number | null>(null);
  const detectorRef = useRef<QRDetector | null>(null);
  const [decodedPayload, setDecodedPayload] = useState<string | null>(null);
  const router = useRouter();

  const addFrame = useAddFrame();
  const openUrl = useOpenUrl();

  useEffect(() => {
    if (!isFrameReady) {
      setFrameReady();
    }
  }, [setFrameReady, isFrameReady]);

  const handleAddFrame = useCallback(async () => {
    const frameAdded = await addFrame();
    setFrameAdded(Boolean(frameAdded));
  }, [addFrame]);

  const saveFrameButton = useMemo(() => {
    if (context && !context.client.added) {
      return (
        <Button
          variant="ghost"
          size="sm"
          onClick={handleAddFrame}
          className="text-[var(--app-accent)] p-4"
          icon={<Icon name="plus" size="sm" />}
        >
          Save Frame
        </Button>
      );
    }

    if (frameAdded) {
      return (
        <div className="flex items-center space-x-1 text-sm font-medium text-[#0052FF] animate-fade-out">
          <Icon name="check" size="sm" className="text-[#0052FF]" />
          <span>Saved</span>
        </div>
      );
    }

    return null;
  }, [context, frameAdded, handleAddFrame]);

  const closeScanner = useCallback(() => {
    setIsScannerOpen(false);
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((track) => track.stop());
      mediaStreamRef.current = null;
    }
    if (rafIdRef.current !== null) {
      cancelAnimationFrame(rafIdRef.current);
      rafIdRef.current = null;
    }
    detectorRef.current = null;
  }, []);

  const openScanner = useCallback(async () => {
    setCameraError(null);
    setIsScannerOpen(true);
    try {
      const constraints: MediaStreamConstraints = {
        video: {
          facingMode: { ideal: "environment" },
        },
        audio: false,
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      mediaStreamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }

      // Start decoding loop if supported
      const isBarcodeSupported = typeof window.BarcodeDetector !== "undefined";
      if (!isBarcodeSupported) {
        setCameraError(
          "QR scanning not supported on this browser. Please try Chrome, Edge, or Safari 17+.",
        );
        return;
      }

      if (!detectorRef.current) {
        const DetectorCtor = window.BarcodeDetector!;
        detectorRef.current = new DetectorCtor({ formats: ["qr_code"] });
      }

      const detectFrame = async () => {
        try {
          if (!videoRef.current || !detectorRef.current) return;
          const results = await detectorRef.current.detect(videoRef.current);
          if (results && results.length > 0) {
            const value = results[0].rawValue;
            if (value) {
              setDecodedPayload(value);
              try {
                sessionStorage.setItem("decodedPayload", value);
              } catch {}
              closeScanner();
              router.push("/broadcast");
              return;
            }
          }
        } catch {
          // Swallow detection errors to keep scanning
        }
        rafIdRef.current = requestAnimationFrame(detectFrame);
      };

      rafIdRef.current = requestAnimationFrame(detectFrame);
    } catch (err) {
      setCameraError(
        err instanceof Error ? err.message : "Unable to access camera",
      );
    }
  }, [closeScanner, router]);

  return (
    <div className="flex flex-col min-h-screen font-sans text-[var(--app-foreground)] mini-app-theme from-[var(--app-background)] to-[var(--app-gray)]">
      <div className="w-full max-w-md mx-auto px-4 py-3">
        <header className="flex justify-between items-center mb-3 h-11">
          <div>
            <div className="flex items-center space-x-2">
              <Wallet className="z-10">
                <ConnectWallet>
                  <Name className="text-inherit" />
                </ConnectWallet>
                <WalletDropdown>
                  <Identity className="px-4 pt-3 pb-2" hasCopyAddressOnClick>
                    <Avatar />
                    <Name />
                    <Address />
                    <EthBalance />
                  </Identity>
                  <WalletDropdownDisconnect />
                </WalletDropdown>
              </Wallet>
            </div>
          </div>
          <div>{saveFrameButton}</div>
        </header>

        <main className="flex-1">
          {activeTab === "home" && (
            <div className="space-y-4 animate-fade-in">
              <h1 className="text-3xl font-bold">BaseOS</h1>
              <p className="text-[var(--app-foreground-muted)]">
                Scan your signed transaction payload in order to broadcast your
                transaction
              </p>
              <div>
                <Button variant="primary" size="md" onClick={openScanner}>
                  Scan
                </Button>
              </div>
              {decodedPayload && (
                <div className="mt-4 p-3 border border-[var(--app-card-border)] rounded-lg bg-[var(--app-card-bg)]">
                  <div className="text-sm font-medium mb-1">
                    Decoded Payload
                  </div>
                  <pre className="whitespace-pre-wrap break-words text-xs">
                    {decodedPayload}
                  </pre>
                </div>
              )}
              <div className="mt-8 space-y-3">
                <h2 className="text-xl font-semibold">Resillience Resources</h2>
                <ul className="space-y-2">
                  <li>
                    <Link
                      href="/resources/how-to-use"
                      className="text-[var(--app-accent)] hover:underline"
                    >
                      How to use BaseOS
                    </Link>
                  </li>
                  <li>
                    <Link
                      href="/resources/security-privacy"
                      className="text-[var(--app-accent)] hover:underline"
                    >
                      Increasing your security and privacy
                    </Link>
                  </li>
                  <li>
                    <Link
                      href="/resources/censorship-resistance"
                      className="text-[var(--app-accent)] hover:underline"
                    >
                      Censorship resistance
                    </Link>
                  </li>
                  <li>
                    <Link
                      href="/resources/humanitarian-aid"
                      className="text-[var(--app-accent)] hover:underline"
                    >
                      Humanitarian & Aid
                    </Link>
                  </li>
                </ul>
              </div>
            </div>
          )}
          {activeTab === "features" && <Features setActiveTab={setActiveTab} />}
        </main>

        <footer className="mt-2 pt-4 flex justify-center">
          <Button
            variant="ghost"
            size="sm"
            className="text-[var(--ock-text-foreground-muted)] text-xs"
            onClick={() => openUrl("https://base.org/builders/minikit")}
          >
            Built on Base with MiniKit
          </Button>
        </footer>
      </div>

      {isScannerOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70">
          <div className="w-full max-w-md mx-auto px-4">
            <div className="bg-[var(--app-card-bg)] border border-[var(--app-card-border)] rounded-xl overflow-hidden">
              <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--app-card-border)]">
                <h3 className="font-medium">Scan</h3>
                <button
                  type="button"
                  className="text-[var(--app-foreground-muted)] hover:text-[var(--app-foreground)]"
                  onClick={closeScanner}
                >
                  ×
                </button>
              </div>
              <div className="p-4">
                {cameraError ? (
                  <div className="text-red-500 text-sm">
                    {cameraError}. Please ensure camera permissions are granted
                    and try again.
                  </div>
                ) : (
                  <video
                    ref={videoRef}
                    className="w-full rounded-lg bg-black"
                    playsInline
                    autoPlay
                    muted
                  />
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
