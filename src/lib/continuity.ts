import type { ContinuityStateData } from "./types";

export interface ContinuityWarning { field: string; message: string; severity: "WARNING" | "ERROR"; }

/** Previous output → current input diff; indokolatlan változásokra warning. */
export function diffContinuity(prev: ContinuityStateData | null, curr: ContinuityStateData): ContinuityWarning[] {
  if (!prev) return [];
  const warnings: ContinuityWarning[] = [];
  const prevChars = new Map(prev.characters.map((c) => [c.character_id, c]));
  for (const c of curr.characters) {
    const p = prevChars.get(c.character_id);
    if (!p) { warnings.push({ field: "characters", message: `Új karakter jelenik meg átvezetés nélkül: ${c.character_id}`, severity: "WARNING" }); continue; }
    if (p.present && !c.present) warnings.push({ field: "characters", message: `Karakter eltűnik magyarázat nélkül: ${c.character_id}`, severity: "WARNING" });
    if (p.costume_id !== c.costume_id) warnings.push({ field: "costume", message: `Indokolatlan ruha-változás: ${c.character_id} (${p.costume_id ?? "-"} → ${c.costume_id ?? "-"})`, severity: "WARNING" });
    if ((p.held_object ?? null) !== (c.held_object ?? null)) warnings.push({ field: "held_object", message: `Kézben tartott tárgy változott: ${c.character_id}`, severity: "WARNING" });
  }
  const prevProps = new Map(prev.props.map((p) => [p.prop_id, p.state]));
  for (const p of curr.props) {
    const s = prevProps.get(p.prop_id);
    if (s !== undefined && s !== p.state) warnings.push({ field: "prop_state", message: `Prop state változás: ${p.prop_id} (${s} → ${p.state})`, severity: "WARNING" });
  }
  const e1 = prev.environment, e2 = curr.environment;
  if (e1.location_id !== e2.location_id) warnings.push({ field: "location", message: "Helyszín váltás ugyanazon a snitt-határon", severity: "ERROR" });
  if (e1.time_of_day !== e2.time_of_day) warnings.push({ field: "time", message: `Napszak változás: ${e1.time_of_day} → ${e2.time_of_day}`, severity: "WARNING" });
  if (e1.weather !== e2.weather) warnings.push({ field: "weather", message: `Időjárás változás: ${e1.weather} → ${e2.weather}`, severity: "WARNING" });
  return warnings;
}

/** Shot adatból output continuity state származtatása */
export function stateFromShot(shot: {
  location: { location_id: string; variant?: string };
  characters: { character_id: string; costume_id: string | null; position: [number,number,number]; rotation: [number,number,number]; emotion: string }[];
  props: { prop_id: string; state: string }[];
  lighting: { preset: string; time_of_day: string };
}): ContinuityStateData {
  return {
    characters: shot.characters.map((c) => ({ character_id: c.character_id, present: true, position: c.position, rotation: c.rotation, costume_id: c.costume_id, emotion: c.emotion, held_object: null })),
    props: shot.props.map((p) => ({ prop_id: p.prop_id, state: p.state })),
    environment: { time_of_day: shot.lighting.time_of_day, weather: shot.location.variant === "RAIN" ? "RAIN" : "CLEAR", lighting_preset: shot.lighting.preset, location_id: shot.location.location_id },
    story_variables: {},
  };
}
