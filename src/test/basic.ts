import { bosqueEmitterOutputFor } from "./test-host.js";

import { expect } from "chai";

describe("Top level Model decls (Basics)", () => {
    it("basic", async () => {
       const output = await bosqueEmitterOutputFor(`
       model M1 {
            iv: int64;
        }
       `, "main.bsq");
       expect(output).contains("MISSING"); 
    });
});
