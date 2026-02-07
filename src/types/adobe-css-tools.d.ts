declare module "@adobe/css-tools" {
  export interface CssDeclaration {
    type: "declaration" | "comment";
    property?: string;
    value?: string;
  }

  export interface CssRule {
    type: string;
    import?: string;
    declarations?: CssDeclaration[];
    rules?: CssRule[];
  }

  export interface CssStylesheetAst {
    stylesheet: {
      rules: CssRule[];
    };
  }

  export interface ParseOptions {
    silent?: boolean;
    source?: string;
  }

  export function parse(css: string, options?: ParseOptions): CssStylesheetAst;
}
