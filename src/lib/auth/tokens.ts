import { randomBytes, createHash } from "node:crypto";

export function generateToken(): string {
  return randomBytes(24).toString("base64url");
}

export function sha256Hex(input: string): string {
  return createHash("sha256").update(input).digest("hex");
}
