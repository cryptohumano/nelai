# Guía de Despliegue a GitHub Pages

## Pasos para Desplegar

### 1. Habilitar GitHub Pages en tu Repositorio

1. Ve a tu repositorio en GitHub: `https://github.com/cryptohumano/aura-pwa`
2. Ve a **Settings** (Configuración) → **Pages**
3. En la sección **Source** (Origen), selecciona **GitHub Actions**
4. Guarda los cambios

### 2. Hacer Push de tus Cambios

El workflow está configurado para ejecutarse en las ramas `main` o `master`. Si estás en otra rama (como `documents`), tienes dos opciones:

#### Opción A: Hacer Merge a main/master

```bash
# Cambiar a la rama main
git checkout main

# Hacer merge de documents
git merge documents

# Hacer push
git push origin main
```

#### Opción B: Actualizar el Workflow para usar tu rama

Si quieres desplegar desde la rama `documents`, puedes modificar `.github/workflows/deploy.yml` para agregar `documents` a la lista de ramas:

```yaml
on:
  push:
    branches:
      - main
      - master
      - documents  # Agregar esta línea
```

### 3. El Despliegue se Ejecutará Automáticamente

Una vez que hagas push:

1. Ve a la pestaña **Actions** en tu repositorio
2. Verás el workflow "Deploy to GitHub Pages" ejecutándose
3. Espera a que complete (toma unos minutos)

### 4. Verificar el Despliegue

1. Ve a **Settings** → **Pages** en tu repositorio
2. Verás la URL de tu sitio: `https://cryptohumano.github.io/aura-pwa/`
3. El sitio estará disponible después de que el workflow termine

## Configuración Automática

✅ **Base Path**: Se detecta automáticamente según el nombre del repositorio (`aura-pwa`)
✅ **Manifest**: Se genera automáticamente con las rutas correctas
✅ **Service Worker**: Se configura automáticamente con el base path correcto
✅ **Assets**: Todas las rutas se transforman automáticamente durante el build

## Troubleshooting

### El workflow no se ejecuta

- Verifica que GitHub Pages esté habilitado con **GitHub Actions** como fuente
- Verifica que estés haciendo push a una rama configurada (`main`, `master`, o `documents` si la agregaste)

### Errores 404 en el sitio

- Verifica que el workflow se haya completado exitosamente
- Espera unos minutos después del despliegue (puede tomar tiempo propagarse)
- Verifica que el base path sea correcto en los logs del workflow

### El build falla

- Revisa los logs en **Actions** para ver el error específico
- Verifica que todas las dependencias estén instaladas correctamente
- Asegúrate de que `yarn build` funcione localmente

## URL de tu Sitio

Una vez desplegado, tu PWA estará disponible en:

```
https://cryptohumano.github.io/aura-pwa/
```

## Notas Importantes

- El despliegue es automático cada vez que haces push a la rama configurada
- El base path se detecta automáticamente, no necesitas configurarlo manualmente
- Los cambios pueden tardar unos minutos en aparecer después del despliegue
- El Service Worker funcionará correctamente en GitHub Pages

