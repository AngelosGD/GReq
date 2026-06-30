import type { NodeTypes } from '@xyflow/react'
import UrlNode from './UrlNode'
import MethodNode from './MethodNode'

export const nodeTypes: NodeTypes = {
  url: UrlNode,
  method: MethodNode,
}
