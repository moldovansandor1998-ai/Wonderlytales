import { createHash } from 'node:crypto';
const text = (v, n) => typeof v === 'string' ? v.slice(0, n) : String(v ?? '').slice(0, n);
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
  return { id, type, user, text: comment, gift, count };
}
