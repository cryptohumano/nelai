import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { getGuideContent } from '@/services/nelai/guideAgent'
import type { GuideActionType } from '@/config/guideAgent'
import { Info } from 'lucide-react'

interface GuideModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  actionType: GuideActionType
  fieldsToPublish?: string[]
  onAcknowledged: () => void
  hasGeolocation?: boolean
  hasPersonalData?: boolean
}

export function GuideModal({
  open,
  onOpenChange,
  actionType,
  fieldsToPublish = [],
  onAcknowledged,
  hasGeolocation,
  hasPersonalData,
}: GuideModalProps) {
  const result = getGuideContent({
    actionType,
    fieldsToPublish,
    hasGeolocation,
    hasPersonalData,
  })

  const handleAcknowledged = () => {
    onAcknowledged()
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <div className="rounded-full bg-primary/10 p-2">
              <Info className="h-5 w-5 text-primary" />
            </div>
            <DialogTitle>{result.title}</DialogTitle>
          </div>
          <DialogDescription className="sr-only">
            Explicación sobre qué datos serán públicos y privados
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 pt-2">
          {result.sections ? (
            <div className="space-y-4">
              {result.sections.map((section, i) => (
                <div key={i}>
                  <h4 className="font-semibold text-sm mb-1">{section.heading}</h4>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    {section.body}
                  </p>
                </div>
              ))}
            </div>
          ) : (
            <div className="prose prose-sm dark:prose-invert max-w-none">
              <p className="text-sm text-muted-foreground whitespace-pre-line leading-relaxed">
                {result.content.replace(/\*\*(.*?)\*\*/g, '$1')}
              </p>
            </div>
          )}
          <Button onClick={handleAcknowledged} className="w-full mt-4">
            Entendido
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
