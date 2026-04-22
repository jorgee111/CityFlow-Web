# 🚌 CityFlow Web

Sistema inteligente de gestión de transporte público de Madrid.  
**Stack**: Node.js · Express · Azure SQL Database · HTML/CSS/Vanilla JS

---

## 🚀 Puesta en marcha local

### 1. Instalar dependencias
```bash
npm install
```

### 2. Configurar variables de entorno
```bash
cp .env.example .env
# Edita .env con tus credenciales de Azure SQL
```

### 3. Crear la base de datos en Azure (primera vez)

> Ver sección completa **"Configuración Azure"** más abajo.

```bash
npm run setup-db
```

### 4. Arrancar el servidor
```bash
npm run dev      # desarrollo (nodemon, auto-reload)
npm start        # producción
```

La app estará disponible en: **http://localhost:3000**

---

## 👤 Cuentas de demo

| Email | Contraseña | Rol |
|---|---|---|
| `admin@cityflow.es` | `Admin1234!` | Gestor |
| `carlos@cityflow.es` | `Conductor1!` | Conductor |
| `ana@ejemplo.es` | `Pasajero1!` | Pasajero |

---

## 🗄️ Configuración Azure SQL Database

### Paso 1: Crear el servidor SQL en Azure Portal

1. Ve a [portal.azure.com](https://portal.azure.com)
2. Busca **"SQL Server"** → **Crear**
3. Rellena:
   - **Nombre del servidor**: `cityflow-sqlserver` (o el que elijas)
   - **Región**: `West Europe` (o la más cercana a España)
   - **Autenticación**: SQL authentication
   - **Login de administrador**: `cityflow_admin`
   - **Contraseña**: (anota una contraseña segura)
4. Haz clic en **Revisar y crear**

### Paso 2: Crear la base de datos

1. Dentro del servidor recién creado → **Bases de datos** → **Nueva base de datos**
2. **Nombre**: `cityflow`
3. **Plan de tarifa**: Basic (5 DTU, 2 GB) para desarrollo, Standard para producción
4. Crear

### Paso 3: Configurar el firewall

1. En el servidor SQL → **Redes** → **Firewall y redes virtuales**
2. Activar: "Permitir que los servicios y recursos de Azure accedan a este servidor"
3. Añadir tu IP local para desarrollo
4. Guardar

### Paso 4: Obtener la cadena de conexión

1. Bases de datos → `cityflow` → **Cadenas de conexión**
2. Copia los valores de **Server**, **Database**, **User** y **Password**
3. Edita tu `.env`:

```env
DB_SERVER=cityflow-sqlserver.database.windows.net
DB_NAME=cityflow
DB_USER=cityflow_admin
DB_PASSWORD=TuContraseñaSegura
DB_PORT=1433
JWT_SECRET=genera_una_clave_muy_larga_aqui
```

### Paso 5: Ejecutar el schema

```bash
npm run setup-db
```

---

## ☁️ Despliegue en Azure App Service

### Opción A: Desde VS Code (recomendado)

1. Instala la extensión **Azure App Service** en VS Code
2. Haz clic en el icono de Azure → App Services → **Deploy to Web App**
3. Selecciona tu suscripción y crea un nuevo App Service:
   - **Nombre**: `cityflow-web`
   - **Stack**: Node.js 18 LTS
   - **Plan**: Free (F1) para pruebas, B1 para producción
4. En la configuración del App Service → **Variables de entorno** (env vars):
   - Añade todas las variables de `.env`

### Opción B: Desde Azure Portal + GitHub Actions

1. En Azure Portal → App Service → **Centro de implementación**
2. Origen: **GitHub** → Selecciona tu repo `CityFlow-Web`
3. Se generará automáticamente un archivo `.github/workflows/azure-webapp.yml`
4. Cada push a `main` desplegará automáticamente

### Variables de entorno en Azure App Service

En el portal: App Service → **Configuración** → **Configuración de la aplicación**:

| Nombre | Valor |
|---|---|
| `NODE_ENV` | `production` |
| `DB_SERVER` | `cityflow-sqlserver.database.windows.net` |
| `DB_NAME` | `cityflow` |
| `DB_USER` | `cityflow_admin` |
| `DB_PASSWORD` | `***` |
| `DB_PORT` | `1433` |
| `JWT_SECRET` | `(clave larga aleatoria)` |
| `JWT_EXPIRES_IN` | `7d` |
| `PORT` | `8080` |

---

## 📁 Estructura del proyecto

```
CityFlow-Web/
├── server/
│   ├── index.js          ← Servidor Express
│   ├── config/db.js      ← Conexión Azure SQL (mssql)
│   ├── middleware/auth.js ← JWT middleware
│   ├── routes/           ← auth, buses, incidents, suggestions, users
│   └── db/
│       ├── schema.sql    ← Schema SQL Server + datos demo
│       └── setup.js      ← Script para ejecutar el schema
├── public/               ← Frontend estático
│   ├── index.html        ← Login/Registro
│   ├── dashboard.html    ← Dashboard pasajero
│   ├── lineas.html
│   ├── mapa.html         ← Mapa Leaflet
│   ├── alertas.html
│   ├── trafico.html
│   ├── buscar.html
│   ├── perfil.html
│   ├── conductor.html    ← Panel conductor
│   ├── gestor.html       ← Panel gestor (con Three.js 3D)
│   ├── css/styles.css    ← Design system completo
│   └── js/               ← api.js, nav.js, map.js, gestor.js, toast.js
├── .env.example
├── .gitignore
├── web.config            ← Azure App Service (IIS + iisnode)
└── package.json
```

---

## 🔌 API Endpoints

| Método | Endpoint | Auth | Descripción |
|---|---|---|---|
| POST | `/api/auth/register` | ❌ | Registro de usuario |
| POST | `/api/auth/login` | ❌ | Login → JWT |
| GET | `/api/auth/me` | ✅ | Perfil del usuario |
| PUT | `/api/auth/profile` | ✅ | Actualizar perfil |
| GET | `/api/buses` | ✅ | Lista de buses activos |
| GET | `/api/buses/stats` | ✅ | Estadísticas agregadas |
| GET | `/api/buses/lines` | ✅ | Líneas con próximo bus |
| GET | `/api/incidents` | ✅ | Incidencias (filtradas por rol) |
| POST | `/api/incidents` | ✅ | Crear incidencia |
| PUT | `/api/incidents/:id` | 🔒 Gestor | Actualizar estado |
| GET | `/api/suggestions` | ✅ | Sugerencias/mensajes |
| POST | `/api/suggestions` | ✅ | Crear sugerencia |
| PUT | `/api/suggestions/:id` | 🔒 Gestor | Responder sugerencia |
| GET | `/api/users` | 🔒 Gestor | Lista de usuarios |
| GET | `/api/health` | ❌ | Health check |

---

## 🛠️ Tecnologías

| Capa | Tecnología |
|---|---|
| Frontend | HTML5 · CSS Vanilla · JavaScript ES Modules |
| Backend | Node.js 18+ · Express.js |
| Base de datos | Azure SQL Database (Microsoft SQL Server) |
| Autenticación | JWT · bcryptjs |
| Mapa | Leaflet.js |
| Vista 3D | Three.js |
| Despliegue | Azure App Service · iisnode |

---

## 📄 Licencia

MIT © CityFlow Madrid
