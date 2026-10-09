const fs = require('fs');
let code = fs.readFileSync('app/actions/moloni.ts', 'utf8');

const catchStr = `  } catch (error: any) {
    console.error("emitInvoiceAction error:", error)
    return { success: false, error: error.message }
  }`;

code = code.replace(catchStr, '');

fs.writeFileSync('app/actions/moloni.ts', code);
console.log("Fixed moloni.ts successfully");
