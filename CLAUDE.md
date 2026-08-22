# CLAUDE.md — Préstamos El Tigre (PrestaFlow)

App de gestión de préstamos informales: cartera de clientes, tesorería, intereses, mora
y "redirección de capital". Multi-tenant por organización. PWA mobile-first, en español.

- **Producción:** https://prestaflow.vercel.app (Vercel, auto-deploy desde `main`)
- **Supabase de producción:** proyecto `fzdzyjdryjlfuvaxyuzv`
- **Stack:** React 19 + Vite 6 + TypeScript 5.8 + Tailwind 3 + Supabase (Postgres + Auth + Realtime + Storage + Edge Functions en Deno)
- Sin router, sin state manager, **sin tests**.

## Comandos

```bash
npm run dev      # Vite en http://localhost:3000
npm run build    # debe pasar SIEMPRE — es la red de seguridad real
npx tsc --noEmit # informativo: ya arranca con 19 errores preexistentes
```

`.env.local` necesita **solo** dos variables:

```
VITE_SUPABASE_URL=...
VITE_SUPABASE_ANON_KEY=...
```

El `README.md` está obsoleto (es el scaffold de AI Studio y pide un `GEMINI_API_KEY`
en el cliente). Ignóralo: **ninguna clave de IA va en el bundle**, viven en la tabla
`settings` por organización y solo las lee la Edge Function con `service_role`.

### Verificación antes de dar algo por terminado

No hay framework de tests. La red de seguridad es: `npm run build` + prueba manual del
flujo tocado. `npx tsc --noEmit` sirve para comparar contra la línea base de 19 errores
(`ErrorBoundary.props`, el mapeo de `settings` en `DataContext`, y los `Deno`/`jsr:` de
la Edge Function, que TS no debería estar compilando). **No los cuentes como regresión,
pero no añadas errores nuevos.** Los flujos de dinero se prueban a mano.

## Arquitectura

```
ErrorBoundary → AuthProvider → OrganizationProvider → DataProvider → App
```

Cadena estricta: cada provider consume el anterior. `DataContext.fetchData` está memoizado
con `[currentOrg]`, así que **cambiar de organización recarga todo el dataset** y recrea el
canal Realtime.

**Navegación:** no hay router. Es un `useState` en `App.tsx` con cuatro vistas —
`CLIENTS_LIST` (Cartera), `SINGLE_CLIENT`, `BANKS` (Tesorería), `SETTINGS`. Las tres
últimas son `React.lazy`. Antes del switch hay seis guards secuenciales (config de Supabase
ausente, recuperación de contraseña, carga, sin sesión, sin organización, error de datos).

**Lectura de datos:** todo en `contexts/DataContext.tsx`, un `Promise.all` de 5 queries
filtradas por `organization_id`, más Realtime (5 listeners) y `loadClientHistory(clientId)`
para hidratar el detalle de un cliente bajo demanda.

**Escritura:** `hooks/useDataOperations.ts` es la única capa de escritura de negocio.
Los `services/*` son helpers sin estado. Dos excepciones que escriben directo desde
`App.tsx`: `updateSettings` y `handleAddAccount`.

## Reglas que no se rompen

1. **Nunca quites el filtro `organization_id`** de una query. Es la frontera de tenant.
2. **La RLS es la única autoridad de permisos.** La SPA habla directo con Supabase usando
   la anon key pública; la UI no es control de acceso. Si añades una escritura, añade su
   policy.
3. **`clients`, `transactions` y `bank_accounts` usan columnas camelCase entre comillas**
   (`"clientId"`, `"balanceAfter"`, `"cardCode"`, `"nextPaymentDate"`…) porque el código
   inserta el objeto JS sin mapear. `settings` y las tablas de organización usan snake_case
   y **sí** se mapean a mano. No unifiques uno sin el otro.
4. **No desactives Realtime**: los saldos de tesorería dependen de él (`handleAddAccount`
   no hace update optimista).
5. **Las columnas de secretos de `settings` son write-only** (`ai_api_key`, `api_key`,
   `"apiKey"`). Si añades una columna a `settings`, hay que re-otorgar el grant de columna
   de `migration_C3` o la app no la verá. Nunca incluyas las tres secretas en el grant.
6. **`settings.n8nWebhookUrl` se valida como HTTPS antes de enviar PII.** No relajes eso.
7. **El bucket `receipts` es privado.** `transactions."receiptUrl"` guarda el *path*, no una
   URL, con forma `{organization_id}/{año}/{archivo}`, y la lectura pasa por
   `createSignedUrl`. No lo vuelvas público ni guardes URLs directas.

## Dominio: la lógica de dinero

Aquí es donde un error cuesta plata real. Un cliente = un préstamo (embebido en la fila).

**Siete tipos de transacción** (`types.ts`): `DISBURSEMENT`, `REFINANCE` ("re-tanqueo"),
`PAYMENT_CAPITAL`, `PAYMENT_INTEREST`, `REDIRECT_OUT`, `REDIRECT_IN`, `SETTLEMENT`.
Más `BANK_DEPOSIT` / `BANK_WITHDRAWAL`, que van con `clientId` nulo.

**`PAYMENT_INTEREST` no toca el capital.** `change = 0` sobre el saldo. El interés es
ingreso puro; sí entra a caja, pero no amortiza la deuda. Es la decisión de dominio central
y es intencional.

**`services/transactionService.ts::recalculateClientTransactions` es el libro mayor.**
Recalcula el saldo corriente del cliente desde cero y lo persiste con un upsert masivo.
Orden determinista de tres niveles: `date` → `createdAt` → `id`. Suma con
`safeAdd` (redondeo a 2 decimales) contra errores de coma flotante.

⚠️ **Trampa activa:** `DataContext` carga las transacciones con *vertical slicing* — solo
`id, organization_id, clientId, balanceAfter, interestPaid, date, type`. Si llamas a
`recalculateClientTransactions` sobre esos datos sin haber hidratado antes con
`loadClientHistory`, el upsert **reescribe las filas con `undefined`** en `amount`,
`capitalPaid`, `notes`, `bankAccountId`. `handleClientSelection` hidrata; `handleQuickAction`
(QuickPay/F2 y los swipes de la lista) **no**.

**Tasas e intereses** (`services/loanUtils.ts`): `interestRate` es **mensual en porcentaje**
(`5` = 5 % mensual). `freqDivider` = pagos por mes: `MONTHLY`=1, `BIWEEKLY`=2, `WEEKLY`=4,
`DAILY`=30 (mes comercial). `FIXED` = interés plano sobre capital inicial (no baja al
amortizar); `DIMINISHING` = anualidad francesa sobre saldos. `BIWEEKLY` en
`calculateNextPaymentDate` suma **15 días**, no 2 semanas.

El cálculo de interés por cuota al cobrar vive en `components/TransactionModal.tsx`
(`entryCalc`), no en `loanUtils` — mala ubicación, pero es donde está.

**Fechas: strings `YYYY-MM-DD`, comparadas como strings.** Deliberado: `new Date('YYYY-MM-DD')`
parsea en UTC y desfasaba un día la mora. La regla de mora es
`nextPaymentDate < getToday() && balance > 0`. **No hay interés de mora ni penalización** —
la mora es solo un estado de agenda/UI.

Ojo: `getToday()` usa `toISOString()`, que es UTC, así que entre 19:00 y medianoche hora
colombiana (UTC-5) "hoy" se adelanta un día. Afecta mora y "a cobrar hoy".

**Redirección de capital** es el concepto diferenciador: el pago de un cliente financia
directamente el préstamo de otro en vez de pasar por caja. Un `REDIRECT_OUT` crea
automáticamente su `REDIRECT_IN` espejo en el cliente destino (con `relatedClientId` y
`relatedTransactionId` cruzados) y reduce su `pendingRedirectionBalance`. Si rompes el
espejo, el dinero desaparece de los libros del receptor.

**Saldos de caja:** siempre vía la RPC atómica `bump_bank_balance(p_bank_id text, p_delta,
p_allow_negative)`, con update optimista corregido después con el saldo autoritativo que
devuelve. Al editar una transacción se revierte el efecto viejo y se aplica el nuevo
**agregando deltas por cuenta en un solo update**, porque `updateBankBalance` lee el saldo
de memoria y no se refresca entre llamadas.

## Permisos

Dos capas: rol base hardcodeado en el cliente (`utils/permissions.ts`, mapa
`ROLE_PERMISSIONS` sobre `owner`/`admin`/`member`) + overrides por miembro en la tabla
`member_permissions`. `can(slug)` de `OrganizationContext` resuelve: el override gana sobre
el rol, y puede *conceder* lo que el rol niega.

⚠️ **Hay dos semánticas de default opuestas con la misma firma.**
`utils/permissions.ts::hasPermission(role, perm)` es **opt-in** (deny by default).
`services/permissionService.ts::hasPermission(permissions, slug)` es **opt-out**
(`return perm ? perm.is_enabled : true`). La RLS y la Edge Function usan la opt-out.
Verifica cuál estás importando.

⚠️ **`useDataOperations` chequea solo el rol base, no `can()`** — ignora los overrides.
Los componentes sí usan `can()`. Y `saveTransaction`/`createBankMovement` no chequean nada
en el cliente: dependen 100 % de la RLS.

## Convenciones de UI

- **Named exports siempre** (`export const X: React.FC<XProps>`). Cero `export default` en
  `components/`. Props con `interface <Componente>Props`, nunca `type`.
- **Sin `cn()`, sin `clsx`, sin `tailwind-merge`.** Están en `package.json` pero nadie los
  importa; todo es interpolación de template strings. Sin CVA ni variantes.
- **Dark mode es un retrofit por CSS, no por variantes.** Hay **cero** usos de `dark:` en
  `components/`. `index.css` (después de `@tailwind utilities`) redefine ~60 utilidades con
  `html.dark .bg-white { … }`. Consecuencia: **un componente nuevo solo funciona en oscuro si
  usa la paleta ya mapeada** (`bg-white`, `bg-slate-50/100/200`, `text-slate-500..900`,
  `border-slate-100..300`). Un color fuera de la lista blanca no tiene versión oscura.
- **`tailwindcss-animate` NO está instalado.** Las ~40 clases `animate-in`, `fade-in`,
  `zoom-in-95`, `slide-in-from-*` **no hacen nada**: los modales aparecen de golpe. Si
  necesitas animar, usa framer-motion (ya es dependencia) o instala el plugin — no añadas
  más clases muertas. Igual con `custom-scrollbar` / `scrollbar-thin` / `no-scrollbar`.
- **Si creas una carpeta nueva de componentes, añádela a `content` en `tailwind.config.js`**
  o sus clases se purgan (el `content` enumera rutas explícitas).
- `.glass-effect` lleva blur y va solo en barras fijas. `.glass-card` **no lleva blur a
  propósito** (causaba jank al scrollear). No le añadas `backdrop-blur`.
- Modales: no hay componente base, cada uno reimplementa el shell (bottom sheet en móvil,
  diálogo centrado en desktop, `items-end md:items-center`). Z-index ad-hoc: `z-40` navbar →
  `z-50` → `z-[60]` forms → `z-[70]` → `z-[100]` confirmaciones y toasts.
- Móvil vs desktop se resuelve duplicando el árbol JSX (`md:hidden` cards vs
  `hidden md:table`), no con un componente adaptativo. `BottomNavbar` (`md:hidden`) y
  `Sidebar` (colapsable) son exclusivos por breakpoint `md` = 768px.
- Safe areas vía variables `--safe-area-*` consumidas en `style` inline. Respétalas en
  cualquier elemento fijo.
- Moneda: `utils/format.ts::formatCurrency` (`es-CO`/`COP`, 0 decimales). **Está duplicado
  con opciones distintas** en `ClientList.tsx` y `BankDashboard.tsx`, así que la misma cifra
  puede renderizarse diferente según la pantalla. Usa el helper canónico.
- Las fechas se pintan como ISO crudo (`YYYY-MM-DD`) en casi toda la UI.
- Todo el texto está hardcodeado en español, sin i18n. Vocabulario de dominio: Cartera,
  Tesorería, Fiador, Cédula, Cupo, Paz y Salvo, Mora, Redirección, re-tanqueo.

## Migraciones SQL

En `scripts/`, con nombre `migration_<ID>_<descripción>.sql` donde el ID (`A1`, `A2`, `C1`,
`C3`, `M1`, `M2`) mapea a un hallazgo de la auditoría de seguridad. **No se aplican
automáticamente** — se ejecutan a mano en el SQL editor de Supabase.

Patrones a mantener: cabecera-documento que declara *riesgo → vector → fix → código
acompañante*; todo idempotente (`if not exists`, `or replace`, `drop … if exists` antes de
`create`); toda función `security definer set search_path = ''` con referencias cualificadas;
parámetros `p_`, locales `v_`; cada función pública cierra con `revoke all … from public,
anon` + `grant execute … to authenticated`; toda función `security definer` revalida la
membresía internamente porque bypassa la RLS; helpers de autorización en el schema `private`
(no expuesto por la Data API); mensajes de excepción en español para el usuario final.

`supabase_schema.sql` es el esquema versionado pero **está desincronizado de producción**
(prod tiene `accepted_at` y columnas camelCase duplicadas en `settings` que el archivo no
declara). Confirma contra la base real antes de asumir una columna.

## Deuda conocida — no la "arregles" de paso

Documentado para que no la confundas con un bug nuevo ni la toques sin pedirlo:

- **Flujo de invitación roto:** el enlace se genera con `#invite=<token>` pero nadie parsea
  `window.location.hash` para escribir `localStorage['prestaFlow_inviteToken']`, así que
  `checkAndClaimInvitations` siempre sale temprano y una invitación a un usuario nuevo nunca
  se auto-reclama.
- **`use_ai` no existe en `permissions_definition`** pero la Edge Function lo consulta. Con
  la FK, es imposible crear la fila → el gate de IA es siempre permisivo.
- **Límite duro de 2000 filas** en `clients` y `transactions`, con `console.warn`. La
  paginación server-side sigue pendiente (`docs/PERFORMANCE_ROADMAP.md`).
- **`return` antes de los hooks** en `App.tsx` (guard de config de Supabase): viola las
  reglas de hooks, funciona porque la condición es constante en runtime.
- Cero `React.memo` y cero `useCallback` en `components/`. Monolitos: `ClientList` 903
  líneas, `SettingsView` 754, `TransactionModal` 671.
- 13 `window.alert` + 3 `window.confirm` conviviendo con el sistema de Toast y con modales
  de confirmación custom.
- "Modo Privado" (ocultar cifras) está implementado a medias: `ClientStats`,
  `TransactionHistory`, `ClientCard`, `BankDashboard` y la tabla lo ignoran.
- `PullToRefresh` chequea `window.scrollY === 0`, pero el scroll ocurre en contenedores
  internos (`body { overflow: hidden }`), así que se activa desde cualquier posición.
- `hooks/useGestures.ts` es código muerto; `SwipeableItem` y `PullToRefresh` duplican su
  lógica touch a mano.
- El mapeo de `settings` snake_case → camelCase está duplicado en `DataContext` (fetch y
  handler de Realtime) y ya divergen en un fallback.
- Los checkboxes sin marcar en `docs/superpowers/plans/` son documentación obsoleta: las 16
  tareas están implementadas en git. No son trabajo pendiente.

## Estado del repositorio

`main` es producción. Hay trabajo sin integrar que conviene revisar antes de tocar dinero:

- **`feat/apple-glass-redesign`** — 13 commits por delante de `main`, incluidos cuatro
  `fix(dinero)` del 19-jun (mora con fecha local en vez de UTC, recálculo leyendo de BD,
  interés FIJO al refinanciar, "Cerrar Ciclo" con saldo ≤ 0) que **no están en producción**.
  También borra el service worker, que `main` luego reintrodujo — el merge no es trivial.
- **`chore/keep-supabase-alive`** — PR #1 abierto: workflow de GitHub Actions para que
  Supabase no se pause por inactividad. `main` no tiene `.github/` en absoluto.

## ⚠️ Estado de producción al 2026-08-22

El frontend en https://prestaflow.vercel.app está vivo y sirve exactamente este `main`
(commit `d9f937c`), pero **el proyecto Supabase `fzdzyjdryjlfuvaxyuzv` no resuelve por DNS**:
`fzdzyjdryjlfuvaxyuzv.supabase.co` y su `db.` devuelven NXDOMAIN autoritativo desde el DNS de
Cloudflare, que es el proveedor de Supabase. En Supabase eso corresponde a un proyecto
pausado o eliminado, así que **la app no puede autenticar ni leer datos: el login falla**.

Encaja con el plan gratuito, que pausa por inactividad, y con que el último push fue el
10-jul-2026. Es justo lo que el PR #1 pretendía evitar.

Si vas a trabajar en esto, lo primero es reactivar (o recrear) el proyecto en el dashboard de
Supabase. Antes de diagnosticar cualquier fallo de datos, comprueba que el host resuelva —
si no, no es un bug del código.
