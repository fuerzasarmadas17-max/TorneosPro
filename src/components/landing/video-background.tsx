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

// Delay (ms) antes de empezar a cargar el primer video. Es lo que tarda
// el browser en renderear la landing y el usuario en empezar a leer la
// hero. Cada video pesa ~5MB y antes los descargábamos en T=0, lo que
// bloqueaba el render perceptible en redes 4G.
const VIDEO_LOAD_DELAY = 1500;

export function VideoBackground() {
  const videoARef = useRef<HTMLVideoElement>(null);
  const videoBRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const videoA = videoARef.current;
    const videoB = videoBRef.current;
    if (!videoA || !videoB) return;

    const order = shuffle(VIDEOS);
    let index = 0;
    let isAVisible = true;
    let timer: ReturnType<typeof setTimeout>;

    const startVideos = () => {
      // Step 1: Play first video on A
      videoA.src = order[0];
      videoA.load();
      videoA.play().catch(() => {});
      videoA.style.opacity = "1";
      videoB.style.opacity = "0";

      // Step 2: Preload second video on B
      videoB.src = order[1 % order.length];
      videoB.load();

      timer = setTimeout(doSwitch, CLIP_DURATION);
    };

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

    // Arrancar la carga del primer video con delay para no competir con
    // el render de la landing. El user ve hero + botones al toque y el
    // video aparece ~1.5s después con fade-in.
    const startTimer = setTimeout(startVideos, VIDEO_LOAD_DELAY);

    return () => {
      clearTimeout(startTimer);
      clearTimeout(timer);
    };
  }, []);

  return (
    <div className="absolute inset-0 overflow-hidden bg-black pointer-events-none">
      <video
        ref={videoARef}
        className="absolute inset-0 w-full h-full object-cover transition-opacity duration-1000"
        muted
        playsInline
        preload="none"
      />
      <video
        ref={videoBRef}
        className="absolute inset-0 w-full h-full object-cover transition-opacity duration-1000"
        style={{ opacity: 0 }}
        muted
        playsInline
        preload="none"
      />
      <div className="absolute inset-0 bg-black/60" />
    </div>
  );
}
