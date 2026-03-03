import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { LogOut, Activity, ShieldCheck } from 'lucide-react'
import { NetworkSwitcher } from '@/components/NetworkSwitcher'
import { ActiveAccountSwitcher } from '@/components/ActiveAccountSwitcher'
import { BalanceDisplay } from '@/components/BalanceDisplay'
import { ThemeToggle } from '@/components/ThemeToggle'
import { useContext, useState } from 'react'
import { NetworkContext } from '@/contexts/NetworkContext'
import { KeyringContext } from '@/contexts/KeyringContext'
import { useActiveAccount } from '@/contexts/ActiveAccountContext'

// Componente separado para el botón de logout
// Usa useContext directamente para evitar el error si el contexto no está disponible
function LogoutButton() {
  const keyringContext = useContext(KeyringContext)
  
  // Si el contexto no está disponible, no mostrar el botón
  if (!keyringContext) {
    return null
  }
  
  const { isUnlocked, lock } = keyringContext
  
  if (!isUnlocked || !lock) {
    return null
  }
  
  return (
    <Button 
      variant="ghost" 
      size="icon" 
      className="h-8 w-8 sm:h-10 sm:w-10"
      onClick={lock}
      title="Cerrar sesión"
    >
      <LogOut className="h-4 w-4 sm:h-5 sm:w-5" />
    </Button>
  )
}

export function Header() {
  // Usar useContext directamente para evitar el error si el contexto no está disponible
  const context = useContext(NetworkContext)
  const [logoError, setLogoError] = useState(false)
  // Usar BASE_URL de Vite para rutas correctas en producción (GitHub Pages)
  // En desarrollo será '/', en producción será '/andino-wallet-pwa/'
  const baseUrl = import.meta.env.BASE_URL || '/'
  const logoPath = `${baseUrl}web-app-manifest-192x192.png`
  
  // Si el contexto no está disponible, renderizar un header simplificado
  if (!context) {
    return (
      <header className="glass-header border-b sticky top-0 z-40 safe-area-inset-top">
        <div className="container mx-auto px-2 sm:px-4 py-2 sm:py-4 max-w-full overflow-hidden">
          <div className="flex items-center justify-between gap-2 min-w-0">
            <div className="flex items-center gap-2 sm:gap-4 min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <div className="h-8 w-8 sm:h-10 sm:w-10 rounded-full bg-primary/10 flex items-center justify-center overflow-hidden flex-shrink-0">
                  {!logoError ? (
                    <img 
                      src={logoPath}
                      alt="Nelai" 
                      className="w-full h-full object-cover"
                      onError={() => setLogoError(true)}
                    />
                  ) : (
                    <Activity className="h-5 w-5 sm:h-6 sm:w-6 text-primary" />
                  )}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-1 sm:gap-2 flex-shrink-0">
              <Link
                to="/verify"
                className="hidden sm:flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
                title="Verificar procedencia"
              >
                <ShieldCheck className="h-4 w-4" />
                <span>Verificar</span>
              </Link>
              <div className="hidden sm:flex items-center gap-2">
                <BalanceDisplay />
                <ActiveAccountSwitcher />
              </div>
              <ThemeToggle className="hidden sm:flex" />
              <LogoutButton />
            </div>
          </div>
        </div>
      </header>
    )
  }
  
  const { selectedChain, setSelectedChain, isConnecting } = context
  const { activeAccount } = useActiveAccount()

  return (
    <header className="glass-header border-b sticky top-0 z-40 safe-area-inset-top">
      <div className="container mx-auto px-2 sm:px-4 py-2 sm:py-4 max-w-full overflow-hidden">
        <div className="flex items-center justify-between gap-2 min-w-0">
          <div className="flex items-center gap-2 sm:gap-4 min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <div className="h-8 w-8 sm:h-10 sm:w-10 rounded-full bg-primary/10 flex items-center justify-center overflow-hidden flex-shrink-0">
                {!logoError ? (
                  <img 
                    src={logoPath}
                    alt="Nelai" 
                    className="w-full h-full object-cover"
                    onError={() => setLogoError(true)}
                  />
                ) : (
                  <Activity className="h-5 w-5 sm:h-6 sm:w-6 text-primary" />
                )}
              </div>
            </div>
            <div className="hidden sm:block flex-shrink-0">
              <NetworkSwitcher
                selectedChain={selectedChain}
                onSelectChain={setSelectedChain}
                isConnecting={isConnecting}
                activeAccountAddress={activeAccount}
              />
            </div>
          </div>
          <div className="flex items-center gap-1 sm:gap-2 flex-shrink-0">
            <Link
              to="/verify"
              className="hidden sm:flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
              title="Verificar procedencia"
            >
              <ShieldCheck className="h-4 w-4" />
              <span>Verificar</span>
            </Link>
            <div className="hidden sm:flex items-center gap-2">
              <BalanceDisplay />
              <ActiveAccountSwitcher />
            </div>
            <ThemeToggle className="hidden sm:flex" />
            <LogoutButton />
            <div className="sm:hidden">
              <NetworkSwitcher
                selectedChain={selectedChain}
                onSelectChain={setSelectedChain}
                isConnecting={isConnecting}
                activeAccountAddress={activeAccount}
              />
            </div>
          </div>
        </div>
      </div>
    </header>
  )
}
