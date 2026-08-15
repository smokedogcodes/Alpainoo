"use client";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body style={{ fontFamily: "system-ui, sans-serif", padding: "3rem", textAlign: "center" }}>
        <h2>Something went wrong</h2>
        <p style={{ color: "#6b7280", marginTop: "0.5rem" }}>{error.message || "Unexpected error"}</p>
        <button
          type="button"
          onClick={reset}
          style={{
            marginTop: "1.5rem",
            padding: "0.6rem 1.2rem",
            border: "1px solid #ccc",
            background: "#faf9f6",
            cursor: "pointer",
          }}
        >
          Try again
        </button>
      </body>
    </html>
  );
}
