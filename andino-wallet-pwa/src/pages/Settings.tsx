import { useState, useEffect, useCallback } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Plus, Edit, Trash2, Save, ExternalLink, Key, Globe, Shield, Bot, Check } from 'lucide-react'
import { useNetwork } from '@/contexts/NetworkContext'
import { useActiveAccount } from '@/contexts/ActiveAccountContext'
import { NetworkSwitcher } from '@/components/NetworkSwitcher'
import { DkgNetworkSwitcher } from '@/components/DkgNetworkSwitcher'
import { WebAuthnCredentialsManager } from '@/components/WebAuthnCredentialsManager'
import { DatabaseManager } from '@/components/DatabaseManager'
import { BackupManager } from '@/components/BackupManager'
import {
  getAllLLMConfigs,
  saveLLMConfig,
  deleteLLMConfig,
  setActiveLLMConfig,
  getDefaultEndpoint,
  type LLMApiConfig,
  type LLMProvider,
} from '@/config/llmConfig'

interface ApiConfig {
  id: string
  name: string
  baseUrl: string
  apiKey?: string
  description?: string
  type: 'credential' | 'medical' | 'attestation' | 'other'
  enabled: boolean
  createdAt: number
  updatedAt: number
}

// Simulación de almacenamiento (temporal, hasta que se implemente la DB completa)
const API_CONFIGS_STORAGE_KEY = 'andino-wallet-api-configs'

function useApiConfigsStorage() {
  const [configs, setConfigs] = useState<ApiConfig[]>([])

  useEffect(() => {
    const stored = localStorage.getItem(API_CONFIGS_STORAGE_KEY)
    if (stored) {
      try {
        setConfigs(JSON.parse(stored))
      } catch (e) {
        console.error('Error loading API configs:', e)
      }
    }
  }, [])

  const saveConfigs = (newConfigs: ApiConfig[]) => {
    setConfigs(newConfigs)
    localStorage.setItem(API_CONFIGS_STORAGE_KEY, JSON.stringify(newConfigs))
  }

  const addConfig = (config: Omit<ApiConfig, 'id' | 'createdAt' | 'updatedAt'>) => {
    const newConfig: ApiConfig = {
      ...config,
      id: `api-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    }
    const updated = [...configs, newConfig]
    saveConfigs(updated)
    return newConfig
  }

  const updateConfig = (id: string, updates: Partial<ApiConfig>) => {
    const updated = configs.map(c =>
      c.id === id ? { ...c, ...updates, updatedAt: Date.now() } : c
    )
    saveConfigs(updated)
  }

  const deleteConfig = (id: string) => {
    const updated = configs.filter(c => c.id !== id)
    saveConfigs(updated)
  }

  return {
    configs,
    addConfig,
    updateConfig,
    deleteConfig,
  }
}

function LLMSettingsSection() {
  const [configs, setConfigs] = useState<LLMApiConfig[]>([])
  const [llmDialogOpen, setLlmDialogOpen] = useState(false)
  const [editingLlm, setEditingLlm] = useState<LLMApiConfig | null>(null)
  const [llmForm, setLlmForm] = useState({
    name: '',
    provider: 'openai' as LLMProvider,
    apiKey: '',
    endpoint: '',
    proxyUrl: '',
    model: '',
    isActive: false,
  })

  const loadConfigs = useCallback(async () => {
    const list = await getAllLLMConfigs()
    setConfigs(list)
  }, [])

  useEffect(() => {
    loadConfigs()
  }, [loadConfigs])

  const handleOpenLlmDialog = (config?: LLMApiConfig) => {
    if (config) {
      setEditingLlm(config)
      setLlmForm({
        name: config.name,
        provider: config.provider,
        apiKey: config.apiKey,
        endpoint: config.endpoint || getDefaultEndpoint(config.provider),
        proxyUrl: config.proxyUrl || '',
        model: config.model || '',
        isActive: config.isActive,
      })
    } else {
      setEditingLlm(null)
      setLlmForm({
        name: '',
        provider: 'openai',
        apiKey: '',
        endpoint: getDefaultEndpoint('openai'),
        proxyUrl: '',
        model: '',
        isActive: configs.length === 0,
      })
    }
    setLlmDialogOpen(true)
  }

  const handleCloseLlmDialog = () => {
    setLlmDialogOpen(false)
    setEditingLlm(null)
  }

  const handleSaveLlm = async (e: React.FormEvent) => {
    e.preventDefault()
    const apiKey = llmForm.apiKey.trim() || editingLlm?.apiKey
    if (!llmForm.name.trim() || !apiKey) return

    const cfg: LLMApiConfig = {
      id: editingLlm?.id ?? `llm-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
      provider: llmForm.provider,
      name: llmForm.name.trim(),
      apiKey,
      endpoint: llmForm.endpoint.trim() || undefined,
      proxyUrl: llmForm.proxyUrl.trim() || undefined,
      model: llmForm.model.trim() || undefined,
      isActive: llmForm.isActive,
      createdAt: editingLlm?.createdAt ?? Date.now(),
      updatedAt: Date.now(),
    }
    await saveLLMConfig(cfg)
    if (cfg.isActive) await setActiveLLMConfig(cfg.id)
    await loadConfigs()
    handleCloseLlmDialog()
  }

  const handleDeleteLlm = async (id: string) => {
    if (!confirm('¿Eliminar esta configuración de IA?')) return
    await deleteLLMConfig(id)
    await loadConfigs()
  }

  const handleSetActive = async (id: string) => {
    await setActiveLLMConfig(id)
    await loadConfigs()
  }

  const providerLabels: Record<LLMProvider, string> = {
    openai: 'OpenAI (GPT)',
    anthropic: 'Anthropic (Claude)',
    gemini: 'Google Gemini',
    custom: 'Custom',
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Bot className="h-5 w-5" />
              APIs de IA (LLM)
            </CardTitle>
            <CardDescription>
              Configura APIs para que el Agente Guía use IA en lugar de plantillas fijas
            </CardDescription>
          </div>
          <Dialog open={llmDialogOpen} onOpenChange={setLlmDialogOpen}>
            <DialogTrigger asChild>
              <Button onClick={() => handleOpenLlmDialog()}>
                <Plus className="mr-2 h-4 w-4" />
                Agregar API
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle>{editingLlm ? 'Editar API de IA' : 'Nueva API de IA'}</DialogTitle>
                <DialogDescription>
                  OpenAI, Anthropic o endpoint compatible. Las claves se guardan localmente.
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleSaveLlm} className="space-y-4">
                <div className="space-y-2">
                  <Label>Nombre *</Label>
                  <Input
                    value={llmForm.name}
                    onChange={(e) => setLlmForm({ ...llmForm, name: e.target.value })}
                    placeholder="Ej: Mi OpenAI"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label>Proveedor *</Label>
                  <select
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    value={llmForm.provider}
                    onChange={(e) => {
                      const p = e.target.value as LLMProvider
                      setLlmForm({
                        ...llmForm,
                        provider: p,
                        endpoint: getDefaultEndpoint(p),
                      })
                    }}
                  >
                    <option value="openai">OpenAI (GPT)</option>
                    <option value="anthropic">Anthropic (Claude)</option>
                    <option value="gemini">Google Gemini</option>
                    <option value="custom">Custom</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <Label>API Key {editingLlm ? '(dejar vacío para mantener)' : '*'}</Label>
                  <Input
                    type="password"
                    value={llmForm.apiKey}
                    onChange={(e) => setLlmForm({ ...llmForm, apiKey: e.target.value })}
                    placeholder={editingLlm ? '••••••••' : 'sk-...'}
                    required={!editingLlm}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Endpoint (opcional)</Label>
                  <Input
                    value={llmForm.endpoint}
                    onChange={(e) => setLlmForm({ ...llmForm, endpoint: e.target.value })}
                    placeholder={getDefaultEndpoint(llmForm.provider)}
                  />
                </div>
                {llmForm.provider === 'gemini' && (
                  <div className="space-y-2">
                    <Label>Proxy URL (para GitHub Pages / evita CORS)</Label>
                    <Input
                      value={llmForm.proxyUrl}
                      onChange={(e) => setLlmForm({ ...llmForm, proxyUrl: e.target.value })}
                      placeholder="https://tu-servidor.com/api/llm-proxy"
                    />
                    <p className="text-xs text-muted-foreground">
                      La API de Gemini no soporta CORS desde el navegador. Despliega el servidor (yarn c2pa-server) y pon aquí su URL + /api/llm-proxy
                    </p>
                  </div>
                )}
                <div className="space-y-2">
                  <Label>Modelo (opcional)</Label>
                  <Input
                    value={llmForm.model}
                    onChange={(e) => setLlmForm({ ...llmForm, model: e.target.value })}
                    placeholder={
                      llmForm.provider === 'openai'
                        ? 'gpt-4o-mini'
                        : llmForm.provider === 'gemini'
                          ? 'gemini-2.0-flash'
                          : 'claude-3-5-haiku-20241022'
                    }
                  />
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="llm-active"
                    checked={llmForm.isActive}
                    onChange={(e) => setLlmForm({ ...llmForm, isActive: e.target.checked })}
                    className="rounded border-gray-300"
                  />
                  <Label htmlFor="llm-active" className="cursor-pointer">Usar como activa</Label>
                </div>
                <div className="flex gap-2 justify-end">
                  <Button type="button" variant="outline" onClick={handleCloseLlmDialog}>Cancelar</Button>
                  <Button type="submit"><Save className="mr-2 h-4 w-4" />Guardar</Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>
      <CardContent>
        {configs.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <p className="mb-4">No hay APIs de IA configuradas</p>
            <Button onClick={() => handleOpenLlmDialog()}>
              <Plus className="mr-2 h-4 w-4" />
              Agregar primera API
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            {configs.map((c) => (
              <div
                key={c.id}
                className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors"
              >
                <div className="flex items-center gap-4 flex-1 min-w-0">
                  <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                    <Bot className="h-5 w-5 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-semibold truncate">{c.name}</h3>
                      {c.isActive && (
                        <Badge variant="default" className="gap-1">
                          <Check className="h-3 w-3" /> Activa
                        </Badge>
                      )}
                      <Badge variant="outline">{providerLabels[c.provider]}</Badge>
                    </div>
                    <p className="text-sm text-muted-foreground truncate">
                      {c.endpoint || getDefaultEndpoint(c.provider)} • {c.model || 'default'}
                    </p>
                  </div>
                </div>
                <div className="flex gap-2 flex-shrink-0">
                  {!c.isActive && (
                    <Button variant="outline" size="sm" onClick={() => handleSetActive(c.id)}>
                      Activar
                    </Button>
                  )}
                  <Button variant="outline" size="sm" onClick={() => handleOpenLlmDialog(c)}>
                    <Edit className="h-4 w-4" />
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => handleDeleteLlm(c.id)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
        <Alert className="mt-4">
          <Shield className="h-4 w-4" />
          <AlertDescription>
            Las API keys se almacenan solo en tu dispositivo. El Agente Guía las usa para generar
            explicaciones personalizadas antes de acciones sensibles (emergencias, publicar en DKG, etc.).
          </AlertDescription>
        </Alert>
      </CardContent>
    </Card>
  )
}

function NetworkSwitcherInSettings() {
  const { selectedChain, setSelectedChain, isConnecting } = useNetwork()
  const { activeAccount } = useActiveAccount()
  return (
    <NetworkSwitcher
      selectedChain={selectedChain}
      onSelectChain={setSelectedChain}
      isConnecting={isConnecting}
      activeAccountAddress={activeAccount}
    />
  )
}

export default function Settings() {
  const { configs, addConfig, updateConfig, deleteConfig } = useApiConfigsStorage()
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [editingConfig, setEditingConfig] = useState<ApiConfig | null>(null)
  const [formData, setFormData] = useState({
    name: '',
    baseUrl: '',
    apiKey: '',
    description: '',
    type: 'credential' as ApiConfig['type'],
    enabled: true,
  })

  const handleOpenDialog = (config?: ApiConfig) => {
    if (config) {
      setEditingConfig(config)
      setFormData({
        name: config.name,
        baseUrl: config.baseUrl,
        apiKey: config.apiKey || '',
        description: config.description || '',
        type: config.type,
        enabled: config.enabled,
      })
    } else {
      setEditingConfig(null)
      setFormData({
        name: '',
        baseUrl: '',
        apiKey: '',
        description: '',
        type: 'credential',
        enabled: true,
      })
    }
    setIsDialogOpen(true)
  }

  const handleCloseDialog = () => {
    setIsDialogOpen(false)
    setEditingConfig(null)
    setFormData({
      name: '',
      baseUrl: '',
      apiKey: '',
      description: '',
      type: 'credential',
      enabled: true,
    })
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()

    if (!formData.name.trim() || !formData.baseUrl.trim()) {
      return
    }

    if (editingConfig) {
      updateConfig(editingConfig.id, {
        name: formData.name.trim(),
        baseUrl: formData.baseUrl.trim(),
        apiKey: formData.apiKey.trim() || undefined,
        description: formData.description.trim() || undefined,
        type: formData.type,
        enabled: formData.enabled,
      })
    } else {
      addConfig({
        name: formData.name.trim(),
        baseUrl: formData.baseUrl.trim(),
        apiKey: formData.apiKey.trim() || undefined,
        description: formData.description.trim() || undefined,
        type: formData.type,
        enabled: formData.enabled,
      })
    }

    handleCloseDialog()
  }

  const getTypeLabel = (type: ApiConfig['type']) => {
    const labels = {
      credential: 'Credenciales',
      medical: 'Registro Médico',
      attestation: 'Atestación',
      other: 'Otro',
    }
    return labels[type]
  }

  const getTypeIcon = (type: ApiConfig['type']) => {
    switch (type) {
      case 'credential':
        return <Key className="h-4 w-4" />
      case 'medical':
        return <Shield className="h-4 w-4" />
      case 'attestation':
        return <Globe className="h-4 w-4" />
      default:
        return <ExternalLink className="h-4 w-4" />
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Configuración</h1>
        <p className="text-muted-foreground mt-2">
          Gestiona la configuración de Nelai
        </p>
      </div>

      <Tabs defaultValue="general" className="space-y-4">
        <TabsList>
          <TabsTrigger value="general">General</TabsTrigger>
          <TabsTrigger value="apis">APIs Externas</TabsTrigger>
          <TabsTrigger value="llm">IA (LLM)</TabsTrigger>
          <TabsTrigger value="security">Seguridad</TabsTrigger>
        </TabsList>

        {/* APIs Externas */}
        <TabsContent value="apis" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>APIs Externas</CardTitle>
                  <CardDescription>
                    Configura las APIs para conectarte con servicios externos de credenciales,
                    registros médicos y atestaciones
                  </CardDescription>
                </div>
                <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                  <DialogTrigger asChild>
                    <Button onClick={() => handleOpenDialog()}>
                      <Plus className="mr-2 h-4 w-4" />
                      Agregar API
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-2xl max-h-[90vh] sm:max-h-[85vh] overflow-y-auto mx-4 sm:mx-0">
                    <DialogHeader>
                      <DialogTitle>
                        {editingConfig ? 'Editar API' : 'Nueva API'}
                      </DialogTitle>
                      <DialogDescription>
                        {editingConfig
                          ? 'Modifica la configuración de la API'
                          : 'Agrega una nueva API externa para interactuar con servicios de credenciales, registros médicos o atestaciones'}
                      </DialogDescription>
                    </DialogHeader>
                    <form onSubmit={handleSubmit} className="space-y-4">
                      <div className="space-y-2">
                        <Label htmlFor="name">Nombre *</Label>
                        <Input
                          id="name"
                          value={formData.name}
                          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                          placeholder="Nombre del servicio"
                          required
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="baseUrl">URL Base *</Label>
                        <Input
                          id="baseUrl"
                          type="url"
                          value={formData.baseUrl}
                          onChange={(e) => setFormData({ ...formData, baseUrl: e.target.value })}
                          placeholder="https://api.example.com"
                          required
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="apiKey">API Key (Opcional)</Label>
                        <Input
                          id="apiKey"
                          type="password"
                          value={formData.apiKey}
                          onChange={(e) => setFormData({ ...formData, apiKey: e.target.value })}
                          placeholder="Tu API key"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="type">Tipo de API *</Label>
                        <select
                          id="type"
                          className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                          value={formData.type}
                          onChange={(e) => setFormData({ ...formData, type: e.target.value as ApiConfig['type'] })}
                          required
                        >
                          <option value="credential">Credenciales</option>
                          <option value="medical">Registro Médico</option>
                          <option value="attestation">Atestación</option>
                          <option value="other">Otro</option>
                        </select>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="description">Descripción (Opcional)</Label>
                        <Input
                          id="description"
                          value={formData.description}
                          onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                          placeholder="Descripción del servicio"
                        />
                      </div>
                      <div className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          id="enabled"
                          checked={formData.enabled}
                          onChange={(e) => setFormData({ ...formData, enabled: e.target.checked })}
                          className="rounded border-gray-300"
                        />
                        <Label htmlFor="enabled" className="cursor-pointer">
                          Habilitado
                        </Label>
                      </div>
                      <div className="flex gap-2 justify-end">
                        <Button type="button" variant="outline" onClick={handleCloseDialog}>
                          Cancelar
                        </Button>
                        <Button type="submit">
                          <Save className="mr-2 h-4 w-4" />
                          {editingConfig ? 'Guardar Cambios' : 'Agregar API'}
                        </Button>
                      </div>
                    </form>
                  </DialogContent>
                </Dialog>
              </div>
            </CardHeader>
            <CardContent>
              {configs.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <p className="mb-4">No hay APIs configuradas aún</p>
                  <Button onClick={() => handleOpenDialog()}>
                    <Plus className="mr-2 h-4 w-4" />
                    Agregar Primera API
                  </Button>
                </div>
              ) : (
                <div className="space-y-3">
                  {configs.map((config) => (
                    <div
                      key={config.id}
                      className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors"
                    >
                      <div className="flex items-center gap-4 flex-1 min-w-0">
                        <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                          {getTypeIcon(config.type)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <h3 className="font-semibold truncate">{config.name}</h3>
                            <Badge variant={config.enabled ? 'default' : 'secondary'}>
                              {config.enabled ? 'Habilitado' : 'Deshabilitado'}
                            </Badge>
                            <Badge variant="outline">{getTypeLabel(config.type)}</Badge>
                          </div>
                          <p className="text-sm text-muted-foreground truncate">
                            {config.baseUrl}
                          </p>
                          {config.description && (
                            <p className="text-xs text-muted-foreground mt-1 truncate">
                              {config.description}
                            </p>
                          )}
                        </div>
                      </div>
                      <div className="flex gap-2 flex-shrink-0">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleOpenDialog(config)}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            if (confirm('¿Estás seguro de eliminar esta API?')) {
                              deleteConfig(config.id)
                            }
                          }}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Alert>
            <Shield className="h-4 w-4" />
            <AlertDescription>
              <strong>Seguridad:</strong> Las API keys se almacenan localmente en tu dispositivo
              y nunca se comparten con terceros. Asegúrate de usar conexiones HTTPS para todas las APIs.
            </AlertDescription>
          </Alert>
        </TabsContent>

        {/* IA (LLM) */}
        <TabsContent value="llm" className="space-y-4">
          <LLMSettingsSection />
        </TabsContent>

        {/* General */}
        <TabsContent value="general" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Red Substrate</CardTitle>
              <CardDescription>
                Selecciona la red blockchain para transacciones y consultas
              </CardDescription>
            </CardHeader>
            <CardContent>
              <NetworkSwitcherInSettings />
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Red DKG (Nelai)</CardTitle>
              <CardDescription>
                Red OriginTrail para publicar y consultar evidencias. Usa clave EVM derivada de tu cuenta.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <DkgNetworkSwitcher />
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Configuración General</CardTitle>
              <CardDescription>
                Ajustes generales de la aplicación
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Idioma</Label>
                <select className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
                  <option value="es">Español</option>
                  <option value="en">English</option>
                </select>
              </div>
              <div className="space-y-2">
                <Label>Moneda de Visualización</Label>
                <select className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
                  <option value="USD">USD ($)</option>
                  <option value="EUR">EUR (€)</option>
                  <option value="DOT">DOT</option>
                </select>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Seguridad */}
        <TabsContent value="security" className="space-y-4">
          <WebAuthnCredentialsManager />

          <Card data-section="backup">
            <CardHeader>
              <CardTitle>Backup e Importación</CardTitle>
              <CardDescription>
                Exporta o importa todos tus datos
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <BackupManager />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Datos y Almacenamiento</CardTitle>
              <CardDescription>
                Gestiona los datos almacenados localmente en tu dispositivo
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <DatabaseManager />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
