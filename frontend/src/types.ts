export interface User {
  id: number
  username: string
  email: string
  is_admin: boolean
  created_at?: string
}

export interface Category {
  id: number
  name: string
}

export interface Document {
  id: number
  user_id: number
  original_filename: string
  stored_filename: string
  mime_type: string | null
  file_size: number | null
  created_at: string
  category: Category | null
  ocr_text: string | null
  predicted_confidence: number | null
  predicted_category_name: string | null
}

export interface UploadStatus {
  upload_id: string
  percent: number
  stage: string
  details: Record<string, unknown>
  updated_at: number
}

export interface ServiceLogsResponse {
  source: string
  line_count: number
  lines: string[]
}
