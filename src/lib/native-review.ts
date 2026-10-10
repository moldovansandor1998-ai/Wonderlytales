/** Existing review artifacts; a successful render is not a quality approval. */
export const V024_REVIEW_ARTIFACTS = [
  { id: 'scene-001', title: 'Csodakapu — első jelenet, 58 másodperc',
    description: '1080p, eredeti magyar hangokkal. A képi minőség még nincs elfogadva.',
    key: 'renders/native/S1E1/review/V024/SC001_58s.mp4',
    sha256: '6e1ecd21fe2476a6be3c9181d2e69a52e8997dd8d34c19a8ade6b1435ad81956',
    kind: 'video', durationSec: 58, productionApproved: false },
  { id: 'cast-motion', title: 'Hat szereplő — 20 másodperces mozgásdiagnosztika',
    description: 'Néma mozgáspróba, csökkentett felbontásban.',
    key: 'native/S1E1/V024/cast_preview/WonderlyTales_V024_all6_motion_20s.mp4',
    sha256: '8abf78d258d56036a73820a695eab3c24bf2819d5cc5aef154608821eb18b939',
    kind: 'video', durationSec: 20, productionApproved: false },
  { id: 'timed-storyboard', title: 'FEATURE_V002 — időzített storyboard és olvasópróba',
    description: '329 képes terv és 131 eredeti hangfelvétel; 113 új szöveg még felolvasásra vár.',
    key: 'native/S1E1/V024/preproduction/Csodakapu_idozitett_storyboard_V024.html',
    sha256: 'e380d82df9d9c8fcccc9817643a692c1d10e51adf1c92f48404323dbd4f36bfa',
    kind: 'html', durationSec: null, productionApproved: false },
] as const;

export function isNativeReviewArtifactKey(key: string): boolean {
  return V024_REVIEW_ARTIFACTS.some(a => a.key === key)
    || /^renders\/native\/S1E1\/assembled\/[a-f0-9]{64}\/master\.mp4$/.test(key)
    || /^native\/S1E1\/V024\/face_review\/CHAR_(MARK|LILI|MORZSI|POTTY|ZIZI|BOGYO)_(1|456)\.png$/.test(key);
}
