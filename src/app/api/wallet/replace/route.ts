import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { requireUser } from "@/lib/serverAuth";
import { enforceRateLimit, LIMITS } from "@/lib/rateLimit";

const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;

const ALLOWED_TYPES: Record<string, string> = {
  "application/pdf": "pdf",
  "application/msword": "doc",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
  "application/vnd.ms-powerpoint": "ppt",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation": "pptx",
  "application/vnd.ms-excel": "xls",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "xlsx",
  "text/plain": "txt",
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/heic": "heic",
};

function ownedFolder(uid: string): string {
  return `wallet/${uid}/`;
}

export async function POST(req: NextRequest) {
  const auth = await requireUser(req);
  if (!auth.ok) return auth.response;

  const uid = auth.user.uid;

  const limited = enforceRateLimit(req, { ...LIMITS.upload, uid });
  if (!limited.ok) return limited.response;

  try {
    const contentLength = Number(req.headers.get("content-length") || "0");
    if (contentLength > MAX_UPLOAD_BYTES + 1024) {
      return NextResponse.json(
        { error: `File is too large. Maximum size is ${MAX_UPLOAD_BYTES / (1024 * 1024)} MB.` },
        { status: 413 }
      );
    }

    const formData = await req.formData();
    const file = formData.get("file");
    const oldPublicId = formData.get("oldPublicId");

    if (!(file instanceof File) || file.size === 0) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    if (typeof oldPublicId !== "string" || !oldPublicId.trim()) {
      return NextResponse.json({ error: "Missing oldPublicId" }, { status: 400 });
    }

    if (file.size > MAX_UPLOAD_BYTES) {
      return NextResponse.json(
        { error: `File is too large (${(file.size / (1024 * 1024)).toFixed(1)} MB). Maximum size is ${MAX_UPLOAD_BYTES / (1024 * 1024)} MB.` },
        { status: 413 }
      );
    }

    const mime = (file.type || "").toLowerCase();
    const format = ALLOWED_TYPES[mime];
    if (!format) {
      return NextResponse.json(
        {
          error: `Unsupported file type${mime ? ` (${mime})` : ""}. Allowed: PDF, Word, PowerPoint, Excel, TXT, JPEG, PNG, WebP, HEIC.`,
        },
        { status: 415 }
      );
    }

    const folder = ownedFolder(uid);
    const trimmedOldId = oldPublicId.trim();
    if (!trimmedOldId.startsWith(folder) || trimmedOldId.includes("..") || trimmedOldId.includes("\\")) {
      return NextResponse.json(
        { error: "You can only replace documents in your own wallet." },
        { status: 403 }
      );
    }

    const cloudName = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME || process.env.CLOUDINARY_CLOUD_NAME;
    const apiKey = process.env.CLOUDINARY_API_KEY;
    const apiSecret = process.env.CLOUDINARY_API_SECRET;

    if (!cloudName || !apiKey || !apiSecret) {
      return NextResponse.json(
        { error: "Cloudinary server credentials are not configured." },
        { status: 500 }
      );
    }

    const deleteFromCloudinary = async (publicId: string, resourceType: "image" | "raw") => {
      const timestamp = Math.floor(Date.now() / 1000);
      const paramsToSign = `public_id=${publicId}&timestamp=${timestamp}${apiSecret}`;
      const signature = crypto.createHash("sha1").update(paramsToSign).digest("hex");

      const body = new URLSearchParams();
      body.append("public_id", publicId);
      body.append("timestamp", timestamp.toString());
      body.append("api_key", apiKey);
      body.append("signature", signature);

      const res = await fetch(
        `https://api.cloudinary.com/v1_1/${cloudName}/${resourceType}/destroy`,
        { method: "POST", body, signal: AbortSignal.timeout(15000) }
      );
      return res.json();
    };

    // SAFETY ORDER: upload the replacement FIRST, delete the old file only
    // after the new asset is confirmed live. Deleting first meant any upload
    // failure/timeout permanently destroyed the user's original document.
    const uploadFormData = new FormData();
    uploadFormData.append("file", file);
    uploadFormData.append("folder", folder);

    const timestamp = Math.floor(Date.now() / 1000).toString();
    const paramsToSign = `folder=${folder}&timestamp=${timestamp}${apiSecret}`;
    const signature = crypto.createHash("sha1").update(paramsToSign).digest("hex");

    uploadFormData.append("api_key", apiKey);
    uploadFormData.append("timestamp", timestamp);
    uploadFormData.append("signature", signature);

    const uploadRes = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/auto/upload`, {
      method: "POST",
      body: uploadFormData,
      signal: AbortSignal.timeout(60_000),
    });

    const resText = await uploadRes.text();
    let data: Record<string, any> = {};
    try {
      data = JSON.parse(resText);
    } catch {
      return NextResponse.json(
        { error: `Cloudinary returned an unreadable response (HTTP ${uploadRes.status}).` },
        { status: 502 }
      );
    }

    if (!uploadRes.ok) {
      return NextResponse.json(
        { error: data?.error?.message || "Cloudinary upload failed." },
        { status: uploadRes.status >= 400 && uploadRes.status < 600 ? uploadRes.status : 502 }
      );
    }

    // New file is live — now clean up the old asset. A cleanup failure only
    // leaves an orphaned file on the CDN, so it must NOT fail the replace.
    try {
      let deleteResult = await deleteFromCloudinary(trimmedOldId, "image");
      if (deleteResult.result !== "ok") {
        const rawResult = await deleteFromCloudinary(trimmedOldId, "raw");
        if (rawResult.result === "ok") {
          deleteResult = rawResult;
        }
      }
      if (deleteResult.result !== "ok" && deleteResult.result !== "not found") {
        console.warn(
          `wallet/replace: new file uploaded but old file cleanup failed (${trimmedOldId}): ${deleteResult.result}`
        );
      }
    } catch (cleanupErr) {
      console.warn("wallet/replace: old file cleanup error:", cleanupErr);
    }

    return NextResponse.json({
      secure_url: data.secure_url,
      public_id: data.public_id,
      format: data.format,
      bytes: data.bytes,
    });
  } catch (err: any) {
    console.error("Wallet replace API error:", err);
    return NextResponse.json(
      { error: err.message || "Internal server error during replace." },
      { status: 500 }
    );
  }
}
