export interface UnitOfWork<TTx> {
  run<T>(work: (tx: TTx) => Promise<T>): Promise<T>;
}
