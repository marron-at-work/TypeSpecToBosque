import { createTestHost, expectDiagnosticEmpty, resolveVirtualPath, TestHost } from "@typespec/compiler/testing";
import { BosqueLibrary } from "./testing/index.js";

export async function createBosqueTestHost(): Promise<TestHost> {
    return createTestHost({
        libraries: [BosqueLibrary],
    });
}

export async function bosqueEmitterOutputFor(code: string, fileName: string) {
    const host = await createBosqueTestHost();
    const outfile = resolveVirtualPath("typespec-output/");
    host.addTypeSpecFile("main.tsp", code);

    const diagnostics = await host.diagnose("main.tsp", {
        noEmit: false,
        emit: ["@bosque/typespec-to-bosque"],
        options: {"@bosque/typespec-to-bosque": { outfile: outfile }}
    });
    expectDiagnosticEmpty(diagnostics);
    const npath = outfile + fileName;
    return host.fs.get(npath);
}
