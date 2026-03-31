declare module "russian-nouns-js" {
  interface RussianNounsGender {
    MASCULINE: string;
    FEMININE: string;
    NEUTER: string;
  }
  interface RussianNounsCase {
    NOMINATIVE: string;
    GENITIVE: string;
    DATIVE: string;
    ACCUSATIVE: string;
    INSTRUMENTAL: string;
    PREPOSITIONAL: string;
  }
  interface RussianNounsEngine {
    decline(lemma: any, caseName: string): string[];
  }

  const RussianNouns: {
    Gender: RussianNounsGender;
    Case: RussianNounsCase;
    Engine: new () => RussianNounsEngine;
    createLemma: (opts: { text: string; gender: string }) => any;
  };
  export default RussianNouns;
}
