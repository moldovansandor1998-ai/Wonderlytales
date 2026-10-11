import {redirect} from 'next/navigation';
import {getStudioUser} from '@/lib/auth';
import FilmCut from './FilmCut';
export default async function Page(){const user=await getStudioUser();if(!user)redirect('/login?next=/ai-video/film-cut');if(!['admin','studio'].includes(user.role))return <p>Stúdiós jogosultság szükséges.</p>;return <FilmCut/>;}
