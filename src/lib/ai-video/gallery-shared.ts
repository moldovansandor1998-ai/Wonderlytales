/** Owner-scoped media library. URLs always point to authenticated app routes. */
export type GalleryKind = 'images' | 'videos' | 'finished';
export type GalleryItem = {
  id: string;
  kind: GalleryKind;
  url: string;
  title: string;
  createdAt: string;
  bytes?: number;
  archived: boolean;
  jobId?: string;
  sha256?: string;
};
export type GalleryPage = {items: GalleryItem[]; nextCursor?: string};
