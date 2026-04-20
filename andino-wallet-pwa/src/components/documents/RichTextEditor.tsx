/**
 * Editor de texto enriquecido usando Quill
 */

import { useRef, useEffect, useState, useMemo } from 'react'
import ReactQuill from 'react-quill-new'
import 'react-quill-new/dist/quill.snow.css'
import { cn } from '@/lib/utils'
import PhotoCapture from './PhotoCapture'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Camera, Image as ImageIcon } from 'lucide-react'
import { toast } from 'sonner'

export interface EditorApi {
  insertAtCursor: (text: string) => void
  replaceText: (original: string, replacement: string) => boolean
  getContent: () => string
}

export interface RichTextEditorProps {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  className?: string
  readOnly?: boolean
  /** Ref que se rellena con insertAtCursor cuando el editor está listo */
  editorApiRef?: React.MutableRefObject<EditorApi | null>
}

export default function RichTextEditor({
  value,
  onChange,
  placeholder = 'Escribe el contenido del documento...',
  className,
  readOnly = false,
  editorApiRef,
}: RichTextEditorProps) {
  const quillRef = useRef<ReactQuill>(null)
  const [photoDialogOpen, setPhotoDialogOpen] = useState(false)
  const [cameraDialogOpen, setCameraDialogOpen] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [mounted, setMounted] = useState(false)

  // Ref estable para el handler de imagen — evita que modules cambie en cada render
  const openPhotoDialogRef = useRef(() => setPhotoDialogOpen(true))
  useEffect(() => {
    openPhotoDialogRef.current = () => setPhotoDialogOpen(true)
  }, [])

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    if (!mounted || !editorApiRef) return
    const tryAttach = () => {
      if (!quillRef.current) return false
      try {
        // react-quill-new puede lanzar error si se llama a getEditor() muy pronto
        const editor = quillRef.current.getEditor()
        if (!editor) return false

        /**
         * Flash highlight con delay de 60ms.
         * Se aplica DESPUÉS de que el caller (handleReplace/handleInsert)
         * haya llamado getContent(), así el HTML guardado nunca incluye
         * el fondo amarillo.
         */
        const flashHighlight = (q: any, index: number, length: number) => {
          setTimeout(() => {
            // 1. Aplicar fondo resaltado — 'silent' para NO disparar onChange
            q.formatText(index, length, { background: '#facc15' }, 'silent')

            // 2. Scroll suave al texto modificado
            try {
              const editorEl = q.root as HTMLElement
              const bounds = q.getBounds(index, length)
              if (bounds && editorEl) {
                const scrollContainer = editorEl.closest('.ql-container') || editorEl.parentElement
                if (scrollContainer) {
                  const targetScroll = bounds.top - scrollContainer.clientHeight / 3
                  editorEl.scrollTo({ top: targetScroll, behavior: 'smooth' })
                }
                const absoluteRect = editorEl.getBoundingClientRect()
                const targetY = absoluteRect.top + bounds.top + window.scrollY - window.innerHeight / 3
                window.scrollTo({ top: targetY, behavior: 'smooth' })
              }
            } catch {
              // bounds puede fallar en edge cases, ignorar
            }

            // 3. Transición gradual: amarillo fuerte → suave → transparente
            setTimeout(() => {
              q.formatText(index, length, { background: '#fef08a' }, 'silent')
            }, 1200)
            setTimeout(() => {
              q.formatText(index, length, { background: '#fef9c3' }, 'silent')
            }, 2200)
            setTimeout(() => {
              q.formatText(index, length, { background: false }, 'silent')
            }, 3200)
          }, 60)
        }

        editorApiRef.current = {
          insertAtCursor: (text: string) => {
            const q = quillRef.current?.getEditor()
            if (!q) return
            const range = q.getSelection(true)
            if (range) {
              q.insertText(range.index, text, 'user')
              q.setSelection(range.index + text.length)
              flashHighlight(q, range.index, text.length)
            } else {
              const pos = q.getLength() - 1
              q.insertText(pos, text, 'user')
              flashHighlight(q, pos, text.length)
            }
          },
          replaceText: (original: string, replacement: string) => {
            const q = quillRef.current?.getEditor()
            if (!q) return false
            const text = q.getText()
            const index = text.indexOf(original)
            if (index === -1) return false
            
            q.deleteText(index, original.length)
            q.insertText(index, replacement, 'user')
            flashHighlight(q, index, replacement.length)
            return true
          },
          getContent: () => {
            const q = quillRef.current?.getEditor()
            return q?.root?.innerHTML || ''
          }
        }
        return true
      } catch (err) {
        // El editor aún no está listo, intentaremos de nuevo en el próximo tick
        return false
      }
    }
    if (tryAttach()) return () => { editorApiRef.current = null }
    const id = setTimeout(() => {
      tryAttach()
    }, 100)
    return () => {
      clearTimeout(id)
      editorApiRef.current = null
    }
  }, [mounted, editorApiRef])

  // --- Modules ESTABLE con useMemo ---
  // CRÍTICO: si modules se recrea en cada render, ReactQuill reinicializa
  // el editor y el history module pierde su stack → Ctrl+Z no funciona.
  // El handler de imagen usa un ref estable para evitar la dependencia en estado.
  const modules = useMemo(() => {
    if (readOnly) return { toolbar: false }
    return {
      toolbar: {
        container: [
          [
            { header: [1, 2, 3, false] },
            'bold',
            'italic',
            'underline',
            'strike',
            { list: 'ordered' },
            { list: 'bullet' },
            { align: [] },
            'link',
            'image',
            'clean',
          ],
        ],
        handlers: {
          image: function () {
            openPhotoDialogRef.current()
          },
        },
      },
      history: {
        delay: 500,
        maxStack: 100,
        userOnly: true,
      },
    }
  }, [readOnly])

  const handlePhotoCapture = (photoBase64: string) => {
    if (quillRef.current) {
      const quill = quillRef.current.getEditor()
      const range = quill.getSelection(true)
      quill.insertEmbed(range.index, 'image', photoBase64, 'user')
      quill.setSelection(range.index + 1)
    }
    setPhotoDialogOpen(false)
  }

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    if (!file.type.startsWith('image/')) {
      toast.error('Por favor selecciona un archivo de imagen')
      return
    }

    const reader = new FileReader()
    reader.onload = (e) => {
      const result = e.target?.result as string
      if (result && quillRef.current) {
        const quill = quillRef.current.getEditor()
        const range = quill.getSelection(true)
        quill.insertEmbed(range.index, 'image', result, 'user')
        quill.setSelection(range.index + 1)
      }
    }
    reader.readAsDataURL(file)
    setPhotoDialogOpen(false)
    
    // Limpiar input
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  // Quill 2: 'bullet' es valor de 'list', no un formato. Solo 'list' cubre ordered y bullet.
  const formats = [
    'header',
    'bold',
    'italic',
    'underline',
    'strike',
    'list',
    'align',
    'link',
    'image',
    'background',
  ]

  if (!mounted) {
    return (
      <div className="w-full min-h-[300px] border rounded-lg p-4 flex items-center justify-center">
        <p className="text-muted-foreground">Cargando editor...</p>
      </div>
    )
  }

  return (
    <>
      <style>{`
        /* Estilo tipo Google Docs: toolbar compacta, área de edición amplia */
        .rich-text-editor {
          width: 100% !important;
          display: block !important;
          min-height: 300px !important;
          font-family: inherit;
        }
        .rich-text-editor .ql-container {
          min-height: 280px !important;
          font-size: 14px;
          line-height: 1.6;
          width: 100% !important;
          display: block !important;
          border: none !important;
        }
        .rich-text-editor .ql-editor {
          min-height: 280px !important;
          width: 100% !important;
          padding: 1rem 1.5rem !important;
          /* Padding inferior generoso (estilo Google Docs) para que el cursor
             nunca quede pegado al borde inferior de la pantalla al escribir */
          padding-bottom: 50vh !important;
          font-family: inherit;
        }
        .rich-text-editor .ql-editor.ql-blank::before {
          color: hsl(var(--muted-foreground));
          font-style: normal;
        }
        /* Toolbar horizontal compacta como Google Docs */
        .rich-text-editor .ql-toolbar {
          border: none !important;
          border-bottom: 1px solid hsl(var(--border)) !important;
          padding: 0.5rem 1rem !important;
          background: hsl(var(--background)) !important;
          display: flex !important;
          flex-wrap: wrap !important;
          gap: 0 !important;
        }
        .rich-text-editor .ql-toolbar .ql-formats {
          margin-right: 0.5rem !important;
        }
        .rich-text-editor .ql-toolbar button {
          padding: 0.35rem 0.5rem !important;
        }
        .rich-text-editor .ql-toolbar .ql-picker {
          padding: 0.25rem 0.5rem !important;
        }
        .rich-text-editor .ql-container {
          border-radius: 0 0 0.5rem 0.5rem;
          background: hsl(var(--background)) !important;
        }
        .rich-text-editor .ql-snow {
          width: 100% !important;
          border-radius: 0.5rem;
          border: 1px solid hsl(var(--border)) !important;
        }
        .rich-text-editor .ql-snow .ql-toolbar {
          border-radius: 0.5rem 0.5rem 0 0 !important;
        }
        .rich-text-editor .ql-snow .ql-toolbar,
        .rich-text-editor .ql-snow .ql-container,
        .rich-text-editor .ql-snow .ql-editor {
          display: block !important;
          visibility: visible !important;
          opacity: 1 !important;
        }
        /* Encabezados con mejor jerarquía visual */
        .rich-text-editor .ql-editor h1 { font-size: 1.75rem; font-weight: 600; margin: 1rem 0 0.5rem; }
        .rich-text-editor .ql-editor h2 { font-size: 1.35rem; font-weight: 600; margin: 0.75rem 0 0.5rem; }
        .rich-text-editor .ql-editor h3 { font-size: 1.15rem; font-weight: 600; margin: 0.5rem 0 0.25rem; }
        /* Highlight suave para texto modificado por IA */
        .rich-text-editor .ql-editor span[style*="background"] {
          border-radius: 2px;
          padding: 1px 0;
          transition: background-color 0.8s ease;
        }
      `}</style>
      <div className={cn('rich-text-editor w-full', className)} style={{ width: '100%', minHeight: '350px' }}>
        <ReactQuill
          ref={quillRef}
          theme="snow"
          value={value || ''}
          onChange={onChange}
          modules={modules}
          formats={formats}
          placeholder={placeholder}
          readOnly={readOnly}
        />
      </div>

      {/* Input oculto para seleccionar archivos */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleFileSelect}
        className="hidden"
      />

      {/* Dialog para seleccionar método de imagen */}
      <Dialog open={photoDialogOpen} onOpenChange={setPhotoDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Agregar Imagen</DialogTitle>
            <DialogDescription>
              Selecciona cómo deseas agregar la imagen
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 mt-4">
            <div className="grid grid-cols-2 gap-4">
              <Button
                variant="outline"
                onClick={() => {
                  fileInputRef.current?.click()
                }}
                className="flex flex-col items-center gap-2 h-auto py-4"
              >
                <ImageIcon className="h-6 w-6" />
                <span>Desde Archivo</span>
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  setPhotoDialogOpen(false)
                  setCameraDialogOpen(true)
                }}
                className="flex flex-col items-center gap-2 h-auto py-4"
              >
                <Camera className="h-6 w-6" />
                <span>Desde Cámara</span>
              </Button>
            </div>
            <Button
              variant="ghost"
              onClick={() => setPhotoDialogOpen(false)}
              className="w-full"
            >
              Cancelar
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Dialog para capturar foto desde cámara */}
      <Dialog open={cameraDialogOpen} onOpenChange={setCameraDialogOpen}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <PhotoCapture
            onCapture={(photoBase64) => {
              handlePhotoCapture(photoBase64)
              setCameraDialogOpen(false)
            }}
            onCancel={() => setCameraDialogOpen(false)}
          />
        </DialogContent>
      </Dialog>
    </>
  )
}
