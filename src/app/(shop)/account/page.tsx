import { Suspense } from "react";
import { AccountView } from "@/components/account/AccountView";
import { getCustomer, toAccountData } from "@/lib/server/customer";

export const metadata = { title: "Account", robots: { index: false } };

// Per request: shows the signed-in customer's account, or the phone login.
export const dynamic = "force-dynamic";

export default async function AccountPage() {
  const customer = await getCustomer();
  return (
    <Suspense>
      <AccountView initialAccount={customer ? toAccountData(customer) : null} />
    </Suspense>
  );
}
