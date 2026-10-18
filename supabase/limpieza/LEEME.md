# Limpieza de la migración doble

La migración desde tardeosclub.com se ejecutó dos veces con dos scripts distintos y
dejó copias de tardeos, locales y DJs. **No está aplicada en producción**: necesita el
"sí" del cliente (CLAUDE.md §4.2). Recuentos actuales, solo lectura:

```bash
node --env-file=.env.local scripts/limpieza-recuentos.mjs
```

**Para aplicarlo de una vez: `PEGAR_LIMPIEZA.sql`** (L0 a L8 seguidos; probado dos veces
seguidas en local). **Sí del cliente: 17-oct-2026.**

## Orden y qué hace cada uno

| Paso | Fichero | Qué hace | Borra |
|---|---|---|---|
| 0 | `L0_copia_de_seguridad.sql` | Copia tardeos, locales, DJs, perfiles y métricas en tablas `_bak_limpieza_*` (ocultas). **Siempre primero.** | No |
| 1 | `L1_tardeos_duplicados.sql` | Pasa al gemelo bueno lo que solo tiene la copia (tipo, ambiente, público, dress code), sus métricas, sus inscripciones y sus favoritos; borra las copias. | Sí (copias) |
| 2 | `L2_locales_duplicados.sql` | Pasa al local bueno el dueño, las fotos, el orden de destacado y las métricas; borra las copias. | Sí (copias) |
| 3 | `L3_djs_duplicados.sql` | Pasa al DJ bueno la cuenta, el orden y las métricas (no el WhatsApp); borra las copias. | Sí (copias) |
| 4 | `L4_vincular_cuentas_por_email.sql` | Cuando alguien confirma su email y coincide con un perfil migrado, recibe sus fichas. Nunca el permiso de admin. | No |
| 5 | `L5_destacados_orden_de_la_antigua.sql` | Pone el orden de destacados de la web antigua. **Sustituye** el orden actual. | No |
| 6 | `L6_zonas_unificadas.sql` | Unifica nombres de zona (Mataro → Mataró…). | No |
| 7 | `L7_estados.sql` | Propaga el cancelado de la antigua y marca `finalizado` lo publicado ya pasado. | No |
| 8 | `L8_ocultar_fichas_de_prueba.sql` | Oculta gnerai, Interdesign y localp (reversible). Independiente del resto. | No |

## Garantías

- **Todo o nada**: cada fichero va en una transacción. Si algo falla, no cambia nada.
- **Guardas**: L1-L3 se paran si de una copia cuelga algo que no sea una métrica
  (cartel de DJs, Meet Zone, sorteos…). El mensaje dice qué tabla y cuántas filas.
- **Inscripciones**: pasan al gemelo. El 16-oct alguien se apuntó a la copia publicada de
  «Fiesta Sevillanas»; su gemelo está en borrador porque en la web antigua estaba inactiva
  (fechas sin sentido: 2-ene-2027 / 28-mar-2026; el flyer dice 21 feb). Tras la limpieza
  deja de verse hasta que el local la publique con la fecha buena.
- **Métricas**: no se pierden; se pasan al gemelo. Solo se quitan las que ya estaban
  repetidas en él (misma sesión, tipo y día), que contarían doble.
- **SQL Editor sin sesión**: los disparadores de protección deshacen en silencio cambios de
  estado y de orden si "no eres admin". Por eso L1-L3 y L5-L8 marcan su transacción como
  escritura del servidor (`set_config(..., true)`, solo hasta el commit).
- **Idempotente**: repetir cualquier paso no cambia nada más.

Probado el 17-oct-2026 en Postgres local con los lotes 01-72 y un escenario que imita
producción (copias con métricas, una visita repetida, contadores, tardeo real con
asistentes, inscripción y favorito en una copia): 26 comprobaciones, todas bien, también en la segunda pasada.
