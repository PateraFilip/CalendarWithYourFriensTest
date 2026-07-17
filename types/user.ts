export type User = {
    id: string | number
    auth_user_id?: string | null
    username: string
    name: string
    lastname: string
    email: string
    notify_friend_requests?: boolean
    notify_chat_messages?: boolean
    notify_global_chat?: boolean
}
