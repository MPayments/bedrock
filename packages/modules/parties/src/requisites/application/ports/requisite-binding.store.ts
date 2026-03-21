export interface RequisiteBindingRecord {
  requisiteId: string;
  bookId: string;
  bookAccountInstanceId: string;
  postingAccountNo: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface RequisiteBindingStore {
  upsert(input: {
    requisiteId: string;
    bookId: string;
    bookAccountInstanceId: string;
    postingAccountNo: string;
  }): Promise<RequisiteBindingRecord | null>;
}
