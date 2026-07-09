import type { StoredResponse } from './store/execStore'

export interface Slide {
  number: string
  title: string
  description: string
  icon: string
}

export interface AuthForm {
  email: string
  password: string
  name?: string
}

export interface KeyValuePair {
  key: string
  value: string
}

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' | 'UPDATE'
export type BodyType = 'json' | 'text' | 'form'
export type AuthType = 'None' | 'Basic' | 'Bearer'

export interface NodeDataUrl {
  url: string
  title: string
  headers: KeyValuePair[]
  params: KeyValuePair[]
}

export interface NodeDataMethod {
  method: HttpMethod
  headers: KeyValuePair[]
  body: string
  bodyType: BodyType
  auth: AuthType
  authValue: string
  repeatCount: number
  response?: StoredResponse
  responses?: StoredResponse[]
}

export type AnyNodeData = NodeDataUrl | NodeDataMethod
