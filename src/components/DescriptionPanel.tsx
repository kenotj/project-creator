import { FolderIcon, XIcon } from 'lucide-react'
import { Textarea } from './ui/textarea'
import { Button } from './ui/button'

interface DescriptionPanelProps {
  folderName: string
  description: string
  onChange: (value: string) => void
  onClose: () => void
}

export function DescriptionPanel({
  folderName,
  description,
  onChange,
  onClose,
}: DescriptionPanelProps) {
  return (
    <div className="flex flex-col h-full border-l border-border bg-muted/30">
      <div className="flex items-center justify-between px-3 py-2 border-b border-border">
        <div className="flex items-center gap-2 min-w-0">
          <FolderIcon className="w-4 h-4 flex-shrink-0 text-amber-500 dark:text-amber-400" />
          <span className="text-sm font-medium truncate">{folderName}</span>
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6 flex-shrink-0"
          onClick={onClose}
          title="Close"
        >
          <XIcon className="w-3.5 h-3.5" />
        </Button>
      </div>
      <div className="flex-1 p-3">
        <label className="text-xs font-medium text-muted-foreground mb-1.5 block">
          Description
        </label>
        <Textarea
          value={description}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Describe the purpose of this folder..."
          className="resize-none h-32"
        />
      </div>
    </div>
  )
}
