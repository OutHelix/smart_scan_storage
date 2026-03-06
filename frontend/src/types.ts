export interface User {
  id: number
  username: string
  email: string
  created_at?: string
}

export interface Document {
  id: number
  user_id: number
  original_filename: string
  stored_filename: string
  mime_type: string | null
  file_size: number | null
  created_at: string
}

