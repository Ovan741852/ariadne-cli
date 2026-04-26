import { Node, SyntaxKind, type SourceFile } from 'ts-morph';
import type { Node as MorphNode } from 'ts-morph';

/**
 * `type` in front matter. Covers **local** declarations in this file (no pure re-export rows).
 */
export type RegistryExportTypeTag =
  | 'Function'
  | 'Class'
  | 'Variable'
  | 'TypeAlias'
  | 'Interface'
  | 'Enum'
  | 'Namespace'
  | 'DefaultExport'
  | 'Expression';

export type RegistryExportItem = {
  name: string;
  type: RegistryExportTypeTag;
  /** Sort key: earliest declaration in file */
  orderPos: number;
  codeSignature: string;
  /** In-file AST nodes for this export (JSDoc + fingerprint). */
  localNodes: MorphNode[];
};

const MAX_TYPE_SNIPPET = 500;
const MAX_VAR_SNIPPET = 600;

function fileOf(n: MorphNode) {
  return n.getSourceFile();
}

function sliceBeforeBody(
  decl: MorphNode,
  bodyStart: number,
  fileText: string
): string {
  return fileText
    .slice(decl.getStart(), bodyStart)
    .replace(/\s+$/, '')
    .trimEnd();
}

/**
 * **Local** exports only (`getExportedDeclarations` with declarations in this file).
 * Pure `export { x } from '…'`, `export * as ns from '…'`, and `export * from '…'` are not registered here.
 */
export function listRegistryExportItems(sourceFile: SourceFile): RegistryExportItem[] {
  const fileText = sourceFile.getFullText();
  const items: RegistryExportItem[] = [];

  for (const [name, decls] of sourceFile.getExportedDeclarations()) {
    if (name.startsWith('__') && name !== '__proto__') continue; // very rare

    const local = decls.filter(
      (d) => fileOf(d) === sourceFile && !Node.isSourceFile(d)
    );
    if (local.length === 0) continue;

    const orderPos = Math.min(...local.map((d) => d.getStart()));
    const sigs = local
      .map((d) => getHeadSignatureForExport(d, fileText))
      .filter((s) => s.length > 0);
    const code = sigs.join('\n\n');
    if (!code) continue;

    const type = selectTypeTag(name, local);
    items.push({
      name,
      type,
      orderPos,
      codeSignature: code,
      localNodes: local,
    });
  }

  items.sort((a, b) => a.orderPos - b.orderPos || a.name.localeCompare(b.name));
  return items;
}

function selectTypeTag(
  exportName: string,
  local: MorphNode[]
): RegistryExportTypeTag {
  const s = (p: (n: MorphNode) => boolean) => local.some(p);
  if (s((n) => Node.isFunctionDeclaration(n) || Node.isFunctionExpression(n)))
    return 'Function';
  if (s((n) => Node.isClassDeclaration(n) || Node.isClassExpression(n)))
    return 'Class';
  if (s((n) => Node.isVariableDeclaration(n))) return 'Variable';
  if (s((n) => Node.isTypeAliasDeclaration(n))) return 'TypeAlias';
  if (s((n) => Node.isInterfaceDeclaration(n))) return 'Interface';
  if (s((n) => Node.isEnumDeclaration(n))) return 'Enum';
  if (s((n) => Node.isModuleDeclaration(n))) return 'Namespace';
  if (exportName === 'default') return 'DefaultExport';
  return 'Expression';
}

/**
 * "Contract" head: signature or declaration only, not full method bodies / enum members / long value initializers.
 */
function getHeadSignatureForExport(
  n: MorphNode,
  fileText: string
): string {
  if (Node.isFunctionDeclaration(n)) {
    const b = n.getBody();
    if (b) return sliceBeforeBody(n, b.getStart(), fileText);
    return n.getText().trim();
  }
  if (Node.isFunctionExpression(n)) {
    const b = n.getBody();
    if (b) return sliceBeforeBody(n, b.getStart(), fileText);
    return n.getText().trim();
  }
  if (Node.isClassDeclaration(n) || Node.isClassExpression(n)) {
    const open = n.getFirstChildByKind(SyntaxKind.OpenBraceToken);
    if (open) return sliceBeforeBody(n, open.getStart(), fileText);
    return n.getText().trim();
  }

  if (Node.isInterfaceDeclaration(n) || Node.isEnumDeclaration(n)) {
    const open = n.getFirstChildByKind(SyntaxKind.OpenBraceToken);
    if (open) return sliceBeforeBody(n, open.getStart(), fileText);
    return n.getText().trim();
  }

  if (Node.isTypeAliasDeclaration(n)) {
    const t = n.getTypeNode();
    if (t) {
      const pre = fileText.slice(n.getStart(), t.getStart());
      const raw = t.getText();
      const tshort =
        raw.length > MAX_TYPE_SNIPPET
          ? raw.slice(0, MAX_TYPE_SNIPPET) + '\n// …'
          : raw;
      return (pre + tshort).trim();
    }
    return n.getText().trim();
  }

  if (Node.isModuleDeclaration(n)) {
    const b = n.getBody();
    if (b) return sliceBeforeBody(n, b.getStart(), fileText);
    return n.getText().trim();
  }

  if (Node.isVariableDeclaration(n)) {
    const init = n.getInitializer();
    if (init) {
      if (Node.isArrowFunction(init) || Node.isFunctionExpression(init)) {
        const fb = init.getBody();
        if (fb) {
          return sliceBeforeBody(
            init as import('ts-morph').Node,
            fb.getStart(),
            fileText
          );
        }
      }
    }
    const vstmt = n.getFirstAncestorByKind(
      SyntaxKind.VariableStatement
    ) as import('ts-morph').VariableStatement | undefined;
    if (vstmt) {
      const dlist = vstmt.getDeclarationList().getDeclarations();
      if (dlist.length === 1) {
        return truncate(
          vstmt.getText().trim(),
          MAX_VAR_SNIPPET
        );
      }
    }
    return truncate(n.getText().trim(), MAX_VAR_SNIPPET);
  }

  if (Node.isExpression(n) || n.getKind() === SyntaxKind.Identifier) {
    return truncate(
      n.getText().trim(),
      MAX_VAR_SNIPPET
    );
  }

  return truncate(
    n.getText().trim(),
    MAX_VAR_SNIPPET
  );
}

function truncate(s: string, max: number): string {
  if (s.length <= max) return s;
  return s.slice(0, max) + '\n// …';
}

export function pickJSDocDescription(nodes: MorphNode[]): string {
  for (const n of nodes) {
    if (!Node.isJSDocable(n)) continue;
    const t = n.getJsDocs()[0]?.getDescription().trim();
    if (t) return t;
  }
  return '';
}

/** Same file segment as `ariadne update` uses for `fileKey_name.md`. */
export function safeRegistryFileName(name: string): string {
  return name.replace(/[<>:"/\\|?*]/g, '_') || 'export';
}

export function contractHints(
  t: RegistryExportTypeTag,
  name: string
): { importHint: string; inputHint: string; outputHint: string } {
  if (t === 'Class') {
    return {
      importHint: `e.g. \`import { ${name} } from '...'\`, or \`new ${name}(...)\`; static vs instance if relevant.`,
      inputHint:
        'constructor, fields, invariants, or *static* call patterns.',
      outputHint:
        'instances, inheritance contract, or the surface API of this class.',
    };
  }
  if (t === 'Function' || t === 'DefaultExport') {
    if (name === 'default') {
      return {
        importHint: `e.g. \`import D from '...'\` (rename \`D\` as you like).`,
        inputHint:
          'args / props / invariants, numeric ranges, unions, "must be" rules.',
        outputHint:
          'return value, side effects, or what downstream code may assume.',
      };
    }
    return {
      importHint: `e.g. \`import { ${name} } from '...'\` (or the intended call pattern).`,
      inputHint: 'props/args, numeric ranges, unions, "must be" rules.',
      outputHint:
        'return type, rendered result, or side-effect summary.',
    };
  }
  if (t === 'Variable' || t === 'Expression') {
    return {
      importHint: `e.g. \`import { ${name} } from '...'\` (or \`import * as ns\` if this is a const object/namespace).`,
      inputHint:
        'shape of the value, allowed mutations, invariants, or *const* depth.',
      outputHint:
        'how consumers use it (read-only, callable, key set, etc.).',
    };
  }
  if (t === 'TypeAlias' || t === 'Interface') {
    return {
      importHint: `e.g. \`import type { ${name} } from '...'\`.`,
      inputHint: 'type params, field constraints, discriminated unions, invariants.',
      outputHint: 'what implementing / assigning values must satisfy.',
    };
  }
  if (t === 'Enum') {
    return {
      importHint: `e.g. \`import { ${name} } from '...'\` (const enum vs object enum matters for emit).`,
      inputHint: 'set of members, numeric vs string, usage as flags vs exhaustiveness.',
      outputHint: 'how the enum value is passed or displayed.',
    };
  }
  if (t === 'Namespace') {
    return {
      importHint: `e.g. \`import { ${name} } from '...'\` or \`import * as ${name}\` per project style.`,
      inputHint: 'sub-symbols, nesting, when to use vs regular modules.',
      outputHint: 'what the namespace groups and how to extend it.',
    };
  }
  return {
    importHint: `e.g. \`import { ${name} } from '...'\`.`,
    inputHint: 'n/a',
    outputHint: 'n/a',
  };
}
