import type {R2VideoStore} from './storage';
import type {GalleryKind, GalleryItem, GalleryPage} from './gallery-shared';

/** Enumerate stored bytes, including older and orphaned variants, with no history cap. */
export async function mediaGallery(store: R2VideoStore, kind: GalleryKind, cursor?: string): Promise<GalleryPage> {
  const page = await store.mediaPage(kind, cursor);
  const items: GalleryItem[] = [];
  for (let offset = 0; offset < page.items.length; offset += 8) {
    const batch = await Promise.all(page.items.slice(offset, offset + 8).map(async asset => {
      const items: GalleryItem[] = [];
      if (kind === 'images') {
        items.push({...asset, kind, title: 'Megőrzött kép', sha256: asset.id,
          url: '/api/ai-video/image?sha256=' + asset.id, archived: true});
      } else if (kind === 'videos') {
        const row = await store.read(asset.id);
        if (!row || row.job.status !== 'COMPLETED') return items;
        items.push({...asset, kind, title: row.job.prompt.slice(0, 160), jobId: asset.id,
          createdAt: row.job.createdAt, url: '/api/ai-video/jobs/' + asset.id + '/media', archived: !!row.job.archived});
      } else {
        items.push({...asset, kind, title: 'Megőrzött videóváltozat', sha256: asset.id,
          url: '/api/ai-video/assets/' + asset.id, archived: true});
      }
      return items;
    }));
    items.push(...batch.flat());
  }
  return {items, nextCursor: page.nextCursor};
}
