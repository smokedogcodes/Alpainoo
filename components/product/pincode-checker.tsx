"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function PincodeChecker() {
  const [pin, setPin] = useState("");
  const [result, setResult] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function check() {
    setLoading(true);
    setResult(null);
    try {
      const res = await fetch("/api/shipping/pincode", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pincode: pin }),
      });
      const data = await res.json();
      if (data.available) {
        setResult(`Delivery available${data.estimate ? ` · ${data.estimate}` : ""}`);
      } else {
        setResult("Not serviceable for this pin code");
      }
    } catch {
      setResult("Unable to check right now");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="rounded-lg border border-border bg-white p-4">
      <p className="text-sm font-medium">Check delivery</p>
      <div className="mt-2 flex gap-2">
        <Input
          value={pin}
          onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 6))}
          placeholder="Enter pin code"
          inputMode="numeric"
        />
        <Button type="button" variant="outline" onClick={check} disabled={pin.length !== 6 || loading}>
          {loading ? "..." : "Check"}
        </Button>
      </div>
      {result && <p className="mt-2 text-sm text-muted">{result}</p>}
    </div>
  );
}
