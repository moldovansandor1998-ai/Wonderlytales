export type LiveAudioFormat = "mp3" | "pcm";
export const PCM_SAMPLE_RATE = 24000;
export const PCM_CONTENT_TYPE = "audio/pcm; rate=24000; channels=1; encoding=s16le";
export const providerAudioFormat = (format: LiveAudioFormat) => format === "pcm" ? "pcm_24000" : "mp3_44100_64";
export const audioContentType = (format: LiveAudioFormat) => format === "pcm" ? PCM_CONTENT_TYPE : "audio/mpeg";
