import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/server/auth";
import {
  uploadImage,
  uploadImageFromUrl,
  UPLOAD_FOLDERS,
  type UploadFolder,
} from "@/lib/server/cloudinary";

const MAX_BYTES = 10 * 1024 * 1024; // 10 MB
const ALLOWED_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/avif"]);

const urlBodySchema = z.object({
  url: z
    .string()
    .trim()
    .max(2048)
    .url("Enter a valid URL")
    .refine((u) => /^https?:\/\//i.test(u), "URL must start with http:// or https://"),
  folder: z.enum(Object.keys(UPLOAD_FOLDERS) as [UploadFolder, ...UploadFolder[]]),
});

// Adds one image to Cloudinary and returns its URL, id and dimensions —
// either an uploaded file (multipart form) or a remote image URL (JSON).
// The image isn't attached to anything until the product / hero is saved.
export async function POST(request: NextRequest) {
  const { error } = await requireAdmin();
  if (error) return error;

  if (request.headers.get("content-type")?.includes("application/json")) {
    return importFromUrl(request);
  }

  const form = await request.formData().catch(() => null);
  const file = form?.get("file");
  const folder = form?.get("folder");

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "No file uploaded" }, { status: 400 });
  }
  if (typeof folder !== "string" || !(folder in UPLOAD_FOLDERS)) {
    return NextResponse.json({ error: "Invalid upload folder" }, { status: 400 });
  }
  if (!ALLOWED_TYPES.has(file.type)) {
    return NextResponse.json({ error: "Use a JPG, PNG, WebP or AVIF image" }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: "Image must be 10 MB or smaller" }, { status: 400 });
  }

  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    const image = await uploadImage(buffer, folder as UploadFolder);
    return NextResponse.json({ image });
  } catch (err) {
    console.error("Upload failed", err);
    return NextResponse.json({ error: "Upload failed. Please try again." }, { status: 502 });
  }
}

async function importFromUrl(request: NextRequest) {
  const parsed = urlBodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid URL" }, { status: 400 });
  }
  try {
    const image = await uploadImageFromUrl(parsed.data.url, parsed.data.folder);
    return NextResponse.json({ image });
  } catch (err) {
    console.error("URL import failed", err);
    return NextResponse.json(
      {
        error:
          "Couldn't import that URL. Make sure it's a direct link to a public image (JPG, PNG, WebP or AVIF), not a web page.",
      },
      { status: 422 }
    );
  }
}
