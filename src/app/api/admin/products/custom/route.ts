import { NextResponse, type NextRequest } from "next/server";
import { requireAdmin } from "@/lib/server/auth";
import { adminActor, recordAudit, type Change } from "@/lib/server/audit";
import { getCustomSettings, saveCustomSettings } from "@/lib/server/custom";
import { revalidateStorefront } from "@/lib/server/revalidate";
import { customSettingsSchema, PRINT_SIDES, SIDE_LABEL, type PrintArea } from "@/lib/custom";
import { fieldErrors } from "@/lib/validation";

const pct = (a: PrintArea) => `x ${Math.round(a.x * 100)}% · y ${Math.round(a.y * 100)}% · ${Math.round(a.w * 100)}×${Math.round(a.h * 100)}%`;

/** Saves the custom-tee settings: on/off, print prices, print areas. */
export async function PUT(request: NextRequest) {
  const { error, admin } = await requireAdmin("products.manage");
  if (error) return error;
  const parsed = customSettingsSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Please fix the highlighted fields", fields: fieldErrors(parsed.error) }, { status: 400 });
  }
  const before = await getCustomSettings();
  const after = parsed.data;
  await saveCustomSettings(after);

  const changes: Change[] = [];
  if (before.enabled !== after.enabled) changes.push({ field: "Custom orders", from: before.enabled ? "On" : "Off", to: after.enabled ? "On" : "Off" });
  for (const side of PRINT_SIDES) {
    if (before.fees[side] !== after.fees[side]) {
      changes.push({ field: `${SIDE_LABEL[side]} print price`, from: `₹${before.fees[side]}`, to: `₹${after.fees[side]}` });
    }
    if (pct(before.areas[side]) !== pct(after.areas[side])) {
      changes.push({ field: `${SIDE_LABEL[side]} printable zone`, from: pct(before.areas[side]), to: pct(after.areas[side]) });
    }
  }
  if (changes.length) {
    await recordAudit({
      actor: adminActor(admin.email),
      entity: "product",
      entityId: "custom-settings",
      entityLabel: "Custom tees settings",
      action: "Custom tees settings updated",
      changes,
    });
  }
  revalidateStorefront();
  return NextResponse.json({ settings: after });
}
