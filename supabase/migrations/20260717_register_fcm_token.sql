-- Uložení FCM tokenu: auth.uid() + claim tokenu i když dřív patřil jinému user_id
-- (upsert přes RLS jinak padá na UPDATE USING)

CREATE OR REPLACE FUNCTION public.register_fcm_token(p_token text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF p_token IS NULL OR length(trim(p_token)) = 0 THEN
    RAISE EXCEPTION 'Empty FCM token';
  END IF;

  DELETE FROM public.user_devices WHERE fcm_token = p_token;

  INSERT INTO public.user_devices (user_id, fcm_token)
  VALUES (auth.uid(), p_token);
END;
$$;

REVOKE ALL ON FUNCTION public.register_fcm_token(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.register_fcm_token(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.register_fcm_token(text) TO service_role;
