# Plan de Optimización de Rendimiento - Presta Flow

Este documento detalla el análisis actual de cuellos de botella y la hoja de ruta para transformar la velocidad de la plataforma.

## 1. Análisis de Estado Actual (Diagnóstico)

Tras revisar la arquitectura de datos y componentes, se han identificado los siguientes puntos que afectan la rapidez:

*   **Carga de Datos Masiva:** El `DataContext` intenta descargar hasta 2000 clientes y 2000 transacciones simultáneamente en cada inicio. Esto satura la memoria del navegador y la red.
*   **Bloqueos de Interfaz (Full-screen Loaders):** Actualmente, la app bloquea totalmente la vista hasta que *todo* está cargado. Esto genera una percepción de lentitud extrema.
*   **Procesamiento Redundante:** Muchos cálculos de saldos se realizan en el cliente sobre arrays masivos, lo cual se vuelve más lento a medida que crece la base de datos.
*   **Suscripciones Globales:** La app escucha cambios en tiempo real para todos los registros del negocio, lo cual consume recursos constantes.

---

## 2. Road Map de Optimización (Paso a Paso)

### [X] Fase 1: Mejoras en la Experiencia de Usuario (Inmediato)
*   **[x] Limpieza de Pantallas de Carga:** Uso de icono sin texto para una carga más limpia.
*   **[x] Implementación de Skeletons:** Mostrar "siluetas" de contenido mientras los datos se cargan.
*   **[x] Persistencia Local (Caché):** Guardar ajustes básicos en `localStorage` para visualización instantánea.

### [X] Fase 2: Optimización de la Arquitectura de Datos (Prioridad Alta)
*   **[x] Carga Diferida de Transacciones:** Cargar historial completo solo cuando se selecciona un cliente (Vertical Slicing).
*   **[ ] Paginación en el Lado del Servidor:** Implementar carga infinita para listas largas (Next step).
*   **Optimización de Queries Supabase:** Usar filtros de rango y selección de columnas específicas para reducir el tamaño de los paquetes de datos.

### [X] Fase 3: Mejoras Técnicas y Assets
*   **[x] Compresión de Imágenes:** Logos convertidos a SVG universal (Reducción del 98% en peso).
*   **[x] Code Splitting:** Implementación de `React.lazy` y `Suspense` para carga modular de vistas pesadas.

---

## 3. Alertas y Seguridad (Lo que se debe y no se debe hacer)

### ✅ Qué SE DEBE hacer:
*   Mantener siempre el filtro `organization_id`. **NUNCA** eliminarlo de las consultas para evitar que un usuario vea datos de otro negocio.
*   Usar `useMemo` y `useCallback` en componentes que manejan listas largas para evitar re-renderizados innecesarios.
*   Mantener las validaciones de conexión a Supabase antes de intentar cualquier operación.

### ❌ Qué NO SE DEBE hacer:
*   **No desactivar Realtime por completo.** La actualización de saldos depende de esto para ser precisa.
*   **No eliminar las pantallas de error.** Son críticas para diagnosticar problemas de red o configuración.
*   **No realizar cambios masivos en la base de datos sin un backup previo.**

---

## 4. Próximos Pasos Sugeridos
1.  **Reemplazar el cargador de la lista de clientes por Skeletons.**
2.  **Modificar el DataContext para que no traiga todas las transacciones de golpe.**
