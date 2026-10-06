import { NextResponse, type NextRequest } from "next/server";
import { requireAdmin } from "@/lib/server/auth";
import { uploadReceipt } from "@/lib/server/cloudinary";

const MAX_BYTES = 10 * 1024 * 1024; // 10 MB
const TYPES: Record<string, "image" | "pdf"> = {
  "image/jpeg": "image",
  "image/png": "image",
  "image/webp": "image",
  "application/pdf": "pdf",
};

/** Uploads one bill / receipt (photo or PDF). It's attached to an entry when
    the entry is saved (or via "Attach bill" on the ledger). */
export async function POST(request: NextRequest) {
  const { error } = await requireAdmin("finance.manage");
  if (error) return error;
  const form = await request.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File)) return NextResponse.json({ error: "No file uploaded" }, { status: 400 });
  const kind = TYPES[file.type];
  if (!kind) return NextResponse.json({ error: "Use a photo (JPG, PNG, WebP) or a PDF" }, { status: 400 });
  if (file.size > MAX_BYTES) return NextResponse.json({ error: "Files must be 10 MB or smaller" }, { status: 400 });

  try {
    const uploaded = await uploadReceipt(Buffer.from(await file.arrayBuffer()), kind === "pdf", file.name);
    return NextResponse.json({ attachment: { ...uploaded, name: file.name.slice(0, 120), kind } });
  } catch (err) {
    console.error("Receipt upload failed", err);
    return NextResponse.json({ error: "Upload failed. Please try again." }, { status: 502 });
  }
}
