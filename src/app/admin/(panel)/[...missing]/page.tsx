import { notFound } from "next/navigation";

// Any /admin URL that isn't a page shows the admin 404 (inside the admin
// frame) instead of the storefront one.
export default function MissingAdminPage() {
  notFound();
}
