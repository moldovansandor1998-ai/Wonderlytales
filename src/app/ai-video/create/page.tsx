import { redirect } from 'next/navigation';
import { getStudioUser } from '@/lib/auth';
import { PageTitle } from '@/components/ui';
import VideoStudio from '../VideoStudio';
import type { GalleryKind } from '@/lib/ai-video/gallery-shared';
export default async function CreateVideoPage({ searchParams }: { searchParams: { kind?: string; id?: string } }) {
  const user = await getStudioUser();
  if (!user) redirect('/login?next=/ai-video/create');
  if (!['admin', 'studio'].includes(user.role)) return <PageTitle title="Új videó" sub="Stúdiós jogosultság szükséges."/>;
  const { kind, id } = searchParams;
  const reuse = kind && id && ['images', 'videos', 'edits'].includes(kind) && (kind === 'videos' ? /^[a-f0-9-]{36}$/ : /^[a-f0-9]{64}$/).test(id) ? { kind: kind as GalleryKind, id } : undefined;
  return <><PageTitle title="Új videó a galériából" sub="A forrás megmarad. Az új videó csak a generálás gomb megnyomásával indul."/><a className="mb-5 inline-block text-amber-300 underline" href="/gallery">Vissza a galériába</a><VideoStudio reuse={reuse}/></>;
}
