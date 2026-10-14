import { cn } from '@/lib/utils'

// Why: the Badge primitive owns its color and spacing, and these chips need per-situation tones.
export function AzurePullRequestChip({
  className,
  ...props
}: React.ComponentProps<'span'>): React.JSX.Element {
  return (
    <span
      className={cn(
        'inline-flex w-fit max-w-full shrink-0 items-center gap-1 rounded-full border border-border px-2 py-0.5 text-[10px] whitespace-nowrap',
        className
      )}
      {...props}
    />
  )
}
