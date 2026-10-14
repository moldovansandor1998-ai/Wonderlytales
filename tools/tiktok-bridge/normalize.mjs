import { createHash } from 'node:crypto';
const text = (v, n) => typeof v === 'string' ? v.slice(0, n) : String(v ?? '').slice(0, n);
/** V3 group IDs let us react on the first gift without replaying every streak tick. */
export function createEventNormalizer() {
  const seenStreaks = new Set();
  return (type, data) => {
    const giftType = Number(data.gift?.type ?? data.giftDetails?.giftType ?? data.giftDetails?.type ?? data.giftType);
    const group = text(data.groupId, 100);
    const uid = data.user?.id || data.user?.displayId || data.user?.uniqueId || data.uniqueId;
    // Without a reliable streak identity, retain the final-event fallback.
    if (type !== 'gift' || giftType !== 1 || !/^[1-9]\d*$/.test(group) || !uid) return normalizeEvent(type, data);
    const key = createHash('sha256').update(JSON.stringify([String(uid), String(data.giftId || data.gift?.id || ''), group])).digest('hex').slice(0, 32);
    if (seenStreaks.has(key)) return null;
    const event = normalizeEvent(type, {...data, repeatEnd:1});
    seenStreaks.add(key);
    if (seenStreaks.size > 2000) seenStreaks.delete(seenStreaks.values().next().value);
    return {...event, id:`gift-streak:${key}`};
  };
}
export function normalizeEvent(type, data) {
  // Connector 2.5 uses protobuf v3 (content / gift / displayId).
  // Retain older aliases for the standalone bridge and recorded events.
  const giftType = Number(data.gift?.type ?? data.giftDetails?.giftType ?? data.giftDetails?.type ?? data.giftType);
  if (type === 'gift' && giftType === 1 && !data.repeatEnd) return null;
  const user = text(data.user?.nickname || data.nickname || data.user?.displayId || data.user?.uniqueId || data.uniqueId || 'Néző', 80);
  const uid = data.user?.id || data.user?.displayId || data.user?.uniqueId || data.uniqueId || user;
  const comment = type === 'comment' ? text(data.content ?? data.comment, 500).trim() : '';
  if (type === 'comment' && !comment) return null;
  const gift = type === 'gift' ? text(data.gift?.name || data.giftDetails?.giftName || data.giftDetails?.name || data.giftName || data.extendedGiftInfo?.name || 'ajándék', 100) : undefined;
  const count = Math.max(1, Math.min(10000, Math.floor(Number(data.repeatCount) || 1)));
  const nativeId = data.common?.msgId || data.msgId;
  const id = nativeId ? `${type}:${text(nativeId, 100)}` : `${type}:${createHash('sha256').update(JSON.stringify([uid, comment, gift, count, String(data.common?.createTime ?? Math.floor(Date.now() / 3000))])).digest('hex').slice(0, 32)}`;
  const rawGiftId = type === 'gift' ? text(Number(data.giftId) > 0 ? data.giftId : data.gift?.id ?? '', 30) : '';
  const value = Number(data.gift?.diamondCount ?? data.diamondCount ?? data.giftDetails?.diamondCount ?? data.extendedGiftInfo?.diamondCount);
  const giftValue = type === 'gift' && Number.isFinite(value) && value >= 0 ? Math.min(1000000, Math.floor(value)) : undefined;
  return { giftValue, id, type, user, text: comment, gift, count, ...(/^[1-9]\d*$/.test(rawGiftId) ? {giftId: rawGiftId} : {}) };
}
