# Deal-Scoped Formal Document Creation From Finance Workbench

## Summary
- Remove the current dead end in `/treasury/deals`: when a deal is blocked by a missing formal document, Finance must be able to create or open the requirement-linked document directly from the Documents tab.
- Reuse the existing typed document create page and the existing deal-scoped backend route. Do not add a new DB schema or a parallel API flow.
- Scope UI changes to Finance. Shared projection semantics will change for every consumer of `formalDocumentRequirements`, but CRM UI parity is out of scope for this pass.

## Key Changes
- **Projection logic**
  - Stop hardcoding `formalDocumentRequirements[*].createAllowed` to `false`.
  - Derive `createAllowed` from the same commercial-write policy used by the backend route: reuse `canDealWriteTreasuryOrFormalDocuments(...)` via the same deal policy surface that powers `assertDealAllowsCommercialWrite(...)`.
  - Keep `openAllowed` derived from `Boolean(activeDocumentId)`.
  - Keep the existing requirement contract shape. Do not add a new top-level `canCreateFormalDocument` flag.
  - Call out in the implementation that this builder is shared by CRM and Finance projections, so the contract change is shared even though only Finance UI changes in this pass.

- **Finance deal workbench**
  - In the Documents tab, render requirement-row actions:
    - `Создать` when `createAllowed === true`
    - `Открыть` when `openAllowed === true`
  - Make the requirement row the primary CTA for required formal documents.
  - Keep formal-document cards as status/history surfaces, but remove the duplicate card-level `Открыть` affordance for the active requirement-linked document. If a card represents a document not covered by a requirement row, it may keep its own open CTA.
  - Build the create href as a deal-scoped flow:
    - `/documents/create/{docType}?dealId={dealId}&returnTo={encodedInternalPath}`
    - default `returnTo` is `/treasury/deals/{dealId}?tab=documents`

- **Document create flow**
  - Extend `/documents/create/[docType]` to accept optional `dealId` and `returnTo` search params.
  - Validate `returnTo` as an app-internal path only:
    - allow only app-relative paths beginning with `/`
    - reject absolute URLs and protocol-relative values
    - fall back to `/treasury/deals/{dealId}?tab=documents` when invalid or absent
  - When `dealId` is absent, preserve the current generic create flow and redirect to document details after success.
  - When `dealId` is present:
    - load deal context for prefills from the existing finance workspace response
    - surface the existing `workflow` payload from `/v1/deals/{id}/finance-workspace` in the Finance query layer instead of inventing a new backend route
    - fetch the existing agreement details from `GET /v1/agreements/{agreementId}` to obtain `organizationRequisiteId`
    - prefill by doc type:
      - `invoice`: default `customerId`, applicant `counterpartyId`, internal `organizationId`, and `organizationRequisiteId`
      - `acceptance` / `exchange`: default `invoiceDocumentId` from the active opening invoice linked to the deal
    - if a prefill source is unavailable, leave the field empty and keep existing form validation behavior
  - Keep the reused page generic in structure. This pass adds defaults/navigation, not a dedicated deal-specific form UI.

- **Finance mutation layer**
  - Add a dedicated deal-scoped create helper instead of overloading the generic document create helper with hidden branching.
  - POST to `POST /v1/deals/{dealId}/formal-documents/{docType}`.
  - Send `Idempotency-Key` in the request header, matching the deal route contract enforced by `withRequiredIdempotency(...)`.
  - Use the route param as the source of truth for the deal id. Send `{ input }` in the body by default; do not include `dealId` unless there is a specific compatibility need.
  - After successful deal-scoped creation, redirect to validated `returnTo`, defaulting to the deal Documents tab.
  - Leave update/edit behavior on the generic document flow unchanged.

## Public Interfaces
- No backend schema, DB, or route changes are required.
- Frontend page/query inputs on `/documents/create/[docType]`:
  - `dealId?: string`
  - `returnTo?: string`
- Frontend query changes:
  - expose the already-returned `workflow` field from the finance workspace payload to support prefills
  - add a small agreement read helper against existing `GET /v1/agreements/{id}`
- Reuse the existing finance workspace contract fields:
  - `formalDocumentRequirements[*].activeDocumentId`
  - `formalDocumentRequirements[*].createAllowed`
  - `formalDocumentRequirements[*].openAllowed`

## Test Plan
- **Projection tests**
  - Missing opening formal document on a commercial-write-allowed deal returns `createAllowed: true`, `openAllowed: false`.
  - Existing formal document returns `createAllowed: false`, `openAllowed: true`.
  - Non-writable statuses keep `createAllowed: false` even when the requirement is missing.
  - Shared projection tests cover both missing and existing opening/closing document requirements without relying on handwritten status logic.

- **Finance workbench tests**
  - Documents tab renders `Создать` for a missing creatable requirement.
  - Documents tab renders row-level `Открыть` for an existing requirement-linked document.
  - The create href includes encoded `dealId` and `returnTo`.
  - The duplicate card-level open CTA is removed for the active requirement-linked document.

- **Create page and routing tests**
  - `/documents/create/[docType]` accepts `dealId` and `returnTo`.
  - Invalid `returnTo` values fall back to `/treasury/deals/{dealId}?tab=documents`.
  - Deal-scoped invoice create mode preloads `customerId`, applicant `counterpartyId`, internal `organizationId`, and `organizationRequisiteId`.
  - Deal-scoped acceptance/exchange create mode preloads `invoiceDocumentId` from the active opening invoice when available.

- **Mutation tests**
  - Deal-scoped create submits through `/v1/deals/{dealId}/formal-documents/{docType}`, not `/v1/documents/{docType}`.
  - Deal-scoped create sends `Idempotency-Key` in the request header.
  - Deal-scoped create sends `{ input }` without requiring `dealId` in the body.
  - Successful deal-scoped create redirects back to the validated deal Documents tab target.
  - Generic create flow still redirects to document details when `dealId` is absent.

## Assumptions
- This pass fixes the Finance dead end only; CRM UI remains unchanged.
- The preferred UX is page reuse, not inline modal creation.
- Requirement rows are the primary create/open entrypoint for required formal documents in Finance.
- The existing deal-scoped formal-document route is the source of truth and should be reused as-is.
- Deal-aware prefills are limited to defaults derivable from existing deal workspace plus agreement data; this pass does not redesign typed document forms around deal-specific workflows.
