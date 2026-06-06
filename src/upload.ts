import { ShelbyClient } from "@shelby/sdk";
import * as fs from "fs";
import * as path from "path";

const config = {
  apiKey: process.env.SHELBY_API_KEY || "",
  network: "testnet" as const,
};

export type AccessMode = "public" | "private" | "paid";

export interface FileRecord {
  blobId: string;
  fileName: string;
  fileSize: number;
  accessMode: AccessMode;
  price?: number;
  uploadedAt: number;
  expiresAt: number;
}

const client = new ShelbyClient(config);

export async function uploadFile(
  filePath: string,
  accessMode: AccessMode = "public",
  price?: number
): Promise<FileRecord> {
  const fileName = path.basename(filePath);
  const fileSize = fs.statSync(filePath).size;
  const fileBuffer = fs.readFileSync(filePath);

  console.log(`📤 Uploading: ${fileName} (${(fileSize / 1024).toFixed(1)} KB)`);

  const blob = await client.blobs.upload(fileBuffer, {
    contentType: getContentType(filePath),
  });

  const record: FileRecord = {
    blobId: blob.id,
    fileName,
    fileSize,
    accessMode,
    price: accessMode === "paid" ? price : undefined,
    uploadedAt: Date.now(),
    expiresAt: Date.now() + 48 * 60 * 60 * 1000,
  };

  console.log(`✅ Uploaded! Blob ID: ${blob.id}`);
  scheduleRenewal(blob.id);
  return record;
}

export function scheduleRenewal(blobId: string): void {
  const RENEWAL_INTERVAL = 40 * 60 * 60 * 1000;
  setInterval(async () => {
    try {
      await client.blobs.renew(blobId);
      console.log(`🔄 Renewed blob: ${blobId}`);
    } catch (err) {
      console.error(`❌ Renewal failed:`, err);
    }
  }, RENEWAL_INTERVAL);
}

function getContentType(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase();
  const map: Record<string, string> = {
    ".pdf":  "application/pdf",
    ".png":  "image/png",
    ".jpg":  "image/jpeg",
    ".mp4":  "video/mp4",
    ".zip":  "application/zip",
    ".json": "application/json",
    ".txt":  "text/plain",
  };
  return map[ext] ?? "application/octet-stream";
}
