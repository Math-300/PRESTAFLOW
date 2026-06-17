# PRP — Remediación de Críticos y Altos (Presta Flow)

- **Fecha:** 2026-06-17
- **Autor:** Auditoría QA (7 sub-agentes Sonnet) + validación manual de código y en vivo
- **Alcance acordado:** 5 críticos + 10 altos validados, más 2 ítems de lógica de dinero desbloqueados por decisión de negocio (interés FIJO, mora). Medios/bajos quedan documentados fuera de alcance.
- **Decisión de negocio confirmada:** el interés es **FIJO sobre el capital inicial** (interés por cuota plano).
- **Restricción de entorno:** el sandbox no resuelve DNS a Supabase; la validación de flujos autenticados es a nivel de código. Toda verificación que requiera sesión autenticada se hará en `npm run dev` por el usuario o en staging.

## Contexto

Presta Flow es una SPA React 19 + Vite + TS que habla directo con Supabase (RLS = única frontera). App de préstamos "gota a gota", moneda COP (enteros), multi-tenant por organización, móvil-first/PWA. No hay framework de pruebas instalado (`scripts`: dev/build/preview). La verificación se hará con `tsc --noEmit`, `vite build`, y pruebas manuales/Playwright donde el entorno lo permita.

Ya corregido esta sesión (commit `f43a86e`, NO re-hacer): edición de transacción descuadraba caja; `nextPaymentDate` no avanzaba; redirección no registraba la deuda del receptor.

## Principios

- Arreglar causa raíz, no síntomas. Un cambio por causa.
- Cambios aislados y revisables; respetar patrones existentes.
- Cambios en BD de producción (RLS/RPC) se marcan y requieren confirmación explícita por separado antes de aplicarse.
- Verificar cada fase con `tsc` + `build`; las observables, en vivo.

---

## Fase 0 — Correcciones aisladas de bajo riesgo

### F0.1 — [CRÍTICO] `useAuth()` dentro de callback (Reglas de Hooks)
- **Archivo:** `components/SettingsView.tsx:389-401`
- **Causa raíz:** `DebouncedInput` recibe `value={useAuth().user?...}` y `onChange={async () => await useAuth().updateProfile(...)}`. Llamar `useAuth()` dentro del callback async viola las Reglas de Hooks → al editar el nombre de perfil, `useContext` se ejecuta fuera de render y lanza.
- **Arreglo:** Tomar `const { user, updateProfile } = useAuth();` en el cuerpo de `SettingsView` (top-level) y usar esas referencias dentro del JSX/callback. Verificar que `DebouncedInput` esté definido fuera de `SettingsView` (si está anidado, extraerlo a módulo propio).
- **Verificación:** en vivo, editar "Nombre para Mostrar" no crashea y persiste.
- **Riesgo:** bajo.

### F0.2 — [CRÍTICO] Comprobante de movimiento bancario nunca se sube
- **Archivo:** `hooks/useDataOperations.ts` (`createBankMovement`)
- **Causa raíz:** la firma acepta `receiptFile?` pero el cuerpo nunca llama `uploadReceipt` ni guarda `receiptUrl`.
- **Arreglo:** al inicio del `try`, `if (receiptFile) { const path = await uploadReceipt(receiptFile); if (path) tx.receiptUrl = path; }` antes del insert (mismo patrón que `saveTransaction`).
- **Verificación:** registrar depósito con imagen → la fila `transactions` BANK_INTERNAL guarda `receiptUrl` (path); se ve la signed URL.
- **Riesgo:** bajo.

### F0.3 — [ALTO] Mensajes de error de autenticación genéricos + sin feedback de registro
- **Archivo:** `components/AuthPage.tsx:37-56`
- **Causa raíz:** el `catch` colapsa todo a "Credenciales inválidas o error de conexión"; el éxito de registro con sesión no da feedback. (Confirmado en vivo: un fallo de red en registro mostró el mensaje de credenciales.)
- **Arreglo:** mapear errores de Supabase a mensajes en español (email no confirmado, rate limit, red/`Failed to fetch`, credenciales). Distinguir contexto login vs registro. Manejar el caso `data.user && data.session` (entrar) y `data.user && !data.session` (avisar de confirmar correo). Agregar `role="alert"`/`aria-live`.
- **Verificación:** en vivo, credenciales malas vs sin red muestran mensajes distintos.
- **Riesgo:** bajo.

### F0.4 — [ALTO] "Interés anticipado" se descarta
- **Archivos:** `components/ClientFormModal.tsx` (recolecta `initialInterest`), `App.tsx:401-417` (`handleClientSubmit` lo ignora; `initialTx.interestPaid: 0`)
- **Causa raíz:** el dato del formulario nunca se mapea a la transacción de desembolso inicial.
- **Arreglo:** en `handleClientSubmit`, `interestPaid: parseCurrency(formData.initialInterest) || 0` en `initialTx`. Confirmar coherencia: el interés anticipado NO altera `balanceAfter`/capital (es interés cobrado por adelantado), solo se registra como `interestPaid` → cuenta para ganancia.
- **Verificación:** crear cliente con interés anticipado → la transacción inicial guarda el interés; aparece en ganancia/stats.
- **Decisión por defecto (explícita):** el interés anticipado NO altera `balanceAfter`/capital ni el monto bancario desembolsado; solo se registra como `interestPaid` (cuenta para ganancia). Si el negocio descuenta el interés del efectivo entregado (desembolso neto), se ajustaría el delta bancario — confirmar antes de implementar.
- **Riesgo:** bajo-medio (afecta cómputo de ganancia; revisar la decisión por defecto de arriba).

### F0.5 — [ALTO] Filtro de rango temporal del gráfico roto
- **Archivo:** `components/client/ClientStats.tsx:74-84`
- **Causa raíz:** `startDate = new Date(0)` (epoch 1970) y luego `setMonth`/`setFullYear` sobre 1970 → 1M/3M/6M incluyen todo.
- **Arreglo:** `let startDate = new Date(now)` (copia de hoy) antes de aplicar los ajustes.
- **Verificación:** seleccionar 1M muestra solo el último mes.
- **Riesgo:** bajo.

### F0.6 — [ALTO] Atajos de teclado disparan mientras se escribe
- **Archivo:** `App.tsx:128-165`
- **Causa raíz:** `handleKeyDown` no ignora foco en inputs; Escape cierra modales mientras se escribe.
- **Arreglo:** al inicio del handler, `const el = e.target as HTMLElement; const typing = ['INPUT','TEXTAREA','SELECT'].includes(el.tagName) || el.isContentEditable;` — para F1/F2/F3 retornar si `typing`; para Escape, permitir que el campo/modal lo maneje (no cerrar todo globalmente cuando el foco está en un input de un modal). Mantener atajos solo en vistas de lista.
- **Verificación:** escribir en búsqueda y pulsar Escape no cierra el modal de transacción.
- **Riesgo:** bajo.

### F0.7 — [ALTO] `banksRes.error` no se verifica
- **Archivo:** `contexts/DataContext.tsx:98-101`
- **Causa raíz:** se verifican settings/clients/tx pero no banks → tesorería queda en $0 sin aviso si falla esa query.
- **Arreglo:** `if (banksRes.error) throw banksRes.error;` junto a las demás.
- **Verificación:** simular error → se muestra el error en vez de $0 silencioso.
- **Riesgo:** bajo.

---

## Fase 1 — Resiliencia de UI asíncrona

### F1.1 — [ALTO] `TransactionModal.handleSubmit` no respeta fallos, se cuelga y permite doble-submit
- **Archivo:** `components/TransactionModal.tsx:253-302`
- **Causa raíz:** ignora el `boolean` de `onSubmit`; sin `try/catch/finally`; sin guard de `isProcessing` (Enter doble).
- **Arreglo:** primera línea `if (isProcessing) return;`. Validar `targetClientId` en redirección y campos del simulador (evitar `NaN`, ver F-money). Envolver en `try { const ok = await onSubmit(...); if (ok) onClose(); } catch { mostrar error } finally { setIsProcessing(false); }`.
- **Verificación:** en vivo, forzar fallo → el modal permanece abierto con los datos; el botón se reactiva; Enter doble no duplica.
- **Riesgo:** medio (toca el flujo principal de dinero — probar bien).

### F1.2 — [ALTO] `PullToRefresh` se cuelga y se dispara fuera del tope
- **Archivo:** `components/ui/PullToRefresh.tsx`
- **Causa raíz:** `onTouchEnd` sin `try/finally` (spinner colgado si `onRefresh` falla); usa `window.scrollY` (siempre 0 con `body overflow:hidden`); sin `onTouchCancel`.
- **Arreglo:** `try { await onRefresh(); } finally { setIsRefreshing(false); setPullOffset(0); }`. Recibir/usar una ref al contenedor scrollable real y comprobar `ref.scrollTop === 0`. Añadir `onTouchCancel` que resetee estado.
- **Verificación:** en vivo móvil/responsive: refrescar sin red no cuelga; no se dispara a media lista.
- **Riesgo:** medio (gesto táctil; probar en dispositivo/responsive).

### F1.3 — [ALTO] Chat IA sin timeout y pierde historial
- **Archivos:** `components/AIChat.tsx:29-79`, `services/aiAgentService.ts`
- **Causa raíz:** sin `AbortController`/timeout → `isTyping` se cuelga; el `useEffect` con dep `activeClient` reinicia el historial al cambiar de cliente.
- **Arreglo:** en `aiAgentService`, `fetch` con `AbortController` y timeout (~30s). Separar el efecto de inicialización del agente (dep `currentOrg?.id`) del de bienvenida; no destruir el historial al cambiar de cliente (o resetearlo explícitamente si es el comportamiento deseado).
- **Verificación:** en vivo, timeout muestra error y reactiva input; cambiar de cliente no borra el chat.
- **Riesgo:** medio.

---

## Fase 2 — Correctitud de datos y concurrencia

### F2.1 — [CRÍTICO] `limit(2000)` sin `.order()`
- **Archivo:** `contexts/DataContext.tsx:88-93`
- **Causa raíz:** sin `ORDER BY`, Postgres devuelve 2000 filas arbitrarias → saldos/métricas potencialmente erróneos en orgs grandes.
- **Arreglo (incremental):** añadir `.order('date', { ascending: false })` (y/o `created_at`) antes de `.limit(2000)` en `transactions` y orden en `clients`. Documentar el techo y registrar (log) cuando se alcanza. (Paginación real = fuera de alcance, anotar como deuda.)
- **Verificación:** en vivo/SQL: con >2000 tx, las recientes están presentes.
- **Riesgo:** bajo (orden) / la paginación queda diferida.

### F2.2 — [CRÍTICO] Saldo bancario no atómico + sin realtime de `bank_accounts`
- **Archivos:** `hooks/useDataOperations.ts` (`updateBankBalance`), `contexts/DataContext.tsx` (canal realtime)
- **Causa raíz:** read-modify-write de valor absoluto desde estado React; sin suscripción realtime de `bank_accounts` → operaciones concurrentes se pisan.
- **Arreglo:**
  1. **(Producción)** RPC Postgres `bump_bank_balance(bank_id uuid, delta numeric, allow_negative boolean)` con `UPDATE ... SET balance = balance + delta WHERE id = ... RETURNING balance`, `security definer`/RLS acorde (permiso `create_transactions`/`manage_banks`), validando saldo negativo server-side. `updateBankBalance` la invoca y usa el `balance` retornado para el estado.
  2. Añadir listener realtime de `bank_accounts` (filtrado por org) que sincronice `setBankAccounts`.
- **Verificación:** dos pestañas → movimientos concurrentes suman correctamente; cambios se reflejan sin recargar.
- **Riesgo:** medio-alto. **Requiere migración en producción → confirmación explícita antes de aplicar.**

### F2.3 — [ALTO] `loadClientHistory` con dependencia inestable
- **Archivo:** `contexts/DataContext.tsx:286-323`
- **Causa raíz:** `useCallback([currentOrg, transactions])` se invalida en cada cambio de `transactions`; `setTransactions(prev => prev.filter(...))` retira temporalmente las del cliente → parpadeo de cartera / posible bucle.
- **Arreglo:** leer `transactions` vía `useRef` (sin ponerlo en deps); rastrear clientes ya cargados con un `Set` en vez de inferir por presencia de `notes`. No vaciar las tx del cliente antes de re-poblar (merge).
- **Verificación:** abrir un cliente no altera los totales del tablero; sin renders en bucle.
- **Riesgo:** medio.

---

## Fase 3 — PWA / Service Worker

### F3.1 — [CRÍTICO] SW sirve versión vieja tras deploy
- **Archivo:** `public/sw.js`
- **Causa raíz:** sin `activate`/limpieza de cachés viejos, sin `skipWaiting`/`clients.claim`; `fetch` cache-first del shell (incl. `/` e `index.html`) → tras deploy se sirve la app antigua indefinidamente.
- **Arreglo:** versionar `CACHE_NAME`; `install` → `self.skipWaiting()`; `activate` → borrar cachés con nombre distinto + `clients.claim()`; estrategia **network-first** para navegación/HTML (fallback a caché offline) y cache-first solo para assets estáticos versionados; no interceptar requests cross-origin (Supabase/Edge Function).
- **Verificación:** build, simular nuevo deploy → la app actualiza sin cerrar pestañas; offline sigue cargando el shell.
- **Riesgo:** medio (probar registro/actualización del SW; cuidar caché en iOS).

---

## Fase 4 — Seguridad de invitaciones

### F4.1 — [ALTO] Reclamo de invitación por email sin token + no atómico
- **Archivo:** `contexts/OrganizationContext.tsx:43-107`; limpieza en `contexts/AuthContext.tsx` (`signOut`)
- **Causa raíz:** fallback que reclama por `invited_email` sin token; inserción de miembro y borrado de invitación en dos pasos no atómicos; `signOut` no limpia `localStorage` (token de invitación / org).
- **Arreglo:**
  1. Exigir token siempre (eliminar el fallback por email puro) — el `#hash` ya lo transporta.
  2. **(Producción)** RPC `claim_invitation(token text)` `security definer` que valide token + email del JWT, inserte miembro y marque/borrе la invitación **en una transacción**.
  3. En `signOut`, `localStorage.removeItem('prestaFlow_inviteToken'); localStorage.removeItem('prestaFlow_currentOrgId');`.
- **Verificación:** invitación válida con token entra; sin token no reclama; logout limpia estado; doble reclamo es idempotente.
- **Riesgo:** medio. **La RPC requiere migración en producción → confirmación explícita.**

---

## Fase 5 — Lógica de dinero desbloqueada por decisión

### F5.1 — [ALTO] Interés FIJO se sub-cobra tras abonos
- **Archivos:** `components/TransactionModal.tsx:64-87` (`entryCalc`); referencia: `services/loanUtils.ts`
- **Decisión:** modelo **FIJO sobre capital inicial** (interés por cuota plano).
- **Causa raíz:** `entryCalc` usa `currentDebt * periodicRate` sin mirar `interestType`; para FIJO el interés/cuota debe ser plano (`installmentAmount - capitalFijo`, o `firstPeriodInterest`), constante aunque baje el saldo.
- **Arreglo:** ramificar por `activeClient.interestType`. FIJO → interés sugerido = interés plano por período (derivado de la proyección guardada: `installmentAmount` y capital por cuota, o recomputar `firstPeriodInterest`). DIMINISHING → comportamiento actual (saldo×tasa).
- **Verificación:** préstamo FIJO 1.000.000 @10% 1 mes: cobro 1 = $100.000 interés; tras abono parcial, el interés del período sigue plano (no baja a saldo×tasa).
- **Riesgo:** medio (matemática de dinero; documentar con ejemplos en el plan).

### F5.2 — [ALTO] Mora desfasada un día e inconsistente desktop/móvil
- **Archivos:** `components/ClientCard.tsx:47`, `components/ClientList.tsx:438,547`, `components/client/ClientStats.tsx`; patrón correcto ya en `ClientList.tsx:155`, `QuickPaySearch.tsx:97`
- **Causa raíz:** `new Date('YYYY-MM-DD') < new Date()` interpreta medianoche UTC → mora un día antes en UTC-5; convive con comparación por string en otros lados.
- **Arreglo:** unificar a comparación de strings `client.nextPaymentDate < getToday() && balance > 0` en todos los puntos de mora.
- **Verificación:** cliente con vencimiento hoy NO aparece en mora hasta mañana; desktop y móvil coinciden.
- **Riesgo:** bajo.

---

## Orden de ejecución y dependencias

1. **Fase 0** (aislada, sin BD) → entregable rápido.
2. **Fase 1** (resiliencia UI).
3. **Fase 5** (dinero; F5.2 barato, F5.1 con ejemplos).
4. **Fase 2** (F2.1 ya; F2.2 requiere migración → confirmar).
5. **Fase 3** (SW; probar actualización).
6. **Fase 4** (requiere migración → confirmar).

Cada fase: commit propio, `tsc --noEmit` + `vite build` verdes, y prueba en vivo/Playwright o por el usuario donde haya auth. Los ítems con **migración en producción** (F2.2 RPC saldo, F4.1 RPC claim) se codifican localmente y se aplican solo tras confirmación explícita por separado.

## Fuera de alcance (documentado para después)
Medios (validación de cédula/teléfono/tasa, normalización de acentos, `permissionService` fail-open, `parseCurrency` con coma, `onTouchCancel` en SwipeableItem, manifest 192/512, "Prestar" en cliente cerrado, QuickPay sin teléfono, "Limpiar Logs" no-op, webhook sin validar) y bajos (Tailwind CDN, `alert()`/`confirm()`→toasts, accesibilidad de labels/`aria-live`/`user-scalable`, paginación/virtualización, toasts sin límite, revoke de object URLs, IDs con `Math.random()`). Redondeo de última cuota (dinero, bajo).

## Riesgos globales
- Sin framework de pruebas: la red de seguridad es `tsc` + `build` + prueba manual. Considerar añadir un par de pruebas Playwright para los flujos de dinero como deuda futura.
- Cambios de BD impactan a todos los tenants: aplicar con confirmación y, si es posible, validar antes en staging.
