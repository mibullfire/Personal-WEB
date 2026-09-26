# Instalación del blog con panel admin (Railway)

El blog (`blog.mibullfire.com`) lee los posts de una base de datos **PostgreSQL** y guarda las fotos en un **volumen**. Las dos cosas están en Railway. Los posts se publican desde `blog.mibullfire.com/admin`.

## Lo que necesita el servidor

| Qué | Para qué | Dónde se configura |
|---|---|---|
| `DATABASE_URL` | Conexión a PostgreSQL (posts) | Variable del servicio web |
| `ADMIN_PASSWORD` | Contraseña del panel `/admin` | Variable del servicio web |
| Volumen en `/data` | Fotos subidas (`/data/uploads`) | Volumen conectado al servicio web |

> La contraseña **no** está en el código a propósito: el repo está en GitHub y cualquiera que lo vea podría publicar en el blog. Solo se guarda en las variables de Railway.

---

## 1. Subir el código

```bash
git add .
git commit -m "feat: panel admin y posts desde base de datos"
git push origin main
```

Railway detecta el push, instala las dependencias (`npm install`, que instala `pg`) y arranca con `npm start`.

## 2. Crear la base de datos

1. Abre tu proyecto en [railway.com](https://railway.com).
2. Pulsa **+ New → Database → Add PostgreSQL**.
3. Espera a que el servicio `Postgres` aparezca en verde.

No hace falta crear tablas: el servidor crea la tabla `posts` al arrancar. La primera vez también copia los 5 posts antiguos que estaban escritos a mano en `blog.html`.

## 3. Conectar la base de datos y poner la contraseña

En el **servicio de la web** (no en el de Postgres), ve a **Variables → New Variable** y añade estas dos:

| Nombre | Valor |
|---|---|
| `DATABASE_URL` | `${{Postgres.DATABASE_URL}}` |
| `ADMIN_PASSWORD` | la contraseña del panel |

- `${{Postgres.DATABASE_URL}}` es una referencia: Railway pone ahí la URL de la base de datos. Si tu servicio de base de datos se llama de otra forma, cambia `Postgres` por su nombre (Railway lo autocompleta al escribir `${{`).
- Usa la URL **interna** (la que da esa referencia por defecto). La pública no hace falta. Si algún día usas la pública, añade también `PGSSL=true`.

## 4. Crear el volumen para las fotos

1. Haz clic derecho en el **servicio de la web** (o `Ctrl/⌘ + K`) y elige **Attach Volume**.
2. Como **Mount path** pon: `/data`
3. Guarda.

El servidor detecta el volumen solo (Railway define `RAILWAY_VOLUME_MOUNT_PATH`) y guarda las fotos en `/data/uploads`.

> ⚠️ Sin volumen, las fotos se **borran en cada despliegue**. Los posts no se pierden, pero se quedarían con fotos rotas.

## 5. Redesplegar y comprobar

1. Pulsa **Deploy** en el servicio web (o espera al despliegue automático después de guardar las variables).
2. Mira los **Deploy Logs**. Deberían salir estas líneas:
   ```
   Servidor escuchando en http://0.0.0.0:XXXX
   Fotos del blog en /data/uploads
   Base de datos inicializada con 5 posts
   ```
3. Abre `https://blog.mibullfire.com`: deberían salir los 5 posts de siempre, el buscador y el panel de tags.
4. Abre `https://blog.mibullfire.com/admin`, entra con la contraseña y publica un post de prueba con una foto.
5. Haz un **Redeploy** y comprueba que el post y la foto siguen ahí. Si siguen, el volumen funciona.

---

## Uso del panel

- **Dirección:** `blog.mibullfire.com/admin`. Desde `mibullfire.com/admin` redirige ahí.
- **Formato del texto:**
  - línea en blanco → párrafo nuevo
  - `**negrita**`
  - `*cursiva*`
  - `> cita`
  - los enlaces se detectan solos
- **Fotos:** hasta 4 por post (JPG, PNG, GIF o WebP). Antes de subirse se reducen a 2048 px.
- **Opcional:** título, mood, música y tags (separados por comas).
- **Publicar rápido:** `Ctrl + Enter`.
- **Borrar un post:** botón **borrar** en la lista de abajo. Borra también sus fotos.
- **"Recordar en este dispositivo":** guarda la contraseña en ese navegador. Usa **salir** para olvidarla.
- **Bloqueo:** después de 5 contraseñas incorrectas, esa IP queda bloqueada 15 minutos.

## Cambiar la contraseña

Cambia `ADMIN_PASSWORD` en **Variables** del servicio web. Railway redespliega solo. Los dispositivos donde tenías la sesión recordada te volverán a pedir la contraseña.

---

## Probar en local (opcional)

Necesitas un PostgreSQL. Con Docker o Podman:

```bash
podman run -d --rm --name blogpg -e POSTGRES_PASSWORD=test -p 55432:5432 docker.io/library/postgres:16-alpine

npm install
DATABASE_URL=postgres://postgres:test@localhost:55432/postgres \
ADMIN_PASSWORD=loquesea \
npm start
```

- Blog: <http://localhost:3000/blog.html>
- Panel: <http://localhost:3000/admin>

Las fotos se guardan en `uploads/`, que está en `.gitignore`. Para parar la base de datos: `podman stop blogpg`.

## Si algo falla

| Síntoma | Causa probable |
|---|---|
| Blog: "no se pudieron cargar los posts (Base de datos no configurada…)" | Falta `DATABASE_URL` en el servicio web |
| Log: "No se pudo inicializar la base de datos" | La referencia `${{…}}` apunta a un nombre de servicio que no existe, o Postgres aún está arrancando (se reintenta solo) |
| Panel: "ADMIN_PASSWORD no esta configurada" | Falta la variable `ADMIN_PASSWORD` |
| Panel: "Demasiados intentos" | 5 fallos seguidos: espera 15 minutos |
| Las fotos desaparecen después de desplegar | El volumen no está conectado al servicio web o no está montado en `/data` |
| Una foto del iPhone da error | El navegador no pudo convertir la HEIC. Cámbiala a JPG o súbela desde Safari |
