"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/** On opening Orders, settles online orders left unpaid past the payment
    window (their stock goes back on sale) and refreshes if any changed.
    Done through the API because it updates the storefront cache, which a
    page render can't. */
export function ReleaseExpiredOrders() {
  const router = useRouter();
  useEffect(() => {
    fetch("/api/admin/orders/release-expired", { method: "POST" })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.settled > 0) router.refresh();
      })
      .catch(() => {});
  }, [router]);
  return null;
}
