import { redirect } from 'next/navigation';
import { getStudioUser } from '@/lib/auth';
import { PageTitle } from '@/components/ui';
import LegacyStudio from './LegacyStudio';
import EpisodeStudio from './EpisodeStudio';
import VoiceDesigns from './VoiceDesigns';
export default async function AIVideoPage() {
  const user = await getStudioUser();
  if (!user) redirect('/login?next=/ai-video');
  if (!['admin','studio'].includes(user.role)) return <PageTitle title="AI-videó" sub="A videókészítéshez stúdiós jogosultság szükséges."/>;
  return <><PageTitle title="Titokváros · első rész" sub="Jelenetek, karakterek, kezdőképek és magyar párbeszéd"/><a href="/gallery" className="mb-5 inline-flex rounded-lg border border-amber-700 px-4 py-3 text-amber-200">Galéria · minden korábbi kép és videó</a><EpisodeStudio/><VoiceDesigns/><LegacyStudio/></>;
}
