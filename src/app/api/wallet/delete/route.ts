import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { requireUser } from "@/lib/serverAuth";
import { enforceRateLimit, LIMITS } from "@/lib/rateLimit";

/** Uploads are stored under `wallet/<uid>/-`, so ownership is a prefix check. */
function ownedFolder(uid: string): string {
  return `wallet/${uid}/`;
}

export async function POST(req: NextRequest) {
  // Previously unauthenticated: anyone could destroy any asset in the Cloudinary
  // account by supplying an arbitrary public_id.
  const auth = await requireUser(req);
  if (!auth.ok) return auth.response;

  const uid = auth.user.uid;

  const limited = enforceRateLimit(req, { ...LIMITS.walletDelete, uid });
  if (!limited.ok) return limited.response;

  try {
    const body = (await req.json().catch(() => null)) as { publicId?: unknown } | null;
    const publicId = typeof body?.publicId === "string" ? body.publicId.trim() : "";

    if (!publicId) {
      return NextResponse.json({ error: "Missing publicId" }, { status: 400 });
    }

    // Ownership check. Never trust the caller-supplied id on its own: refuse
    // anything outside this user's own wallet folder, and refuse path traversal.
    const folder = ownedFolder(uid);
    if (!publicId.startsWith(folder) || publicId.includes("..") || publicId.includes("\\")) {
      return NextResponse.json(
        { error: "You can only delete documents from your own wallet." },
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

    const deleteFromCloudinary = async (resourceType: "image" | "raw") => {
      const timestamp = Math.floor(Date.now() / 1000);
      const paramsToSign = `public_id=${publicId}&timestamp=${timestamp}${apiSecret}`;
      const signature = crypto.createHash("sha1").update(paramsToSign).digest("hex");

      const formData = new URLSearchParams();
      formData.append("public_id", publicId);
      formData.append("timestamp", timestamp.toString());
      formData.append("api_key", apiKey);
      formData.append("signature", signature);

      const res = await fetch(
        `https://api.cloudinary.com/v1_1/${cloudName}/${resourceType}/destroy`,
        { method: "POST", body: formData, signal: AbortSignal.timeout(15000) }
      );
      return res.json();
    };

    // Try deleting as an image (PDFs and images default to image under auto upload)
    let data = await deleteFromCloudinary("image");

    // If it's a raw file (e.g. .docx, .txt), it won't be found as an image. Try raw deletion.
    if (data.result !== "ok") {
      const rawData = await deleteFromCloudinary("raw");
      if (rawData.result === "ok") {
        data = rawData;
      }
    }

    if (data.result !== "ok") {
      return NextResponse.json(
        { error: `Cloudinary delete failed: ${data.result}` },
        { status: data.result === "not found" ? 404 : 500 }
      );
    }

    return NextResponse.json({ success: true, result: data.result });
  } catch (err: any) {
    console.error("Wallet delete API error:", err);
    return NextResponse.json({ error: "Delete failed" }, { status: 500 });
  }
}
