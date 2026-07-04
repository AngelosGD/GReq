import type { Node } from '@xyflow/react'
import type { NodeDataUrl, NodeDataMethod } from '../types'

export function getUrlData(node: Node): Partial<NodeDataUrl> {
  return node.data as Partial<NodeDataUrl>
}

export function getMethodData(node: Node): Partial<NodeDataMethod> {
  return node.data as Partial<NodeDataMethod>
}
