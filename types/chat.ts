export interface Message {
  id: string
  conversation_id: string
  role: 'user' | 'assistant'
  content: string
  created_at: string
}

export interface Conversation {
  id: string
  user_id: string
  agent_id: string
  title: string
  created_at: string
  updated_at: string
  is_shared: boolean
  share_token?: string
}

export interface ChatMessage {
  id?: string
  role: 'user' | 'assistant'
  content: string
  created_at?: string
  _streamId?: number // Internal: tracks streaming messages
  attachedDocuments?: Array<{ id: string; name: string }>
}
