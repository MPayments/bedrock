export type ValueBinding =
  | {
      kind: "literal";
      value: string;
    }
  | {
      kind: "dimension";
      key: string;
    }
  | {
      kind: "ref";
      key: string;
    }
  | {
      kind: "bookRef";
      key: string;
    };

export interface AccountSideTemplateDefinition {
  accountNo: string;
  dimensions: Record<string, ValueBinding>;
}

export interface CreatePostingTemplateDefinition {
  key: string;
  lineType: "create";
  postingCode: string;
  transferCode?: number;
  allowSources: string[];
  requiredBookRefs: string[];
  requiredDimensions: string[];
  requiredRefs?: string[];
  pendingMode?: "allowed" | "required" | "forbidden";
  debit: AccountSideTemplateDefinition;
  credit: AccountSideTemplateDefinition;
}

export interface PendingPostingTemplateDefinition {
  key: string;
  lineType: "post_pending" | "void_pending";
  allowSources: string[];
  requiredBookRefs: string[];
  requiredDimensions: string[];
  requiredRefs?: string[];
}

export type RawPostingTemplateDefinition =
  | CreatePostingTemplateDefinition
  | PendingPostingTemplateDefinition;

export interface AccountingPackDefinition {
  packKey: string;
  version: number;
  templates: RawPostingTemplateDefinition[];
}
