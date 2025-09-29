export type ListType = 'simple' | 'grocery' | 'countdown'

export interface List {
  id: string
  user_id: string
  type: ListType
  title: string
  is_private: boolean
  created_at: string
  updated_at: string
}