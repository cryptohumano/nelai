/**
 * Utilidades para limpiar todos los datos de la aplicación
 * Incluye IndexedDB, localStorage y otros datos almacenados localmente
 */

import { deleteDatabase, closeSharedDB } from './indexedDB'

// Claves de localStorage que deben eliminarse
const LOCAL_STORAGE_KEYS = [
  'aura-wallet-contacts',
  'aura-wallet-api-configs',
  // Agregar otras claves de localStorage aquí
]

/**
 * Elimina todas las bases de datos de IndexedDB relacionadas con la aplicación
 */
export async function deleteAllDatabases(): Promise<void> {
  if (!('indexedDB' in window)) {
    throw new Error('IndexedDB no está disponible')
  }

  // Cerrar todas las conexiones abiertas primero
  closeSharedDB()

  try {
    // Obtener todas las bases de datos
    const databases = await indexedDB.databases()
    
    // Filtrar solo las bases de datos de nuestra aplicación
    const appDatabases = databases.filter(db => 
      db.name && (
        db.name.includes('pwa-substrate') ||
        db.name.includes('aura-wallet') ||
        db.name === 'pwa-substrate-keyring'
      )
    )

    console.log(`[Data Cleanup] Eliminando ${appDatabases.length} base(s) de datos...`)

    // Eliminar cada base de datos
    const deletePromises = appDatabases.map(db => {
      return new Promise<void>((resolve, reject) => {
        if (!db.name) {
          resolve()
          return
        }

        const deleteRequest = indexedDB.deleteDatabase(db.name)

        deleteRequest.onsuccess = () => {
          console.log(`[Data Cleanup] ✅ Base de datos eliminada: ${db.name}`)
          resolve()
        }

        deleteRequest.onerror = () => {
          const error = deleteRequest.error || new Error(`Error al eliminar ${db.name}`)
          console.error(`[Data Cleanup] ❌ Error al eliminar ${db.name}:`, error)
          reject(error)
        }

        deleteRequest.onblocked = () => {
          console.warn(`[Data Cleanup] ⚠️ Eliminación de ${db.name} bloqueada. Esperando...`)
          // Esperar y reintentar
          setTimeout(() => {
            const retryRequest = indexedDB.deleteDatabase(db.name!)
            retryRequest.onsuccess = () => {
              console.log(`[Data Cleanup] ✅ Base de datos eliminada después de bloqueo: ${db.name}`)
              resolve()
            }
            retryRequest.onerror = () => {
              reject(retryRequest.error || new Error(`Error al eliminar ${db.name}`))
            }
          }, 1000)
        }
      })
    })

    await Promise.all(deletePromises)
    console.log('[Data Cleanup] ✅ Todas las bases de datos eliminadas')
  } catch (error) {
    console.error('[Data Cleanup] ❌ Error al eliminar bases de datos:', error)
    throw error
  }
}

/**
 * Elimina todos los datos de localStorage relacionados con la aplicación
 */
export function clearLocalStorage(): void {
  console.log('[Data Cleanup] Limpiando localStorage...')
  
  LOCAL_STORAGE_KEYS.forEach(key => {
    try {
      localStorage.removeItem(key)
      console.log(`[Data Cleanup] ✅ localStorage eliminado: ${key}`)
    } catch (error) {
      console.error(`[Data Cleanup] ❌ Error al eliminar ${key}:`, error)
    }
  })

  // También eliminar cualquier clave que empiece con nuestro prefijo
  try {
    const keysToRemove: string[] = []
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i)
      if (key && (key.startsWith('aura-wallet-') || key.startsWith('pwa-substrate-'))) {
        keysToRemove.push(key)
      }
    }
    keysToRemove.forEach(key => {
      localStorage.removeItem(key)
      console.log(`[Data Cleanup] ✅ localStorage eliminado: ${key}`)
    })
  } catch (error) {
    console.error('[Data Cleanup] ❌ Error al limpiar localStorage:', error)
  }

  console.log('[Data Cleanup] ✅ localStorage limpiado')
}

/**
 * Elimina todos los datos de sessionStorage relacionados con la aplicación
 */
export function clearSessionStorage(): void {
  console.log('[Data Cleanup] Limpiando sessionStorage...')
  
  try {
    const keysToRemove: string[] = []
    for (let i = 0; i < sessionStorage.length; i++) {
      const key = sessionStorage.key(i)
      if (key && (key.startsWith('aura-wallet-') || key.startsWith('pwa-substrate-'))) {
        keysToRemove.push(key)
      }
    }
    keysToRemove.forEach(key => {
      sessionStorage.removeItem(key)
      console.log(`[Data Cleanup] ✅ sessionStorage eliminado: ${key}`)
    })
  } catch (error) {
    console.error('[Data Cleanup] ❌ Error al limpiar sessionStorage:', error)
  }

  console.log('[Data Cleanup] ✅ sessionStorage limpiado')
}

/**
 * Elimina TODOS los datos de la aplicación (IndexedDB, localStorage, sessionStorage)
 * ⚠️ ADVERTENCIA: Esta operación es IRREVERSIBLE
 */
export async function deleteAllAppData(): Promise<void> {
  console.warn('[Data Cleanup] ⚠️ INICIANDO ELIMINACIÓN COMPLETA DE DATOS')
  console.warn('[Data Cleanup] ⚠️ Esta operación es IRREVERSIBLE')

  try {
    // 1. Cerrar todas las conexiones
    closeSharedDB()

    // 2. Eliminar IndexedDB
    await deleteAllDatabases()

    // 3. Limpiar localStorage
    clearLocalStorage()

    // 4. Limpiar sessionStorage
    clearSessionStorage()

    console.log('[Data Cleanup] ✅ Todos los datos eliminados exitosamente')
  } catch (error) {
    console.error('[Data Cleanup] ❌ Error durante la limpieza:', error)
    throw error
  }
}

/**
 * Obtiene información sobre los datos almacenados
 */
export async function getStorageInfo(): Promise<{
  databases: Array<{ name: string; version: number }>
  localStorageKeys: string[]
  sessionStorageKeys: string[]
  totalSize?: number
}> {
  const databases = await indexedDB.databases()
  const appDatabases = databases.filter(db => 
    db.name && (
      db.name.includes('pwa-substrate') ||
      db.name.includes('aura-wallet') ||
      db.name === 'pwa-substrate-keyring'
    )
  )

  const localStorageKeys: string[] = []
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i)
    if (key && (key.startsWith('aura-wallet-') || key.startsWith('pwa-substrate-'))) {
      localStorageKeys.push(key)
    }
  }

  const sessionStorageKeys: string[] = []
  for (let i = 0; i < sessionStorage.length; i++) {
    const key = sessionStorage.key(i)
    if (key && (key.startsWith('aura-wallet-') || key.startsWith('pwa-substrate-'))) {
      sessionStorageKeys.push(key)
    }
  }

  return {
    databases: appDatabases.map(db => ({
      name: db.name || '',
      version: db.version || 0,
    })),
    localStorageKeys,
    sessionStorageKeys,
  }
}

