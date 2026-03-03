# Guía de Migración a Nuevo Repositorio Privado

## Estado Actual

✅ **Commit realizado en rama `andino`**
- Todos los cambios de Andino Wallet están commiteados
- 41 archivos modificados/creados
- 9,074 líneas agregadas

## Opciones

### Opción 1: Mantener en el mismo repositorio (rama `andino`)

Si prefieres mantener todo en el mismo repositorio:

```bash
# Push de la rama andino al repositorio actual
git push -u origin andino
```

**Ventajas:**
- Mantiene la historia completa
- Fácil de mantener sincronizado con cambios base

**Desventajas:**
- Repositorio público (si el original es público)
- Mezcla código de Aura PWA y Andino Wallet

### Opción 2: Nuevo Repositorio Privado (Recomendado)

Crear un nuevo repositorio privado para Andino Wallet:

#### Paso 1: Crear repositorio en GitHub/GitLab

1. Ve a GitHub/GitLab y crea un nuevo repositorio privado
   - Nombre sugerido: `andino-wallet-pwa`
   - **IMPORTANTE**: Configúralo como **privado**

2. Copia la URL del repositorio (HTTPS o SSH)

#### Paso 2: Migrar usando el script

```bash
# Ejecutar script de migración
./scripts/migrate-to-new-repo.sh https://github.com/tu-usuario/andino-wallet-pwa.git
```

#### Paso 3: Configurar como repositorio principal (opcional)

```bash
# Cambiar remote por defecto
git remote set-url origin https://github.com/tu-usuario/andino-wallet-pwa.git

# Eliminar remote antiguo (opcional)
git remote remove andino
```

#### Paso 4: Actualizar package.json

Actualizar el nombre del proyecto en `package.json`:

```json
{
  "name": "andino-wallet-pwa",
  "description": "Andino Wallet - PWA para bitácoras de montañismo y expediciones"
}
```

**Ventajas:**
- Repositorio privado y separado
- Código específico de Andino Wallet
- Mejor organización
- Control de acceso independiente

**Desventajas:**
- Pierde sincronización automática con cambios base (pero puedes hacer merge manual)

## Recomendación

**Recomendamos la Opción 2 (Nuevo Repositorio Privado)** porque:

1. **Privacidad**: Los datos de expediciones y avisos de salida son sensibles
2. **Separación**: Andino Wallet es un proyecto específico diferente de Aura PWA
3. **Control**: Puedes gestionar permisos y colaboradores independientemente
4. **Historia**: Puedes mantener la historia del fork si lo necesitas

## Mantener Sincronización con Aura PWA (Opcional)

Si quieres mantener sincronización con cambios base de Aura PWA:

```bash
# Agregar remote del repositorio original
git remote add upstream https://github.com/cryptohumano/aura-pwa.git

# Obtener cambios del upstream
git fetch upstream

# Merge de cambios específicos (cuando sea necesario)
git merge upstream/documents
```

## Checklist Post-Migración

- [ ] Repositorio creado y configurado como privado
- [ ] Código migrado exitosamente
- [ ] `package.json` actualizado con nuevo nombre
- [ ] README.md actualizado para Andino Wallet
- [ ] GitHub Actions/CI actualizado (si aplica)
- [ ] Variables de entorno/configuración revisadas
- [ ] Colaboradores agregados al nuevo repositorio

## Notas Importantes

- **No elimines el repositorio original** hasta verificar que todo funciona
- **Haz backup** antes de migrar
- **Prueba el despliegue** en el nuevo repositorio antes de hacer cambios mayores
- Considera usar **GitHub Secrets** para datos sensibles en CI/CD
