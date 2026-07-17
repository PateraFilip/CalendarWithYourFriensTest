-- Spolehlivé načtení účastníků (zakladatel / pozvaný / přihlášený vidí všechny v sérii)
CREATE OR REPLACE FUNCTION public.list_event_users()
RETURNS TABLE (
  series_id bigint,
  user_id uuid,
  instance_date text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT eu.series_id, eu.user_id, eu.instance_date
  FROM event_users eu
  WHERE eu.user_id = auth.uid()
     OR EXISTS (
       SELECT 1 FROM event_series es
       WHERE es.id = eu.series_id
         AND es.zakladatel_id = auth.uid()
     )
     OR EXISTS (
       SELECT 1 FROM event_invites ei
       WHERE ei.series_id = eu.series_id
         AND ei.user_id = auth.uid()
     )
     OR EXISTS (
       SELECT 1 FROM event_users me
       WHERE me.series_id = eu.series_id
         AND me.user_id = auth.uid()
     );
$$;

REVOKE ALL ON FUNCTION public.list_event_users() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.list_event_users() TO authenticated;
GRANT EXECUTE ON FUNCTION public.list_event_users() TO service_role;

-- SELECT: vlastní řádky + všechny řádky sérií, které vlastním / kam jsem pozván / kde jsem účastník
DROP POLICY IF EXISTS "event_users_read" ON event_users;
CREATE POLICY "event_users_read" ON event_users FOR SELECT
  USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM event_series es
      WHERE es.id = event_users.series_id
        AND es.zakladatel_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM event_invites ei
      WHERE ei.series_id = event_users.series_id
        AND ei.user_id = auth.uid()
    )
  );
