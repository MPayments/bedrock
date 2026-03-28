declare module "russian-nouns-js" {
  const Gender: {
    MASCULINE: string;
    FEMININE: string;
    NEUTER: string;
  };
  const Case: {
    NOMINATIVE: string;
    GENITIVE: string;
    DATIVE: string;
    ACCUSATIVE: string;
    INSTRUMENTAL: string;
    PREPOSITIONAL: string;
  };
  class Engine {
    decline(lemma: any, caseName: string): string[];
  }
  function createLemma(opts: { text: string; gender: string }): any;

  const RussianNouns: {
    Gender: typeof Gender;
    Case: typeof Case;
    Engine: typeof Engine;
    createLemma: typeof createLemma;
  };
  export default RussianNouns;
}
