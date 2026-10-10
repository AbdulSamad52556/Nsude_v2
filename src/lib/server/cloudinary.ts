import "server-only";
import { v2 as cloudinary, type UploadApiResponse } from "cloudinary";

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true,
});

export const UPLOAD_FOLDERS = {
  products: "nsude/products",
  hero: "nsude/hero",
  collections: "nsude/collections",
  /** Customers' custom-tee uploads and design renders. */
  custom: "nsude/custom",
} as const;

export type UploadFolder = keyof typeof UPLOAD_FOLDERS;

export interface UploadedImage {
  src: string;
  publicId: string;
  width: number;
  height: number;
}

export function uploadImage(buffer: Buffer, folder: UploadFolder): Promise<UploadedImage> {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      { folder: UPLOAD_FOLDERS[folder], resource_type: "image" },
      (error, result?: UploadApiResponse) => {
        if (error || !result) return reject(error ?? new Error("Upload failed"));
        resolve({
          src: result.secure_url,
          publicId: result.public_id,
          width: result.width,
          height: result.height,
        });
      }
    );
    stream.end(buffer);
  });
}

/** Import an image from a public URL. Cloudinary fetches it (not our
    server), so a pasted URL can't be used to probe our internal network. */
export async function uploadImageFromUrl(url: string, folder: UploadFolder): Promise<UploadedImage> {
  const result = await cloudinary.uploader.upload(url, {
    folder: UPLOAD_FOLDERS[folder],
    resource_type: "image",
  });
  return {
    src: result.secure_url,
    publicId: result.public_id,
    width: result.width,
    height: result.height,
  };
}

/** A bill / receipt for Finance: photos as images, PDFs as raw files (so
    they open as PDFs). Kept in their own folder. */
export function uploadReceipt(buffer: Buffer, isPdf: boolean, filename: string) {
  const resourceType = isPdf ? "raw" : "image";
  return new Promise<{ url: string; publicId: string; resourceType: string }>((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder: "nsude/receipts",
        resource_type: resourceType,
        // Raw files need their extension in the id to be served as PDFs.
        ...(isPdf ? { public_id: `${filename.replace(/\.pdf$/i, "").replace(/[^\w-]+/g, "-").slice(0, 60)}-${Date.now()}.pdf` } : {}),
      },
      (error, result?: UploadApiResponse) => {
        if (error || !result) return reject(error ?? new Error("Upload failed"));
        resolve({ url: result.secure_url, publicId: result.public_id, resourceType });
      }
    );
    stream.end(buffer);
  });
}

/** Removes one uploaded file of either kind; best effort. */
export async function deleteAsset(publicId: string, resourceType: string) {
  await cloudinary.uploader.destroy(publicId, { resource_type: resourceType }).catch((err) => {
    console.error(`Cloudinary delete failed for ${publicId}`, err);
  });
}

/** Best-effort delete: a failed cleanup shouldn't fail the admin's save. */
export async function deleteImages(publicIds: Array<string | null | undefined>) {
  const ids = publicIds.filter((id): id is string => Boolean(id));
  await Promise.all(
    ids.map((id) =>
      cloudinary.uploader.destroy(id).catch((err) => {
        console.error(`Cloudinary delete failed for ${id}`, err);
      })
    )
  );
}
