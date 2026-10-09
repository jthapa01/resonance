"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export function useAudioPlayback(src: string | File | null) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const play = useCallback(() => {
    if (!audioRef.current) return;
    setIsLoading(true);
    audioRef.current
      .play()
      .then(() => setIsPlaying(true))
      .catch(() => setIsPlaying(false))
      .finally(() => setIsLoading(false));
  }, []);

  const pause = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      setIsPlaying(false);
    }
  }, []);

  useEffect(() => {
    if (!src) return;

    const objectUrl = typeof src === "string" ? null : URL.createObjectURL(src);
    const audio = new Audio(objectUrl ?? (src as string));
    audioRef.current = audio;

    const handleEnded = () => setIsPlaying(false);
    audio.addEventListener("ended", handleEnded);

    return () => {
      audio.pause();
      audio.removeEventListener("ended", handleEnded);
      if (objectUrl) URL.revokeObjectURL(objectUrl);
      setIsPlaying(false);
    };
  }, [src]);

  return { isPlaying, isLoading, play, pause };
}
