import { useState } from 'react'
import { Check, ChevronsUpDown } from 'lucide-react'
import { translate } from '@/i18n/i18n'
import { cn } from '@/lib/utils'
import { Button } from '../ui/button'
import { Command, CommandEmpty, CommandInput, CommandItem, CommandList } from '../ui/command'
import { Popover, PopoverContent, PopoverTrigger } from '../ui/popover'
import type { DeepSeekModelPickerOption } from './deepseek-model-picker-options'

export function DeepSeekModelSlotPicker({
  label,
  envName,
  value,
  options,
  onChange
}: {
  label: string
  envName: string
  value: string
  options: readonly DeepSeekModelPickerOption[]
  onChange: (value: string) => void
}): React.JSX.Element {
  const [open, setOpen] = useState(false)
  return (
    <div className="grid grid-cols-[12rem_minmax(0,1fr)] items-center gap-2">
      <span className="min-w-0">
        <span className="block text-xs text-muted-foreground">{label}</span>
        <span className="block truncate font-mono text-[10px] text-muted-foreground/70">
          {envName}
        </span>
      </span>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            size="xs"
            role="combobox"
            aria-expanded={open}
            aria-label={translate('settings.agents.deepseek.slotPickerAria', '{{value0}} model', {
              value0: label
            })}
            className="h-7 min-w-0 justify-between"
          >
            <span className="truncate font-mono">{value}</span>
            <ChevronsUpDown className="size-3.5 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent
          align="start"
          className="w-[var(--radix-popover-trigger-width)] min-w-[16rem]"
        >
          <Command>
            <CommandInput
              placeholder={translate('settings.agents.deepseek.searchModels', 'Search models...')}
            />
            <CommandList>
              <CommandEmpty>
                {translate('settings.agents.deepseek.noModelMatch', 'No models match.')}
              </CommandEmpty>
              {options.map((option) => (
                <CommandItem
                  key={option.value}
                  value={option.value}
                  onSelect={() => {
                    setOpen(false)
                    if (option.value !== value) {
                      onChange(option.value)
                    }
                  }}
                >
                  <Check
                    className={cn(
                      'size-4 shrink-0',
                      option.value === value ? 'opacity-100' : 'opacity-0'
                    )}
                  />
                  <span className="min-w-0 flex-1 truncate font-mono text-xs">{option.value}</span>
                  {option.oneMillionContext ? (
                    <span className="shrink-0 text-[10px] text-muted-foreground">
                      {translate('settings.agents.deepseek.oneMillionContext', '1M context')}
                    </span>
                  ) : null}
                  {option.listed ? null : (
                    <span className="shrink-0 text-[10px] text-muted-foreground">
                      {translate('settings.agents.deepseek.notListed', 'Not listed by DeepSeek')}
                    </span>
                  )}
                </CommandItem>
              ))}
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </div>
  )
}
