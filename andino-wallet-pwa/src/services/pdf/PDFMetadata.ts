/**
 * Utilidades para manejar metadata GPS y EXIF en PDFs
 */

import type { GPSMetadata } from '@/types/documents'
import jsPDF from 'jspdf'

/**
 * Inyecta metadata GPS en un documento PDF
 * 
 * NOTA: jsPDF tiene limitaciones para metadata personalizada.
 * Esta función es un placeholder. La metadata GPS real se maneja
 * en el objeto Document de IndexedDB y se puede agregar al PDF
 * cuando se convierte a pdf-lib (ver mountainLogPDFGenerator.ts).
 * 
 * Esta función no hace nada actualmente, pero se mantiene para
 * compatibilidad con código existente.
 */
export function injectGPSMetadata(
  pdf: jsPDF,
  gpsMetadata: GPSMetadata
): void {
  // jsPDF no tiene getMetadata(). Las propiedades se establecen con setProperties()
  // y se pueden leer desde pdf.internal.metadata, pero no es necesario aquí.
  
  // La metadata GPS se guarda en el objeto Document de IndexedDB.
  // Si necesitamos agregarla al PDF, debemos hacerlo después de convertir
  // el PDF a pdf-lib (ver mountainLogPDFGenerator.ts línea 664+).
  
  // Por ahora, esta función no hace nada para evitar errores.
  // TODO: Si se necesita metadata GPS en el PDF, agregarla en mountainLogPDFGenerator.ts
  // después de cargar el PDF con PDFDocument.load()
}

/**
 * Obtiene la ubicación GPS actual del usuario
 */
export async function getCurrentGPSLocation(): Promise<GPSMetadata | null> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('Geolocalización no está disponible'))
      return
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        resolve({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          altitude: position.coords.altitude || undefined,
          accuracy: position.coords.accuracy || undefined,
          timestamp: position.timestamp,
        })
      },
      (error) => {
        reject(error)
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0,
      }
    )
  })
}

/**
 * Extrae metadata EXIF de una imagen
 * Nota: Para una implementación completa, necesitaríamos exif-js
 */
export async function extractEXIFMetadata(imageFile: File): Promise<{
  gps?: GPSMetadata
  dateTime?: string
  [key: string]: any
}> {
  // Implementación básica - en producción usaríamos exif-js
  return new Promise((resolve) => {
    const reader = new FileReader()
    
    reader.onload = (e) => {
      const result = e.target?.result
      if (result instanceof ArrayBuffer) {
        // Aquí procesaríamos los datos EXIF
        // Por ahora retornamos un objeto vacío
        resolve({})
      } else {
        resolve({})
      }
    }
    
    reader.onerror = () => {
      resolve({})
    }
    
    reader.readAsArrayBuffer(imageFile)
  })
}

/**
 * Convierte coordenadas GPS a formato de metadata PDF
 */
export function formatGPSForPDF(gps: GPSMetadata): {
  Latitude: number
  Longitude: number
  Altitude?: number
} {
  return {
    Latitude: gps.latitude,
    Longitude: gps.longitude,
    ...(gps.altitude !== undefined && { Altitude: gps.altitude }),
  }
}

