/** Uncompressed ZIP32 with UTF-8 filenames. Audio is already compressed MP3. */
export function audioZip(entries: {name:string;data:Buffer}[]): Buffer {
  const locals:Buffer[]=[],centrals:Buffer[]=[];let offset=0;
  for(const entry of entries) {
    if(!/^[a-zA-Z0-9_./-]+$/.test(entry.name) || entry.name.includes('..')) throw new Error('Invalid archive filename');
    const name=Buffer.from(entry.name);let crc=0xffffffff;
    for(const byte of entry.data) {crc^=byte;for(let bit=0;bit<8;bit++) crc=(crc>>>1)^((crc&1)?0xedb88320:0);}
    crc=(crc^0xffffffff)>>>0;
    const local=Buffer.alloc(30);local.writeUInt32LE(0x04034b50,0);local.writeUInt16LE(20,4);local.writeUInt16LE(0x800,6);
    local.writeUInt32LE(crc,14);local.writeUInt32LE(entry.data.length,18);local.writeUInt32LE(entry.data.length,22);local.writeUInt16LE(name.length,26);
    const central=Buffer.alloc(46);central.writeUInt32LE(0x02014b50,0);central.writeUInt16LE(20,4);central.writeUInt16LE(20,6);central.writeUInt16LE(0x800,8);
    central.writeUInt32LE(crc,16);central.writeUInt32LE(entry.data.length,20);central.writeUInt32LE(entry.data.length,24);central.writeUInt16LE(name.length,28);central.writeUInt32LE(offset,42);
    locals.push(local,name,entry.data);centrals.push(central,name);offset+=local.length+name.length+entry.data.length;
  }
  const directory=Buffer.concat(centrals),end=Buffer.alloc(22);end.writeUInt32LE(0x06054b50,0);end.writeUInt16LE(entries.length,8);end.writeUInt16LE(entries.length,10);end.writeUInt32LE(directory.length,12);end.writeUInt32LE(offset,16);
  return Buffer.concat([...locals,directory,end]);
}
