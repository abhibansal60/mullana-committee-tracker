import bcrypt from "bcryptjs";

const BCRYPT_ROUNDS = 10;
export const MAX_FAILED_PIN_ATTEMPTS = 5;
export const PIN_LOCKOUT_DURATION_MS = 15 * 60 * 1000;

export async function hashPin(pin: string): Promise<string> {
  return bcrypt.hash(pin, BCRYPT_ROUNDS);
}

export async function verifyPin(pin: string, hash: string): Promise<boolean> {
  return bcrypt.compare(pin, hash);
}

/** True once a PIN entry attempt should be rejected outright due to prior failures. */
export function shouldLock(failedAttempts: number): boolean {
  return failedAttempts >= MAX_FAILED_PIN_ATTEMPTS;
}

export function computeLockoutExpiry(now: Date = new Date()): Date {
  return new Date(now.getTime() + PIN_LOCKOUT_DURATION_MS);
}

export function isLockedOut(
  lockedUntil: Date | null,
  now: Date = new Date()
): boolean {
  return lockedUntil !== null && lockedUntil.getTime() > now.getTime();
}
