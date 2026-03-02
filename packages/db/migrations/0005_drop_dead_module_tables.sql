-- Drop legacy platform_module_* tables that were replaced by platform_component_* in 0003.
-- Data was already migrated in 0003_component_runtime_cutover.sql.

DROP TABLE IF EXISTS "platform_module_events";
DROP TABLE IF EXISTS "platform_module_states";
DROP TABLE IF EXISTS "platform_module_runtime_meta";
