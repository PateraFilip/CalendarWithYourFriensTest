-- Fix colors RLS: allow claiming a free color and releasing your own.
-- Previous policy required user_id = auth.uid() on BOTH USING and CHECK,
-- so (1) clearing to NULL failed CHECK and (2) claiming free (NULL) failed USING.

DROP POLICY IF EXISTS "colors_update" ON colors;
CREATE POLICY "colors_update" ON colors FOR UPDATE
  USING (user_id = auth.uid() OR user_id IS NULL)
  WITH CHECK (user_id = auth.uid() OR user_id IS NULL);
