export interface NotificationPort {
  notifyDealStatusChanged(
    dealId: number,
    status: string,
    agentId: number,
  ): Promise<void>;
  notifyNewCalculation(
    calculationId: number,
    agentId: number,
  ): Promise<void>;
  notifyApplicationCreated(applicationId: number): Promise<void>;
}
