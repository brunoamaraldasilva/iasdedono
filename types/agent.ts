export interface Agent {
  id: string
  name: string
  description: string
  system_prompt: string
  icon?: string
  color?: string
  is_published: boolean
  is_beta: boolean
  created_by?: string
  conversation_starters?: string[]
  created_at: string
  updated_at: string
}

export interface AgentMaterial {
  id: string
  agent_id: string
  type: 'document' | 'context' | 'resource'
  title: string
  content: string
  order: number
  created_at: string
  updated_at: string
  // File upload support
  file_path?: string
  file_type?: string
  is_file_based?: boolean
  file_size?: number
  extraction_status?: 'pending' | 'extracting' | 'completed' | 'error'
}

export interface AgentBetaLink {
  id: string
  agent_id: string
  beta_token: string
  created_at: string
  expires_at?: string
}
