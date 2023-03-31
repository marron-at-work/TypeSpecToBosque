import { resolvePath } from "@typespec/compiler";
import { createTestLibrary } from "@typespec/compiler/testing";
import { fileURLToPath } from "url";

export const BosqueLibrary = createTestLibrary({
    name: "@bosque/typespec-to-bosque",
    packageRoot: resolvePath(fileURLToPath(import.meta.url), "../../../../")
});
