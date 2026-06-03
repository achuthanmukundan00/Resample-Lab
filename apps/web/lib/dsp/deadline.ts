/**
 * Shared deadline for aborting slow DSP operations.
 * Set once at the start of processing; checked periodically inside heavy loops.
 * When the deadline is exceeded, checkAborted() throws so the error propagates
 * up through the worker's try/catch.
 *
 * Guarded: when no deadline is set (0), checkAborted() is a no-op.
 * This prevents spurious throws in unit tests and non-worker contexts.
 */

let _deadline = 0;

export function setDeadline(ts: number) {
  _deadline = ts;
}

/** Throws "DSP processing timed out" if we've passed the deadline. */
export function checkAborted() {
  if (_deadline > 0 && Date.now() > _deadline) {
    throw new Error("DSP processing timed out");
  }
}
