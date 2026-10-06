import { db } from "@/lib/server/db";
import { pageAdmin } from "@/lib/server/auth";
import { can } from "@/lib/adminPermissions";
import { FINANCE_TABS } from "@/lib/finance";
import { LIVE } from "@/lib/server/finance";
import { expenseCategoryTree } from "@/lib/server/expenseCategories";
import { AdminPageHeader } from "@/components/admin/AdminShell";
import { SectionTabs } from "@/components/admin/SectionTabs";
import { CategoryManager } from "@/components/admin/CategoryManager";

export const metadata = { title: "Expense categories" };

/** Expense categories and sub-categories, with how much went to each. */
export default async function ExpenseCategoriesPage() {
  const admin = await pageAdmin("finance.view");
  const [tree, byCategory, bySub] = await Promise.all([
    expenseCategoryTree(),
    db.financeEntry.groupBy({
      by: ["categoryId"],
      where: { AND: [LIVE, { type: "expense", categoryId: { not: null } }] },
      _sum: { amount: true },
      _count: { _all: true },
    }),
    db.financeEntry.groupBy({
      by: ["subcategoryId"],
      where: { AND: [LIVE, { type: "expense", subcategoryId: { not: null } }] },
      _sum: { amount: true },
      _count: { _all: true },
    }),
  ]);
  const usage: Record<string, { count: number; paise: number }> = {};
  for (const r of byCategory) if (r.categoryId) usage[r.categoryId] = { count: r._count._all, paise: -(r._sum.amount ?? 0) };
  for (const r of bySub) if (r.subcategoryId) usage[r.subcategoryId] = { count: r._count._all, paise: -(r._sum.amount ?? 0) };

  return (
    <div>
      <AdminPageHeader title="Finance" subtitle="Expense categories and sub-categories. Totals are all time." />
      <SectionTabs tabs={FINANCE_TABS} active="/admin/finance/categories" />
      <CategoryManager
        tree={tree}
        usage={usage}
        canManage={can(admin, "finance.manage")}
        apiBase="/api/admin/finance/categories"
        unit="expense"
        placeholder="New category, e.g. Events"
        note="Hidden categories stay on past expenses but can't be picked for new ones. Only unused categories can be deleted."
      />
    </div>
  );
}
