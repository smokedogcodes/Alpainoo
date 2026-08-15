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
