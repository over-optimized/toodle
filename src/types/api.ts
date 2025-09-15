import { List, Item, Share, ListType, ShareRole } from './database'

export interface AuthResponse {
  user: { id: string; email: string } | null
  session: { access_token: string } | null
  error: string | null
}

export interface CreateListRequest {
  title: string
  type: ListType
  is_private?: boolean
}

export interface UpdateListRequest {
  title?: string
  is_private?: boolean
}

export interface CreateItemRequest {
  content: string
  position?: number
  target_date?: string
}

export interface UpdateItemRequest {
  content?: string
  is_completed?: boolean
  position?: number
  target_date?: string
}

export interface CreateShareRequest {
  shared_with_email: string
  role: ShareRole
  expires_at: string
}

export interface ListWithItems extends List {
  items: Item[]
}

export interface ListWithShare extends List {
  share?: Share
}

export interface ApiError {
  message: string
  code?: string
  details?: unknown
}

export interface PaginatedResponse<T> {
  data: T[]
  count: number
  page: number
  limit: number
}