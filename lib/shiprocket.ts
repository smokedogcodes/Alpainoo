const BASE = "https://apiv2.shiprocket.in/v1/external";

let cachedToken: { token: string; exp: number } | null = null;

export async function getShiprocketToken() {
  const email = process.env.SHIPROCKET_EMAIL;
  const password = process.env.SHIPROCKET_PASSWORD;
  if (!email || !password) return null;

  if (cachedToken && cachedToken.exp > Date.now()) return cachedToken.token;

  const res = await fetch(`${BASE}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok) return null;
  const data = await res.json();
  cachedToken = { token: data.token, exp: Date.now() + 1000 * 60 * 60 * 8 };
  return data.token as string;
}

export async function checkPincodeServiceability(pincode: string) {
  const token = await getShiprocketToken();
  if (!token) {
    // Mock when credentials absent
    const ok = /^\d{6}$/.test(pincode);
    return {
      available: ok,
      estimate: ok ? "3-5 business days" : undefined,
      mock: true,
    };
  }

  const res = await fetch(
    `${BASE}/courier/serviceability/?pickup_postcode=110001&delivery_postcode=${pincode}&cod=0&weight=0.5`,
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

export async function createShiprocketOrder(payload: ShiprocketOrderPayload) {
  const token = await getShiprocketToken();
  if (!token) {
    return {
      mock: true,
      order_id: `MOCK-SR-${payload.order_id}`,
      shipment_id: `MOCK-SH-${Date.now()}`,
      awb_code: `MOCKAWB${Math.floor(Math.random() * 1e8)}`,
      courier_name: "Mock Courier",
      tracking_url: "https://shiprocket.co/tracking",
    };
  }

  const res = await fetch(`${BASE}/orders/create/adhoc`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Shiprocket error: ${text}`);
  }
  return res.json();
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

  return {
    mock: true,
    status,
    awb: awb || `DEMO${orderNumber.replace(/\D/g, "").slice(-8)}`,
    courierName: "Shiprocket Demo Courier",
    trackingUrl: `https://shiprocket.co/tracking/${awb || orderNumber}`,
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
  const token = await getShiprocketToken();
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
      trackingUrl: track?.track_url || `https://shiprocket.co/tracking/${input.awb}`,
      events,
      mappedOrderStatus: mapCourierStatus(String(current)),
    };
  } catch {
    return demoTrack(input.createdAt, input.orderNumber, input.awb);
  }
}
