import status from '../../production/titokvaros/professional/status.json';

/** The rejected procedural cast is retired. Reads and reconciliation stay enabled. */
export function assertLegacyTitokvarosSubmissionAllowed(): void {
  if (!status.legacy_render_submissions_enabled) {
    throw new Error('A kísérleti karakterek új renderelése leállítva. Az aktív irány: Félix, Maya → Unreal Engine, 30 másodperces filmes jelenet.');
  }
}
