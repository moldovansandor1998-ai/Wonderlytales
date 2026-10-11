import { redirect } from 'next/navigation';
import { getStudioUser } from '@/lib/auth';
import { PageTitle } from '@/components/ui';
import Gallery from './Gallery';
export default async function GalleryPage() {
  const user = await getStudioUser();
  if (!user) redirect('/login?next=/gallery');
  if (!['admin', 'studio'].includes(user.role)) return <PageTitle title="Galéria" sub="Stúdiós jogosultság szükséges."/>;
  return <><PageTitle title="Galéria" sub="Minden megőrzött kép és videó, a korábbi és a későbbi munkákból is."/><Gallery/></>;
}
