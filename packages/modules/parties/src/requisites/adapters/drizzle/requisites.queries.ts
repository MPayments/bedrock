import type { Database } from "@bedrock/platform/persistence";

import { DrizzleRequisiteBindingReads } from "./requisite-binding.reads";
import { DrizzleRequisiteProviderReads } from "./requisite-provider.reads";
import { DrizzleRequisiteReads } from "./requisite.reads";

export interface RequisitesQueries {
  findById(id: string): Promise<Awaited<ReturnType<DrizzleRequisiteReads["findById"]>>>;
  findActiveById(
    id: string,
  ): Promise<Awaited<ReturnType<DrizzleRequisiteReads["findActiveById"]>>>;
  list(
    input: Parameters<DrizzleRequisiteReads["list"]>[0],
  ): ReturnType<DrizzleRequisiteReads["list"]>;
  listOptions(
    input: Parameters<DrizzleRequisiteReads["listOptions"]>[0],
  ): ReturnType<DrizzleRequisiteReads["listOptions"]>;
  listLabelsById(ids: string[]): Promise<Map<string, string>>;
  findSubjectById(
    requisiteId: string,
  ): ReturnType<DrizzleRequisiteReads["findSubjectById"]>;
  listSubjectsById(
    requisiteIds: string[],
  ): ReturnType<DrizzleRequisiteReads["listSubjectsById"]>;
  bindings: {
    findByRequisiteId(
      requisiteId: string,
    ): ReturnType<DrizzleRequisiteBindingReads["findByRequisiteId"]>;
    listByRequisiteId(
      requisiteIds: string[],
    ): ReturnType<DrizzleRequisiteBindingReads["listByRequisiteId"]>;
  };
  providers: {
    findById(
      id: string,
    ): ReturnType<DrizzleRequisiteProviderReads["findById"]>;
    findActiveById(
      id: string,
    ): ReturnType<DrizzleRequisiteProviderReads["findActiveById"]>;
    list(
      input: Parameters<DrizzleRequisiteProviderReads["list"]>[0],
    ): ReturnType<DrizzleRequisiteProviderReads["list"]>;
  };
}

export class DrizzleRequisitesQueries implements RequisitesQueries {
  readonly bindings: RequisitesQueries["bindings"];
  readonly providers: RequisitesQueries["providers"];

  private readonly requisiteReads: DrizzleRequisiteReads;

  constructor(db: Database) {
    this.requisiteReads = new DrizzleRequisiteReads(db);
    const bindingReads = new DrizzleRequisiteBindingReads(db);
    const providerReads = new DrizzleRequisiteProviderReads(db);

    this.bindings = {
      findByRequisiteId: bindingReads.findByRequisiteId.bind(bindingReads),
      listByRequisiteId: bindingReads.listByRequisiteId.bind(bindingReads),
    };
    this.providers = {
      findById: providerReads.findById.bind(providerReads),
      findActiveById: providerReads.findActiveById.bind(providerReads),
      list: providerReads.list.bind(providerReads),
    };
  }

  findById(id: string) {
    return this.requisiteReads.findById(id);
  }

  findActiveById(id: string) {
    return this.requisiteReads.findActiveById(id);
  }

  list(input: Parameters<DrizzleRequisiteReads["list"]>[0]) {
    return this.requisiteReads.list(input);
  }

  listOptions(input: Parameters<DrizzleRequisiteReads["listOptions"]>[0]) {
    return this.requisiteReads.listOptions(input);
  }

  listLabelsById(ids: string[]) {
    return this.requisiteReads.listLabelsById(ids);
  }

  findSubjectById(requisiteId: string) {
    return this.requisiteReads.findSubjectById(requisiteId);
  }

  listSubjectsById(requisiteIds: string[]) {
    return this.requisiteReads.listSubjectsById(requisiteIds);
  }
}
