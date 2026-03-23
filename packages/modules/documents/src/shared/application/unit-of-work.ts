export interface UnitOfWork<TTx> {
  run<TResult>(work: (tx: TTx) => Promise<TResult>): Promise<TResult>;
}
