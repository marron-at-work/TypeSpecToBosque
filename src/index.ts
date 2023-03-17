
import { EmitContext, Model, Program, ModelProperty, BooleanLiteral, NumericLiteral, StringLiteral, Scalar, IntrinsicType, Type, getPattern, getKnownValues, getMinLength, getMaxLength, getMinItems, getMaxItems, getMinValue, getMaxValue, Enum, EnumMember, Union, UnionVariant, Tuple } from "@typespec/compiler";
import { CodeTypeEmitter, code, StringBuilder } from "@typespec/compiler/emitter-framework";

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

            return this.emitter.result.rawCode(ttype);
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
        const builder = new StringBuilder();
        let first = true;
        model.properties.forEach((pp) => {
            const ee = code`${!first ? "," : ""} ${this.emitter.emitModelProperty(pp)}`;
            first = false;
            builder.push(ee);
        });

        return this.emitter.result.rawCode(code`{ ${builder.reduce()} }`);
    }

    modelDeclarationContext(model: Model) {
        return {
            inLiteralModel: false
        };
    }

    modelDeclaration(model: Model, name: string) {
        const extendsClause = model.baseModel ? code`provides ${this.emitter.emitTypeReference(model.baseModel)}` : "";
        const dkind = (model.derivedModels.length !== 0) ? "concept" : "entity";

        const builder = new StringBuilder();
        model.properties.forEach((pp) => {
            const ee = code`    ${this.emitter.emitModelProperty(pp)}\n`;
            builder.push(ee);
        });

        return this.emitter.result.declaration(name, code`${dkind} ${name} ${extendsClause} {\n${builder.reduce()}}`);
    }

    modelInstantiation(model: Model, name: string) {
        return this.modelDeclaration(model, name);
    }

    modelPropertyLiteral(property: ModelProperty) {
        const name = property.name;

        const pattern = getPattern(this.emitter.getProgram(), property);
        const pattern_inv = pattern ? `invariant /${pattern}/.accepts($${name});` : "";

        const kvs = getKnownValues(this.emitter.getProgram(), property);
        const kvs_inv = kvs ? `invariant [NOT IMPLEMENTED];` : "";

        const minlen = getMinLength(this.emitter.getProgram(), property);
        const maxlen = getMaxLength(this.emitter.getProgram(), property);
        let len_inv = "";
        if(minlen !== undefined || maxlen !== undefined) {
            const ml = minlen === undefined ? "" : minlen;
            const mx = maxlen === undefined ? "" : maxlen;
            len_inv = `invariant /.{${ml}, ${mx}}/.accepts($${name});`;
        }
        
        const minitems = getMinItems(this.emitter.getProgram(), property);
        const maxitems = getMaxItems(this.emitter.getProgram(), property);
        let items_inv = "";
        if(minitems !== undefined || maxitems !== undefined) {
            const mi = minitems === undefined ? undefined : `$${name}.size() >= ${minitems};`;
            const mx = maxitems === undefined ? undefined : `$${name}.size() <= ${maxitems};`;
            if(minitems !== undefined && maxitems !== undefined) {
                items_inv = `invariant /\(${mi}, ${mx});`;
            }
            else if(minitems !== undefined) {
                items_inv = `invariant ${mi};`;
            }
            else {
                items_inv = `invariant ${mx};`;
            }
        }
        
        const minvalue = getMinValue(this.emitter.getProgram(), property);
        const maxvalue = getMaxValue(this.emitter.getProgram(), property);
        let value_inv = "";
        if(minvalue !== undefined || maxvalue !== undefined) {
            const mi = minvalue === undefined ? undefined : `$${name} >= ${minvalue};`;
            const mx = maxvalue === undefined ? undefined : `$${name} <= ${maxvalue};`;
            if(minvalue !== undefined && maxvalue !== undefined) {
                value_inv = `invariant /\(${mi}, ${mx});`;
            }
            else if(minvalue !== undefined) {
                value_inv = `invariant ${mi};`;
            }
            else {
                value_inv = `invariant ${mx};`;
            }
        }

        const invs = [pattern_inv, kvs_inv, len_inv, items_inv, value_inv].filter((x) => x !== "").join(" ");

        const ctx = this.emitter.getContext();
        if(ctx.inLiteralModel) {
            return this.emitter.result.rawCode(code`${name}: ${this.emitter.emitTypeReference(property.type)}`);
        }
        else {
            return this.emitter.result.rawCode(code`field ${name}: ${this.emitter.emitTypeReference(property.type)}; ${invs}`);
        }
    }

    arrayDeclaration(array: Model, name: string, elementType: Type) {
        return this.emitter.result.declaration(
            name,
            code`type ${name} = List<${this.emitter.emitTypeReference(elementType)}>;`
        );
    }

    arrayLiteral(array: Model, elementType: Type) {
        return this.emitter.result.rawCode(code`List<${this.emitter.emitTypeReference(elementType)}>`);
    }

    enumDeclaration(en: Enum, name: string) {
        return this.emitter.result.declaration(
          name,
          code`enum ${name} {
            ${this.emitter.emitEnumMembers(en)}
          }`
        );
      }
    
      enumMember(member: EnumMember) {
        return `
          ${member.name}
        `;
      }
    
      unionDeclaration(union: Union, name: string) {
        return this.emitter.result.declaration(
          name,
          code`type ${name} = ${this.emitter.emitUnionVariants(union)};`
        );
      }
    
      unionInstantiation(union: Union, name: string) {
        return this.unionDeclaration(union, name);
      }
    
      unionLiteral(union: Union) {
        return this.emitter.emitUnionVariants(union);
      }
    
      unionVariants(union: Union) {
        const builder = new StringBuilder();
        let i = 0;
        for (const variant of union.variants.values()) {
          i++;
          builder.push(code`${this.emitter.emitType(variant)}${i < union.variants.size ? " | " : ""}`);
        }
        return this.emitter.result.rawCode(builder.reduce());
      }
    
      unionVariant(variant: UnionVariant) {
        return this.emitter.emitTypeReference(variant.type);
      }
    
      tupleLiteral(tuple: Tuple) {
        return code`[${this.emitter.emitTupleLiteralValues(tuple)}]`;
      }
}
