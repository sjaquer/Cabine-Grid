# 🔐 Guía de Configuración de Variables de Entorno

## Descripción General

Este proyecto usa variables de entorno para mantener las credenciales seguras y fuera del control de versiones. Las variables con prefijo `NEXT_PUBLIC_` se exponen al navegador (necesarias para Firebase), mientras que otras permanecen privadas en el servidor.

## ⚙️ Configuración Inicial

### 1. Crear archivo `.env.local`

En la raíz del proyecto, crea un archivo `.env.local` (este archivo **NUNCA debe commitirse**):

```bash
# Firebase Configuration (DO NOT COMMIT)
NEXT_PUBLIC_FIREBASE_PROJECT_ID=tu-project-id
NEXT_PUBLIC_FIREBASE_APP_ID=tu-app-id
NEXT_PUBLIC_FIREBASE_API_KEY=tu-api-key
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=tu-project-id.firebaseapp.com
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=tu-messaging-sender-id
NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID=tu-measurement-id

NODE_ENV=development
NEXT_PUBLIC_DEBUG_MODE=false
```

### 2. Obtener credenciales de Firebase

1. Ve a [Firebase Console](https://console.firebase.google.com)
2. Selecciona tu proyecto
3. Ve a **Configuración del proyecto** (⚙️ engranaje)
4. En la pestaña **General**, desplázate hasta **Tus aplicaciones**
5. Haz clic en tu aplicación web
6. Copia el objeto `firebaseConfig`
7. Rellena el `.env.local` con los valores

### 3. Verificar configuración

```bash
# El proyecto debería iniciar sin errores
npm run dev
```

## 📋 Variables de Entorno Disponibles

### Firebase Configuration (NEXT_PUBLIC_*)

| Variable | Descripción | Ejemplo | Requerida |
|----------|-------------|---------|-----------|
| `NEXT_PUBLIC_FIREBASE_PROJECT_ID` | ID del proyecto Firebase | `studio-3052883783-56f49` | ✅ |
| `NEXT_PUBLIC_FIREBASE_APP_ID` | ID de la aplicación web | `1:7673368149:web:f16641da...` | ✅ |
| `NEXT_PUBLIC_FIREBASE_API_KEY` | Clave de API pública | `AIzaSyC1MXMFMz6RZOLyXd...` | ✅ |
| `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN` | Dominio de autenticación | `studio-3052883783-56f49.firebaseapp.com` | ✅ |
| `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID` | ID del remitente de mensajería | `7673368149` | ✅ |
| `NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID` | ID de medición (Analytics) | (vacío si no usas Analytics) | ❌ |

### Aplicación

| Variable | Descripción | Valores | Requerida |
|----------|-------------|---------|-----------|
| `NODE_ENV` | Entorno de ejecución | `development`, `production` | ✅ |
| `NEXT_PUBLIC_DEBUG_MODE` | Habilitar modo debug | `true`, `false` | ❌ |

## 🔒 Seguridad

### ✅ Lo que está bien (expuesto en el navegador)

Las credenciales de Firebase con prefijo `NEXT_PUBLIC_` **son públicas por diseño**:
- La clave API de Firebase está diseñada para ser pública
- Las credenciales de cliente NO permiten escribir/eliminar datos sin reglas de seguridad
- Protégete siempre con **Firebase Security Rules**

### ❌ Lo que NUNCA debes hacer

- ❌ Hacer commit de `.env.local` - está en `.gitignore`
- ❌ Exponer claves privadas de servicio (solo para servidor)
- ❌ Hardcodear secretos en el código
- ❌ Compartir credenciales en Slack, email o repositorios públicos

## 🚀 Despliegue

### Firebase Hosting

1. Configura variables en Firebase:
```bash
firebase functions:config:set \
  firebase.project_id="tu-project-id" \
  firebase.api_key="tu-api-key"
```

2. En la consola de Firebase, bajo **Compilación > Hosting**:
   - Copia tu `.env.local`
   - Agregalo a las **Variables de entorno** del proyecto

### Vercel / Netlify / Cualquier hosting

1. Ve a la configuración del proyecto en tu plataforma de hosting
2. Agrega las variables de entorno bajo **Environment Variables**
3. Copia exactamente los pares clave-valor de tu `.env.local`
4. Despliega nuevamente

### Variables de Producción

Para producción, normalmente usarás un proyecto Firebase **diferente** o credenciales diferentes:

```bash
# .env.production.local (nunca commitir)
NEXT_PUBLIC_FIREBASE_PROJECT_ID=tu-project-id-produccion
NEXT_PUBLIC_FIREBASE_API_KEY=tu-api-key-produccion
# ... resto de variables ...
```

## 🔍 Verificar Variables Cargadas

Para probar que las variables se cargan correctamente:

```typescript
// En cualquier componente cliente
console.log(process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID);
// Output: studio-3052883783-56f49 ✅
```

Para servidor:

```typescript
// En API route o Server Component
console.log(process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID);
// Output: studio-3052883783-56f49 ✅
```

## 📚 Recursos

- [Next.js - Environment Variables](https://nextjs.org/docs/basic-features/environment-variables)
- [Firebase - Seguridad de claves](https://firebase.google.com/docs/projects/api-keys)
- [Firebase Security Rules](https://firebase.google.com/docs/rules)

## ⚠️ Troubleshooting

### "process.env.NEXT_PUBLIC_* es undefined"

1. Reinicia el servidor dev: `Ctrl+C` y `npm run dev`
2. Verifica que `.env.local` existe en la raíz
3. Verifica que los nombres de variables son exactos
4. Ensure no hay espacios: `KEY=value` (no `KEY = value`)

### "Credenciales rechazadas por Firebase"

1. Copia el valor exacto de Firebase Console
2. Asegúrate de que authDomain coincida con projectId
3. Verifica en Firebase Console > Configuración > Aplicaciones que la clave esté activa

### "La aplicación funciona en desarrollo pero no en producción"

1. Las variables de entorno no se sincronizaron con la plataforma de hosting
2. Verifica las variables en el dashboard del hosting
3. Redeploy después de agregar variables

---

✅ **¡Configuración completada!** Tu aplicación ahora usa variables de entorno seguras.
