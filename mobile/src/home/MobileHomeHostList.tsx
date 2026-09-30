import { memo, useCallback, type ReactElement } from 'react'
import { FlatList, StyleSheet, View } from 'react-native'
import type { ListRenderItemInfo } from 'react-native'
import { MobileHostCard } from '../components/MobileHostCard'
import {
  desktopUpdateTag,
  type DesktopUpdateOffer,
  type DesktopUpdateRun
} from '../desktop-update/desktop-update-offer'
import type { HomeStatsSummary } from '../stats/home-stats-total'
import { spacing } from '../theme/mobile-theme'
import { classifyConnection } from '../transport/connection-health'
import { resolveHomeHostConnectionState } from '../transport/home-host-auto-connect'
import type { ConnectionState, HostCatalogEntry } from '../transport/types'
import type { HostWorktreeInfo } from '../worktree/home-worktree-info'
import type { HomeHostConnections } from './home-host-connection-projection'
import { MobileHomeListHeader } from './MobileHomeListHeader'

type MobileHomeHostListProps = {
  autoConnectHostIds: string[]
  bottomInset: number
  contentMaxWidth: number
  desktopUpdates: Record<string, DesktopUpdateOffer | null>
  desktopUpdateRuns: Record<string, DesktopUpdateRun>
  footer: ReactElement
  hostAttempts: Record<string, number>
  hostLastConnected: Record<string, number | null>
  hostConnections: HomeHostConnections
  hosts: HostCatalogEntry[]
  hostStates: Record<string, ConnectionState>
  isWideLayout: boolean
  stats: HomeStatsSummary | null
  worktreeInfo: Record<string, HostWorktreeInfo>
  onOpen: (host: HostCatalogEntry) => void
  onLongPress: (host: HostCatalogEntry) => void
  onOpenActions: (host: HostCatalogEntry) => void
  onPressUpdate: (host: HostCatalogEntry) => void
}

export function MobileHomeHostList(props: MobileHomeHostListProps) {
  const renderHost = useCallback(
    ({ item }: ListRenderItemInfo<HostCatalogEntry>) => (
      <MobileHomeHostRow
        item={item}
        autoConnectHostIds={props.autoConnectHostIds}
        desktopUpdate={props.desktopUpdates[item.id] ?? null}
        desktopUpdateRun={props.desktopUpdateRuns[item.id] ?? null}
        hostAttempts={props.hostAttempts}
        hostLastConnected={props.hostLastConnected}
        hostConnections={props.hostConnections}
        hostStates={props.hostStates}
        worktreeInfo={props.worktreeInfo}
        onOpen={props.onOpen}
        onLongPress={props.onLongPress}
        onOpenActions={props.onOpenActions}
        onPressUpdate={props.onPressUpdate}
      />
    ),
    [
      props.autoConnectHostIds,
      props.desktopUpdates,
      props.desktopUpdateRuns,
      props.hostAttempts,
      props.hostLastConnected,
      props.hostConnections,
      props.hostStates,
      props.onLongPress,
      props.onOpen,
      props.onOpenActions,
      props.onPressUpdate,
      props.worktreeInfo
    ]
  )

  return (
    <FlatList
      data={props.hosts}
      keyExtractor={(host) => host.id}
      contentContainerStyle={[
        styles.list,
        { paddingBottom: spacing.xl + props.bottomInset },
        props.isWideLayout && {
          maxWidth: props.contentMaxWidth,
          width: '100%',
          alignSelf: 'center'
        }
      ]}
      ListHeaderComponent={<MobileHomeListHeader stats={props.stats} />}
      ItemSeparatorComponent={CardGap}
      renderItem={renderHost}
      ListFooterComponent={props.footer}
    />
  )
}

type MobileHomeHostRowProps = Pick<
  MobileHomeHostListProps,
  | 'autoConnectHostIds'
  | 'hostAttempts'
  | 'hostLastConnected'
  | 'hostConnections'
  | 'hostStates'
  | 'worktreeInfo'
  | 'onOpen'
  | 'onLongPress'
  | 'onOpenActions'
  | 'onPressUpdate'
> & {
  item: HostCatalogEntry
  desktopUpdate: DesktopUpdateOffer | null
  desktopUpdateRun: DesktopUpdateRun | null
}

const MobileHomeHostRow = memo(function MobileHomeHostRow(props: MobileHomeHostRowProps) {
  const { item, onLongPress, onOpen, onOpenActions, onPressUpdate } = props
  const state = resolveHomeHostConnectionState(
    item.id,
    props.hostStates[item.id],
    props.autoConnectHostIds
  )
  const connection = props.hostConnections[item.id]
  const verdict = classifyConnection({
    state,
    reconnectAttempts: props.hostAttempts[item.id] ?? 0,
    lastConnectedAt: props.hostLastConnected[item.id] ?? null,
    endpoint: item.endpoint,
    pendingPath: connection?.pendingPath ?? null,
    pairingRejected: connection?.pairingRejected ?? false,
    relayHostReachability: connection?.relayHostReachability ?? 'connecting',
    hostName: item.name
  })
  const open = useCallback(() => onOpen(item), [item, onOpen])
  const longPress = useCallback(() => onLongPress(item), [item, onLongPress])
  const openActions = useCallback(() => onOpenActions(item), [item, onOpenActions])
  const pressUpdate = useCallback(() => onPressUpdate(item), [item, onPressUpdate])

  return (
    <MobileHostCard
      host={item}
      credentialStatus={item.credentialStatus}
      state={state}
      verdict={verdict}
      path={connection?.path ?? 'lan'}
      worktreeInfo={props.worktreeInfo[item.id]}
      updateTag={desktopUpdateTag(props.desktopUpdate, props.desktopUpdateRun)}
      onPressUpdate={pressUpdate}
      onPress={open}
      onLongPress={longPress}
      onOpenActions={openActions}
    />
  )
})

function CardGap() {
  return <View style={styles.cardGap} />
}

const styles = StyleSheet.create({
  list: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xl },
  cardGap: { height: spacing.sm }
})
