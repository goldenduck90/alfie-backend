export interface Channel {
  channel_url: string
  name: string
  data: string
  members?: Member[]
  member_count: number
  created_at: number
  joined_member_count: number
  custom_type: string
  is_distinct: boolean
  is_super: boolean
  is_public: boolean
  is_discoverable: boolean
  is_ephemeral: boolean
  freeze: boolean
  unread_message_count: number
  unread_mention_count: number
  created_by: Member
}

export interface MessageEvents {
  send_push_notification: string
  update_unread_count: boolean
  update_mention_count: boolean
  update_last_message: boolean
}

export interface Message {
  message_id: number
  type: string
  custom_type: string
  channel_url: string
  user: Member
  mention_type: string
  mentioned_users: Member[]
  is_removed: boolean
  message: string
  translations: Record<string, any>
  data: any
  sorted_metaarray?: Array<{ key: any; value: any }>
  poll?: any
  message_events: MessageEvents
  created_at: number
  updated_at: number
  file: any
  is_apple_critical_alert: boolean
}

export interface Payload {
  custom_type: string
  message: string
  data: string
  message_id: number
  created_at: number
}

export interface Sender {
  user_id: string
  nickname: string
  profile_url: string
}

export interface Member {
  user_id: string
  nickname: string
  profile_url: string
  is_online: boolean
  push_enabled: boolean
  push_trigger_option: string
  do_not_disturb: boolean
  state: string
  is_active: boolean
  is_hidden: number
  unread_message_count: number
  total_unread_message_count: number
  channel_unread_message_count: number
  channel_mention_count: number
  is_blocked_by_sender: boolean
  is_blocking_sender: boolean
}

export interface SendBirdWebhookMessage {
  app_id: string
  category: string
  type: string
  custom_type: string
  channel: Channel
  sender_ip_addr: string
  mention_type: string
  mentioned_users: any[]
  sdk: string
  silent: boolean
  message_events: MessageEvents
  payload: Payload
  sender: Sender
  members: Member[]
}
