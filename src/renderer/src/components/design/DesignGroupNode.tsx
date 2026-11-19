import { memo } from 'react'
import { Handle, Position, type NodeProps } from '@xyflow/react'
import { cn } from '@/lib/utils'
import {
  designBlockSourceHandle,
  DESIGN_GROUP_SOURCE_HANDLE,
  DESIGN_GROUP_TARGET_HANDLE,
  type DesignGroupNode as DesignGroupNodeType
} from './design-canvas-flow'
import {
  DESIGN_BLOCK_ICON,
  DESIGN_BLOCK_ICON_TONE,
  designBlockKindLabel
} from './design-block-kind'

function DesignGroupNodeView({ data }: NodeProps<DesignGroupNodeType>): React.JSX.Element {
  const { group, sourceBlockIds, hasGroupSource, hasIncoming } = data
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
      <div className="px-3 pb-2 pt-2.5 text-sm font-semibold leading-5">{group.title}</div>
      <div className="space-y-1.5 px-2 pb-2">
        {group.blocks.map((block) => {
          const Icon = DESIGN_BLOCK_ICON[block.kind]
          return (
            <div
              key={block.id}
              className="relative flex items-start gap-2 rounded-md border border-border bg-background px-2.5 py-2"
            >
              <Icon
                aria-label={designBlockKindLabel(block.kind)}
                className={cn('mt-0.5 size-3.5 shrink-0', DESIGN_BLOCK_ICON_TONE[block.kind])}
              />
              <div className="min-w-0 flex-1">
                <div className="text-xs font-medium leading-4">{block.title}</div>
                {block.description ? (
                  <div className="mt-0.5 line-clamp-2 text-[11px] leading-4 text-muted-foreground">
                    {block.description}
                  </div>
                ) : null}
              </div>
              {sourceBlockIds.includes(block.id) ? (
                <Handle
                  type="source"
                  id={designBlockSourceHandle(block.id)}
                  position={Position.Right}
                  isConnectable={false}
                  className="-right-3!"
                />
              ) : null}
            </div>
          )
        })}
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
