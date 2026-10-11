import {it,expect,vi,beforeEach} from 'vitest';
const m=vi.hoisted(()=>({auth:vi.fn(),single:vi.fn(),rpc:vi.fn(),from:vi.fn()}));
vi.mock('@/lib/auth',()=>({requireStudioUser:m.auth,createServerSupabase:()=>({from:m.from,rpc:m.rpc})}));
vi.mock('next/cache',()=>({revalidatePath:vi.fn()}));
import {controlFilm} from '@/app/production/actions';
beforeEach(()=>{vi.resetAllMocks();m.auth.mockResolvedValue({role:'studio'});m.from.mockReturnValue({select:()=>({eq:()=>({single:m.single})})});m.rpc.mockResolvedValue({error:null});});
it('does not resume a preserved archived film run',async()=>{m.single.mockResolvedValue({data:{quality_report:{archived:true}},error:null});await expect(controlFilm('old-run','RESUME')).rejects.toThrow('archív');expect(m.rpc).not.toHaveBeenCalled();});
it('still permits pausing an archived run if it was already active',async()=>{await controlFilm('old-run','PAUSE');expect(m.rpc).toHaveBeenCalledWith('control_film',{p_run:'old-run',p_action:'PAUSE'});});
it('does not bypass authentication for archive checks',async()=>{m.auth.mockRejectedValue(new Error('UNAUTHORIZED'));await expect(controlFilm('old-run','RESUME')).rejects.toThrow('UNAUTHORIZED');expect(m.from).not.toHaveBeenCalled();expect(m.rpc).not.toHaveBeenCalled();});
