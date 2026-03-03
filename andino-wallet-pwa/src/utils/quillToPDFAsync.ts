/**
 * Utilidades asíncronas para convertir contenido de Quill (HTML) a formato PDF con imágenes
 */

import jsPDF from 'jspdf'


/**
 * Convierte HTML de Quill a PDF preservando formato e imágenes
 */
export async function convertQuillHTMLToPDF(
  pdf: jsPDF,
  html: string,
  startY: number,
  maxWidth: number = 170
): Promise<number> {
  const margin = 20
  let yPosition = startY
  const lineHeight = 6

  // Crear elemento temporal para parsear HTML
  const tempDiv = document.createElement('div')
  tempDiv.innerHTML = html
  tempDiv.style.position = 'absolute'
  tempDiv.style.visibility = 'hidden'
  tempDiv.style.width = `${maxWidth}mm`
  document.body.appendChild(tempDiv)

  // Función para procesar nodos (async para imágenes)
  async function processNode(node: Node, indent: number = 0): Promise<void> {
    if (node.nodeType === Node.TEXT_NODE) {
      const text = node.textContent?.trim()
      if (text && text !== '[Imagen]') {
        if (yPosition > 250) {
          pdf.addPage()
          yPosition = 20
        }
        const lines = pdf.splitTextToSize(text, maxWidth - indent)
        pdf.text(lines, margin + indent, yPosition)
        yPosition += lines.length * lineHeight
      }
      return
    }

    if (node.nodeType === Node.ELEMENT_NODE) {
      const element = node as HTMLElement
      const tagName = element.tagName.toLowerCase()

      switch (tagName) {
        case 'p':
          if (yPosition > 20) yPosition += 3
          for (const child of Array.from(element.childNodes)) {
            await processNode(child, indent)
          }
          yPosition += 3
          break

        case 'br':
          yPosition += lineHeight
          break

        case 'strong':
        case 'b':
          pdf.setFont('helvetica', 'bold')
          for (const child of Array.from(element.childNodes)) {
            await processNode(child, indent)
          }
          pdf.setFont('helvetica', 'normal')
          break

        case 'em':
        case 'i':
          pdf.setFont('helvetica', 'italic')
          for (const child of Array.from(element.childNodes)) {
            await processNode(child, indent)
          }
          pdf.setFont('helvetica', 'normal')
          break

        case 'h1':
          if (yPosition > 20) yPosition += 5
          pdf.setFontSize(18)
          pdf.setFont('helvetica', 'bold')
          for (const child of Array.from(element.childNodes)) {
            await processNode(child, indent)
          }
          pdf.setFontSize(12)
          pdf.setFont('helvetica', 'normal')
          yPosition += 5
          break

        case 'h2':
          if (yPosition > 20) yPosition += 4
          pdf.setFontSize(16)
          pdf.setFont('helvetica', 'bold')
          for (const child of Array.from(element.childNodes)) {
            await processNode(child, indent)
          }
          pdf.setFontSize(12)
          pdf.setFont('helvetica', 'normal')
          yPosition += 4
          break

        case 'h3':
          if (yPosition > 20) yPosition += 3
          pdf.setFontSize(14)
          pdf.setFont('helvetica', 'bold')
          for (const child of Array.from(element.childNodes)) {
            await processNode(child, indent)
          }
          pdf.setFontSize(12)
          pdf.setFont('helvetica', 'normal')
          yPosition += 3
          break

        case 'ul':
        case 'ol':
          Array.from(element.children).forEach((li, index) => {
            if (yPosition > 250) {
              pdf.addPage()
              yPosition = 20
            }
            const marker = tagName === 'ol' ? `${index + 1}. ` : '• '
            pdf.text(marker, margin + indent, yPosition)
            Array.from(li.childNodes).forEach(child => {
              if (child.nodeType === Node.TEXT_NODE) {
                const text = child.textContent?.trim()
                if (text) {
                  const lines = pdf.splitTextToSize(text, maxWidth - indent - 10)
                  pdf.text(lines, margin + indent + 10, yPosition)
                  yPosition += lines.length * lineHeight
                }
              } else {
                processNode(child, indent + 10)
              }
            })
            yPosition += 2
          })
          break

        case 'img':
          // Imágenes - procesar de forma asíncrona
          const img = element as HTMLImageElement
          const src = img.src || img.getAttribute('src')
          if (src && src.startsWith('data:')) {
            // Las imágenes se procesarán después, por ahora marcador
            if (yPosition > 200) {
              pdf.addPage()
              yPosition = 20
            }
            // Intentar agregar imagen directamente
            try {
              const imgElement = new Image()
              imgElement.src = src
              
              // Esperar carga
              await new Promise<void>((resolve, reject) => {
                if (imgElement.complete) {
                  resolve()
                } else {
                  imgElement.onload = () => resolve()
                  imgElement.onerror = () => reject(new Error('Error'))
                  setTimeout(() => reject(new Error('Timeout')), 3000)
                }
              })

              const imgWidth = imgElement.width
              const imgHeight = imgElement.height
              const maxImgWidth = maxWidth - indent
              const maxImgHeight = 50
              
              let displayWidth = imgWidth * 0.264583
              let displayHeight = imgHeight * 0.264583
              
              if (displayWidth > maxImgWidth) {
                const ratio = maxImgWidth / displayWidth
                displayWidth = maxImgWidth
                displayHeight = displayHeight * ratio
              }
              if (displayHeight > maxImgHeight) {
                const ratio = maxImgHeight / displayHeight
                displayHeight = maxImgHeight
                displayWidth = displayWidth * ratio
              }

              pdf.addImage(src, 'PNG', margin + indent, yPosition, displayWidth, displayHeight)
              yPosition += displayHeight + 3
            } catch (error) {
              console.warn('Error al agregar imagen:', error)
            }
          }
          break

        case 'div':
        case 'span':
          Array.from(element.childNodes).forEach(child => processNode(child, indent))
          break

        default:
          Array.from(element.childNodes).forEach(child => processNode(child, indent))
      }
    }
  }

  // Procesar nodos
  for (const node of Array.from(tempDiv.childNodes)) {
    await processNode(node)
  }

  // Limpiar
  document.body.removeChild(tempDiv)

  return yPosition
}

