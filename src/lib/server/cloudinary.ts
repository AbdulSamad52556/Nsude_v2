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
