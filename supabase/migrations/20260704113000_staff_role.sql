
-- Step 1: add staff enum value (must commit before use in policies)

alter type public.app_role add value if not exists 'staff';
