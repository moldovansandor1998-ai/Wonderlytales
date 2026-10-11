import {redirect} from 'next/navigation';
import {getStudioUser} from '@/lib/auth';
import Trial from './Trial';
export default async function Page(){const user=await getStudioUser();if(!user)redirect('/login?next=/ai-video/avatar-trial');if(!['admin','studio'].includes(user.role))return <p>Stúdiós jogosultság szükséges.</p>;return <Trial/>;}
