const BASE = "https://apiv2.shiprocket.in/v1/external";

/** ~8 days — Shiprocket JWTs typically last ~10 days; refresh before expiry. */
const TOKEN_TTL_MS = 8 * 24 * 60 * 60 * 1000;

let cachedToken: { token: string; exp: number } | null = null;

export function getShiprocketCredentials() {
  const email =
    process.env.SHIPROCKET_API_EMAIL?.trim() ||
    process.env.SHIPROCKET_EMAIL?.trim() ||
    "";
  const password =
    process.env.SHIPROCKET_API_PASSWORD?.trim() ||
    process.env.SHIPROCKET_PASSWORD?.trim() ||
    "";
  return { email, password, configured: Boolean(email && password) };
}

export function getPickupLocation() {
  return (
    process.env.SHIPROCKET_PICKUP_LOCATION?.trim() ||
    "Primary"
  );
}

export function getPickupPostcode() {
  return process.env.SHIPROCKET_PICKUP_POSTCODE?.trim() || "110001";
}

export function generateTrackingUrl(awbCode: string) {
  return `https://shiprocket.co/tracking/${encodeURIComponent(awbCode)}`;
}

export function validateShiprocketPincode(pincode: string) {
  if (!/^\d{6}$/.test(pincode.trim())) {
    throw new Error("Invalid pincode — must be 6 digits");
  }
}

export function validateShiprocketPhone(phone: string) {
  const digits = phone.replace(/\D/g, "");
  const ten = digits.length === 12 && digits.startsWith("91") ? digits.slice(2) : digits;
  if (!/^\d{10}$/.test(ten)) {
    throw new Error("Phone must be 10 digits");
  }
  return ten;
}

export function validateShiprocketWeight(weight: number) {
  if (!(weight > 0) || Number.isNaN(weight)) {
    throw new Error("Weight required (kg) and must be greater than 0");
  }
}

function parseShiprocketError(text: string, status: number) {
  try {
    const data = JSON.parse(text) as {
      message?: string | string[];
      errors?: Record<string, string[] | string> | string;
      error?: string;
    };
    if (typeof data.message === "string" && data.message.trim()) return data.message;
    if (Array.isArray(data.message)) return data.message.join("; ");
    if (typeof data.error === "string" && data.error.trim()) return data.error;
    if (data.errors) {
      if (typeof data.errors === "string") return data.errors;
      const parts = Object.entries(data.errors).flatMap(([k, v]) =>
        Array.isArray(v) ? v.map((m) => `${k}: ${m}`) : [`${k}: ${v}`]
      );
      if (parts.length) return parts.join("; ");
    }
  } catch {
    /* plain text */
  }
  return text.trim() || `Shiprocket request failed (${status})`;
}

/** Preferred name; alias of getShiprocketToken. */
export async function getAuthToken() {
  return getShiprocketToken();
}

export async function getShiprocketToken() {
  const { email, password, configured } = getShiprocketCredentials();
  if (!configured) return null;

  if (cachedToken && cachedToken.exp > Date.now()) return cachedToken.token;

  const res = await fetch(`${BASE}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Shiprocket auth failed: ${parseShiprocketError(text, res.status)}`);
  }
  const data = (await res.json()) as { token?: string };
  if (!data.token) throw new Error("Shiprocket auth failed: no token returned");
  cachedToken = { token: data.token, exp: Date.now() + TOKEN_TTL_MS };
  return data.token;
}

export async function checkPincodeServiceability(pincode: string) {
  try {
    validateShiprocketPincode(pincode);
  } catch {
    return { available: false, mock: false };
  }

  let token: string | null;
  try {
    token = await getShiprocketToken();
  } catch {
    return { available: false, mock: false };
  }

  if (!token) {
    const ok = /^\d{6}$/.test(pincode);
    return {
      available: ok,
      estimate: ok ? "3-5 business days" : undefined,
      mock: true,
    };
  }

  const pickup = getPickupPostcode();
  const res = await fetch(
    `${BASE}/courier/serviceability/?pickup_postcode=${encodeURIComponent(pickup)}&delivery_postcode=${encodeURIComponent(pincode)}&cod=0&weight=0.5`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  if (!res.ok) return { available: false, mock: false };
  const data = await res.json();
  const couriers = data?.data?.available_courier_companies ?? [];
  return {
    available: couriers.length > 0,
    estimate: couriers[0]?.etd,
    mock: false,
  };
}

export type ShiprocketOrderPayload = {
  order_id: string;
  order_date: string;
  pickup_location: string;
  billing_customer_name: string;
  billing_last_name?: string;
  billing_address: string;
  billing_city: string;
  billing_pincode: string;
  billing_state: string;
  billing_country: string;
  billing_email: string;
  billing_phone: string;
  shipping_is_billing: boolean;
  order_items: Array<{
    name: string;
    sku: string;
    units: number;
    selling_price: number;
  }>;
  payment_method: string;
  sub_total: number;
  length: number;
  breadth: number;
  height: number;
  weight: number;
};

export type ShiprocketCreateResult = {
  mock?: boolean;
  order_id?: string | number;
  shipment_id?: string | number;
  awb_code?: string | null;
  courier_name?: string | null;
  tracking_url?: string | null;
  status?: string | number;
  [key: string]: unknown;
};

export async function createShiprocketOrder(
  payload: ShiprocketOrderPayload,
  opts?: { allowMock?: boolean }
): Promise<ShiprocketCreateResult> {
  validateShiprocketPincode(payload.billing_pincode);
  validateShiprocketPhone(payload.billing_phone);
  validateShiprocketWeight(payload.weight);

  const token = await getShiprocketToken();
  if (!token) {
    if (opts?.allowMock !== false && !getShiprocketCredentials().configured) {
      const awb = `MOCKAWB${Math.floor(Math.random() * 1e8)}`;
      return {
        mock: true,
        order_id: `MOCK-SR-${payload.order_id}`,
        shipment_id: `MOCK-SH-${Date.now()}`,
        awb_code: awb,
        courier_name: "Mock Courier",
        tracking_url: generateTrackingUrl(awb),
      };
    }
    throw new Error("Shiprocket credentials are not configured");
  }

  const res = await fetch(`${BASE}/orders/create/adhoc`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });
  const text = await res.text();
  if (!res.ok) {
    throw new Error(`Shiprocket error: ${parseShiprocketError(text, res.status)}`);
  }
  try {
    return JSON.parse(text) as ShiprocketCreateResult;
  } catch {
    throw new Error(`Shiprocket error: invalid JSON response`);
  }
}

export type AssignAwbResult = {
  awb_code?: string | null;
  courier_name?: string | null;
  courier_company_id?: number | string | null;
  [key: string]: unknown;
};

export async function assignAwb(
  shipmentId: string | number,
  courierId?: string | number
): Promise<AssignAwbResult> {
  const token = await getShiprocketToken();
  if (!token) {
    throw new Error("Shiprocket credentials are not configured");
  }

  const body: Record<string, unknown> = {
    shipment_id: Number(shipmentId) || shipmentId,
  };
  if (courierId != null && courierId !== "") {
    body.courier_id = Number(courierId) || courierId;
  }

  const res = await fetch(`${BASE}/courier/assign/awb`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  if (!res.ok) {
    throw new Error(`Shiprocket AWB assign failed: ${parseShiprocketError(text, res.status)}`);
  }

  let data: Record<string, unknown> = {};
  try {
    data = JSON.parse(text) as Record<string, unknown>;
  } catch {
    throw new Error("Shiprocket AWB assign failed: invalid JSON response");
  }

  const response = (data.response as Record<string, unknown> | undefined) || data;
  const payload =
    (response.data as Record<string, unknown> | undefined) ||
    (data.data as Record<string, unknown> | undefined) ||
    response;

  const awb =
    (payload.awb_code as string | undefined) ||
    (payload.awb as string | undefined) ||
    (data.awb_code as string | undefined) ||
    null;
  const courier =
    (payload.courier_name as string | undefined) ||
    (payload.courier_company_id != null
      ? String(payload.courier_company_id)
      : null) ||
    (data.courier_name as string | undefined) ||
    null;

  return {
    ...payload,
    awb_code: awb,
    courier_name: courier,
  };
}

export type TrackingEvent = {
  status: string;
  location?: string;
  at?: string;
};

export type TrackResult = {
  mock: boolean;
  status: string;
  awb?: string | null;
  courierName?: string | null;
  trackingUrl?: string | null;
  events: TrackingEvent[];
  mappedOrderStatus?: "PROCESSING" | "SHIPPED" | "DELIVERED";
};

function demoTrack(createdAt: Date, orderNumber: string, awb?: string | null): TrackResult {
  const hours = Math.max(0, (Date.now() - createdAt.getTime()) / 36e5);
  let status = "READY_TO_SHIP";
  let mappedOrderStatus: TrackResult["mappedOrderStatus"] = "PROCESSING";
  const events: TrackingEvent[] = [
    { status: "Order confirmed", at: createdAt.toISOString(), location: "Warehouse" },
  ];

  if (hours >= 6) {
    status = "IN_TRANSIT";
    mappedOrderStatus = "SHIPPED";
    events.push({
      status: "Picked up by courier",
      at: new Date(createdAt.getTime() + 6 * 36e5).toISOString(),
      location: "Origin hub",
    });
  }
  if (hours >= 24) {
    status = "OUT_FOR_DELIVERY";
    events.push({
      status: "Out for delivery",
      at: new Date(createdAt.getTime() + 24 * 36e5).toISOString(),
      location: "Local hub",
    });
  }
  if (hours >= 48) {
    status = "DELIVERED";
    mappedOrderStatus = "DELIVERED";
    events.push({
      status: "Delivered",
      at: new Date(createdAt.getTime() + 48 * 36e5).toISOString(),
      location: "Customer",
    });
  }

  const code = awb || `DEMO${orderNumber.replace(/\D/g, "").slice(-8)}`;
  return {
    mock: true,
    status,
    awb: code,
    courierName: "Shiprocket Demo Courier",
    trackingUrl: generateTrackingUrl(code),
    events,
    mappedOrderStatus,
  };
}

function mapCourierStatus(raw: string): TrackResult["mappedOrderStatus"] | undefined {
  const s = raw.toLowerCase();
  if (s.includes("deliver")) return "DELIVERED";
  if (s.includes("transit") || s.includes("shipped") || s.includes("out for")) return "SHIPPED";
  if (s.includes("pickup") || s.includes("processing") || s.includes("ready")) return "PROCESSING";
  return undefined;
}

/** Live Shiprocket track when credentials exist; otherwise deterministic demo timeline */
export async function trackShipment(input: {
  awb?: string | null;
  shipmentId?: string | null;
  createdAt: Date;
  orderNumber: string;
}): Promise<TrackResult> {
  let token: string | null = null;
  try {
    token = await getShiprocketToken();
  } catch {
    token = null;
  }
  if (!token || !input.awb) {
    return demoTrack(input.createdAt, input.orderNumber, input.awb);
  }

  try {
    const res = await fetch(`${BASE}/courier/track/awb/${encodeURIComponent(input.awb)}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) {
      return demoTrack(input.createdAt, input.orderNumber, input.awb);
    }
    const data = await res.json();
    const track = data?.tracking_data || data?.data || {};
    const activities: Array<{
      activity?: string;
      date?: string;
      location?: string;
      status?: string;
    }> = track?.shipment_track_activities || track?.track_status || [];

    const current =
      track?.shipment_status ||
      track?.track_status ||
      activities[0]?.status ||
      activities[0]?.activity ||
      "IN_TRANSIT";

    const events: TrackingEvent[] = (Array.isArray(activities) ? activities : []).slice(0, 12).map((a) => ({
      status: a.activity || a.status || "Update",
      location: a.location,
      at: a.date,
    }));

    return {
      mock: false,
      status: String(current),
      awb: input.awb,
      courierName: track?.courier_name || null,
      trackingUrl: track?.track_url || generateTrackingUrl(input.awb),
      events,
      mappedOrderStatus: mapCourierStatus(String(current)),
    };
  } catch {
    return demoTrack(input.createdAt, input.orderNumber, input.awb);
  }
}
