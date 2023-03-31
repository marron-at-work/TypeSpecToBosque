
import { EmitContext, Model, Program, ModelProperty, Scalar, IntrinsicType, Type, getPattern, getKnownValues, getMinLength, getMaxLength, getMinItems, getMaxItems, getMinValue, getMaxValue, Enum, EnumMember, Union, UnionVariant, Tuple, Namespace, isTemplateDeclaration, ModelIndexer, DecoratedType } from "@typespec/compiler";

export async function $onEmit(context: EmitContext) {
    context.program.checker.getGlobalNamespaceType().namespaces.forEach((nn) => {
        if (nn.name !== "TypeSpec") {
            const ce = new MyCodeEmitter(context.program, nn);
            const nsv = ce.process();

            console.log(nsv);
        }
    });
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

const s_elemNonce = "@@exp@@";
const s_namespaceSep = "::";

class ProcessResult {
    readonly decl: string;
    readonly checks: string[];

    constructor(decl: string, checks: string[]) {
        this.decl = decl;
        this.checks = checks;
    }
}

class MyCodeEmitter {
    readonly m_program: Program;
    readonly m_namespace: Namespace;

    constructor(program: Program, namespace: Namespace) {
        this.m_program = program;
        this.m_namespace = namespace;
    }

    private getNamespacePrefix(ns: Namespace | undefined): string {
        if(ns === undefined) {
            return "";
        }
        else {
            if(this.m_namespace.name === ns.name) {
                return "";
            }
            else {
                return ns.name + s_namespaceSep;
            }
        }
    }

    private scopeResolveName(ns: Namespace | undefined, name: string): string {
        return this.getNamespacePrefix(ns) + name;
    }

    private spathResolveNameAccess(spath: string, name: string): string {
        return spath + "." + name;
    }

    private spathResolveTupleAccess(spath: string, idx: number): string {
        return spath + "." + idx.toString();
    }

    private spathResolveEveryAccess(spath: string, exp: string): string {
        return spath + ".allOf((ee) => " + exp + ")";
    }

    private resolveListOfT(type: Type, spath: string): ProcessResult {
        const tres = this.processTypeReference(type, "ee");
        const checks = tres.checks.length !== 0 ? [this.spathResolveEveryAccess(spath, tres.checks.join(" && "))] : [];
        return new ProcessResult("List<" + tres.decl + ">", checks);
    }

    private processDecorators(tt: Type, npath: string): string[] {
        let pchecks: string[] = [];

        const pattern = getPattern(this.m_program, tt);
        if(pattern) {
            pchecks.push(`/${pattern}/.accepts(${npath})`);
        }

        const kvs = tt.kind === "ModelProperty" ? getKnownValues(this.m_program, tt) : undefined;
        if(kvs) {
            pchecks.push(`[NOT IMPLEMENTED -- KNOWN VALUES]`);
        }

        const minlen = getMinLength(this.m_program, tt);
        const maxlen = getMaxLength(this.m_program, tt);
        if(minlen !== undefined || maxlen !== undefined) {
            const ml = minlen === undefined ? "" : minlen;
            const mx = maxlen === undefined ? "" : maxlen;
            pchecks.push(`/.{${ml}, ${mx}}/.accepts(${npath})`);
        }
        
        const minitems = getMinItems(this.m_program, tt);
        const maxitems = getMaxItems(this.m_program, tt);
        if(minitems !== undefined || maxitems !== undefined) {
            const mi = minitems === undefined ? undefined : `${npath}.size() >= ${minitems}`;
            const mx = maxitems === undefined ? undefined : `${npath}.size() <= ${maxitems}`;
            if(minitems !== undefined && maxitems !== undefined) {
                pchecks.push(`/\(${mi}, ${mx})`);
            }
            else if(minitems !== undefined) {
                pchecks.push(`${mi}`);
            }
            else {
                pchecks.push(`${mx}`);
            }
        }
        
        const minvalue = getMinValue(this.m_program, tt);
        const maxvalue = getMaxValue(this.m_program, tt);
        if(minvalue !== undefined || maxvalue !== undefined) {
            const mi = minvalue === undefined ? undefined : `${npath} >= ${minvalue}`;
            const mx = maxvalue === undefined ? undefined : `${npath} <= ${maxvalue}`;
            if(minvalue !== undefined && maxvalue !== undefined) {
               pchecks.push(`/\(${mi}, ${mx})`);
            }
            else if(minvalue !== undefined) {
                pchecks.push(`${mi}`);
            }
            else {
                pchecks.push(`${mx}`);
            }
        }

        return pchecks
    }

    private processPropertyLiteral(property: ModelProperty, spath: string, noextend: boolean): {pname: string, ptype: string, pchecks: string[]} {
        const name = property.name;
        const npath = noextend ? spath : this.spathResolveNameAccess(spath, property.name);
        const ptypeinfo = this.processTypeReference(property.type, npath);

        const pchecks = this.processDecorators(property, npath);

        return {pname: name, ptype: ptypeinfo.decl, pchecks: [...pchecks, ...ptypeinfo.checks]};
    }

    private resolveObjectLiteral(model: Model, spath: string): ProcessResult {
        const ffs: {pname: string, ptype: string, pchecks: string[]}[] = [];
        model.properties.forEach((ff) => {
            const nc = this.processPropertyLiteral(ff, spath, false);
            ffs.push(nc);
        });

        const decl = `{ ${ffs.map((ff) => `${ff.pname}: ${ff.ptype}`).join(", ")} }`;
        const checks = ffs.map((ff) => ff.pchecks).reduce((a, b) => a.concat(b), []);

        return new ProcessResult(decl, checks);
    }

    private resolveTupleLiteral(tuple: Tuple, spath: string): ProcessResult {
        const ffs: ProcessResult[] = [];
        tuple.values.forEach((ff, ii) => {
            const nc = this.processTypeReference(ff, this.spathResolveTupleAccess(spath, ii));
            ffs.push(nc);
        });

        const decl = `[${ffs.map((ff) => `${ff.decl}`).join(", ")}]`;
        const checks = ffs.map((ff) => ff.checks).reduce((a, b) => a.concat(b), []);

        return new ProcessResult(decl, checks);
    }

    private resolveUnionLiteral(union: Union, spath: string): ProcessResult {
        const ffs: ProcessResult[] = [];
        union.variants.forEach((vv) => {
            const nc = this.processTypeReference(vv.type, "[Constraints on Union Variants Not Supported]");
            ffs.push(nc);
        });

        const decl = `${ffs.map((ff) => `${ff.decl}`).join(" | ")}`;
        return new ProcessResult(decl, []);
    }

    private processTypeReference(type: Type, spath: string): ProcessResult {
        if(type.kind === "Model") {
            if(type.name === "Array") {
                return this.resolveListOfT((type.indexer as ModelIndexer).value, spath);
            }
            else if (type.name === "") {
                return this.resolveObjectLiteral(type, spath);
            }
            else {
                return new ProcessResult(this.scopeResolveName(type.namespace, type.name), []);
            }
        }
        else if(type.kind === "Scalar") {
            if(!intrinsicNameToBSQType.has(type.name)) {
                return new ProcessResult(this.scopeResolveName(type.namespace, type.name), []);
            }
            else {
                const ttype = intrinsicNameToBSQType.get(type.name) as string;
                return new ProcessResult(ttype, []);
            }
        }
        else if(type.kind === "Enum") {
            return new ProcessResult(this.scopeResolveName(type.namespace, type.name), []);
        }
        else if(type.kind === "Tuple") {
            return this.resolveTupleLiteral(type, spath);
        }
        else if(type.kind === "Union") {
            if(type.name !== undefined) {
                return new ProcessResult(this.scopeResolveName(type.namespace, type.name), []);
            }
            else {
                return this.resolveUnionLiteral(type, spath);
            }
        }
        else if(type.kind === "Intrinsic") {
            if(type.name === "null") {
                return new ProcessResult("None", []);
            }
            else {
                console.log("Unexpected Intrinsic type: " + type.kind);
                return new ProcessResult("[|Unexpected Intrinsic type: " + type.kind + "|]", []);    
            }
        }
        else {
            console.log("Unexpected type: " + type.kind);
            return new ProcessResult("[|Unexpected type: " + type.kind + "|]", []);
        }
    }

    process() {
        let decls: string[] = []; 

        this.m_namespace.models.forEach((mm) => {
            if(!isTemplateDeclaration(mm)) {
                const pr = this.processTopLevelModel(mm);
                decls.push(pr.decl);
            }
        });
        
        this.m_namespace.enums.forEach((ee) => {
            decls.push(`enum ${ee.name} = {\n    ${[...ee.members].map((vv) => vv[1].name).join(",\n    ")}\n}`);
        });

        this.m_namespace.scalars.forEach((ss) => {
            const ssdecl = intrinsicNameToBSQType.has(ss.name) ? intrinsicNameToBSQType.get(ss.name) as string : this.processTypeReference(ss.baseScalar as Scalar, "$value").decl;
            const sschecks = this.processDecorators(ss, "$value");

            let decl = `typedecl ${ss.name} = ${ssdecl}`;
            if(sschecks.length === 0) {
                decl += ";";
            }
            else {
                decl += " & {\n    invariant " + sschecks.join(" && ") + ";\n}";
            }

            decls.push(decl);
        });

        this.m_namespace.unions.forEach((uu) => {
            if (!isTemplateDeclaration(uu)) {
                if (uu.name === undefined) {
                    console.log("[Union Declaration]");
                }
                else {
                    const mentities: ProcessResult[] = [];
                    uu.variants.forEach((vv) => {
                        const mentity = this.processTopLevelVariantMember(vv);
                        mentities.push(mentity);                
                    });

                    const ebody = mentities.map((mm) => mm.decl).join("\n| ");
                    decls.push(`datatype ${uu.name} provides APIType \nof\n${ebody}\n;`);
                }
            }
        });

        return `namespace ${this.m_namespace.name};\n\n${decls.join("\n")}\n`;
    }

    private processTopLevelModel(model: Model): ProcessResult {
        const ffs: {pname: string, ptype: string, pchecks: string[]}[] = [];
        model.properties.forEach((ff) => {
            const nc = this.processPropertyLiteral(ff, "$" + ff.name, true);
            ffs.push(nc);
        });

        const checks = ffs.map((ff) => ff.pchecks).reduce((a, b) => a.concat(b), []).map((cc) => "    invariant " + cc + ";\n").join("");
        const decl = `entity ${model.name} provides APIType {\n${ffs.map((ff) => `    field ${ff.pname}: ${ff.ptype};`).join("\n")}\n${checks}}`;

        return new ProcessResult(decl, []);
    }

    private processTopLevelVariantMember(uv: UnionVariant): ProcessResult {
        if(uv.type.kind !== "Model" || uv.type.name !== "") {
            return new ProcessResult("[|Named Union Variants must be Literal Objects: " + uv.name.toString() + "|]", []);
        }

        const mm = uv.type as Model;
        const ffs: {pname: string, ptype: string, pchecks: string[]}[] = [];
        mm.properties.forEach((ff) => {
            const nc = this.processPropertyLiteral(ff, "$" + ff.name, true);
            ffs.push(nc);
        });

        const checks = ffs.map((ff) => ff.pchecks).reduce((a, b) => a.concat(b), []).map((cc) => "    invariant " + cc + ";\n").join("");
        const decl = `${uv.name as string} {\n${ffs.map((ff) => `    field ${ff.pname}: ${ff.ptype};`).join("\n")}\n${checks}}`;

        return new ProcessResult(decl, []);
    }
}
