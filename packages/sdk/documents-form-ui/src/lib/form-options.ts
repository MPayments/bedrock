export type DocumentFormCounterpartyOption = {
  id: string;
  label: string;
};

export type DocumentFormCurrencyOption = {
  id: string;
  code: string;
  label: string;
};

export type DocumentFormDocumentOption = {
  id: string;
  docType: string;
  label: string;
};

export type DocumentFormOptions = {
  counterparties: DocumentFormCounterpartyOption[];
  customers: DocumentFormCounterpartyOption[];
  organizations: DocumentFormCounterpartyOption[];
  currencies: DocumentFormCurrencyOption[];
  documents?: DocumentFormDocumentOption[];
};

export function createEmptyDocumentFormOptions(): DocumentFormOptions {
  return {
    counterparties: [],
    customers: [],
    documents: [],
    organizations: [],
    currencies: [],
  };
}
