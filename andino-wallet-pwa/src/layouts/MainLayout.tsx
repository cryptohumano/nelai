import { Outlet, useLocation } from 'react-router-dom'
import { Header } from '@/components/layout/Header'
import { Sidebar } from '@/components/layout/Sidebar'
import { BottomNav } from '@/components/layout/BottomNav'
import { AuthGuard } from '@/components/auth/AuthGuard'
import { useIsMobile } from '@/hooks/use-mobile'
import { useKeyringContext } from '@/contexts/KeyringContext'
import { useDocumentEditorLayout } from '@/contexts/DocumentEditorLayoutContext'

export default function MainLayout() {
  const isMobile = useIsMobile()
  const { isUnlocked } = useKeyringContext()
  const location = useLocation()
  const layoutCtx = useDocumentEditorLayout()

  const isDocumentEditor =
    location.pathname === '/documents/new' ||
    /^\/documents\/[^/]+\/edit$/.test(location.pathname)

  // En modo documento: sidebar visible si el usuario la activó; en otros modos: mostrar siempre (excepto móvil)
  const showSidebar =
    !isMobile &&
    isUnlocked &&
    (isDocumentEditor ? (layoutCtx?.sidebarOpen ?? false) : true)

  return (
    <AuthGuard>
      <div className="min-h-screen bg-background flex flex-col">
        {isUnlocked && !isDocumentEditor && <Header />}
        <div className="flex flex-1 overflow-hidden">
          {showSidebar && <Sidebar />}
          <main 
            className={`flex-1 overflow-y-auto ${isDocumentEditor ? 'p-0' : 'p-4 md:p-6 lg:p-8'} ${showSidebar ? 'md:ml-64' : ''} ${isMobile && isUnlocked ? 'pb-28' : ''}`} 
            style={{ 
              scrollBehavior: 'smooth',
              // Asegurar que el contenido pueda hacer scroll hasta el final
              // Padding suficiente para el FAB (h-14 = 3.5rem) + espacio (1rem) + safe-area
              paddingBottom: isMobile && isUnlocked 
                ? 'calc(1rem + env(safe-area-inset-bottom, 0px) + 5rem)' 
                : undefined,
              // Asegurar que el scroll funcione correctamente
              WebkitOverflowScrolling: 'touch',
            }}
          >
            <Outlet />
          </main>
        </div>
        {isMobile && isUnlocked && <BottomNav />}
      </div>
    </AuthGuard>
  )
}

