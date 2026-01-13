# Roadmap de Solución: Corrección de Carga para Nuevos Usuarios

## Diagnóstico del Problema
El usuario reportó que al crear un nuevo usuario (con rol de admin) mediante invitación, este se quedaba atascado en una pantalla de carga infinita sin mostrar el contenido correspondiente a su organización.

**Causa Raíz:** Condición de Carrera ("Race Condition") en la inicialización lógica.
1. La aplicación cargaba `OrganizationContext`.
2. Se disparaban dos procesos en paralelo: `fetchOrganizations()` y `checkAndClaimInvitations()`.
3. `fetchOrganizations()` terminaba primero. Como el usuario era nuevo, no tenía organizaciones asociadas aún.
4. `checkAndClaimInvitations()` aceptaba la invitación e insertaba al usuario en la BD, *demasiado tarde*.
5. `currentOrg` quedaba como `null`.
6. `DataContext` (que maneja los datos del negocio) se quedaba esperando infinitamente a que hubiera una `currentOrg` o, peor, entraba en un estado de "cargando datos" que nunca se resolvía.

## Solución Implementada: "Strict Initialization Logic"

Se ha refactorizado la lógica de inicialización en `OrganizationContext.tsx` para forzar una ejecución secuencial estricta.

### 1. Bloqueo de Secuencia en `OrganizationContext`
**Código Anterior (Problemático):**
```typescript
useEffect(() => {
  fetchOrganizations();       // <-- Se ejecutaba independiente
  checkAndClaimInvitations(); // <-- Se ejecutaba independiente
}, [user]);
```

**Código Nuevo (Corregido):**
```typescript
useEffect(() => {
  const init = async () => {
    setIsLoading(true);
    // 1. PRIMERO aseguramos que la invitación se acepte
    await checkAndClaimInvitations(); 
    
    // 2. SOLO ENTONCES buscamos las organizaciones
    await fetchOrganizations(true);
    
    setIsLoading(false);
  };
  init(); // <-- Ejecución controlada
}, [user]);
```

### 2. Prevención de Bloqueo en `DataContext`
Se añadió una salvaguarda en `DataContext.tsx` para que, en el caso extremo de que un usuario no tenga organización (ej. borró la organización o falló todo), la aplicación termine de cargar y muestre la interfaz vacía o de onboarding, en lugar de un spinner infinito.

```typescript
if (!currentOrg) {
    setLoading(false); // <-- Desbloquea la UI
    return;
}
```

## Validación de Flujo (User Journey)
1. **Admin** genera enlace de invitación.
2. **Nuevo Usuario** hace click y se registra/loguea.
3. El sistema detecta el usuario y detiene la carga visual.
4. `checkAndClaimInvitations` encuentra el token, valida y añade al usuario a `organization_members`.
5. `fetchOrganizations` consulta la BD, encuentra la nueva membresía y descarga la organización.
6. `OrganizationContext` selecciona automáticamente esa organización por defecto.
7. `DataContext` detecta la organización seleccionada y descarga Clientes, Transacciones y Logs.
8. **Resultado:** El Dashboard aparece con los datos correctos según el rol del usuario.

## Próximos Pasos Recomendados
1. Probar el flujo completo creando un usuario de prueba en una ventana de incógnito.
2. Verificar que los permisos de "Admin" dentro de la organización permitan ver/editar lo esperado (esto se maneja en la lógica de `can(permission)` que ya está implementada).
