import fs from "fs"
import path from "path"

const p = path.join(process.cwd(), "app/actions/clientes.ts")
const code = fs.readFileSync(p, "utf8")
console.log(code.slice(0, 1500))
