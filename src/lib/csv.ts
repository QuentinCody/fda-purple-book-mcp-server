/** Strict CSV records; preserve native cells and quoted line endings verbatim. */
export function parseCsv(input: string): string[][] {
  const text = input.replace(/^\uFEFF/, "");
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  let closed = false;
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (quoted) {
      if (char === '"' && text[i + 1] === '"') { field += '"'; i++; }
      else if (char === '"') { quoted = false; closed = true; }
      else field += char;
      continue;
    }
    if (closed && ![",", "\r", "\n"].includes(char)) throw new Error("Unexpected text after a quoted Purple Book CSV field");
    if (char === '"') {
      if (field) throw new Error("Unexpected quote in a Purple Book CSV field");
      quoted = true;
    } else if (char === ",") { row.push(field); field = ""; closed = false; }
    else if (char === "\n" || char === "\r") {
      row.push(field); rows.push(row); row = []; field = ""; closed = false;
      if (char === "\r" && text[i + 1] === "\n") i++;
    } else field += char;
  }
  if (quoted) throw new Error("Unterminated Purple Book CSV field");
  if (field || row.length || closed) { row.push(field); rows.push(row); }
  return rows;
}
