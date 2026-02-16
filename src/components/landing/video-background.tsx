"use client";

import { useEffect, useRef } from "react";

const VIDEOS = [
  "/videos/Basket.mp4",
  "/videos/beisbol.mp4",
  "/videos/Futbol.mp4",
  "/videos/futsal.mp4",
  "/videos/softbol.mp4",
  "/videos/Tenis.mp4",
  "/videos/Volley.mp4",
];

const CLIP_DURATION = 7200;

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

  useEffect(() => {
    const order = shuffle(VIDEOS);
    let index = 0;
    let isAVisible = true;
    let timer: ReturnType<typeof setTimeout>;

    const videoA = videoARef.current;
    const videoB = videoBRef.current;
    if (!videoA || !videoB) return;

    // Step 1: Play first video on A
    videoA.src = order[0];
    videoA.load();
    videoA.play().catch(() => {});
    videoA.style.opacity = "1";
    videoB.style.opacity = "0";

    // Step 2: Preload second video on B
    videoB.src = order[1 % order.length];
    videoB.load();

    const doSwitch = () => {
      index = (index + 1) % order.length;

      if (isAVisible) {
        // B already has the next video preloaded — show it
        videoB.currentTime = 0;
        videoB.play().catch(() => {});
        videoB.style.opacity = "1";
        videoA.style.opacity = "0";
        // After fade, pause A and preload next video into A
        setTimeout(() => {
          videoA.pause();
          videoA.src = order[(index + 1) % order.length];
          videoA.load();
        }, 1000);
      } else {
        // A already has the next video preloaded — show it
        videoA.currentTime = 0;
        videoA.play().catch(() => {});
        videoA.style.opacity = "1";
        videoB.style.opacity = "0";
        // After fade, pause B and preload next video into B
        setTimeout(() => {
          videoB.pause();
          videoB.src = order[(index + 1) % order.length];
          videoB.load();
        }, 1000);
      }

      isAVisible = !isAVisible;
      timer = setTimeout(doSwitch, CLIP_DURATION);
    };

    timer = setTimeout(doSwitch, CLIP_DURATION);

    return () => clearTimeout(timer);
  }, []);

  return (
    <div className="absolute inset-0 overflow-hidden bg-black">
      <video
        ref={videoARef}
        className="absolute inset-0 w-full h-full object-cover transition-opacity duration-1000"
        muted
        playsInline
      />
      <video
        ref={videoBRef}
        className="absolute inset-0 w-full h-full object-cover transition-opacity duration-1000"
        style={{ opacity: 0 }}
        muted
        playsInline
      />
      <div className="absolute inset-0 bg-black/60" />
    </div>
  );
}
