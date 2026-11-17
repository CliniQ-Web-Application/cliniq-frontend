"use client";

import { useEffect, useRef, useState } from "react";
import jsQR from "jsqr";
import { Camera, X } from "lucide-react";
import { appointmentIdFromQr } from "@/lib/check-in-qr";

type DetectedBarcode = { rawValue?: string };
type BarcodeDetectorLike = { detect: (source: HTMLVideoElement) => Promise<DetectedBarcode[]> };
type BarcodeDetectorConstructor = new (options: { formats: string[] }) => BarcodeDetectorLike;

export default function CheckInQrScanner({ onDetected, onClose }: { onDetected: (appointmentId: string) => void; onClose: () => void }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const callbackRef = useRef(onDetected);
  const [error, setError] = useState("");
  const [scanning, setScanning] = useState(true);

  useEffect(() => {
    callbackRef.current = onDetected;
  }, [onDetected]);

  useEffect(() => {
    const videoElement = videoRef.current;
    let disposed = false;
    let frame = 0;
    let detecting = false;
    let handled = false;
    let warned = false;
    let stream: MediaStream | null = null;

    // Shared handler for a decoded raw QR value.
    const handleValue = (rawValue: string | undefined) => {
      if (!rawValue || handled) return false;
      const appointmentId = appointmentIdFromQr(rawValue);
      if (appointmentId) {
        handled = true;
        callbackRef.current(appointmentId);
        return true;
      }
      if (!warned) {
        setError("That code is not a CliniQ check-in QR. Ask the patient to show their check-in code.");
        warned = true;
      }
      return false;
    };

    async function start() {
      if (!navigator.mediaDevices?.getUserMedia) {
        setError("Camera access is unavailable. Open this staff portal in a browser that supports camera access.");
        setScanning(false);
        return;
      }
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: "environment" } }, audio: false });
        if (disposed) { stream.getTracks().forEach((track) => track.stop()); return; }
        const video = videoRef.current;
        if (!video) return;
        video.srcObject = stream;
        await video.play();

        const detectorClass = (window as unknown as { BarcodeDetector?: BarcodeDetectorConstructor }).BarcodeDetector;
        if (detectorClass) {
          // Native BarcodeDetector (Chrome/Edge).
          const detector = new detectorClass({ formats: ["qr_code"] });
          const scan = async () => {
            if (disposed || handled) return;
            if (!detecting && video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) {
              detecting = true;
              try {
                const results = await detector.detect(video);
                for (const result of results) {
                  if (handleValue(result.rawValue)) return;
                }
              } catch {
                // Frames can fail to decode while moving; keep scanning.
              } finally {
                detecting = false;
              }
            }
            if (!disposed && !handled) frame = requestAnimationFrame(() => { void scan(); });
          };
          void scan();
        } else {
          // Fallback for Firefox/Safari: decode video frames with jsQR.
          const canvas = document.createElement("canvas");
          const context = canvas.getContext("2d", { willReadFrequently: true });
          if (!context) {
            setError("Could not initialise the QR scanner. Try a different browser.");
            setScanning(false);
            return;
          }
          const scan = () => {
            if (disposed || handled) return;
            if (!detecting && video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA && video.videoWidth && video.videoHeight) {
              detecting = true;
              try {
                canvas.width = video.videoWidth;
                canvas.height = video.videoHeight;
                context.drawImage(video, 0, 0, canvas.width, canvas.height);
                const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
                const result = jsQR(imageData.data, imageData.width, imageData.height, { inversionAttempts: "attemptBoth" });
                handleValue(result?.data);
              } catch {
                // Ignore transient frame read failures.
              } finally {
                detecting = false;
              }
            }
            if (!disposed && !handled) frame = requestAnimationFrame(scan);
          };
          void scan();
        }
      } catch {
        if (!disposed) {
          setError("Could not open the camera. Allow camera access and use a secure connection, then try again.");
          setScanning(false);
        }
      }
    }

    void start();
    return () => {
      disposed = true;
      cancelAnimationFrame(frame);
      stream?.getTracks().forEach((track) => track.stop());
      if (videoElement) videoElement.srcObject = null;
    };
  }, []);

  return <div role="dialog" aria-modal="true" aria-labelledby="qr-scan-heading" className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
    <section className="w-full max-w-lg rounded-2xl bg-surface p-5 shadow-xl sm:p-7">
      <div className="flex items-start justify-between gap-4">
        <div><Camera className="mb-2 text-primary" size={24} aria-hidden="true" /><h2 id="qr-scan-heading" className="text-xl font-bold">Scan patient check-in QR</h2><p className="mt-1 text-sm text-neutral-600">Hold the patient’s QR code inside the camera frame.</p></div>
        <button type="button" onClick={onClose} aria-label="Close QR scanner" className="min-h-10 rounded-lg p-2 text-neutral-600 hover:bg-background"><X size={20} aria-hidden="true" /></button>
      </div>
      <div className="mt-5 overflow-hidden rounded-xl bg-black">
        <video ref={videoRef} muted playsInline className="aspect-video w-full object-cover" aria-label="QR scanner camera" />
      </div>
      {scanning && <p role="status" className="mt-3 text-sm text-neutral-600">Waiting for a check-in QR code...</p>}
      {error && <p role="alert" className="mt-3 rounded-lg bg-error-background p-3 text-sm text-error">{error}</p>}
      <p className="mt-3 text-xs text-neutral-500">Camera access requires permission and a secure browser connection. Scanning only sends the appointment reference to the clinic API.</p>
    </section>
  </div>;
}
