import { NextResponse, type NextRequest } from "next/server";
import type { Prisma } from "@prisma/client";
import { db } from "@/lib/server/db";
import { rateLimit } from "@/lib/server/rateLimit";
import { CUSTOM_FOLDER, getCustomSettings, isCustomUpload } from "@/lib/server/custom";
import { recordActivity } from "@/lib/server/activity";
import { designInputSchema, printLabel } from "@/lib/custom";

// Public: saves a finished design when the customer adds it to the bag. The
// bag line then refers to it by id; the price is worked out at checkout.
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  if (!rateLimit(request, "custom-design", 30, 10 * 60 * 1000)) {
    return NextResponse.json({ error: "Too many designs saved. Try again in a few minutes." }, { status: 429 });
  }
  const settings = await getCustomSettings();
  if (!settings.enabled) return NextResponse.json({ error: "Custom printing is paused right now." }, { status: 403 });

  const parsed = designInputSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "This design can't be saved" }, { status: 400 });
  }
  const input = parsed.data;

  const product = await db.product.findFirst({ where: { blank: true, variants: { some: { code: input.code } } } });
  if (!product) return NextResponse.json({ error: "That tee is no longer available." }, { status: 404 });

  // Every file must be one our upload endpoint stored.
  const cloud = `https://res.cloudinary.com/${process.env.CLOUDINARY_CLOUD_NAME}/`;
  const ours =
    input.sides.every((s) => isCustomUpload(s.preview.url, s.preview.publicId) && isCustomUpload(s.print.url, s.print.publicId)) &&
    input.sides.every((s) => s.layers.every((l) => l.type !== "image" || (l.src.startsWith(cloud) && l.src.includes(CUSTOM_FOLDER)))) &&
    input.assetIds.every((id) => id.startsWith(CUSTOM_FOLDER));
  if (!ours) return NextResponse.json({ error: "This design can't be saved" }, { status: 400 });

  // Print areas must sit on the shirt (inside the printable zone).
  const ε = 0.002;
  const inside = input.sides.every((s) => {
    const z = settings.areas[s.side];
    return s.boxes.every((b) => b.x >= z.x - ε && b.y >= z.y - ε && b.x + b.w <= z.x + z.w + ε && b.y + b.h <= z.y + z.h + ε);
  });
  if (!inside) return NextResponse.json({ error: "A print area is outside the printable part of the shirt." }, { status: 400 });

  const design = await db.customDesign.create({
    data: {
      productId: product.id,
      code: input.code,
      assetIds: input.assetIds,
      sides: input.sides.map((s) => ({
        side: s.side,
        preview: s.preview.url,
        previewPublicId: s.preview.publicId,
        print: s.print.url,
        printPublicId: s.print.publicId,
        // The editor state: the customer's print areas and what's in them.
        layers: { boxes: s.boxes, layers: s.layers } as unknown as Prisma.InputJsonValue,
      })),
    },
  });
  const label = printLabel(input.sides.map((s) => s.side));
  await recordActivity("custom_design_saved", { tee: product.name, code: input.code, print: label });
  return NextResponse.json({ id: design.id, label, preview: design.sides[0].preview }, { status: 201 });
}
