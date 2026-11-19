import { memo } from 'react'
import { Handle, Position, type NodeProps } from '@xyflow/react'
import { cn } from '@/lib/utils'
import { Popover, PopoverAnchor, PopoverContent } from '@/components/ui/popover'
import type { DesignBlock } from '../../../../shared/design-types'
import {
  designBlockSourceHandle,
  DESIGN_GROUP_SOURCE_HANDLE,
  DESIGN_GROUP_TARGET_HANDLE,
  type DesignGroupNode as DesignGroupNodeType
} from './design-canvas-flow'
import { useDesignCanvasInteraction } from './design-canvas-interaction'
import {
  DESIGN_BLOCK_ICON,
  DESIGN_BLOCK_ICON_TONE,
  designBlockKindLabel
} from './design-block-kind'
import { DesignBlockActivityChips } from './DesignBlockActivityChips'

function BlockRow({
  block,
  hasSource
}: {
  block: DesignBlock
  hasSource: boolean
}): React.JSX.Element {
  const interaction = useDesignCanvasInteraction()
  const Icon = DESIGN_BLOCK_ICON[block.kind]
  const open = interaction.openBlockId === block.id
  return (
    <Popover
      open={open}
      onOpenChange={(next) => interaction.setOpenBlockId(next ? block.id : null)}
    >
      <PopoverAnchor asChild>
        <div
          data-design-block={block.id}
          data-highlighted={interaction.highlightedBlockId === block.id ? 'true' : undefined}
          className={cn(
            'relative rounded-md border border-border bg-background transition-colors hover:bg-accent',
            (open || interaction.highlightedBlockId === block.id) && 'ring-2 ring-ring'
          )}
        >
          <button
            type="button"
            onClick={() => interaction.setOpenBlockId(open ? null : block.id)}
            className="flex w-full items-start gap-2 rounded-md px-2.5 py-2 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <Icon
              aria-label={designBlockKindLabel(block.kind)}
              className={cn('mt-0.5 size-3.5 shrink-0', DESIGN_BLOCK_ICON_TONE[block.kind])}
            />
            <span className="min-w-0 flex-1">
              <span className="block text-xs font-medium leading-4">{block.title}</span>
              {block.description ? (
                <span className="mt-0.5 line-clamp-2 block text-[11px] leading-4 text-muted-foreground">
                  {block.description}
                </span>
              ) : null}
            </span>
            <DesignBlockActivityChips activity={interaction.activity.get(block.id)} />
          </button>
          {hasSource ? (
            <Handle
              type="source"
              id={designBlockSourceHandle(block.id)}
              position={Position.Right}
              isConnectable={false}
              className="-right-3!"
            />
          ) : null}
        </div>
      </PopoverAnchor>
      <PopoverContent side="right" align="start" className="w-96">
        <div className="scrollbar-sleek max-h-[70vh] overflow-y-auto p-4">
          <div className="mb-3 space-y-1">
            <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
              <Icon className={cn('size-3.5', DESIGN_BLOCK_ICON_TONE[block.kind])} />
              {designBlockKindLabel(block.kind)}
            </div>
            <p className="text-sm font-semibold">{block.title}</p>
            {block.description ? (
              <p className="whitespace-pre-wrap text-xs text-muted-foreground">
                {block.description}
              </p>
            ) : null}
          </div>
          {interaction.renderBlockThread(block)}
        </div>
      </PopoverContent>
    </Popover>
  )
}

function DesignGroupNodeView({ data }: NodeProps<DesignGroupNodeType>): React.JSX.Element {
  const { group, sourceBlockIds, hasGroupSource, hasIncoming } = data
  const interaction = useDesignCanvasInteraction()
  const firstBlock = group.blocks[0]
  return (
    // Why: w-[280px] must equal DESIGN_GROUP_WIDTH, which the auto layout spaces columns by.
    <div className="relative w-[280px] rounded-xl border border-border bg-card text-card-foreground shadow-xs">
      {hasIncoming ? (
        <Handle
          type="target"
          id={DESIGN_GROUP_TARGET_HANDLE}
          position={Position.Left}
          isConnectable={false}
          className="top-5!"
        />
      ) : null}
      {firstBlock ? (
        // Why: comments attach to blocks, so a group title opens its first block's thread.
        <button
          type="button"
          onClick={() => interaction.setOpenBlockId(firstBlock.id)}
          className="block w-full rounded-t-xl px-3 pb-2 pt-2.5 text-left text-sm font-semibold leading-5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          {group.title}
        </button>
      ) : (
        <div className="px-3 pb-2 pt-2.5 text-sm font-semibold leading-5">{group.title}</div>
      )}
      <div className="space-y-1.5 px-2 pb-2">
        {group.blocks.map((block) => (
          <BlockRow key={block.id} block={block} hasSource={sourceBlockIds.includes(block.id)} />
        ))}
      </div>
      {hasGroupSource ? (
        <Handle
          type="source"
          id={DESIGN_GROUP_SOURCE_HANDLE}
          position={Position.Right}
          isConnectable={false}
          className="top-auto! bottom-3!"
        />
      ) : null}
    </div>
  )
}

export const DesignGroupNode = memo(DesignGroupNodeView)
