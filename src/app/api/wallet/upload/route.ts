import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { requireUser } from "@/lib/serverAuth";
import { enforceRateLimit, LIMITS } from "@/lib/rateLimit";

/** 10 MB. Anything larger is refused before the body is buffered. */
const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;

/**
 * Accepted MIME types and the Cloudinary format each maps to. SVG and HTML are
 * excluded on purpose: Cloudinary serves them from its own CDN with the
 * attacker's content type, which turns a "document upload" into stored XSS on a
 * trusted origin.
 */
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

export async function POST(req: NextRequest) {
  // Previously unauthenticated: the project's Cloudinary account was an open,
  // unmetered file host and a bandwidth bill anyone could trigger.
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

    if (!(file instanceof File) || file.size === 0) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
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

    // The folder is derived from the verified uid, never from the request body.
    // A client-supplied folder let any caller write into any user's namespace.
    const folder = `wallet/${uid}`;

    const cloudName = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME || process.env.CLOUDINARY_CLOUD_NAME;
    const apiKey = process.env.CLOUDINARY_API_KEY;
    const apiSecret = process.env.CLOUDINARY_API_SECRET;
    const uploadPreset = process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET || process.env.CLOUDINARY_UPLOAD_PRESET;

    if (!cloudName) {
      return NextResponse.json(
        { error: "Cloudinary Cloud Name is not configured in environment variables." },
        { status: 500 }
      );
    }

    if (!apiKey || !apiSecret) {
      return NextResponse.json(
        { error: "Cloudinary server credentials are not configured." },
        { status: 500 }
      );
    }

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

    return NextResponse.json({
      secure_url: data.secure_url,
      public_id: data.public_id,
      format: data.format,
      bytes: data.bytes,
    });
  } catch (err: any) {
    console.error("Cloudinary upload API error:", err);
    return NextResponse.json(
      { error: err.message || "Internal server error during upload." },
      { status: 500 }
    );
  }
}
