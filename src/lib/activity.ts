// Visitor activity tracking: names shared by the browser tracker, the
// server and the admin Activity pages. No server-only imports here.

/** Random id per browser, kept for a year. */
export const VISITOR_COOKIE = "nsude_vid";
/** Random id per visit; slides forward on activity, ends after 30 idle minutes. */
export const VISIT_COOKIE = "nsude_sid";
/** Same, for admin users in the admin panel (a separate visit). */
export const ADMIN_VISIT_COOKIE = "nsude_asid";

export type ActivityArea = "store" | "admin";
export const areaOf = (path: string): ActivityArea => (path.startsWith("/admin") ? "admin" : "store");
export const visitCookie = (area: ActivityArea) => (area === "admin" ? ADMIN_VISIT_COOKIE : VISIT_COOKIE);
export const VISIT_IDLE_MINUTES = 30;

export const ID_PATTERN = /^[A-Za-z0-9_-]{16,64}$/;

/** How each event reads in the admin timeline. */
export const ACTIVITY_LABEL: Record<string, string> = {
  page_view: "Viewed page",
  page_leave: "Left page",
  click: "Clicked",
  product_view: "Viewed product",
  size_select: "Picked a size",
  quantity_change: "Changed quantity",
  add_to_bag: "Added to bag",
  buy_now: "Tapped Buy Now",
  remove_from_bag: "Removed from bag",
  bag_quantity: "Changed bag quantity",
  bag_open: "Opened the bag",
  search: "Searched",
  shop_filter: "Filtered / sorted the shop",
  checkout_step: "Checkout step",
  payment_method: "Chose payment method",
  order_placed: "Placed an order",
  payment_completed: "Paid online",
  payment_cancelled: "Closed the payment window",
  otp_requested: "Asked for a sign-in code",
  signed_up: "Created an account",
  signed_in: "Signed in",
  signed_out: "Signed out",
  profile_updated: "Updated profile",
  address_saved: "Saved an address",
  address_deleted: "Deleted an address",
  order_edited: "Edited an order",
  order_cancelled: "Cancelled an order",
  sign_in_failed: "Sign-in failed (wrong password)",
  audit: "Saved a change",
};

/** Events that matter most, highlighted in the timeline. */
export const KEY_EVENTS = new Set([
  "add_to_bag",
  "buy_now",
  "order_placed",
  "payment_completed",
  "signed_in",
  "signed_up",
  "order_cancelled",
  "audit",
  "sign_in_failed",
]);

/** Where a visit got to, best first. */
export type VisitOutcome = "ordered" | "checkout" | "bag" | "browsed";
export const OUTCOME_LABEL: Record<VisitOutcome, string> = {
  ordered: "Ordered",
  checkout: "Reached checkout",
  bag: "Added to bag",
  browsed: "Browsed",
};
export const OUTCOME_TONE: Record<VisitOutcome, string> = {
  ordered: "border-moss bg-moss text-paper",
  checkout: "border-sand bg-sand/50 text-ink",
  bag: "border-taupe bg-taupe/20 text-ink",
  browsed: "border-taupe/50 text-ash",
};
export function visitOutcome(v: { orderNumbers: string[]; reachedCheckout: boolean; addedToBag: boolean }): VisitOutcome {
  if (v.orderNumbers.length > 0) return "ordered";
  if (v.reachedCheckout) return "checkout";
  if (v.addedToBag) return "bag";
  return "browsed";
}
