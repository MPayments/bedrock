-- Enum value additions must land in their own committed transaction before
-- they can be referenced in CHECK constraints. The adjacent
-- `0023_file_links_payment_step_owner.sql` migration adds the column and
-- constraint that rely on this value.
ALTER TYPE "public"."file_link_kind" ADD VALUE 'payment_step_evidence';
