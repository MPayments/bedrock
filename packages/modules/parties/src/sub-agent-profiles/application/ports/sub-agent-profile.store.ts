export interface StoredSubAgentProfile {
  counterpartyId: string;
  commissionRate: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateStoredSubAgentProfileInput {
  counterpartyId: string;
  commissionRate: number;
  isActive: boolean;
}

export interface UpdateStoredSubAgentProfileInput {
  counterpartyId: string;
  commissionRate?: number;
  isActive?: boolean;
}

export interface SubAgentProfileStore {
  findById(counterpartyId: string): Promise<StoredSubAgentProfile | null>;
  create(
    input: CreateStoredSubAgentProfileInput,
  ): Promise<StoredSubAgentProfile>;
  update(
    input: UpdateStoredSubAgentProfileInput,
  ): Promise<StoredSubAgentProfile | null>;
}
