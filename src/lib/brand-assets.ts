import fs from "node:fs";
import path from "node:path";

const logoPath = path.join(process.cwd(), "src", "assets", "logo.png");

export function readAtharLogoBuffer() {
  return fs.readFileSync(logoPath);
}

export function atharLogoDataUri() {
  return `data:image/png;base64,${readAtharLogoBuffer().toString("base64")}`;
}
