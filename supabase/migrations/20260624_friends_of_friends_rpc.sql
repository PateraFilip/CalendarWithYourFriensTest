
CREATE OR REPLACE FUNCTION get_extended_network_ids(p_user_id UUID)
RETURNS SETOF UUID AS $$
BEGIN
    RETURN QUERY
    WITH direct_friends AS (
        SELECT friend_id as u_id FROM friendships WHERE user_id = p_user_id AND status = 'accepted'
        UNION
        SELECT user_id as u_id FROM friendships WHERE friend_id = p_user_id AND status = 'accepted'
    ),
    friends_of_friends AS (
        SELECT f.friend_id as u_id FROM friendships f
        JOIN direct_friends df ON f.user_id = df.u_id
        WHERE f.status = 'accepted' AND f.friend_id != p_user_id
        UNION
        SELECT f.user_id as u_id FROM friendships f
        JOIN direct_friends df ON f.friend_id = df.u_id
        WHERE f.status = 'accepted' AND f.user_id != p_user_id
    )
    SELECT u_id FROM direct_friends
    UNION
    SELECT u_id FROM friends_of_friends;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
