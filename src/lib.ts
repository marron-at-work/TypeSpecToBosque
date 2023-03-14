
import { createTypeSpecLibrary } from "@typespec/compiler";

export const libdef = createTypeSpecLibrary({
    name: "@bosque/typespec-to-bosque",
    diagnostics: {},
    emitter: {}
});
