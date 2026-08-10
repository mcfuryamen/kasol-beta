import { gbkNormalizeDevice, gbkHmac, validateGBKSerial } from "./_gbk_check_tmp.mjs";

const d = gbkNormalizeDevice("DID-AB12CD34");
const sig = await gbkHmac(d + "12");
const ser = "GBK-" + d.slice(0, 4) + "-" + d.slice(4, 8) + "-12-" + sig;
console.log("admin devCode:", d, "| serial:", ser);

const ok = await validateGBKSerial(ser, "DID-AB12CD34");
console.log("device benar  ->", ok && ok.valid === true ? "PASS" : "FAIL");

const bad = await validateGBKSerial(ser, "DID-AB12CD99");
console.log("device beda   ->", bad && bad.valid === false ? "PASS" : "FAIL");

const non = await validateGBKSerial("KSG-1111-2222-3333-4444-DID-AB12CD34", "DID-AB12CD34");
console.log("non-GBK null ->", non === null ? "PASS" : "FAIL");
