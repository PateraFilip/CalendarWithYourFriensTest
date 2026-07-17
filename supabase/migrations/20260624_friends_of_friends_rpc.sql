-- Fixed FoF RPC (also in 20260717_friendships_leagues_rls.sql)

CREATE OR REPLACE FUNCTION public.get_extended_network_ids(p_user_id UUID)
RETURNS SETOF UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;
  IF p_user_id IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'forbidden: can only query own network';
  END IF;

  RETURN QUERY
  WITH direct_friends AS (
    SELECT friend_id AS u_id FROM friendships WHERE user_id = p_user_id AND status = 'accepted'
    UNION
    SELECT user_id AS u_id FROM friendships WHERE friend_id = p_user_id AND status = 'accepted'
  ),
  friends_of_friends AS (
    SELECT f.friend_id AS u_id FROM friendships f
    JOIN direct_friends df ON f.user_id = df.u_id
    WHERE f.status = 'accepted' AND f.friend_id != p_user_id
    UNION
    SELECT f.user_id AS u_id FROM friendships f
    JOIN direct_friends df ON f.friend_id = df.u_id
    WHERE f.status = 'accepted' AND f.user_id != p_user_id
  )
  SELECT u_id FROM direct_friends
  UNION
  SELECT u_id FROM friends_of_friends;
END;
$$;

REVOKE ALL ON FUNCTION public.get_extended_network_ids(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_extended_network_ids(UUID) TO authenticated;
