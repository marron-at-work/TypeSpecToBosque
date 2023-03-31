
import { createTypeSpecLibrary, JSONSchemaType } from "@typespec/compiler";

export interface EmitterOptions {
    "output-file": string;
    "namespaces": string;
    "package": string;
}

const EmitterOptionsSchema: JSONSchemaType<EmitterOptions> = {
    type: "object",
    additionalProperties: true,
    properties: {
        "output-file": {
            type: "string",
            nullable: false
        },
        "namespaces": {
            type: "string",
            nullable: false
        },
        "package": {
            type: "string",
            nullable: false
        }
    },
    required: []
};

export const $lib = createTypeSpecLibrary({
    name: "@bosque/typespec-to-bosque",
    diagnostics: {},
    emitter: {
        options: EmitterOptionsSchema
    }
});

export const {reportDiagnostic} = $lib;

