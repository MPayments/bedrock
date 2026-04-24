DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'deals'
      AND column_name = 'header_snapshot'
      AND is_nullable = 'NO'
  ) THEN
    ALTER TABLE public.deals
      ALTER COLUMN header_snapshot DROP NOT NULL;
  END IF;
END
$$;
