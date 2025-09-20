export type ShareRole = 'read' | 'edit'

export interface Share {
  id: string
  list_id: string
  created_by: string
  shared_with_email: string
  role: ShareRole
  expires_at: string
  created_at: string
}