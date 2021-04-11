const tokenKind = require('./lexer.js').tokenKind;
const exprKind = require('./parser.js').exprKind;
const gens = require('./analyzer.js').gens;

let output;
let mods;
let genNames;
let reqs;
let binds;

function generateType(type, raw) {
    const gen = genNames[type.path.join('_')];
    type = gen ? gen : type;

    if (type === undefined) {
        output += 'void';
        return;
    }

    let path = type.path[0];
    if (!raw) {
        if (path === 'i32') {
            output += 'int32_t';
            return;
        }
        else if (path === 'f32') {
            output += 'float';
            return;
        }
        else if (path === 'i8') {
            output += 'int8_t';
            return;
        }
        else if (path === 'f64') {
            output += 'double';
            return;
        }
        else if (path === 'u32') {
            output += 'uint32_t';
            return;
        }
        else if (path === 'i64') {
            output += 'int64_t';
            return;
        }
        else if (path === 'i16') {
            output += 'int16_t';
            return;
        }
        else if (path === 'u8') {
            output += 'uint8_t';
            return;
        }
        else if (path === 'u64') {
            output += 'uint64_t';
            return;
        }
        else if (path === 'u16') {
            output += 'uint16_t';
            return;
        }
    }
    output += type.path.join('_');
    for (let i = 0; i < type.gens.length; ++i) {
        output += '_';
        generateType(type.gens[i], true);
    }
}

function generateGeneric(expr, gen, how) {
    if (expr.gen.length) {
        gen = gen || [];
        for (let i = 0; i < gen.length; ++i) {
            let oldGens = Object.assign({}, genNames);
            for (let ii = 0; ii < expr.gen.length; ++ii) {
                genNames[expr.gen[ii].name] = gen[i][ii];
            }
            how(gen[i]);
            genNames = oldGens;
        }
    } else {
        how();
    }
}

function generateGenericNamePart(type) {
    let name = type.path.join('_');
    for (let i = 0; i < type.gens.length; ++i) {
        name += '_';
        name += generateGenericNamePart(type.gens[i]);
    }
    return name;
}

function generateGenericName(gens) {
    if (!gens) {
        return '';
    }
    let name = '';
    for (let i = 0; i < gens.length; ++i) {
        name += '_';
        name += generateGenericNamePart(gens[i]);
    }
    return name;
}

function generateExpr(expr, last, semicolon, parenths) {
    if (expr.tags) {
        for (let i = 0; i < expr.tags.length; ++i) {
            const tag = expr.tags[i];
            switch (tag.name) {
                case 'req':
                    if (!reqs.includes(tag.args[0].value)) {
                        reqs.push(tag.args[0].value);
                    }
                    break;
                case 'bind':
                    binds[mods.concat(expr.name).join('_')] = tag.args[0].value;
                    break;
            }
        }
    }

    switch (expr.kind) {
        case exprKind.USE:
            break;
        case exprKind.MOD:
            mods.push(expr.name);
            generateBlock(expr.body, 0, 0);
            mods.pop();
            break;
        case exprKind.COMP: {
            let name = mods.concat(expr.name).join('_');
            generateGeneric(expr, gens[name], (gen) => {
                output += 'typedef struct {';
                generateBlock(expr.body, 1, 0);
                output += `} ${name + generateGenericName(gen)};`;
            });
            break;
        }
        case exprKind.ENUM: {
            let name = mods.concat(expr.name).join('_');
            generateGeneric(expr, gens[name], (gen) => {
                let gname = name + generateGenericName(gen);
                generateBlock(expr.body, 1, 0);
                output += `union ${gname} {`;
                for (let i = 0; i < expr.body.length; ++i) {
                    output += `struct ${gname + '_' + expr.body[i].name} u${i};`;
                }
                output += `};\n`;
                output += 'typedef struct {\n';
                output += '    int type;\n';
                output += `    union ${gname} u;\n`;
                output += `} ${gname};`;
            });
            break;
        }
        case exprKind.OPTION:
            output += `struct ${expr.name} {`;
            generateBlock(expr.body, 1, 0);
            output += '}';
            break;
        case exprKind.OPTION_FIELD:
            generateType(expr.type);
            output += ` ${expr.name};`;
            break;
        case exprKind.PROP:
            break;
        case exprKind.DEF:
            break;
        case exprKind.SUB_DEF: {
            let name = mods.concat(expr.name).join('_');
            if (binds[name]) { break; }
            generateGeneric(expr, gens[name], (gen) => {
                generateType(expr.retTypes[0]);
                output += ` ${name + generateGenericName(gen)}(`;
                generateBlock(expr.args, 0, 0);
                output += ') {';
                generateBlock(expr.body, 1, 0);
                output += '};';
            });
            break;
        }
        case exprKind.FIELD:
        case exprKind.ARG:
            generateType(expr.type);
            output += ` ${expr.name}`;
            if (semicolon) {
                output += ';';
            }
            else if (!last) {
                output += ',';
            }
            break;
        case exprKind.VAR_DEF:
        case exprKind.LOCAL_VAR_DEF:
            generateType(expr.type);
            output += ` ${mods.concat(expr.name).join('_')}`;
            if (expr.value) {
                output += '=';
                generateExpr(expr.value, 0, 0, 0);
            }
            output += ';';
            break;
        case exprKind.SUB_CALL:
            let path = expr.path.join('_');
            let bind = binds[path];
            output += `${bind ? bind : path}(`;
            generateBlock(expr.args, 0, 1);
            output += ')';
            if (semicolon) {
                output += ';';
            }
            break;
        case exprKind.VAR_USE:
            output += expr.path.join('_');
            if (semicolon) {
                output += ';';
            }
            break;
        case exprKind.STRING_LIT:
            output += `"${expr.value}"`;
            break;
        case exprKind.ARRAY_LIT:
            break;
        case exprKind.INT_LIT:
        case exprKind.FLOAT_LIT:
            output += expr.value;
            break;
        case exprKind.BOOL_LIT:
            output += expr.value ? '1' : '0';
            break;
        case exprKind.CHAR_LIT:
            output += `'${expr.value}'`;
            break;
        case exprKind.NULL_LIT:
            output += 'NULL';
            break;
        case exprKind.SELF_LIT:
            break;
        case exprKind.BLOCK:
            output += '{';
            generateBlock(expr.body, 1, 0);
            output += '}';
            break;
        case exprKind.LOOP:
            output += 'for(;;) {';
            generateBlock(expr.body, 1, 0);
            output += '}';
            break;
        case exprKind.WHILE:
            output += 'while(';
            generateExpr(expr.cond, 0, 0, 0);
            output += ') {';
            generateBlock(expr.body, 1, 0);
            output += '}';
            break;
        case exprKind.IF:
            output += 'if (';
            generateExpr(expr.if.cond, 0, 0, 0);
            output += ') {';
            generateBlock(expr.if.body, 1, 0);
            output += '}';
            for (let i = 0; i < expr.elif.length; ++i) {
                output += ' else if (';
                generateExpr(expr.elif[i].cond, 0, 0, 0);
                output += ') {';
                generateBlock(expr.elif[i].body, 1, 0);
                output += '}';
            }
            if (expr.else) {
                output += ' else {';
                generateBlock(expr.else, 1, 0);
                output += '}';
            }
            break;
        case exprKind.FOR:
            output += `for(int ${expr.loop_var}=0;`;
            generateExpr(expr.cond, 0, 0, 0);
            output += ';';
            generateExpr(expr.next, 0, 0, 0);
            output += ') {';
            generateBlock(expr.body, 1, 0);
            output += '}';
            break;
        case exprKind.EACH:
            break;
        case exprKind.MATCH:
            break;
        case exprKind.NEXT:
            output += `continue ${expr.target};`;
            break;
        case exprKind.JUMP:
            output += `goto ${expr.target};`;
            break;
        case exprKind.RET:
            if (expr.label) {
                output += `break ${expr.label}`;
            } else {
                output += 'return';
            }
            if (expr.value) {
                output += ' ';
                generateExpr(expr.value, 0, 0, 0);
            }
            output += ';';
            break;
        case exprKind.TRY:
            break;
        case exprKind.UNARY_OP:
            switch (expr.type) {
                case tokenKind.NOT:
                    output += '!';
                    break;
                case tokenKind.DEREF:
                    output += '*';
                    break;
                case tokenKind.ADDRESS:
                    output += '&';
                    break;
            }
            generateExpr(expr.value, 0, 0, parenths + 1);
            break;
        case exprKind.BINARY_OP:
            if (parenths) {
                output += '(';
            }
            generateExpr(expr.lhs, 0, 0, parenths + 1);
            switch (expr.type) {
                case tokenKind.ASSIGN:
                    output += '=';
                    break;
                case tokenKind.EQUAL:
                    output += '==';
                    break;
                case tokenKind.AND:
                    output += '&&';
                    break;
                case tokenKind.OR:
                    output += '||';
                    break;
                case tokenKind.LESS:
                    output += '<';
                    break;
                case tokenKind.LESS_EQUAL:
                    output += '<=';
                    break;
                case tokenKind.GREATER:
                    output += '>';
                    break;
                case tokenKind.GREATER_EQUAL:
                    output += '>=';
                    break;
                case tokenKind.ADD:
                    output += '+';
                    break;
                case tokenKind.ADD_ASSIGN:
                    output += '+=';
                    break;
                case tokenKind.SUBTRACT:
                    output += '-';
                    break;
                case tokenKind.SUBTRACT_ASSIGN:
                    output += '-=';
                    break;
                case tokenKind.MULTIPLY:
                    output += '*';
                    break;
                case tokenKind.MULTIPLY_ASSIGN:
                    output += '*=';
                    break;
                case tokenKind.DIVIDE:
                    output += '/';
                    break;
                case tokenKind.DIVIDE_ASSIGN:
                    output += '/=';
                    break;
                case tokenKind.MODULO:
                    output += '%';
                    break;
                case tokenKind.MODULO_ASSIGN:
                    output += '%=';
                    break;
                case tokenKind.NOT_EQUAL:
                    output += '!=';
                    break;
            }
            generateExpr(expr.rhs, 0, 0, parenths + 1);
            if (parenths) {
                output += ')';
            }
            if (semicolon) {
                output += ';';
            }
            break;
    }
}

function generateBlock(exprs, semicolon, comma) {
    for (let i = 0; i < exprs.length; ++i) {
        let is_last = i + 1 === exprs.length;
        generateExpr(exprs[i], is_last, semicolon, 0);
        if (comma && !is_last) {
            output += ',';
        }
    }
}

module.exports.generate = function (ast) {
    output = '';
    mods = [];
    genNames = {};
    reqs = [];
    binds = {};
    generateBlock(ast, 0, 0);
    for (let i = 0; i < reqs.length; ++i) {
        reqs[i] = `#include <${reqs[i]}>\n`;
    }
    output = reqs.join('') + output;
    return output;
};