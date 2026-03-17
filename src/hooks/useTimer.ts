"use client";

import { useState, useEffect } from 'react';

export function useTimer(startTime?: number, prepaidSeconds?: number) {
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    if (!startTime) return;
    
    const interval = setInterval(() => {
      setNow(Date.now());
    }, 1000);

    return () => clearInterval(interval);
  }, [startTime]);
  
  if (!startTime) {
    return { elapsedSeconds: 0, remainingSeconds: undefined, isTimeUp: false };
  }

  const elapsedSeconds = Math.floor((now - startTime) / 1000);
  const remainingSeconds = prepaidSeconds !== undefined 
    ? Math.max(0, prepaidSeconds - elapsedSeconds) 
    : undefined;
  
  const isTimeUp = prepaidSeconds !== undefined && remainingSeconds === 0;

  return { elapsedSeconds, remainingSeconds, isTimeUp };
}
