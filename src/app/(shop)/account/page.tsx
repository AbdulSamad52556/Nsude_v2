import { Suspense } from "react";
import { AccountView } from "@/components/account/AccountView";

export const metadata = { title: "Account", robots: { index: false } };

// The account loads through /api/account in the browser: only API routes can
// renew the login cookies (access / refresh tokens), so the page itself
// doesn't read the session.
export default function AccountPage() {
  return (
    <Suspense>
      <AccountView />
    </Suspense>
  );
}
