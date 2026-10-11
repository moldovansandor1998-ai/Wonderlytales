import bible from '../../production/titokvaros/bible/series.json';
import demo from '../../production/titokvaros/episodes/TV_S1E1/demo.json';
import ids from '../../production/titokvaros/ids.json';
export { bible as titokvarosBible, demo as titokvarosDemo, ids as titokvarosIds };
export const titokvarosPrefix = 'native/S1E1/TITOKVAROS/V001';
export const titokvarosFiles = {
 cast2: {key:`${titokvarosPrefix}/Titokvaros_cast_02_V001.png`,mime:'image/png'},
 animated: {key:`${titokvarosPrefix}/TV_ANIMATED_V003.blend`,mime:'application/octet-stream'},
 concept: {key:`${titokvarosPrefix}/Titokvaros_visual_direction_V001.png`,mime:'image/png'},
 master: {key:`${titokvarosPrefix}/TV_MASTER_V001.blend`,mime:'application/octet-stream'},
 proof: {key:`${titokvarosPrefix}/TV_model_proof_V001.png`,mime:'image/png'},
 review: {key:`${titokvarosPrefix}/TV_motion_review_V001.mp4`,mime:'video/mp4'},
 screenplay: {key:`${titokvarosPrefix}/Titokvaros_S1E1_forgatokonyv_V001.txt`,mime:'text/plain; charset=utf-8'},
} as const;

export const voiceDesigns = {
 MIRA:{description:'Original adult Hungarian female voice, age 24, warm mezzo register with slightly breathy lower notes, articulate native Hungarian vowels and consonants. Intelligent curiosity, restrained wit, emotionally present reassurance. Natural feature film acting, no narrator cadence, not a child. No imitation of any real person.',text:'A térkép szerint ez az utca nem létezik. De mi itt állunk, és valaki segítséget kér. Rám nézz, Kipp. Nem kell egyedül. Együtt átjutunk a túloldalra.'},
 BRUNO:{description:'Original adult Hungarian male voice, age 38, warm baritone with mild gravel and grounded resonance. Native Hungarian accent, concise dry humor and dependable calm. During effort breath is audible but words stay clear. Natural intimate film acting, not an announcer. No imitation of any real person.',text:'Akkor tegnap nagyon rossz helyen parkoltam. Várjatok! A kocsi elindult. Tartom, de a féket ne engedd el. Most! Jól van. Mindenki itt van? Akkor megvagyunk.'},
 KIPP:{description:'Original Hungarian young adult male voice, age 19, light natural tenor with a little nervous grain. Native Hungarian articulation, observant, vulnerable but not childish, precise timing and relieved dry wit. Fear is an intimate hesitation, not cartoon squeaking. No imitation of any real person.',text:'Halljátok? Ez nem áramszünet. Ugyanaz a két koppanás, mint tegnap. Én... félek. De hallak, Mira. Megpróbálom. Legközelebb inkább létező utcában sétáljunk.'}
} as const;
export type NewVoiceCode = keyof typeof voiceDesigns;
export function newVoiceCode(value: string): NewVoiceCode {
 if (!Object.prototype.hasOwnProperty.call(voiceDesigns,value)) throw new Error('Ismeretlen új karakter.');
 return value as NewVoiceCode;
}
