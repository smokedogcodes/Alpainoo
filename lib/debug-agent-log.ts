/** Debug-mode ingest (session b3f0a8). Safe no-op on failure. */
export function agentLog(payload: {
  location: string;
  message: string;
  data?: Record<string, unknown>;
  hypothesisId: string;
  runId?: string;
}) {
  // #region agent log
  fetch("http://127.0.0.1:7376/ingest/6e190034-3568-4fc1-85eb-6c282aded999", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Debug-Session-Id": "b3f0a8",
    },
    body: JSON.stringify({
      sessionId: "b3f0a8",
      timestamp: Date.now(),
      runId: payload.runId || "pre-fix",
      hypothesisId: payload.hypothesisId,
      location: payload.location,
      message: payload.message,
      data: payload.data || {},
    }),
  }).catch(() => {});
  // #endregion
}
