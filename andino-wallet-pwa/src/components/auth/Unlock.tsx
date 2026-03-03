import { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { useKeyringContext } from '@/contexts/KeyringContext'
import { Lock, Fingerprint, Eye, EyeOff } from 'lucide-react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'

export function Unlock() {
  const { unlock, unlockWithWebAuthn, hasWebAuthnCredentials, accounts: webauthnAccounts } = useKeyringContext()
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)

  const handleUnlock = async () => {
    setError('')
    if (!password) {
      setError('Por favor ingresa tu contraseña')
      return
    }

    setLoading(true)
    try {
      const success = await unlock(password)
      if (!success) {
        setError('Contraseña incorrecta. Por favor intenta de nuevo.')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al desbloquear')
    } finally {
      setLoading(false)
    }
  }

  const handleUnlockWithWebAuthn = async () => {
    setError('')
    setLoading(true)
    try {
      // Obtener la primera credencial WebAuthn disponible
      const credentials = await import('@/utils/webauthnStorage').then(m => m.getAllWebAuthnCredentials())
      if (credentials.length === 0) {
        setError('No hay credenciales WebAuthn configuradas')
        setLoading(false)
        return
      }

      const success = await unlockWithWebAuthn(credentials[0].id)
      if (!success) {
        setError('Error al autenticar con WebAuthn. Las cuentas pueden estar encriptadas con contraseña. Por favor, intenta desbloquear con contraseña en su lugar.')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al desbloquear con WebAuthn')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-primary/10 via-background to-accent/10">
      <Card className="w-full max-w-md shadow-xl border-2 border-primary/20">
        <CardHeader className="text-center">
          {/* Logo Nelai */}
          <div className="mx-auto mb-6 flex flex-col items-center">
            <div className="w-24 h-24 rounded-2xl bg-gradient-to-br from-primary to-accent flex items-center justify-center shadow-lg mb-3 ring-2 ring-primary/30">
              <img 
                src={`${import.meta.env.BASE_URL || '/'}web-app-manifest-192x192.png`} 
                alt="Nelai" 
                className="w-20 h-20 rounded-xl"
                onError={(e) => {
                  const target = e.target as HTMLImageElement
                  target.style.display = 'none'
                  const parent = target.parentElement
                  if (parent) {
                    parent.innerHTML = '<div class="text-white text-2xl font-bold">N</div>'
                  }
                }}
              />
            </div>
            <div className="text-center">
              <h1 className="text-3xl font-bold text-primary">
                Nelai
              </h1>
              <p className="text-sm text-muted-foreground mt-1">Procedencia y autenticidad verificables</p>
            </div>
          </div>
          <div className="mx-auto mb-4 w-16 h-16 rounded-full bg-primary/20 flex items-center justify-center">
            <Lock className="h-8 w-8 text-primary" />
          </div>
          <CardTitle className="text-2xl">Desbloquear Wallet</CardTitle>
          <CardDescription>
            Ingresa tu contraseña para acceder a tu wallet
            {hasWebAuthnCredentials && ' o usa WebAuthn'}
          </CardDescription>
          <Alert className="mt-4">
            <AlertDescription className="text-sm">
              <strong>Nota:</strong> Si acabas de importar un backup, usa la contraseña que usaste al exportar el backup.
            </AlertDescription>
          </Alert>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="password" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="password">Contraseña</TabsTrigger>
              {hasWebAuthnCredentials && (
                <TabsTrigger value="webauthn">WebAuthn</TabsTrigger>
              )}
            </TabsList>

            <TabsContent value="password" className="space-y-4">
              <form
                onSubmit={(e) => {
                  e.preventDefault()
                  handleUnlock()
                }}
                className="space-y-4"
              >
                <div className="space-y-2">
                  <Label htmlFor="password">Contraseña</Label>
                  <div className="relative">
                    <Input
                      id="password"
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault()
                          handleUnlock()
                        }
                      }}
                      placeholder="Ingresa tu contraseña"
                      className="pr-10"
                      autoComplete="current-password"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="absolute right-0 top-0 h-full"
                      onClick={() => setShowPassword(!showPassword)}
                    >
                      {showPassword ? (
                        <EyeOff className="h-4 w-4" />
                      ) : (
                        <Eye className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                </div>

                {error && (
                  <Alert variant="destructive">
                    <AlertDescription>{error}</AlertDescription>
                  </Alert>
                )}

                <Button
                  type="submit"
                  className="w-full"
                  disabled={loading || !password}
                >
                  {loading ? 'Desbloqueando...' : 'Desbloquear'}
                </Button>
              </form>
            </TabsContent>

            {hasWebAuthnCredentials && (
              <TabsContent value="webauthn" className="space-y-4">
                <div className="text-center py-4">
                  <Fingerprint className="h-12 w-12 mx-auto mb-4 text-primary" />
                  <p className="text-sm text-muted-foreground mb-4">
                    Usa tu autenticación biométrica o hardware key para desbloquear
                  </p>
                </div>

                {error && (
                  <Alert variant="destructive">
                    <AlertDescription>{error}</AlertDescription>
                  </Alert>
                )}

                <Button
                  onClick={handleUnlockWithWebAuthn}
                  className="w-full"
                  disabled={loading}
                >
                  {loading ? 'Autenticando...' : 'Desbloquear con WebAuthn'}
                </Button>
              </TabsContent>
            )}
          </Tabs>
        </CardContent>
      </Card>
    </div>
  )
}

