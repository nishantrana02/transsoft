import { useCallback, useRef } from "react";

// Web recorder — uses the browser MediaRecorder API. Same interface as
// recorder.native.js so App.js is platform-agnostic.
//
// Note: browsers record webm/ogg (Chrome/Firefox) or mp4 (Safari), NOT m4a.
// We report the actual mime type so the backend / Gemini receives it correctly.

function pickMimeType() {
  const candidates = [
    "audio/webm;codecs=opus",
    "audio/webm",
    "audio/mp4",
    "audio/ogg;codecs=opus",
  ];
  if (typeof MediaRecorder === "undefined") return "";
  for (const t of candidates) {
    if (MediaRecorder.isTypeSupported(t)) return t;
  }
  return "";
}

function extForMime(mime) {
  if (mime.includes("webm")) return "webm";
  if (mime.includes("mp4")) return "m4a";
  if (mime.includes("ogg")) return "ogg";
  return "webm";
}

export function useRecorder() {
  const mediaRef = useRef(null);
  const chunksRef = useRef([]);
  const streamRef = useRef(null);
  const mimeRef = useRef("");

  const start = useCallback(async () => {
    if (typeof navigator === "undefined" || !navigator.mediaDevices) {
      throw new Error("Recording is not supported in this browser.");
    }
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    streamRef.current = stream;
    const mimeType = pickMimeType();
    mimeRef.current = mimeType;
    const mr = mimeType
      ? new MediaRecorder(stream, { mimeType })
      : new MediaRecorder(stream);
    chunksRef.current = [];
    mr.ondataavailable = (e) => {
      if (e.data && e.data.size > 0) chunksRef.current.push(e.data);
    };
    mediaRef.current = mr;
    mr.start();
  }, []);

  const stop = useCallback(async () => {
    const mr = mediaRef.current;
    if (!mr) return null;

    const blob = await new Promise((resolve) => {
      mr.onstop = () => {
        const type = mr.mimeType || mimeRef.current || "audio/webm";
        resolve(new Blob(chunksRef.current, { type }));
      };
      mr.stop();
    });

    // Release the mic.
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    mediaRef.current = null;

    const mime = blob.type || "audio/webm";
    const name = `recording.${extForMime(mime)}`;
    // On web, FormData accepts a File/Blob directly.
    const file = new File([blob], name, { type: mime });
    return { file, name, type: mime };
  }, []);

  return { start, stop };
}
