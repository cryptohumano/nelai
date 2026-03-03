/**
 * Componente: Grid de Acciones Rápidas
 * Acciones principales para montañistas
 */

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Mountain, FileText, AlertTriangle, MapPin, ArrowRight } from 'lucide-react'
import { Link } from 'react-router-dom'

export function QuickActionsGrid() {
  const actions = [
    {
      title: 'Crear Bitácora',
      description: 'Registra una nueva expedición',
      icon: Mountain,
      href: '/mountain-logs/new',
      variant: 'default' as const,
      primary: true,
    },
    {
      title: 'Ver Bitácoras',
      description: 'Tus expediciones',
      icon: MapPin,
      href: '/mountain-logs',
      variant: 'outline' as const,
      primary: false,
    },
    {
      title: 'Emergencias',
      description: 'Ver y gestionar emergencias',
      icon: AlertTriangle,
      href: '/emergencies',
      variant: 'outline' as const,
      primary: false,
    },
    {
      title: 'Documentos',
      description: 'Permisos y certificados',
      icon: FileText,
      href: '/documents',
      variant: 'outline' as const,
      primary: false,
    },
  ]

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
      {actions.map((action) => {
        const Icon = action.icon
        return (
          <Card key={action.href} className={action.primary ? 'border-primary/20 bg-primary/5' : ''}>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Icon className={`h-5 w-5 ${action.primary ? 'text-primary' : ''}`} />
                {action.title}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm text-muted-foreground">
                {action.description}
              </p>
              <Button asChild className="w-full" variant={action.variant}>
                <Link to={action.href}>
                  {action.title}
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
            </CardContent>
          </Card>
        )
      })}
    </div>
  )
}
