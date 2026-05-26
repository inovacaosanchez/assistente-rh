import fs from "node:fs/promises";
import path from "node:path";

export async function loadRhContext(): Promise<string> {
  const contextPath = path.resolve(__dirname, "../../contextos/rh_sanchez.txt");
  return fs.readFile(contextPath, "utf-8");
}
