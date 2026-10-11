export type GalleryKind = 'images' | 'videos' | 'edits';
export type GalleryItem = {
  id: string; kind: GalleryKind; url: string; title: string; createdAt: string;
  size?: number; prompt?: string; archived: boolean;
};
export type GalleryPage = { items: GalleryItem[]; cursor?: string };
export const GALLERY_LABELS: Record<GalleryKind, string> = {
  videos: 'Eredeti videók', images: 'Képek és képkockák', edits: 'Utómunka és kész filmek',
};
