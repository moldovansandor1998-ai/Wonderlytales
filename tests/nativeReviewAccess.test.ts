import { describe, expect, it } from 'vitest';
import { isNativeReviewArtifactKey, V024_REVIEW_ARTIFACTS } from '@/lib/native-review';
describe('bounded native review downloads', () => {
  it('allows only registered reviews, exact face proofs and hashed assembled films', () => {
    for (const artifact of V024_REVIEW_ARTIFACTS) expect(isNativeReviewArtifactKey(artifact.key)).toBe(true);
    expect(isNativeReviewArtifactKey('native/S1E1/V024/face_review/CHAR_LILI_456.png')).toBe(true);
    expect(isNativeReviewArtifactKey('renders/native/S1E1/assembled/'+'a'.repeat(64)+'/master.mp4')).toBe(true);
  });
  it.each([
    'native/S1E1/V024/../../secrets.json',
    'native/S1E1/V024/face_review/CHAR_LILI_457.png',
    'native/S1E1/V024/face_review/CHAR_LILI_456.png/extra',
    'renders/native/S1E1/assembled/latest/master.mp4',
    'audio/other-project/private.wav',
    'native/S1E1/V024/preproduction/arbitrary.html',
  ])('rejects unregistered or malformed paths: %s', key => {
    expect(isNativeReviewArtifactKey(key)).toBe(false);
  });
});
