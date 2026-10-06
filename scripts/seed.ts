/** npm run seed – újraépíti a demo adatbázist (data/demo.json) */
import { promises as fs } from "fs";
import path from "path";
import { buildDemoData } from "../src/lib/seed";
async function main() {
  const file = path.join(process.cwd(), "data", "demo.json");
  await fs.mkdir(path.dirname(file), { recursive: true });
  await fs.writeFile(file, JSON.stringify(buildDemoData(), null, 2));
  console.log("Demo seed kész:", file);
}
main();
