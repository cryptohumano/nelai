import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Mountain, Loader2 } from 'lucide-react'
import { lazy, Suspense } from 'react'
import { useActiveMountainLog } from '@/hooks/useActiveMountainLog'
import { useActiveEmergencies } from '@/hooks/useActiveEmergencies'
import { useRecentMountainLogs } from '@/hooks/useRecentMountainLogs'
import { ActiveMountainLogCard } from '@/components/home/ActiveMountainLogCard'
import { ActiveEmergenciesCard } from '@/components/home/ActiveEmergenciesCard'
import { GeneralStatistics } from '@/components/home/GeneralStatistics'
import { FAB } from '@/components/ui/fab'
import { useIsMobile } from '@/hooks/use-mobile'
import { useNavigate, Link } from 'react-router-dom'

// Lazy load del mapa para mejorar LCP
// Si falla el import (por ejemplo, después de un deploy con nuevos hashes), recarga la página
const MountainLogsMap = lazy(() => 
  import('@/components/home/MountainLogsMap')
    .then(module => ({ default: module.MountainLogsMap }))
    .catch((error) => {
      console.error('[Home] Error al cargar MountainLogsMap, recargando página:', error)
      // Solo recargar si es un error de fetch/import (nuevo deploy)
      if (error.message?.includes('Failed to fetch') || error.message?.includes('dynamically imported module')) {
        window.location.reload()
      }
      throw error
    })
)

export default function Home() {
  const navigate = useNavigate()
  const isMobile = useIsMobile()
  
  // Hooks para datos de montañistas
  const { activeLog, isLoading: isLoadingActiveLog } = useActiveMountainLog()
  const { activeEmergencies, isLoading: isLoadingEmergencies } = useActiveEmergencies()
  const { recentLogs: allLogs, isLoading: isLoadingAllLogs } = useRecentMountainLogs(100) // Para el mapa

  return (
    <div className="space-y-3 sm:space-y-4">
      {/* Header compacto */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg sm:text-xl font-bold flex items-center gap-2">
            <Mountain className="h-5 w-5 sm:h-6 sm:w-6 text-primary" />
            Nelai
          </h1>
        </div>
      </div>

      {/* Bitácora Activa - Solo si existe */}
      {isLoadingActiveLog ? (
        <Card>
          <CardContent className="py-4">
            <div className="flex items-center justify-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
              <span className="text-xs text-muted-foreground">Cargando...</span>
            </div>
          </CardContent>
        </Card>
      ) : activeLog ? (
        <ActiveMountainLogCard log={activeLog} />
      ) : null}

      {/* Emergencias Activas - Solo si existen */}
      {isLoadingEmergencies ? (
        <Card>
          <CardContent className="py-4">
            <div className="flex items-center justify-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
              <span className="text-xs text-muted-foreground">Cargando...</span>
            </div>
          </CardContent>
        </Card>
      ) : activeEmergencies.length > 0 ? (
        <ActiveEmergenciesCard emergencies={activeEmergencies} />
      ) : null}

      {/* Mapa de Bitácoras - Ocupa la mayor parte de la pantalla, bloqueado */}
      <Suspense fallback={
        <div className="w-full h-[calc(100vh-12rem)] min-h-[400px] rounded-lg border flex items-center justify-center bg-muted/50">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      }>
        <MountainLogsMap 
          logs={allLogs}
          emergencies={activeEmergencies}
          isLoading={isLoadingAllLogs} 
          showCurrentLocation={true}
          className="w-full mb-20 sm:mb-24"
        />
      </Suspense>

      {/* Botón de Crear Bitácora - Desktop: Botón completo, Mobile: FAB */}
      {!isMobile ? (
        <Button size="lg" variant="default" className="w-full" asChild>
          <Link to="/mountain-logs/new">
            <Mountain className="mr-2 h-5 w-5" />
            Crear Bitácora
          </Link>
        </Button>
      ) : null}

      {/* FAB para crear bitácora - Solo en móvil, posicionado a la izquierda para usuarios diestros */}
      {isMobile && (
        <FAB
          icon={Mountain}
          label="Crear Bitácora"
          onClick={() => navigate('/mountain-logs/new')}
          variant="default"
          position="left"
          bottomOffset={0} // Sin offset adicional para que coincida con el FAB de navegación
          aria-label="Crear Bitácora"
        />
      )}
      
      {/* Estadísticas generales - Entre los FABs (móvil) o en la parte inferior (desktop) */}
      <GeneralStatistics 
        logs={allLogs} 
        emergencies={activeEmergencies}
      />
    </div>
  )
}

