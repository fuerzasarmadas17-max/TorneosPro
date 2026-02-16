"use client";

import { useEffect, useRef, useState } from "react";

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
  const videoRef = useRef<HTMLVideoElement>(null);
  const orderRef = useRef<string[]>([]);
  const indexRef = useRef(0);

  useEffect(() => {
    orderRef.current = shuffle(VIDEOS);
    indexRef.current = 0;

    const video = videoRef.current;
    if (!video) return;

    function playCurrentVideo() {
      if (!video) return;
      video.src = orderRef.current[indexRef.current];
      video.load();
      video.play().catch(() => {});
    }

    playCurrentVideo();

    const timer = setInterval(() => {
      indexRef.current = (indexRef.current + 1) % orderRef.current.length;
      playCurrentVideo();
    }, CLIP_DURATION * 1000);

    return () => clearInterval(timer);
  }, []);

  return (
    <div className="absolute inset-0 overflow-hidden">
      <video
        ref={videoRef}
        className="absolute inset-0 w-full h-full object-cover"
        muted
        playsInline
      />
      <div className="absolute inset-0 bg-black/60" />
    </div>
  );
}
