import type { Database } from "@bedrock/platform/persistence";

import { DrizzleCustomerReads } from "./customer.reads";

export interface CustomersQueries {
  listDisplayNamesById(ids: string[]): Promise<Map<string, string>>;
}

export class DrizzleCustomersQueries implements CustomersQueries {
  private readonly customerReads: DrizzleCustomerReads;

  constructor(db: Database) {
    this.customerReads = new DrizzleCustomerReads(db);
  }

  listDisplayNamesById(ids: string[]): Promise<Map<string, string>> {
    return this.customerReads.listDisplayNamesById(ids);
  }
}
