
import { EmitContext, Model, CodeTypeEmitter, Program, ModelProperty, code, BooleanLiteral, NumericLiteral, StringLiteral, Scalar, IntrinsicType, Type, getPattern } from "@typespec/compiler";

export async function $onEmit(context: EmitContext) {
    const assetEmitter = context.getAssetEmitter(MyCodeEmitter);

    // emit my entire typespec program
    assetEmitter.emitProgram();

    // lastly, write your emit output into the output directory
    await assetEmitter.writeOutput();
}

const intrinsicNameToBSQType = new Map<string, string>([
    ["bytes", "ByteBuffer"],
    ["int64", "BigInt"],
    ["int32", "Int"],
    ["int16", "Int"],
    ["int8", "Int"],
    ["uint64", "BigNat"],
    ["uint32", "Nat"],
    ["uint16", "Nat"],
    ["uint8", "Nat"],
    ["float64", "Float"],
    ["float32", "Float"],
    ["float32", "Float"],
    ["decimal", "Decimal"],
    ["string", "String"],
    ["plainDate", "PlainDate"],
    ["plainTime", "PlainTime"],
    ["zonedDateTime", "DateTime"],
    ["duration", "Duration"],
    ["boolean", "Bool"],
    ["null", "None"],
]);

class MyCodeEmitter extends CodeTypeEmitter {
    programContext(program: Program) {
        const sourceFile = this.emitter.createSourceFile("testout.bsq");
        return {
            scope: sourceFile.globalScope,
        };
    }

    booleanLiteral(boolean: BooleanLiteral) {
        return JSON.stringify(boolean.value);
    }

    numericLiteral(number: NumericLiteral) {
        return JSON.stringify(number.value);
    }

    stringLiteral(string: StringLiteral) {
        return JSON.stringify(string.value);
    }

    scalarDeclaration(scalar: Scalar, scalarName: string) {
        if (!intrinsicNameToBSQType.has(scalarName)) {
            return this.emitter.emitTypeReference(scalar.baseScalar as Scalar);
        }
        else {
            const ctx = this.emitter.getContext();
            const ttype = intrinsicNameToBSQType.get(scalarName) as string;

            if (ttype === "String" && ctx.pattern) {
                return this.emitter.result.rawCode(code`StringOf</${ctx.pattern}/>`);
            }
            else {
                return this.emitter.result.rawCode(ttype);
            }
        }
    }

    intrinsic(intrinsic: IntrinsicType, name: string) {
        return this.emitter.result.rawCode(intrinsicNameToBSQType.get(name) as string);
    }

    modelLiteralContext(model: Model) {
        return {
            inLiteralModel: true
        };
    }

    modelLiteral(model: Model) {
        return this.emitter.result.rawCode(code`{ ${this.emitter.emitModelProperties(model)} }`);
    }

    modelDeclarationContext(model: Model) {
        return {
            inLiteralModel: false
        };
    }

    modelDeclaration(model: Model, name: string) {
        const extendsClause = model.baseModel ? code`provides ${this.emitter.emitTypeReference(model.baseModel)}` : "";
        const dkind = (model.derivedModels.length !== 0) ? "concept" : "entity";

        return this.emitter.result.declaration(name, code`${dkind} ${name} ${extendsClause} { ${this.emitter.emitModelProperties(model)} }`);
    }

    modelInstantiation(model: Model, name: string) {
        return this.modelDeclaration(model, name);
    }

    modelPropertyLiteralReferenceContext(property: ModelProperty) {
        const pattern = getPattern(this.emitter.getProgram(), property);
        if (pattern) {
            console.log(pattern);
            return {
                pattern: pattern
            };
        }
        else {
            return {
            };
        }
    }

    modelPropertyLiteral(property: ModelProperty) {
        const name = property.name;

        const ctx = this.emitter.getContext();
        if(ctx.inLiteralModel) {
            return this.emitter.result.rawCode(code`${name}: ${this.emitter.emitTypeReference(property.type)}`);
        }
        else {
            return this.emitter.result.rawCode(code`field ${name}: ${this.emitter.emitTypeReference(property.type)}`);
        }
    }

    arrayDeclaration(array: Model, name: string, elementType: Type) {
        return this.emitter.result.declaration(
            name,
            code`interface ${name} extends Array<${this.emitter.emitTypeReference(elementType)}> { };`
        );
    }

    arrayLiteral(array: Model, elementType: Type) {
        return this.emitter.result.rawCode(code`List<${this.emitter.emitTypeReference(elementType)}>`);
    }
}
