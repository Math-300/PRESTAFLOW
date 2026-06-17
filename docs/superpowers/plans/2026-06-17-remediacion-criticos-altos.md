# Remediación de Críticos y Altos — Plan de Implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) o superpowers:executing-plans para implementar tarea por tarea. Los pasos usan checkbox (`- [ ]`).

**Goal:** Corregir los 5 críticos + 10 altos validados de la auditoría QA 2026-06-17, más 2 ítems de dinero desbloqueados (interés FIJO sobre capital, mora).

**Architecture:** SPA React 19 + Vite + TS hablando directo con Supabase (RLS = frontera). Cambios mayormente client-side; 2 tareas requieren RPC/migración en producción (marcadas, NO aplicar sin confirmación).

**Tech Stack:** React 19, Vite 6, TypeScript, @supabase/supabase-js v2, framer-motion, recharts, lucide-react.

## Global Constraints

- Moneda COP **entera** (sin decimales). App en **español**. Multi-tenant por `organization_id`.
- **No hay framework de tests.** Verificación de cada tarea: `npx tsc --noEmit` (sin errores nuevos en archivos tocados) + `npm run build` (verde) + prueba en vivo/Playwright cuando NO requiera auth; los flujos autenticados los prueba el usuario en `npm run dev` (el sandbox no resuelve DNS a Supabase).
- Nombres de columnas Supabase: camelCase entre comillas (`"nextPaymentDate"`, `"relatedClientId"`, etc.) y snake_case en settings.
- Anon key pública por diseño; secretos solo server-side. NO romper el patrón write-only de keys de IA.
- `console.*` se elimina en build de prod (esbuild drop) — no depender de logs en prod.
- Un commit por tarea. Mensajes en español. Co-Authored-By al final.
- **Tareas T13 y T15 tocan BD de producción** → codificar local, NO aplicar sin confirmación explícita del usuario.

## Orden de archivos (qué toca cada tarea, para evitar conflictos al paralelizar)

- `components/SettingsView.tsx` → T1
- `hooks/useDataOperations.ts` → T2, T13
- `components/AuthPage.tsx` → T3
- `App.tsx` → T4 (handleClientSubmit), T6 (atajos)
- `components/client/ClientStats.tsx` → T5, T16
- `contexts/DataContext.tsx` → T7, T12, T14
- `components/TransactionModal.tsx` → T8, T15(interés)
- `components/ui/PullToRefresh.tsx` → T9
- `components/AIChat.tsx` + `services/aiAgentService.ts` → T10
- `contexts/AuthContext.tsx` + `contexts/OrganizationContext.tsx` → T13
- `public/sw.js` → T11
- `components/ClientCard.tsx`, `components/ClientList.tsx` → T16 (mora)

**Regla de paralelización:** tareas que comparten archivo van en serie. Lotes seguros en paralelo: {T1, T2, T3, T5, T9, T11}; luego {T4, T6} en serie (ambas App.tsx); {T7, T12, T14} en serie (DataContext); {T8, luego T15-interés} en serie (TransactionModal); T10 aparte; T16 aparte; T13 y T15-RPC al final con confirmación.

---

## Fase 0 — Correcciones aisladas

### Task 1: [CRÍTICO] Mover `useAuth()` fuera del callback en Settings
**Files:** Modify `components/SettingsView.tsx` (sección "Mi Perfil", ~389-403)

- [ ] **Step 1:** Leer `components/SettingsView.tsx` y localizar dónde se define `DebouncedInput` y la sección "Mi Perfil".
- [ ] **Step 2:** En el cuerpo de `SettingsView` (top-level del componente, junto a los otros hooks), añadir: `const { user, updateProfile } = useAuth();`
- [ ] **Step 3:** Reemplazar `value={useAuth().user?.user_metadata?.full_name || ''}` por `value={user?.user_metadata?.full_name || ''}` y `await useAuth().updateProfile(...)` por `await updateProfile(...)`.
- [ ] **Step 4:** Si `DebouncedInput` está definido DENTRO de `SettingsView`, extraerlo a nivel de módulo (fuera del componente) para que no se recree en cada render.
- [ ] **Step 5:** Verificar: `npx tsc --noEmit 2>&1 | grep SettingsView || echo OK`; `npm run build`.
- [ ] **Step 6:** Commit: `git add components/SettingsView.tsx && git commit -m "Fix: useAuth fuera del callback de perfil (Reglas de Hooks)"`
- **Verificación en vivo (usuario):** editar "Nombre para Mostrar" en Configuración no crashea y persiste.

### Task 2: [CRÍTICO] Subir comprobante en `createBankMovement`
**Files:** Modify `hooks/useDataOperations.ts` (`createBankMovement`)

- [ ] **Step 1:** En `createBankMovement`, dentro del `try` y antes de construir el objeto `tx`, añadir:
```ts
let receiptPath: string | undefined;
if (receiptFile) {
    const uploaded = await uploadReceipt(receiptFile);
    if (uploaded) receiptPath = uploaded;
}
```
- [ ] **Step 2:** Añadir `receiptUrl: receiptPath` al objeto `tx`.
- [ ] **Step 3:** Verificar: `npx tsc --noEmit 2>&1 | grep useDataOperations || echo OK`; `npm run build`.
- [ ] **Step 4:** Commit: `git commit -am "Fix: subir comprobante en movimientos bancarios"`
- **Verificación (usuario):** registrar depósito con imagen → la fila guarda `receiptUrl`.

### Task 3: [ALTO] Mensajes de error de auth + feedback de registro
**Files:** Modify `components/AuthPage.tsx:37-56`

- [ ] **Step 1:** Crear helper local que mapee errores:
```ts
const mapAuthError = (raw: string): string => {
    const m = raw.toLowerCase();
    if (m.includes('failed to fetch') || m.includes('network')) return 'Sin conexión. Verifica tu internet.';
    if (m.includes('email not confirmed')) return 'Confirma tu correo antes de acceder.';
    if (m.includes('too many') || m.includes('rate')) return 'Demasiados intentos. Espera unos minutos.';
    if (m.includes('invalid login') || m.includes('credentials')) return 'Correo o contraseña incorrectos.';
    if (m.includes('already registered') || m.includes('already exists')) return 'Ese correo ya está registrado. Inicia sesión.';
    return 'Ocurrió un error. Intenta de nuevo.';
};
```
- [ ] **Step 2:** En `handleSubmit`, capturar el mensaje real (`err?.message`) y pasarlo por `mapAuthError`. Para registro: si `data?.user && data?.session` → entrar; si `data?.user && !data?.session` → "Te enviamos un correo de confirmación.".
- [ ] **Step 3:** Añadir `role="alert"` al contenedor de error.
- [ ] **Step 4:** Verificar: `tsc`/`build`.
- [ ] **Step 5:** Commit: `git commit -am "Fix: mensajes de error de autenticación específicos"`
- **Verificación en vivo:** credenciales malas vs sin red → mensajes distintos (probable en localhost: el de red).

### Task 4: [ALTO] Persistir "interés anticipado" en el desembolso inicial
**Files:** Modify `App.tsx` (`handleClientSubmit`, ~401-417)

- [ ] **Step 1:** En la construcción de `initialTx`, cambiar `interestPaid: 0` por `interestPaid: parseCurrency(formData.initialInterest) || 0`.
- [ ] **Step 2:** Confirmar import de `parseCurrency` (ya se usa en el archivo). NO modificar `balanceAfter` ni el delta bancario (decisión: el interés anticipado solo se registra como interés, no altera capital ni caja).
- [ ] **Step 3:** Verificar: `tsc`/`build`.
- [ ] **Step 4:** Commit: `git commit -am "Fix: registrar interés anticipado en desembolso inicial"`
- **Verificación (usuario):** crear cliente con interés anticipado → la transacción inicial lo guarda y suma a ganancia.

### Task 5: [ALTO] Arreglar filtro de rango temporal del gráfico
**Files:** Modify `components/client/ClientStats.tsx:75-82`

- [ ] **Step 1:** Cambiar `let startDate = new Date(0);` por `let startDate = new Date(now);`.
- [ ] **Step 2:** Verificar que para `'ALL'` se siga incluyendo todo (cuando `timeRange === 'ALL'` no se aplica ningún `setMonth`; con `new Date(now)` como base, añadir guard: si `timeRange === 'ALL'` usar `new Date(0)`).
```ts
let startDate = timeRange === 'ALL' ? new Date(0) : new Date(now);
```
- [ ] **Step 3:** Verificar: `tsc`/`build`.
- [ ] **Step 4:** Commit: `git commit -am "Fix: rango temporal del gráfico de cliente (1M/3M/6M)"`

### Task 6: [ALTO] Guard de foco en atajos de teclado
**Files:** Modify `App.tsx:128-165`

- [ ] **Step 1:** Al inicio de `handleKeyDown`:
```ts
const el = e.target as HTMLElement | null;
const typing = !!el && (['INPUT','TEXTAREA','SELECT'].includes(el.tagName) || el.isContentEditable);
```
- [ ] **Step 2:** Envolver los bloques F1/F2/F3 en `if (!typing) { ... }`. Para Escape, mantener el cierre de modales SOLO si `!typing` (cuando se escribe en un input de modal, dejar que el input maneje Escape).
- [ ] **Step 3:** Verificar: `tsc`/`build`.
- [ ] **Step 4:** Commit: `git commit -am "Fix: atajos de teclado no disparan al escribir en campos"`

### Task 7: [ALTO] Verificar `banksRes.error`
**Files:** Modify `contexts/DataContext.tsx:98-101`

- [ ] **Step 1:** Añadir `if (banksRes.error) throw banksRes.error;` junto a las otras verificaciones.
- [ ] **Step 2:** Verificar: `tsc`/`build`.
- [ ] **Step 3:** Commit: `git commit -am "Fix: verificar error de carga de cuentas bancarias"`

---

## Fase 1 — Resiliencia de UI asíncrona

### Task 8: [ALTO] `TransactionModal.handleSubmit` robusto
**Files:** Modify `components/TransactionModal.tsx:253-302`

- [ ] **Step 1:** Primera línea de `handleSubmit`: `if (isProcessing) return;`.
- [ ] **Step 2:** Validar antes de enviar: si `tab==='ENTRY' && isRedirectionEntry && !targetClientId` → mostrar error y `return`. Si `tab==='EXIT'`, normalizar simulador con `|| 0` para no enviar `NaN` (`interestRate: parseFloat(simRate) || 0`, `loanTermMonths: parseInt(simTerm) || 1`, `redirectionWaitDays: parseInt(redirectionWaitDays) || 0`).
- [ ] **Step 3:** Envolver el envío:
```ts
setIsProcessing(true);
try {
    const ok = await onSubmit({ ...payload }, receiptFile);
    if (ok) onClose();
} catch (e) {
    // el padre ya notifica; no cerrar para no perder datos
} finally {
    setIsProcessing(false);
}
```
(Quitar el `setIsProcessing(false); onClose();` incondicional actual.)
- [ ] **Step 4:** Deshabilitar el botón Confirmar también cuando falte `targetClientId` en redirección.
- [ ] **Step 5:** Verificar: `tsc`/`build`.
- [ ] **Step 6:** Commit: `git commit -am "Fix: TransactionModal respeta fallos, evita doble-submit y NaN"`
- **Verificación (usuario):** forzar fallo → modal sigue abierto con datos; Enter doble no duplica.

### Task 9: [ALTO] `PullToRefresh` resiliente y con scroll correcto
**Files:** Modify `components/ui/PullToRefresh.tsx`

- [ ] **Step 1:** En `onTouchEnd`, envolver: `try { await onRefresh(); } finally { setIsRefreshing(false); setPullOffset(0); }` (mover el reset al finally).
- [ ] **Step 2:** Añadir prop opcional `scrollRef?: React.RefObject<HTMLElement>` y en `onTouchStart` comprobar `const atTop = scrollRef?.current ? scrollRef.current.scrollTop === 0 : window.scrollY === 0;`. Documentar que el consumidor debe pasar el contenedor scrollable.
- [ ] **Step 3:** Añadir `onTouchCancel={onTouchEnd}` (o un reset) al contenedor.
- [ ] **Step 4:** Verificar: `tsc`/`build`.
- [ ] **Step 5:** Commit: `git commit -am "Fix: PullToRefresh no se cuelga y respeta el tope real de scroll"`
- **Nota:** si conectar `scrollRef` en los consumidores es invasivo, dejar el fallback `window.scrollY` pero SIEMPRE aplicar el try/finally y onTouchCancel (lo crítico).

### Task 10: [ALTO] Chat IA con timeout y sin perder historial
**Files:** Modify `components/AIChat.tsx:29-79`, `services/aiAgentService.ts`

- [ ] **Step 1:** Leer ambos archivos. En `aiAgentService`, envolver la llamada con `AbortController` y `setTimeout(() => controller.abort(), 30000)`; limpiar el timeout en `finally`. Propagar un error claro si aborta.
- [ ] **Step 2:** En `AIChat`, separar el `useEffect` de inicialización del agente (dep `[currentOrg?.id]`) del mensaje de bienvenida. NO reiniciar `messages` al cambiar `activeClient` (o documentar reset explícito si se desea).
- [ ] **Step 3:** Asegurar `setIsTyping(false)` en `finally` del envío.
- [ ] **Step 4:** Verificar: `tsc`/`build`.
- [ ] **Step 5:** Commit: `git commit -am "Fix: chat IA con timeout y sin borrar historial al cambiar de cliente"`

---

## Fase 2 — Correctitud de datos y concurrencia

### Task 11: [CRÍTICO] Service Worker versionado y network-first para navegación
**Files:** Modify `public/sw.js`

- [ ] **Step 1:** Subir versión: `const CACHE_NAME = 'presta-flow-v2';`.
- [ ] **Step 2:** En `install`: `self.skipWaiting()` tras `cache.addAll(ASSETS)`.
- [ ] **Step 3:** Añadir `activate` que borre cachés con nombre != CACHE_NAME y haga `self.clients.claim()`:
```js
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then(keys => Promise.all(
      keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))
    )).then(() => self.clients.claim())
  );
});
```
- [ ] **Step 4:** Reescribir `fetch`: ignorar requests no-GET y cross-origin (`if (event.request.method !== 'GET' || new URL(event.request.url).origin !== self.location.origin) return;`). Para `mode === 'navigate'` o HTML → **network-first** con fallback a caché. Para assets estáticos → cache-first.
- [ ] **Step 5:** Verificar: `npm run build`; revisar que `dist` sirve y el SW registra (Playwright en localhost: cargar, ver Application→SW si es posible).
- [ ] **Step 6:** Commit: `git commit -am "Fix: SW versionado, activate cleanup y network-first para navegación"`
- **Verificación (usuario):** tras un deploy nuevo, la app actualiza sin cerrar pestañas; offline aún carga.

### Task 12: [CRÍTICO] `.order()` en la carga de transacciones/clientes
**Files:** Modify `contexts/DataContext.tsx:88-93`

- [ ] **Step 1:** En el select de `transactions`, añadir `.order('date', { ascending: false })` antes de `.limit(2000)`.
- [ ] **Step 2:** En `clients`, añadir `.order('created_at', { ascending: false })` antes de `.limit(2000)`.
- [ ] **Step 3:** Añadir un `console.warn` si `data.length === 2000` (techo alcanzado) — documentar paginación como deuda.
- [ ] **Step 4:** Verificar: `tsc`/`build`.
- [ ] **Step 5:** Commit: `git commit -am "Fix: ordenar transacciones/clientes antes del límite de 2000"`

### Task 14: [ALTO] `loadClientHistory` sin dependencia inestable
**Files:** Modify `contexts/DataContext.tsx:286-323`

- [ ] **Step 1:** Crear `const transactionsRef = useRef(transactions);` y un `useEffect(() => { transactionsRef.current = transactions; }, [transactions]);`.
- [ ] **Step 2:** En `loadClientHistory`, leer `transactionsRef.current` en vez de `transactions`; quitar `transactions` de las deps del `useCallback` (dejar `[currentOrg]`).
- [ ] **Step 3:** Rastrear clientes cargados con `const loadedClients = useRef(new Set<string>())` en vez de inferir por `notes`. No vaciar las tx del cliente antes de re-poblar: hacer merge (`prev.filter(t => t.clientId !== clientId).concat(detailed)`) solo tras recibir `detailed`.
- [ ] **Step 4:** Verificar: `tsc`/`build`.
- [ ] **Step 5:** Commit: `git commit -am "Fix: loadClientHistory sin parpadeo de cartera ni bucle de render"`

---

## Fase 3 — Lógica de dinero (decisión: FIJO sobre capital)

### Task 16: [ALTO] Unificar cálculo de mora (comparación por string)
**Files:** Modify `components/ClientCard.tsx:47`, `components/ClientList.tsx:438,547`, `components/client/ClientStats.tsx` (donde calcule `isLate`)

- [ ] **Step 1:** Importar/usar `getToday()` de `utils/format`. Reemplazar `new Date(client.nextPaymentDate) < new Date()` por `client.nextPaymentDate && client.nextPaymentDate < getToday()` en cada punto de mora. Mantener `&& currentBalance > 0` donde ya exista.
- [ ] **Step 2:** Verificar que coincida con el patrón ya correcto de `ClientList.tsx:155` y `QuickPaySearch.tsx:97`.
- [ ] **Step 3:** Verificar: `tsc`/`build`.
- [ ] **Step 4:** Commit: `git commit -am "Fix: unificar cálculo de mora por string (evita desfase de un día)"`

### Task 15a: [ALTO] Interés FIJO sobre capital en el cobro
**Files:** Modify `components/TransactionModal.tsx:64-87` (`entryCalc`)

- [ ] **Step 1:** Ramificar por `activeClient.interestType`:
  - Si `'FIXED'` (o no DIMINISHING): interés sugerido = interés plano por período. Derivarlo de la config guardada: `flatInterest = Math.round((P_inicial * (rate/100) * loanTermMonths) / installmentsCount)`. Si no se dispone de `P_inicial`, usar `firstPeriodInterest` recomputado con `calculateLoanProjection`. El capital sugerido = `Math.max(0, installmentAmount - flatInterest)`.
  - Si `'DIMINISHING'`: comportamiento actual (`currentDebt * periodicRate`).
- [ ] **Step 2:** Asegurar que el interés FIJO sugerido NO baje al reducirse el saldo (constante por cuota).
- [ ] **Step 3:** Verificar: `tsc`/`build`.
- [ ] **Step 4:** Commit: `git commit -am "Fix: interés FIJO sobre capital en sugerencia de cobro"`
- **Verificación (usuario):** préstamo FIJO 1.000.000 @10% 1 mes: cobro 1 interés $100.000; tras abono parcial el interés del período sigue plano.

---

## Fase 4 — Cambios con migración en producción (NO aplicar sin confirmación)

### Task 13: [CRÍTICO] Saldo bancario atómico + realtime de bancos  ⚠ PRODUCCIÓN
**Files:** Create `scripts/migration_bump_bank_balance.sql`; Modify `hooks/useDataOperations.ts` (`updateBankBalance`), `contexts/DataContext.tsx` (canal realtime)

- [ ] **Step 1:** Escribir SQL (NO ejecutar aún):
```sql
create or replace function public.bump_bank_balance(p_bank_id uuid, p_delta numeric, p_allow_negative boolean default false)
returns numeric language plpgsql security definer set search_path = '' as $$
declare v_new numeric;
begin
  update public.bank_accounts set balance = balance + p_delta
   where id = p_bank_id returning balance into v_new;
  if v_new is null then raise exception 'cuenta no encontrada'; end if;
  if not p_allow_negative and v_new < 0 then raise exception 'Fondos insuficientes'; end if;
  return v_new;
end $$;
revoke all on function public.bump_bank_balance(uuid,numeric,boolean) from public, anon;
grant execute on function public.bump_bank_balance(uuid,numeric,boolean) to authenticated;
```
  (RLS: la función es `security definer`; validar membresía/permiso dentro si se requiere endurecer.)
- [ ] **Step 2:** Reescribir `updateBankBalance` para llamar `supabase.rpc('bump_bank_balance', { p_bank_id, p_delta: amountChange, p_allow_negative: allowNegative })` y usar el `balance` retornado para `setBankAccounts` (en vez del cálculo en memoria). Mantener rollback optimista ante error.
- [ ] **Step 3:** Añadir listener realtime de `bank_accounts` en `DataContext` (igual patrón que `clients`).
- [ ] **Step 4:** Verificar: `tsc`/`build`.
- [ ] **Step 5:** **PARAR.** Pedir confirmación al usuario para aplicar la migración (MCP `apply_migration`/`execute_sql`).
- [ ] **Step 6:** Tras confirmación, aplicar y commit: `git commit -am "Fix: saldo bancario atómico (RPC) + realtime de cuentas"`

### Task 15b: [ALTO] Reclamo de invitación seguro y atómico  ⚠ PRODUCCIÓN
**Files:** Create `scripts/migration_claim_invitation.sql`; Modify `contexts/OrganizationContext.tsx:43-107`, `contexts/AuthContext.tsx` (`signOut`)

- [ ] **Step 1:** Quitar el fallback por email puro: exigir siempre token (del `#hash`).
- [ ] **Step 2:** Escribir SQL (NO ejecutar): función `public.claim_invitation(p_token text)` `security definer` que valide token + `auth.email()`, inserte en `organization_members` y borre/marque la invitación en una transacción; `grant execute ... to authenticated`.
- [ ] **Step 3:** Reescribir `checkAndClaimInvitations` para llamar la RPC con el token.
- [ ] **Step 4:** En `signOut` (`AuthContext`), añadir `localStorage.removeItem('prestaFlow_inviteToken'); localStorage.removeItem('prestaFlow_currentOrgId');`.
- [ ] **Step 5:** Verificar: `tsc`/`build`.
- [ ] **Step 6:** **PARAR.** Confirmar antes de aplicar la migración.
- [ ] **Step 7:** Tras confirmación, aplicar y commit: `git commit -am "Fix: reclamo de invitación con token y RPC atómica + limpieza de logout"`

---

## Self-Review (cobertura del spec)

- F0.1→T1, F0.2→T2, F0.3→T3, F0.4→T4, F0.5→T5, F0.6→T6, F0.7→T7 ✓
- F1.1→T8, F1.2→T9, F1.3→T10 ✓
- F2.1→T12, F2.2→T13(prod), F2.3→T14 ✓
- F3.1→T11 ✓
- F4.1→T15b(prod) ✓
- F5.1→T15a, F5.2→T16 ✓
- Sin placeholders sin resolver. Tipos/firmas consistentes con el código leído. Las 2 tareas de producción están aisladas al final con gate de confirmación.

## Notas de ejecución
- `signOut` limpia localStorage (parte de T15b) aunque el resto de T15b sea producción: el cambio de `signOut` es client-side y puede commitearse aparte si se desea avanzar sin la RPC.
- Si añadir `scrollRef` a los consumidores de PullToRefresh resulta invasivo, T9 puede entregar solo try/finally + onTouchCancel (lo crítico) y dejar el scrollRef como mejora.
