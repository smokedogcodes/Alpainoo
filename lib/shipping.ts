/** Flat shipping rules (INR) — typical Indian D2C beauty store pattern. */
export const FREE_SHIPPING_MIN = 499;
export const FLAT_SHIPPING_INR = 49;

export function calcShippingFee(merchandiseTotal: number): number {
  if (!Number.isFinite(merchandiseTotal) || merchandiseTotal <= 0) return 0;
  if (merchandiseTotal >= FREE_SHIPPING_MIN) return 0;
  return FLAT_SHIPPING_INR;
}

export function shippingLabel(fee: number, merchandiseTotal: number) {
  if (fee <= 0) {
    return merchandiseTotal >= FREE_SHIPPING_MIN
      ? "Free shipping"
      : "Free shipping";
  }
  return `Standard shipping`;
}

export function amountToFreeShipping(merchandiseTotal: number): number {
  if (merchandiseTotal >= FREE_SHIPPING_MIN) return 0;
  return Math.max(0, Math.round((FREE_SHIPPING_MIN - merchandiseTotal) * 100) / 100);
}
