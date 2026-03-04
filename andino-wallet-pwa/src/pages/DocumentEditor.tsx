/**
 * Página para editar documentos antes de generar PDF
 */

import { useState, useEffect, useRef } from 'react'
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
import { useKeyringContext } from '@/contexts/KeyringContext'
import { createDocument, updateDocumentContent } from '@/services/documents/DocumentService'
import { getDocument } from '@/utils/documentStorage'
import { toast } from 'sonner'
import { ArrowLeft, Save, Bot, Info, Menu, PanelTopClose, PanelTop } from 'lucide-react'
import type { Document, DocumentType } from '@/types/documents'
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

export default function DocumentEditor() {
  const { documentId } = useParams<{ documentId: string }>()
  const navigate = useNavigate()
  const { accounts } = useKeyringContext()
  const layoutCtx = useDocumentEditorLayout()

  const [isEditing, setIsEditing] = useState(!!documentId)
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
  const [agentOpen, setAgentOpen] = useState(false)
  const editorApiRef = useRef<EditorApi | null>(null)

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
      setContent((doc.metadata.contentHtml as string) || '')
      setEncrypt(doc.encrypted || false)
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
          metadata,
          relatedAccount: selectedAccount,
        })
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
            <div className="flex-1 min-w-0">
              <h1 className="text-sm sm:text-base font-semibold truncate">
                {title || 'Sin título'}
              </h1>
              <p className="text-xs text-muted-foreground truncate">
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
          </>
        )}
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

      {/* Editor */}
      <div className="flex-1 overflow-hidden flex flex-col min-h-0">
        <div className="flex-1 overflow-y-auto p-2 sm:p-3">
          <div className="w-full min-h-[calc(100vh-120px)]">
            <RichTextEditor
              value={content}
              onChange={setContent}
              placeholder="Escribe el contenido del documento aquí..."
              editorApiRef={editorApiRef}
            />
          </div>
        </div>
        {headerCollapsed && (
          <div className="flex items-center justify-end gap-2 px-2 py-1 border-t shrink-0">
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

      <DocumentEditorAgent
        open={agentOpen}
        onOpenChange={setAgentOpen}
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
      />
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
    </>
  )
}

