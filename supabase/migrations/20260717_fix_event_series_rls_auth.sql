-- RLS pro aktuální schéma: public.users.id = auth.uid() (UUID, bez auth_user_id)
-- Spusť celé v Supabase SQL Editor.

CREATE OR REPLACE FUNCTION public.owns_user_ref(p_user_id text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT auth.uid() IS NOT NULL
     AND p_user_id IS NOT NULL
     AND p_user_id = auth.uid()::text;
$$;

CREATE OR REPLACE FUNCTION public.is_accepted_friend(a uuid, b uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM friendships f
    WHERE f.status = 'accepted'
      AND (
        (f.user_id = a AND f.friend_id = b)
        OR (f.user_id = b AND f.friend_id = a)
      )
  );
$$;

CREATE OR REPLACE FUNCTION public.can_view_series(p_series_id bigint)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM event_series es
    WHERE es.id = p_series_id
      AND (
        es.zakladatel_id = auth.uid()
        OR EXISTS (
          SELECT 1 FROM event_invites ei
          WHERE ei.series_id = es.id AND ei.user_id = auth.uid()
        )
        OR EXISTS (
          SELECT 1 FROM event_users eu
          WHERE eu.series_id = es.id AND eu.user_id = auth.uid()
        )
        OR (
          COALESCE(es.is_group, false) = false
          AND es.zakladatel_id IS NOT NULL
          AND public.is_accepted_friend(auth.uid(), es.zakladatel_id)
        )
      )
  );
$$;

CREATE OR REPLACE FUNCTION public.is_series_owner(p_series_id bigint)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM event_series es
    WHERE es.id = p_series_id AND es.zakladatel_id = auth.uid()
  );
$$;

DROP POLICY IF EXISTS "event_series_insert" ON event_series;
CREATE POLICY "event_series_insert" ON event_series FOR INSERT
  WITH CHECK (zakladatel_id = auth.uid());

DROP POLICY IF EXISTS "event_series_update" ON event_series;
CREATE POLICY "event_series_update" ON event_series FOR UPDATE
  USING (zakladatel_id = auth.uid())
  WITH CHECK (zakladatel_id = auth.uid());

DROP POLICY IF EXISTS "event_series_delete" ON event_series;
CREATE POLICY "event_series_delete" ON event_series FOR DELETE
  USING (zakladatel_id = auth.uid());

DROP POLICY IF EXISTS "event_series_read" ON event_series;
CREATE POLICY "event_series_read" ON event_series FOR SELECT
  USING (public.can_view_series(id));

-- Pojistka: po INSERT ... RETURNING musí SELECT projít i když can_view_series selže
DROP POLICY IF EXISTS "event_series_select_own" ON event_series;
CREATE POLICY "event_series_select_own" ON event_series FOR SELECT
  USING (zakladatel_id = auth.uid());
