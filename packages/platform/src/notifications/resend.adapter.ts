import { Resend } from "resend";

import type { Logger } from "../observability/logger";

export interface ResendNotificationConfig {
  apiKey: string;
  fromEmail: string;
  dashboardUrl?: string;
  resolveAgentEmail?: (agentId: number) => Promise<string | null>;
}

export class ResendNotificationAdapter {
  private readonly resend: Resend;
  private readonly logger: Logger;

  constructor(
    private readonly config: ResendNotificationConfig,
    logger: Logger,
  ) {
    this.resend = new Resend(config.apiKey);
    this.logger = logger.child({ adapter: "resend-notification" });
  }

  async notifyDealStatusChanged(
    dealId: number,
    status: string,
    agentId: number,
  ): Promise<void> {
    const email = await this.resolveEmail(agentId);
    if (!email) return;

    const dealUrl = this.buildUrl(`/deals/${dealId}`);

    try {
      await this.resend.emails.send({
        from: this.config.fromEmail,
        to: email,
        subject: `Deal #${dealId} status changed to ${status}`,
        text: [
          `Deal #${dealId} has been updated.`,
          ``,
          `New status: ${status}`,
          ...(dealUrl ? [`View deal: ${dealUrl}`] : []),
        ].join("\n"),
      });

      this.logger.info("Deal status change notification sent", {
        dealId,
        status,
        agentId,
        email,
      });
    } catch (error) {
      this.logger.error("Failed to send deal status change notification", {
        dealId,
        status,
        agentId,
        error,
      });
    }
  }

  async notifyNewCalculation(
    calculationId: number,
    agentId: number,
  ): Promise<void> {
    const email = await this.resolveEmail(agentId);
    if (!email) return;

    const calculationUrl = this.buildUrl(`/calculations/${calculationId}`);

    try {
      await this.resend.emails.send({
        from: this.config.fromEmail,
        to: email,
        subject: `New calculation #${calculationId} created`,
        text: [
          `A new calculation #${calculationId} has been created and requires your attention.`,
          ...(calculationUrl ? [`View calculation: ${calculationUrl}`] : []),
        ].join("\n"),
      });

      this.logger.info("New calculation notification sent", {
        calculationId,
        agentId,
        email,
      });
    } catch (error) {
      this.logger.error("Failed to send new calculation notification", {
        calculationId,
        agentId,
        error,
      });
    }
  }

  async notifyApplicationCreated(applicationId: number): Promise<void> {
    const applicationUrl = this.buildUrl(`/applications/${applicationId}`);

    try {
      await this.resend.emails.send({
        from: this.config.fromEmail,
        to: this.config.fromEmail,
        subject: `New application #${applicationId} submitted`,
        text: [
          `A new application #${applicationId} has been submitted.`,
          ...(applicationUrl ? [`View application: ${applicationUrl}`] : []),
        ].join("\n"),
      });

      this.logger.info("Application created notification sent", {
        applicationId,
      });
    } catch (error) {
      this.logger.error("Failed to send application created notification", {
        applicationId,
        error,
      });
    }
  }

  private async resolveEmail(agentId: number): Promise<string | null> {
    if (!this.config.resolveAgentEmail) {
      this.logger.debug(
        "No email resolver configured, skipping notification",
        { agentId },
      );
      return null;
    }

    const email = await this.config.resolveAgentEmail(agentId);
    if (!email) {
      this.logger.debug("Could not resolve email for agent, skipping", {
        agentId,
      });
    }
    return email;
  }

  private buildUrl(path: string): string | null {
    if (!this.config.dashboardUrl) return null;
    return `${this.config.dashboardUrl}${path}`;
  }
}
