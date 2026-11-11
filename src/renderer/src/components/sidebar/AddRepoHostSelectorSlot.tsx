import { useState, type ReactNode } from 'react'
import { AddRepoHostSelector } from './AddRepoHostSelector'
import type { useAddRepoHostSelection } from './use-add-repo-host-selection'
import { AddRemoteHostDialog, type AddRemoteHostMode } from './AddRemoteHostDialog'

export function AddRepoHostSelectorSlot({
  hostSelection,
  accounts
}: {
  hostSelection: ReturnType<typeof useAddRepoHostSelection>
  /** Project accounts panel, shown under the host it applies to. */
  accounts?: ReactNode
}) {
  const [addRemoteHostMode, setAddRemoteHostMode] = useState<AddRemoteHostMode | null>(null)

  return (
    <>
      <AddRepoHostSelector
        hosts={hostSelection.hostOptions}
        selectedHostId={hostSelection.selectedHostId}
        open={hostSelection.hostSelectorOpen}
        onOpenChange={hostSelection.setHostSelectorOpen}
        onSelectHost={(hostId) => void hostSelection.handleSelectAddProjectHost(hostId)}
        onConnectHost={(hostId) => void hostSelection.handleConnectAddProjectHost(hostId)}
        onAddSshHost={() => setAddRemoteHostMode('ssh')}
        onAddRemoteServer={() => setAddRemoteHostMode('server')}
      />
      {accounts}
      <AddRemoteHostDialog mode={addRemoteHostMode} onOpenChange={setAddRemoteHostMode} />
    </>
  )
}
