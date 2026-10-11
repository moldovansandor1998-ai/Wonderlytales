import Link from 'next/link';
import {redirect} from 'next/navigation';
import {getStudioUser} from '@/lib/auth';
import {PageTitle} from '@/components/ui';
import MediaGallery from '../MediaGallery';
export default async function GalleryPage() {
  const user = await getStudioUser();
  if (!user) redirect('/login?next=/ai-video/gallery');
  if (!['admin', 'studio'].includes(user.role)) return <PageTitle title="Médiagaléria" sub="Stúdiós jogosultság szükséges."/>;
  return <><PageTitle title="Médiagaléria" sub="WonderlyTales · minden megőrzött kép és videóváltozat"/>
    <Link className="mb-6 inline-block text-amber-200" href="/ai-video">← Vissza a videóstúdióba</Link><MediaGallery/></>;
}
