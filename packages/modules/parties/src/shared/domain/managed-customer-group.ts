export const MANAGED_CUSTOMER_GROUP_PREFIX = "customer:";
export const MANAGED_CUSTOMER_GROUP_DESCRIPTION = "Auto-created customer group";

export function buildManagedCustomerGroupCode(customerId: string): string {
  return `${MANAGED_CUSTOMER_GROUP_PREFIX}${customerId}`;
}

export function isManagedCustomerGroupCode(code: string): boolean {
  return code.startsWith(MANAGED_CUSTOMER_GROUP_PREFIX);
}
