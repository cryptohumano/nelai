/**
 * Página para editar documentos antes de generar PDF
 */

import { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import RichTextEditor, { type EditorApi } from '@/components/documents/RichTextEditor'
import { DocumentEditorAgent } from '@/components/documents/DocumentEditorAgent'
import DiffViewer from '@/components/documents/DiffViewer'
import { useKeyringContext } from '@/contexts/KeyringContext'
import { createDocument, updateDocumentContent } from '@/services/documents/DocumentService'
import { getDocument, updateDocument } from '@/utils/documentStorage'
import { toast } from 'sonner'
import { ArrowLeft, Save, Bot, Info, Menu, PanelTopClose, PanelTop, History, RotateCcw, Eye, GitCompare } from 'lucide-react'
import type { DocumentType } from '@/types/documents'
import { encryptDocument } from '@/services/documents/DocumentEncryptor'
import Identicon from '@polkadot/react-identicon'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { useDocumentEditorLayout } from '@/contexts/DocumentEditorLayoutContext'
import { cn } from '@/lib/utils'

export default function DocumentEditor() {
  const { documentId } = useParams<{ documentId: string }>()
  const navigate = useNavigate()
  const { accounts } = useKeyringContext()
  const layoutCtx = useDocumentEditorLayout()

  const [isEditing] = useState(!!documentId)
  const [loading, setLoading] = useState(!!documentId)
  const [saving, setSaving] = useState(false)

  // Formulario
  const [title, setTitle] = useState('')
  const [type, setType] = useState<DocumentType>('generic')
  const [content, setContent] = useState('')
  const [description, setDescription] = useState('')
  const [selectedAccount, setSelectedAccount] = useState<string>('')
  const [encrypt, setEncrypt] = useState(false)
  const [encryptPassword, setEncryptPassword] = useState('')
  const [encryptDialogOpen, setEncryptDialogOpen] = useState(false)
  const [metadataModalOpen, setMetadataModalOpen] = useState(false)
  const [historyModalOpen, setHistoryModalOpen] = useState(false)
  const [agentOpen, setAgentOpen] = useState(false)
  const [chatHistory, setChatHistory] = useState<any[]>([])
  /** Se incrementa al cargar el documento para hidratar el chat del agente desde IndexedDB */
  const [chatSessionKey, setChatSessionKey] = useState(0)
  const chatHistoryRef = useRef<any[]>([])

  useEffect(() => {
    chatHistoryRef.current = chatHistory
  }, [chatHistory])
  const [versions, setVersions] = useState<any[]>([])
  const [appliedMods, setAppliedMods] = useState<Record<string, number>>({})
  const [previewVersion, setPreviewVersion] = useState<any | null>(null)
  const [showDiff, setShowDiff] = useState(false)
  const [liveDiffEnabled, setLiveDiffEnabled] = useState(false)
  const [savedContent, setSavedContent] = useState('')
  const editorApiRef = useRef<EditorApi | null>(null)

  useEffect(() => {
    if (!documentId) return
    // Persistir historial del chat (incluso vacío) en IndexedDB
    getDocument(documentId).then((doc) => {
      if (doc) {
        updateDocument(documentId, { ...doc, chatHistory, updatedAt: Date.now() })
      }
    })
  }, [chatHistory, documentId])

  const flushChatToStorage = useCallback(() => {
    if (!documentId) return
    const latest = chatHistoryRef.current
    getDocument(documentId).then((doc) => {
      if (doc) {
        updateDocument(documentId, { ...doc, chatHistory: latest, updatedAt: Date.now() })
      }
    })
  }, [documentId])

  const handleAgentOpenChange = useCallback(
    (open: boolean) => {
      setAgentOpen(open)
      if (!open) flushChatToStorage()
    },
    [flushChatToStorage]
  )

  useEffect(() => {
    if (documentId) {
      loadDocument()
    } else {
      // Si no hay documentId, usar la primera cuenta disponible
      if (accounts.length > 0) {
        setSelectedAccount(accounts[0].address)
      }
    }
  }, [documentId, accounts])

  const loadDocument = async () => {
    if (!documentId) return

    try {
      setLoading(true)
      const doc = await getDocument(documentId)

      if (!doc) {
        toast.error('Documento no encontrado')
        navigate('/documents')
        return
      }

      setTitle(doc.metadata.title || '')
      setType(doc.type)
      setDescription(doc.metadata.description || '')
      setSelectedAccount(doc.relatedAccount || accounts[0]?.address || '')
      const initialContent = (doc.metadata.contentHtml as string) || ''
      setContent(initialContent)
      setSavedContent(initialContent)
      setEncrypt(doc.encrypted || false)
      setChatHistory(doc.chatHistory || [])
      setChatSessionKey((k) => k + 1)
      setAppliedMods(doc.appliedMods || {})
      setVersions(doc.versions || [])
    } catch (error) {
      console.error('[Document Editor] Error al cargar documento:', error)
      toast.error('Error al cargar el documento')
    } finally {
      setLoading(false)
    }
  }

  const handleSave = async () => {
    if (!title.trim()) {
      toast.error('Por favor ingresa un título')
      return
    }

    if (!selectedAccount) {
      toast.error('Por favor selecciona una cuenta como autor')
      return
    }

    if (!content.trim()) {
      toast.error('Por favor ingresa contenido para el documento')
      return
    }

    try {
      setSaving(true)

      const metadata = {
        title,
        description,
        author: selectedAccount,
        createdAt: new Date().toISOString(),
      }
      const pdfContent = content || '<p>Sin contenido</p>'

      let finalDocument
      if (documentId) {
        finalDocument = await updateDocumentContent(documentId, {
          content: pdfContent,
          metadata: { ...metadata, modifiedAt: new Date().toISOString() },
          relatedAccount: selectedAccount,
          chatHistory,
          appliedMods,
          saveVersion: true,
          changeDescription: 'Guardado manual'
        })
        setSavedContent(pdfContent)
        setVersions(finalDocument.versions || [])
      } else {
        finalDocument = await createDocument({
          type,
          metadata,
          pdfContent: {
            title,
            subtitle: description,
            sections: [
              { title: 'Contenido', content: pdfContent, isTable: false },
            ],
          },
          relatedAccount: selectedAccount,
        })
        // Añadir versión inicial
        finalDocument = await updateDocumentContent(finalDocument.documentId, {
          content: pdfContent,
          metadata: finalDocument.metadata,
          saveVersion: true,
          changeDescription: 'Versión inicial'
        })
        setVersions(finalDocument.versions || [])
      }

      // Encriptar si se solicita
      if (encrypt) {
        if (!encryptPassword.trim()) {
          setEncryptDialogOpen(true)
          return
        }

        finalDocument = await encryptDocument(finalDocument, encryptPassword)
        toast.success('Documento encriptado y guardado')
      } else {
        toast.success('Documento guardado exitosamente')
      }

      // Navegar al detalle del documento
      navigate(`/documents/${finalDocument.documentId}`)
    } catch (error) {
      console.error('[Document Editor] Error al guardar:', error)
      toast.error(
        error instanceof Error ? error.message : 'Error al guardar el documento'
      )
    } finally {
      setSaving(false)
    }
  }

  const handleEncryptConfirm = async () => {
    if (!encryptPassword.trim()) {
      toast.error('Por favor ingresa una contraseña')
      return
    }

    setEncryptDialogOpen(false)
    await handleSave()
  }

  if (loading) {
    return (
      <div className="container mx-auto p-4">
        <div className="flex items-center justify-center min-h-[400px]">
          <p className="text-muted-foreground">Cargando documento...</p>
        </div>
      </div>
    )
  }

  const headerCollapsed = layoutCtx?.headerCollapsed ?? false

  return (
    <>
    <div className="fixed inset-0 flex flex-col bg-background z-10">
      {/* Barra de herramientas */}
      <div
        className={`flex items-center gap-1 sm:gap-2 border-b shrink-0 transition-all ${
          headerCollapsed ? 'px-2 py-1' : 'px-3 sm:px-4 py-2'
        }`}
      >
        <Button
          variant="ghost"
          size="icon"
          onClick={() => layoutCtx?.toggleSidebar()}
          className="flex-shrink-0 h-8 w-8"
          title="Mostrar menú"
        >
          <Menu className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => navigate('/documents')}
          className="flex-shrink-0 h-8 w-8"
          title="Volver"
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        {!headerCollapsed && (
          <>
            <div className="flex-1 min-w-0 px-2 lg:px-4">
              <input
                className="w-full bg-transparent border-none focus:ring-0 text-sm sm:text-base font-semibold truncate hover:bg-muted/30 rounded px-1 transition-colors outline-none"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                onBlur={() => handleSave()}
                placeholder="Título del documento"
              />
              <p className="text-[10px] text-muted-foreground truncate px-1">
                {isEditing ? 'Editar' : 'Nuevo documento'}
              </p>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setAgentOpen(true)}
              className="flex-shrink-0 h-8 w-8"
              title="Asistente IA"
            >
              <Bot className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setMetadataModalOpen(true)}
              className="flex-shrink-0 h-8 w-8"
              title="Información"
            >
              <Info className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setHistoryModalOpen(true)}
              className="flex-shrink-0 h-8 w-8"
              title="Historial de cambios"
            >
              <History className="h-4 w-4" />
            </Button>
          </>
        )}
        <Button
          variant={liveDiffEnabled ? "secondary" : "ghost"}
          size="icon"
          onClick={() => setLiveDiffEnabled(!liveDiffEnabled)}
          className={`flex-shrink-0 h-8 w-8 ${liveDiffEnabled ? 'text-primary' : ''}`}
          title={liveDiffEnabled ? "Ocultar cambios en vivo" : "Ver cambios en vivo (Diff)"}
        >
          <GitCompare className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => layoutCtx?.toggleHeader()}
          className="flex-shrink-0 h-8 w-8"
          title={headerCollapsed ? 'Mostrar barra' : 'Ocultar barra'}
        >
          {headerCollapsed ? (
            <PanelTop className="h-4 w-4" />
          ) : (
            <PanelTopClose className="h-4 w-4" />
          )}
        </Button>
        {!headerCollapsed && (
          <div className="flex gap-2 ml-2">
            <Button variant="outline" size="sm" onClick={() => navigate('/documents')}>
              Cancelar
            </Button>
            <Button size="sm" onClick={handleSave} disabled={saving}>
              <Save className="h-4 w-4 mr-1" />
              {saving ? '...' : 'Guardar'}
            </Button>
          </div>
        )}
      </div>

      {/* Contenedor Principal con Layout Flexible */}
      <div className="flex-1 flex overflow-hidden relative w-full h-full">
        {/* Editor estilo Página */}
        <div 
          className="flex-1 overflow-y-auto transition-all duration-300 ease-in-out bg-muted/40"
        >
          <div className="p-4 sm:p-6 lg:p-10 min-h-full">
            <div className="mx-auto max-w-[850px] min-h-[1056px] bg-background shadow-xl border rounded-sm p-4 sm:p-12 mb-32">
              {liveDiffEnabled ? (
                <div className="min-h-[300px]">
                  <div className="flex items-center justify-between mb-4 border-b pb-2">
                    <h3 className="text-sm font-bold flex items-center gap-2">
                      <GitCompare className="h-4 w-4" /> 
                      Cambios sin guardar
                    </h3>
                    <Button variant="ghost" size="sm" onClick={() => setLiveDiffEnabled(false)} className="h-7 text-[10px]">
                      <Eye className="h-3 w-3 mr-1" /> Volver al editor
                    </Button>
                  </div>
                  <DiffViewer oldValue={savedContent} newValue={content} />
                </div>
              ) : (
                <RichTextEditor
                  value={content}
                  onChange={setContent}
                  placeholder="Escribe el contenido del documento aquí..."
                  editorApiRef={editorApiRef}
                />
              )}
            </div>
          </div>
          {headerCollapsed && (
            <div className="flex items-center justify-end gap-2 px-4 py-2 border-t bg-background sticky bottom-0 z-10">
              <Button variant="outline" size="sm" onClick={() => navigate('/documents')}>
                Cancelar
              </Button>
              <Button size="sm" onClick={handleSave} disabled={saving}>
                <Save className="h-4 w-4 mr-1" />
                {saving ? '...' : 'Guardar'}
              </Button>
            </div>
          )}
        </div>

        {/* Agente: siempre montado para conservar el hilo al cerrar el panel; oculto cuando no está abierto */}
        <aside
          className={cn(
            'w-full lg:w-[500px] border-l bg-background flex-col shadow-2xl z-40 shrink-0',
            agentOpen ? 'flex animate-in slide-in-from-right duration-300' : 'hidden'
          )}
        >
            <DocumentEditorAgent
              open={agentOpen}
              onOpenChange={handleAgentOpenChange}
              documentId={documentId}
              chatSessionKey={chatSessionKey}
              initialMessages={chatHistory}
              appliedMods={appliedMods}
              onAppliedModsChange={setAppliedMods}
              onMessagesChange={(msgs) => {
                setChatHistory(msgs)
              }}
              documentContext={{
                title,
                type,
                description,
                contentPlain: content ? (() => {
                  const div = document.createElement('div')
                  div.innerHTML = content
                  return (div.textContent || div.innerText || '').trim()
                })() : '',
              }}
              editorApiRef={editorApiRef}
              onContentChange={async (newContent, desc) => {
                setContent(newContent)
                if (documentId) {
                  try {
                    const metadata = {
                      title,
                      description,
                      author: selectedAccount,
                    }
                    const updated = await updateDocumentContent(documentId, {
                      content: newContent,
                      metadata,
                      chatHistory,
                      appliedMods,
                      saveVersion: true,
                      changeDescription: desc
                    })
                    setVersions(updated.versions || [])
                  } catch (err) {
                    console.error('[Document Editor] Error auto-saving AI change:', err)
                  }
                }
              }}
            />
        </aside>
      </div>
    </div>

      {/* Modal de metadata */}
      <Dialog open={metadataModalOpen} onOpenChange={setMetadataModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Información del Documento</DialogTitle>
            <DialogDescription>
              Configura título, tipo, descripción y autor
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="modal-title">Título *</Label>
              <Input
                id="modal-title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Título del documento"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="modal-type">Tipo de Documento</Label>
              <Select value={type} onValueChange={(v) => setType(v as DocumentType)}>
                <SelectTrigger id="modal-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="generic">Genérico</SelectItem>
                  <SelectItem value="contract">Contrato</SelectItem>
                  <SelectItem value="flight_log">Registro de Vuelo</SelectItem>
                  <SelectItem value="medical_record">Registro Médico</SelectItem>
                  <SelectItem value="attestation">Atestación</SelectItem>
                  <SelectItem value="other">Otro</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="modal-description">Descripción</Label>
              <Textarea
                id="modal-description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Descripción del documento"
                rows={3}
              />
            </div>
            <div className="flex items-center space-x-2">
              <input
                type="checkbox"
                id="modal-encrypt"
                checked={encrypt}
                onChange={(e) => setEncrypt(e.target.checked)}
                className="rounded border-gray-300"
              />
              <Label htmlFor="modal-encrypt" className="cursor-pointer text-sm">
                Encriptar documento con contraseña
              </Label>
            </div>
            <div className="space-y-2">
              <Label htmlFor="modal-account">Autor *</Label>
              <Select value={selectedAccount} onValueChange={setSelectedAccount}>
                <SelectTrigger id="modal-account">
                  <SelectValue placeholder="Selecciona una cuenta">
                    {selectedAccount && (
                      <div className="flex items-center gap-2">
                        <Identicon value={selectedAccount} size={16} theme="polkadot" />
                        <span>
                          {accounts.find(a => a.address === selectedAccount)?.meta?.name ||
                            `${selectedAccount.slice(0, 8)}...${selectedAccount.slice(-6)}`}
                        </span>
                      </div>
                    )}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {accounts.map((account) => (
                    <SelectItem key={account.address} value={account.address}>
                      <div className="flex items-center gap-2">
                        <Identicon value={account.address} size={16} theme="polkadot" />
                        <div className="flex flex-col">
                          <span className="font-medium">{account.meta?.name || 'Sin nombre'}</span>
                          <span className="text-xs text-muted-foreground">
                            {account.address.slice(0, 8)}...{account.address.slice(-6)}
                          </span>
                        </div>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Dialog para contraseña de encriptación */}
      <Dialog open={encryptDialogOpen} onOpenChange={setEncryptDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Encriptar Documento</DialogTitle>
            <DialogDescription>
              Ingresa una contraseña para encriptar el documento. Esta contraseña será necesaria para desencriptarlo.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="encrypt-password">Contraseña *</Label>
              <Input
                id="encrypt-password"
                type="password"
                value={encryptPassword}
                onChange={(e) => setEncryptPassword(e.target.value)}
                placeholder="Contraseña de encriptación"
              />
            </div>
            <div className="flex gap-2 justify-end">
              <Button
                variant="outline"
                onClick={() => {
                  setEncryptDialogOpen(false)
                  setEncryptPassword('')
                }}
              >
                Cancelar
              </Button>
              <Button onClick={handleEncryptConfirm}>
                Confirmar
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Modal de Historial */}
      <Dialog open={historyModalOpen} onOpenChange={(open) => {
        setHistoryModalOpen(open)
        if (!open) setPreviewVersion(null)
      }}>
        <DialogContent className="sm:max-w-2xl max-h-[85vh] flex flex-col p-0 overflow-hidden">
          <DialogHeader className="p-6 pb-2">
            <DialogTitle className="flex items-center gap-2 text-xl">
              <History className="h-6 w-6 text-primary" />
              Historial de versiones
            </DialogTitle>
            <DialogDescription>
              Compara y restaura estados anteriores de tu documento
            </DialogDescription>
          </DialogHeader>
          
          <div className="flex-1 flex flex-col md:flex-row min-h-0 divide-y md:divide-y-0 md:divide-x border-t">
            {/* Lista de versiones */}
            <div className="w-full md:w-72 overflow-y-auto p-4 space-y-3 bg-muted/20">
              {versions.length === 0 ? (
                <p className="text-center text-muted-foreground py-8 italic text-sm">
                  No hay versiones guardadas todavía.
                </p>
              ) : (
                [...versions].reverse().map((v) => (
                  <button
                    key={v.version}
                    onClick={() => setPreviewVersion(v)}
                    className={`w-full flex flex-col text-left p-3 rounded-xl border transition-all ${
                      previewVersion?.version === v.version 
                        ? 'bg-primary/10 border-primary ring-1 ring-primary/20' 
                        : 'bg-background hover:bg-muted/50 border-border'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-primary opacity-80">
                        V{v.version}
                      </span>
                      <span className="text-[10px] text-muted-foreground">
                        {new Date(v.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                    <p className="text-sm font-semibold truncate leading-tight mb-0.5">
                      {v.changes || 'Cambio sin título'}
                    </p>
                    <p className="text-[10px] text-muted-foreground">
                      {new Date(v.createdAt).toLocaleDateString()}
                    </p>
                  </button>
                ))
              )}
            </div>

            {/* Panel de previsualización */}
            <div className="flex-1 flex flex-col min-h-0 bg-background">
              {previewVersion ? (
                <>
                  <div className="p-3 border-b bg-muted/5 flex items-center justify-between shrink-0">
                    <div className="min-w-0 pr-4">
                      <h3 className="text-sm font-bold truncate">{previewVersion.title || 'Sin título'}</h3>
                      <p className="text-[10px] text-muted-foreground">Previsualizando versión {previewVersion.version}</p>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant={showDiff ? "secondary" : "outline"}
                        className="h-8"
                        onClick={() => setShowDiff(!showDiff)}
                      >
                        <GitCompare className="h-3.5 w-3.5 mr-1.5" />
                        {showDiff ? 'Vista limpia' : 'Comparar'}
                      </Button>
                      <Button 
                        size="sm" 
                        className="h-8 shadow-sm"
                        onClick={async () => {
                          if (window.confirm('¿Restaurar esta versión? Se perderán los cambios actuales.')) {
                            setContent(previewVersion.contentHtml || '')
                            setTitle(previewVersion.title || title)
                            setSavedContent(previewVersion.contentHtml || '')
                            setHistoryModalOpen(false)
                            setPreviewVersion(null)
                            toast.success(`Versión ${previewVersion.version} restaurada`)
                          }
                        }}
                      >
                        <RotateCcw className="h-3.5 w-3.5 mr-1.5" />
                        Restaurar
                      </Button>
                    </div>
                  </div>
                  <div className="flex-1 overflow-y-auto p-6 bg-background custom-preview-container">
                    {/* Renderizado del HTML de la versión o Diff */}
                    {showDiff ? (
                      <DiffViewer oldValue={content} newValue={previewVersion.contentHtml || ''} />
                    ) : (
                      <div 
                        className="text-foreground text-sm leading-relaxed"
                        dangerouslySetInnerHTML={{ 
                          __html: previewVersion.contentHtml || 
                          `<div class="flex flex-col items-center justify-center py-12 text-muted-foreground">
                            <p class="italic">Esta versión no contiene datos de texto editable.</p>
                            <p class="text-[10px] mt-2">Probablemente fue creada antes de activar el historial de contenido.</p>
                           </div>` 
                        }} 
                      />
                    )}
                    <style>{`
                      .custom-preview-container h1 { font-size: 1.5rem; font-weight: bold; margin-bottom: 0.5rem; }
                      .custom-preview-container h2 { font-size: 1.25rem; font-weight: bold; margin-bottom: 0.5rem; }
                      .custom-preview-container p { margin-bottom: 0.5rem; }
                      .custom-preview-container ul { list-style-type: disc; margin-left: 1.5rem; margin-bottom: 0.5rem; }
                      .custom-preview-container ol { list-style-type: decimal; margin-left: 1.5rem; margin-bottom: 0.5rem; }
                      .custom-preview-container img { max-width: 100%; height: auto; border-radius: 0.25rem; }
                    `}</style>
                  </div>
                </>
              ) : (
                <div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-muted-foreground opacity-60">
                  <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
                    <History className="h-8 w-8" />
                  </div>
                  <p className="max-w-[200px] text-sm font-medium">
                    Selecciona una versión de la lista para ver su contenido
                  </p>
                </div>
              )}
            </div>
          </div>
          
          <div className="p-4 border-t flex justify-end bg-muted/10 shrink-0">
            <Button variant="ghost" size="sm" onClick={() => setHistoryModalOpen(false)}>
              Cerrar
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}

