"use client";

import { useEffect, useRef, useCallback } from "react";

const VIDEOS = [
  "/videos/Basket.mp4",
  "/videos/beisbol.mp4",
  "/videos/Futbol.mp4",
  "/videos/futsal.mp4",
  "/videos/softbol.mp4",
  "/videos/Tenis.mp4",
  "/videos/Volley.mp4",
];

const CLIP_DURATION = 5;

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function VideoBackground() {
  const videoARef = useRef<HTMLVideoElement>(null);
  const videoBRef = useRef<HTMLVideoElement>(null);
  const orderRef = useRef<string[]>([]);
  const indexRef = useRef(0);
  const activeRef = useRef<"A" | "B">("A");

  const getActiveVideo = useCallback(() => {
    return activeRef.current === "A" ? videoARef.current : videoBRef.current;
  }, []);

  const getNextVideo = useCallback(() => {
    return activeRef.current === "A" ? videoBRef.current : videoARef.current;
  }, []);

  useEffect(() => {
    orderRef.current = shuffle(VIDEOS);
    indexRef.current = 0;

    const videoA = videoARef.current;
    const videoB = videoBRef.current;
    if (!videoA || !videoB) return;

    // Start first video
    videoA.src = orderRef.current[0];
    videoA.load();
    videoA.play().catch(() => {});
    videoA.style.opacity = "1";
    videoB.style.opacity = "0";

    // Preload next video
    const nextIdx = 1 % orderRef.current.length;
    videoB.src = orderRef.current[nextIdx];
    videoB.load();

    const timer = setInterval(() => {
      indexRef.current = (indexRef.current + 1) % orderRef.current.length;

      const current = getActiveVideo();
      const next = getNextVideo();
      if (!current || !next) return;

      // Switch: show preloaded video, hide current
      next.play().catch(() => {});
      next.style.opacity = "1";
      current.style.opacity = "0";
      current.pause();

      // Flip active
      activeRef.current = activeRef.current === "A" ? "B" : "A";

      // Preload the next one in the now-hidden video
      const preloadIdx = (indexRef.current + 1) % orderRef.current.length;
      const hidden = activeRef.current === "A" ? videoBRef.current : videoARef.current;
      if (hidden) {
        hidden.src = orderRef.current[preloadIdx];
        hidden.load();
      }
    }, CLIP_DURATION * 1000);

    return () => clearInterval(timer);
  }, [getActiveVideo, getNextVideo]);

  return (
    <div className="absolute inset-0 overflow-hidden bg-black">
      <video
        ref={videoARef}
        className="absolute inset-0 w-full h-full object-cover transition-opacity duration-700"
        muted
        playsInline
      />
      <video
        ref={videoBRef}
        className="absolute inset-0 w-full h-full object-cover transition-opacity duration-700"
        style={{ opacity: 0 }}
        muted
        playsInline
      />
      <div className="absolute inset-0 bg-black/60" />
    </div>
  );
}
