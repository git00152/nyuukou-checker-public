/**
 * @description Declare event types for listening with listenTS() and dispatching with dispatchTS()
 */
export type EventTS = {
  checkComplete: {
    results: string; // JSON stringified CheckResult[]
  };
};
