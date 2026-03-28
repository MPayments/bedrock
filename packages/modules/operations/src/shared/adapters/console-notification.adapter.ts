import type { Logger } from "@bedrock/platform/observability/logger";

import type { NotificationPort } from "../application/ports/notification.port";

export class ConsoleNotificationAdapter implements NotificationPort {
  constructor(private readonly logger: Logger) {}

  async notifyDealStatusChanged(
    dealId: number,
    status: string,
    agentId: string,
  ): Promise<void> {
    this.logger.info("[notification:noop] Deal status changed", {
      dealId,
      status,
      agentId,
    });
  }

  async notifyNewCalculation(
    calculationId: number,
    agentId: string,
  ): Promise<void> {
    this.logger.info("[notification:noop] New calculation", {
      calculationId,
      agentId,
    });
  }

  async notifyApplicationCreated(applicationId: number): Promise<void> {
    this.logger.info("[notification:noop] Application created", {
      applicationId,
    });
  }
}
