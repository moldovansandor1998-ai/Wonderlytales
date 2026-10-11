import { redirect } from 'next/navigation';
import { getStudioUser } from '@/lib/auth';
import { PageTitle } from '@/components/ui';
import VideoStudio from './VideoStudio';
export default async function AIVideoPage() {
  const user = await getStudioUser();
  if (!user) redirect('/login?next=/ai-video');
  if (!['admin','studio'].includes(user.role)) return <PageTitle title="AI-videó" sub="A videókészítéshez stúdiós jogosultság szükséges."/>;
  return <><PageTitle title="AI-videó · WaveSpeed" sub="Képből mozgó jelenet · WonderlyTales / Titokváros"/><VideoStudio /></>;
}
