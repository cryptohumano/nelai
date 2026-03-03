import { ReactNode } from 'react'
import { useLocation } from 'react-router-dom'
import { useKeyringContext } from '@/contexts/KeyringContext'
import Onboarding from '@/pages/Onboarding'
import { Unlock } from './Unlock'

interface AuthGuardProps {
  children: ReactNode
}

/**
 * Componente que protege las rutas y muestra onboarding o unlock según sea necesario
 */
export function AuthGuard({ children }: AuthGuardProps) {
  const { isReady, isUnlocked, hasStoredAccounts } = useKeyringContext()
  const location = useLocation()

  // Esperar a que el keyring esté listo
  if (!isReady) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Inicializando wallet...</p>
        </div>
      </div>
    )
  }

  // Si no hay cuentas almacenadas, mostrar onboarding por defecto
  // pero permitir acceso a la ruta de importación de cuentas
  if (!hasStoredAccounts) {
    const currentPath = location.pathname
    
    // Permitir acceso solo a /accounts/import durante el onboarding
    // Settings es una ruta protegida y no debe ser accesible sin cuentas
    const isImportRoute = currentPath === '/accounts/import' || currentPath.startsWith('/accounts/import?')
    
    // Si estamos en la ruta de importación, permitir acceso
    if (isImportRoute) {
      return <>{children}</>
    }
    
    // Para todas las demás rutas (incluyendo /, /accounts, /settings, etc.), mostrar onboarding
    return <Onboarding />
  }

  // Si hay cuentas pero no está desbloqueado, mostrar unlock
  if (!isUnlocked) {
    return <Unlock />
  }

  // Si está desbloqueado, mostrar el contenido protegido
  return <>{children}</>
}

