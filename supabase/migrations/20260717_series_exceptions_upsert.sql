-- Doplnění sloupců pro výjimky instance + upsert-friendly unique + RLS update/delete

ALTER TABLE series_exceptions
  ADD COLUMN IF NOT EXISTS title TEXT,
  ADD COLUMN IF NOT EXISTS poloha TEXT,
  ADD COLUMN IF NOT EXISTS latitude DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS longitude DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS pocet_lidi INT,
  ADD COLUMN IF NOT EXISTS is_group BOOLEAN;

-- Jedna výjimka na den (DELETE nebo UPDATE)
ALTER TABLE series_exceptions DROP CONSTRAINT IF EXISTS series_exceptions_series_id_puvodni_den_typ_key;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'series_exceptions_series_day_unique'
  ) THEN
    ALTER TABLE series_exceptions
      ADD CONSTRAINT series_exceptions_series_day_unique UNIQUE (series_id, puvodni_den);
  END IF;
EXCEPTION WHEN others THEN
  -- Pokud unikátní klíč nejde (duplicity), necháme stávající stav
  RAISE NOTICE 'Could not add unique (series_id, puvodni_den): %', SQLERRM;
END $$;

DROP POLICY IF EXISTS "series_exceptions_update" ON series_exceptions;
CREATE POLICY "series_exceptions_update" ON series_exceptions FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM event_series es
      WHERE es.id = series_exceptions.series_id AND es.zakladatel_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM event_series es
      WHERE es.id = series_exceptions.series_id AND es.zakladatel_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "series_exceptions_delete" ON series_exceptions;
CREATE POLICY "series_exceptions_delete" ON series_exceptions FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM event_series es
      WHERE es.id = series_exceptions.series_id AND es.zakladatel_id = auth.uid()
    )
  );
