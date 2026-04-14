#!/usr/bin/env bash
set -euo pipefail

session="${PLAYWRIGHT_CLI_SESSION:-deal-payment}"
crm_url="${CRM_BASE_URL:-http://localhost:3002}"
timestamp="${DEAL_PAYMENT_TIMESTAMP:-$(date -u +"%Y%m%dT%H%M%SZ")}"
artifact_dir="${DEAL_PAYMENT_ARTIFACT_DIR:-artifacts/deal-payment/${timestamp}}"

mkdir -p "${artifact_dir}"

echo "Payment deal exploratory session"
echo "session=${session}"
echo "crm_url=${crm_url}"
echo "artifacts=${artifact_dir}"

bun x playwright-cli -s="${session}" open "${crm_url%/}/login" --headed --persistent
bun x playwright-cli -s="${session}" tracing-start
bun x playwright-cli -s="${session}" snapshot --filename="${artifact_dir}/00-login.yaml"
bun x playwright-cli -s="${session}" screenshot --filename="${artifact_dir}/00-login.png"

cat <<EOF
Ready for interactive Playwright CLI control.

Suggested next commands:
  PLAYWRIGHT_CLI_SESSION=${session} bun x playwright-cli snapshot --filename=${artifact_dir}/01-step.yaml
  PLAYWRIGHT_CLI_SESSION=${session} bun x playwright-cli screenshot --filename=${artifact_dir}/01-step.png
  PLAYWRIGHT_CLI_SESSION=${session} bun x playwright-cli console warning > ${artifact_dir}/01-console.txt
  PLAYWRIGHT_CLI_SESSION=${session} bun x playwright-cli network > ${artifact_dir}/01-network.txt
  PLAYWRIGHT_CLI_SESSION=${session} bun x playwright-cli show
EOF
