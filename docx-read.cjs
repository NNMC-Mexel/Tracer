const mammoth = require("mammoth");
const path = require("path");
const fs = require("fs");

const dir = "E:\\трейсер чистоты\\опросники";
const files = fs.readdirSync(dir).filter((f) => f.endsWith(".docx"));

(async () => {
  for (const f of files) {
    const { value } = await mammoth.extractRawText({ path: path.join(dir, f) });
    console.log("\n\n##################################################");
    console.log("FILE:", f);
    console.log("##################################################");
    console.log(value);
  }
})();
