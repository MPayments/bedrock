declare module "russian-nouns-js" {
  export const Gender: {
    MASCULINE: string;
    FEMININE: string;
    NEUTER: string;
  };
  export const Case: {
    NOMINATIVE: string;
    GENITIVE: string;
    DATIVE: string;
    ACCUSATIVE: string;
    INSTRUMENTAL: string;
    PREPOSITIONAL: string;
  };
  export class Engine {
    decline(lemma: any, caseName: string): string[];
  }
  export function createLemma(opts: { text: string; gender: string }): any;
}
