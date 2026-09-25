export function formatPrice(value: number) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(value);
}

/** "₹1,799", or "From ₹1,799" when the price varies (e.g. by size). */
export function formatPriceRange(range: { min: number; max: number }) {
  return range.min === range.max ? formatPrice(range.min) : `From ${formatPrice(range.min)}`;
}

export function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}
