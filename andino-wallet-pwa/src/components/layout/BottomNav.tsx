import { useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { cn } from '@/lib/utils'
import { Home, Wallet, Send, FileText, Settings, Menu, X, Mountain, AlertTriangle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet'
import { ActiveAccountSwitcher } from '@/components/ActiveAccountSwitcher'
import { BalanceDisplay } from '@/components/BalanceDisplay'
import { ThemeToggle } from '@/components/ThemeToggle'

const navigation = [
  { name: 'Inicio', href: '/', icon: Home, description: 'Bitácoras activas y emergencias' },
  { name: 'Bitácoras', href: '/mountain-logs', icon: Mountain, description: 'Registrar expediciones de montañismo' },
  { name: 'Emergencias', href: '/emergencies', icon: AlertTriangle, description: 'Ver y gestionar emergencias' },
  { name: 'Documentos', href: '/documents', icon: FileText, description: 'Gestionar documentos' },
  { name: 'Cuentas', href: '/accounts', icon: Wallet, description: 'Gestionar tus cuentas' },
  { name: 'Enviar', href: '/send', icon: Send, description: 'Enviar tokens' },
  { name: 'Configuración', href: '/settings', icon: Settings, description: 'Ajustes y preferencias' },
]

export function BottomNav() {
  const location = useLocation()
  const navigate = useNavigate()
  const [isOpen, setIsOpen] = useState(false)

  const handleNavigation = (href: string) => {
    navigate(href)
    setIsOpen(false)
  }

  return (
    <>
      {/* FAB Button - Posicionado a la derecha (navegación) */}
      <div
        className={cn(
          "fixed bottom-4 right-4 md:hidden z-[100] pointer-events-auto fab-navigation fab-dim"
        )}
        style={{
          bottom: 'max(1rem, env(safe-area-inset-bottom, 1rem))',
          right: 'max(1rem, env(safe-area-inset-right, 1rem))',
        }}
      >
        <Sheet open={isOpen} onOpenChange={setIsOpen}>
          <SheetTrigger asChild>
            <Button
              size="lg"
              className="h-14 w-14 rounded-full transition-all duration-200"
              aria-label="Abrir menú de navegación"
            >
              {isOpen ? (
                <X className="h-6 w-6" />
              ) : (
                <Menu className="h-6 w-6" />
              )}
            </Button>
          </SheetTrigger>
          <SheetContent 
            side="bottom-above-fab" 
            className="h-[70vh] rounded-t-2xl overflow-y-auto sheet-solid-bg"
            style={{
              bottom: 'calc(max(1rem, env(safe-area-inset-bottom, 1rem)) + 5rem)',
              paddingBottom: 'max(1rem, env(safe-area-inset-bottom, 1rem))',
            }}
          >
            <SheetHeader>
              <SheetTitle>Navegación</SheetTitle>
              <SheetDescription>
                Selecciona una opción para navegar
              </SheetDescription>
            </SheetHeader>
            {/* Balance Display - Solo en móvil */}
            <div className="mt-4 mb-4">
              <div className="text-sm font-medium mb-2 px-1">Balance</div>
              <div className="p-2 bg-muted rounded-lg">
                <BalanceDisplay showIcon={true} />
              </div>
            </div>
            {/* Selector de cuenta activa - Solo en móvil */}
            <div className="mt-4 mb-4">
              <div className="text-sm font-medium mb-2 px-1">Cuenta activa</div>
              <ActiveAccountSwitcher />
            </div>
            {/* Theme Toggle - Solo en móvil */}
            <div className="mt-4 mb-4 px-1">
              <div className="text-sm font-medium mb-2">Tema</div>
              <ThemeToggle />
            </div>
            <div className="mt-6 space-y-2 pb-4">
              {navigation.map((item) => {
                const isActive = location.pathname === item.href
                return (
                  <button
                    key={item.name}
                    onClick={() => handleNavigation(item.href)}
                    className={cn(
                      'w-full flex items-center gap-4 p-4 rounded-lg transition-colors text-left',
                      isActive
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-muted hover:bg-muted/80 text-foreground'
                    )}
                  >
                    <item.icon className={cn(
                      'h-6 w-6 flex-shrink-0',
                      isActive ? 'text-primary-foreground' : 'text-muted-foreground'
                    )} />
                    <div className="flex-1 min-w-0">
                      <div className={cn(
                        'font-medium',
                        isActive ? 'text-primary-foreground' : 'text-foreground'
                      )}>
                        {item.name}
                      </div>
                      <div className={cn(
                        'text-sm mt-0.5',
                        isActive ? 'text-primary-foreground/80' : 'text-muted-foreground'
                      )}>
                        {item.description}
                      </div>
                    </div>
                    {isActive && (
                      <div className="h-2 w-2 rounded-full bg-primary-foreground" />
                    )}
                  </button>
                )
              })}
            </div>
          </SheetContent>
        </Sheet>
      </div>
    </>
  )
}

