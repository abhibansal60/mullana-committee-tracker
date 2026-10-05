/**
 * One id per intended payment, reused until it's saved: a retry after a network error sends the same id,
 * and the server records it once. Keyed by member, amount and mode, so a different payment gets a new id.
 */
export function paymentIds() {
  const ids = new Map<string, string>();
  return {
    get: (memberId: string, amount: number, mode: string) => {
      const key = `${memberId}:${amount}:${mode}`;
      if (!ids.has(key)) ids.set(key, crypto.randomUUID());
      return ids.get(key)!;
    },
    clear: () => ids.clear(),
  };
}
