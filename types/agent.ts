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
}

export interface AgentBetaLink {
  id: string
  agent_id: string
  beta_token: string
  created_at: string
  expires_at?: string
}
