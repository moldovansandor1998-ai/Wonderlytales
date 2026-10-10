/** Read beyond PostgREST's row cap. Keyset ordering also tolerates deletions
 * between pages; a short page is not assumed to be the end of the result. */
export async function readAllRows<T>(load: (after?: string)=>Promise<(T & {id:string})[]>): Promise<T[]> {
  const rows:T[]=[];
  let after:string|undefined;
  for(;;) {
    const page=await load(after);
    if(!page.length) return rows;
    for(const row of page) {
      if(typeof row.id!=='string'||(after!==undefined&&row.id<=after)) throw new Error('Database pagination did not advance');
      after=row.id;rows.push(row);
    }
  }
}
