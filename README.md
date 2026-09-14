# MTG Vitrina CR

Catálogos públicos multiusuario de cartas Magic: The Gathering con precios en colones costarricenses y consultas de compra por WhatsApp.

## Estado del MVP

- Catálogo responsive de demostración.
- Autenticación Google mediante Supabase.
- Perfil y URL pública por vendedor (`/v/{slug}`).
- Inventario privado protegido con Row Level Security.
- Importación Moxfield CSV y resolución de impresiones mediante Scryfall.
- Cantidad, condición, idioma, acabado, precio CRC y disponibilidad.
- Carrito de consulta y mensaje de WhatsApp.

No incluye pagos, comisiones, envíos, chat interno ni cuentas para compradores.

## Desarrollo local

Requisitos: Node.js 22+ y pnpm.

```bash
pnpm install
cp .env.example .env.local
pnpm dev
```

Configura en `.env.local`:

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
NEXT_PUBLIC_SITE_URL=http://localhost:3000
```

## Preparar Supabase

1. Crea un proyecto gratuito.
2. Ejecuta `supabase/migrations/202609140001_initial_schema.sql` desde SQL Editor.
3. En Authentication → Providers, habilita Google.
4. Añade `http://localhost:3000/dashboard` y la URL de producción `/dashboard` a las URLs permitidas.
5. Copia la Project URL y la anon key a las variables de entorno.

La clave `service_role` no se utiliza en el navegador y nunca debe incluirse en GitHub.

## Importación Moxfield

El importador reconoce variaciones comunes de `Quantity`, `Name`, `Edition/Set`, `Collector Number`, `Scryfall ID`, `Condition`, `Language` y `Finish/Foil`.

La resolución sigue este orden: Scryfall ID, set + collector number y nombre exacto. Las filas no resueltas permanecen visibles para revisión.

## Validación

```bash
pnpm build
```

GitHub Actions ejecuta el build en cada push y pull request hacia `main`.

## Datos y seguridad

- Los precios CRC se almacenan como enteros.
- RLS limita escritura y administración al propietario.
- Un catálogo solo es público cuando el vendedor lo activa.
- Solo las cartas disponibles y con cantidad mayor a cero son visibles públicamente.
- El comprador no necesita cuenta.

Los datos de Magic y las imágenes provienen de Scryfall. Magic: The Gathering pertenece a Wizards of the Coast.

