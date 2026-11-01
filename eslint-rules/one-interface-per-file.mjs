// Every interface lives in its own file, named after it:
// `interface TradePositions` goes in `trade-positions.interface.ts`, and that
// file declares nothing but the interface (imports are allowed).

/** `TradePositions` → `trade-positions`, `HTTPClient` → `http-client`. */
function toKebabCase(name) {
  return name
    .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
    .replace(/([A-Z])([A-Z][a-z])/g, '$1-$2')
    .toLowerCase();
}

/** The interface a top-level statement declares, or `null`. */
function declaredInterface(statement) {
  if (statement.type === 'TSInterfaceDeclaration') return statement;
  if (
    (statement.type === 'ExportNamedDeclaration' ||
      statement.type === 'ExportDefaultDeclaration') &&
    statement.declaration?.type === 'TSInterfaceDeclaration'
  ) {
    return statement.declaration;
  }
  return null;
}

/** @type {import('eslint').Rule.RuleModule} */
export const oneInterfacePerFile = {
  meta: {
    type: 'suggestion',
    docs: {
      description:
        'Require every interface to be in its own `<kebab-name>.interface.ts` file that declares nothing else',
    },
    schema: [],
    messages: {
      oneInterface:
        "Move interface '{{name}}' to its own file, {{expected}}: a file declares at most one interface.",
      onlyTheInterface:
        "This file declares interface '{{name}}', so it can only hold that interface and imports. Move this code to another file.",
      fileName: "Interface '{{name}}' must be in a file named {{expected}}.",
    },
  },
  create(context) {
    return {
      Program(program) {
        const interfaces = [];
        const others = [];
        for (const statement of program.body) {
          const declaration = declaredInterface(statement);
          if (declaration) interfaces.push(declaration);
          else if (statement.type !== 'ImportDeclaration')
            others.push(statement);
        }
        if (interfaces.length === 0) return;

        const [first, ...extra] = interfaces;
        const name = first.id.name;
        const expected = `${toKebabCase(name)}.interface.ts`;
        const fileName = context.filename.split(/[\\/]/).pop();

        if (fileName !== expected) {
          context.report({
            node: first.id,
            messageId: 'fileName',
            data: { name, expected },
          });
        }
        for (const declaration of extra) {
          context.report({
            node: declaration.id,
            messageId: 'oneInterface',
            data: {
              name: declaration.id.name,
              expected: `${toKebabCase(declaration.id.name)}.interface.ts`,
            },
          });
        }
        for (const statement of others) {
          context.report({
            node: statement,
            messageId: 'onlyTheInterface',
            data: { name },
          });
        }
      },
    };
  },
};

export default {
  meta: { name: 'local' },
  rules: { 'one-interface-per-file': oneInterfacePerFile },
};
