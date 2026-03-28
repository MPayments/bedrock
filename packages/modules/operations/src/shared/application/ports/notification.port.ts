export interface NotificationPort {
  notifyDealStatusChanged(
    dealId: number,
    status: string,
    agentId: string,
  ): Promise<void>;
  notifyNewCalculation(
    calculationId: number,
    agentId: string,
  ): Promise<void>;
  notifyApplicationCreated(applicationId: number): Promise<void>;
}
