import { NextResponse, type NextRequest } from "next/server";
import { uploadImage } from "@/lib/server/cloudinary";
import { rateLimit } from "@/lib/server/rateLimit";
import { getCustomSettings } from "@/lib/server/custom";

// Public: the custom-tee designer uploads the customer's images and the
// rendered design (preview + print file) here, into its own folder.
export const dynamic = "force-dynamic";

const MAX_BYTES = 10 * 1024 * 1024;
const ALLOWED = new Set(["image/jpeg", "image/png", "image/webp"]);

export async function POST(request: NextRequest) {
  // A design is a handful of files; this is generous for real use.
  if (!rateLimit(request, "custom-upload", 60, 10 * 60 * 1000)) {
    return NextResponse.json({ error: "Too many uploads. Try again in a few minutes." }, { status: 429 });
  }
  if (!(await getCustomSettings()).enabled) {
    return NextResponse.json({ error: "Custom printing is paused right now." }, { status: 403 });
  }
  const form = await request.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File)) return NextResponse.json({ error: "No file uploaded" }, { status: 400 });
  if (!ALLOWED.has(file.type)) return NextResponse.json({ error: "Use a JPG, PNG or WebP image" }, { status: 400 });
  if (file.size > MAX_BYTES) return NextResponse.json({ error: "Images must be 10 MB or smaller" }, { status: 400 });

  try {
    const image = await uploadImage(Buffer.from(await file.arrayBuffer()), "custom");
    return NextResponse.json({ url: image.src, publicId: image.publicId, width: image.width, height: image.height });
  } catch (err) {
    console.error("Custom upload failed", err);
    return NextResponse.json({ error: "Upload failed. Please try again." }, { status: 502 });
  }
}
