import type { Node, Edge } from '@xyflow/react'
import { HistoryModal } from './HistoryModal'
import { GroupDeleteModal } from './GroupDeleteModal'
import { ProfileModal } from './ProfileModal'
import { ShortcutsModal } from './ShortcutsModal'

interface GroupDeleteInfo {
  node: Node
  methods: Node[]
}

interface MainModalsProps {
  showHistory: boolean
  onCloseHistory: () => void
  onRetomarHistory: (entry: { nodes: Node[]; edges: Edge[] }) => void
  groupDeleteInfo: GroupDeleteInfo | null
  onDeleteGroup: () => void
  onDeleteNode: () => void
  onCancelGroupDelete: () => void
  showProfile: boolean
  onCloseProfile: () => void
  showShortcuts: boolean
  onCloseShortcuts: () => void
}

export function MainModals({
  showHistory, onCloseHistory, onRetomarHistory,
  groupDeleteInfo, onDeleteGroup, onDeleteNode, onCancelGroupDelete,
  showProfile, onCloseProfile,
  showShortcuts, onCloseShortcuts,
}: MainModalsProps) {
  return (
    <>
      {showHistory && (
        <HistoryModal
          onClose={onCloseHistory}
          onRetomar={onRetomarHistory}
        />
      )}

      {groupDeleteInfo && (
        <GroupDeleteModal
          node={groupDeleteInfo.node}
          methods={groupDeleteInfo.methods}
          onDeleteGroup={onDeleteGroup}
          onDeleteNode={onDeleteNode}
          onCancel={onCancelGroupDelete}
        />
      )}

      {showProfile && <ProfileModal onClose={onCloseProfile} />}

      {showShortcuts && <ShortcutsModal onClose={onCloseShortcuts} />}
    </>
  )
}
