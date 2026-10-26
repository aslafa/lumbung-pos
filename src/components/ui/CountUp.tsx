'use client';

import { useEffect, useState, useRef } from 'react';

interface CountUpProps {
  value: number;
  duration?: number; // ms, default 750ms
  formatter?: (n: number) => string;
  className?: string;
}

/**
 * Komponen Animasi Count-Up Ringan
 * - Durasi: 600 - 1000 ms (default 750 ms)
 * - Menghormati prefers-reduced-motion (langsung menampilkan nilai akhir)
 * - Menghindari re-animasi yang tidak perlu saat render berulang
 * - Menggunakan requestAnimationFrame dengan cubic easing out
 */
export function CountUp({
  value,
  duration = 750,
  formatter = (n) => n.toLocaleString('id-ID'),
  className = '',
}: CountUpProps) {
  // Inisialisasi ke 0 agar animasi bergerak dari 0 ke nilai aktual saat pertama kali tampil
  const [displayValue, setDisplayValue] = useState<number>(0);
  const prevValueRef = useRef<number>(0);
  const frameRef = useRef<number | null>(null);
  const hasMountedRef = useRef<boolean>(false);

  useEffect(() => {
    const startVal = hasMountedRef.current ? prevValueRef.current : 0;
    const endVal = value;
    hasMountedRef.current = true;

    // Jika nilai tidak berubah setelah mount, jangan jalankan animasi ulang
    if (startVal === endVal && prevValueRef.current === endVal) {
      return;
    }

    // 1. Deteksi preferensi reduced motion dari sistem / OS
    const prefersReducedMotion =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    if (prefersReducedMotion) {
      prevValueRef.current = endVal;
      frameRef.current = requestAnimationFrame(() => {
        setDisplayValue(endVal);
      });
      return () => {
        if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
      };
    }

    const startTime = performance.now();

    const animate = (currentTime: number) => {
      const elapsed = currentTime - startTime;
      const progress = Math.min(1, elapsed / duration);

      // Cubic Ease-Out untuk animasi yang melambat di akhir secara natural
      const easeOut = 1 - Math.pow(1 - progress, 3);
      const current = Math.round(startVal + (endVal - startVal) * easeOut);

      setDisplayValue(current);

      if (progress < 1) {
        frameRef.current = requestAnimationFrame(animate);
      } else {
        setDisplayValue(endVal);
        prevValueRef.current = endVal;
      }
    };

    frameRef.current = requestAnimationFrame(animate);

    return () => {
      if (frameRef.current !== null) {
        cancelAnimationFrame(frameRef.current);
      }
    };
  }, [value, duration]);

  return (
    <span className={`tabular-nums ${className}`}>
      {formatter(displayValue)}
    </span>
  );
}

/**
 * Reusable AnimatedNumber alias yang memenuhi spesifikasi
 */
export const AnimatedNumber = CountUp;
