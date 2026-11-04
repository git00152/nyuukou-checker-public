import { useCallback, useRef, useState } from "react";

/** Serialize panel actions until their host calls and follow-up checks finish. */
export function useHostOperation() {
  const running = useRef(false);
  const [isBusy, setIsBusy] = useState(false);
  const runOperation = useCallback(async (operation: () => Promise<void>) => {
    if (running.current) return;
    running.current = true;
    setIsBusy(true);
    try {
      await operation();
    } finally {
      running.current = false;
      setIsBusy(false);
    }
  }, []);
  return { isBusy, runOperation };
}
