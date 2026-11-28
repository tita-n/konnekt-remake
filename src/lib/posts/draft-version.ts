/**
 * Draft version ordering, kept pure so the client and server agree on what a
 * stale write is. A higher version wins; at the same version the newer device
 * timestamp wins. A write with no version is treated as new (first save).
 */
export interface DraftVersionStamp {
  version?: number;
  clientTime?: Date | null;
}

export function isStaleDraftWrite(
  incoming: DraftVersionStamp,
  current: { version: number; clientTime: Date | null },
): boolean {
  if (incoming.version === undefined) return false;
  if (incoming.version < current.version) return true;
  if (incoming.version > current.version) return false;
  if (!incoming.clientTime || !current.clientTime) return false;
  return incoming.clientTime.getTime() < current.clientTime.getTime();
}

export function nextDraftVersion(incomingVersion: number | undefined, currentVersion: number): number {
  if (incomingVersion === undefined) return currentVersion + 1;
  return Math.max(currentVersion, incomingVersion) + 1;
}
