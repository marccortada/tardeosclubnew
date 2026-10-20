"use client";

import { usePathname } from "next/navigation";
import { ReactNode, useEffect, useState } from "react";
import {
  LayoutDashboard, ListTodo, CalendarDays, Store, Users, PartyPopper, Megaphone, Briefcase,
  LineChart, Stethoscope, Home, Plus,
} from "lucide-react";
import { usePermisosAdmin } from "@/components/admin/roles";
import PanelShell, { type GrupoPanel } from "@/components/panel/PanelShell";
import { leerContadores, type Contadores } from "@/lib/adminContadores";
import Link from "next/link";
import { MARCA } from "@/lib/marca";

/**
 * Barra lateral del admin.
 *
 * Tenía 30 entradas en 7 grupos y conceptos repetidos («Por revisar», «Cola de
 * trabajo», «Reclamaciones», «Moderación»… eran casi lo mismo). Ahora son diez
 * entradas, cada una con sus pantallas como pestañas arriba de la página
 * (`hijas` → `SubSecciones`). Ninguna ruta /admin/* desaparece: solo cambia
 * desde dónde se llega.
 *
 * Orden pensado para el móvil (el admin entra casi siempre desde ahí): Inicio
 * y Cola de trabajo arriba, que es lo que se mira cada día; lo demás, por
 * bloques. Agrupado según el dossier (pág. 15): colas de trabajo, fichas
 * (locales/promotores/DJs), eventos con listas y espera, comunidad (sorteos,
 * encuestas), comercial (planes, Coins, promociones) y métricas.
 *
 * Suscripciones y Coins van juntas en Comercial y marcadas «Próximamente»
 * (pagos con PayPal más adelante): los cobros siguen apagados
 * (`ajustes.planes_activos`) hasta cerrar las reglas con el cliente.
 */
export default function AdminShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [c, setC] = useState<Contadores | null>(null);
  // Zona/tarea del admin (lote 69) y su local si también es dueño (caso Sergi).
  const permisos = usePermisosAdmin();

  useEffect(() => { leerContadores().then(setC).catch(() => setC(null)); }, [pathname]);

  const resenasFlyers = c ? (c.resenas ?? 0) + (c.flyers ?? 0) : null;
  const revisar = c ? (c.localesPorVerificar ?? 0) + (c.reclamaciones ?? 0) + (resenasFlyers ?? 0) : null;
  // «Por revisar» ya incluye reclamaciones y reseñas: la entrada cuenta cada
  // cosa una vez, no la suma de las pestañas.
  // El globo de «Cola de trabajo» es la cifra de la propia cola (la que se ve
  // al entrar y en Inicio); la suma a mano queda solo si la cola no se lee.
  const pendientes = c ? (c.cola ?? (revisar ?? 0) + (c.incidencias ?? 0)) : null;

  const grupos: GrupoPanel[] = [
    {
      items: [
        { href: "/admin", label: "Inicio", icon: LayoutDashboard, exacto: true },
        {
          href: "/admin/cola", label: "Cola de trabajo", icon: ListTodo, badge: pendientes,
          hijas: [
            { href: "/admin/cola", label: "Todo" },
            { href: "/admin/revisar", label: "Por revisar", badge: revisar },
            { href: "/admin/reclamaciones", label: "Reclamaciones", badge: c?.reclamaciones },
            { href: "/admin/moderacion", label: "Reseñas y flyers", badge: resenasFlyers },
            { href: "/admin/denuncias", label: "Denuncias" },
            { href: "/admin/incidencias", label: "Ayuda e incidencias", badge: c?.incidencias },
          ],
        },
      ],
    },
    // Admin que además tiene local (Sergi: Local + Admin Tarragona): acceso directo a su panel.
    ...(permisos.miLocal ? [{
      titulo: "Mi negocio",
      items: [{ href: "/local", label: `Mi local · ${permisos.miLocal.nombre}`, icon: Home }],
    }] : []),
    {
      titulo: "Gestión",
      items: [
        {
          href: "/admin/tardeos", label: "Eventos", icon: CalendarDays,
          hijas: [
            { href: "/admin/tardeos", label: "Tardeos" },
            { href: "/admin/registro", label: "Asistentes y espera" },
            { href: "/admin/destacados", label: "Destacados" },
          ],
        },
        {
          href: "/admin/locales", label: "Fichas", icon: Store,
          hijas: [
            { href: "/admin/locales", label: "Locales" },
            { href: "/admin/promotores", label: "Promotores" },
            { href: "/admin/djs", label: "DJs" },
          ],
        },
        {
          href: "/admin/usuarios", label: "Usuarios y equipo", icon: Users,
          hijas: [
            { href: "/admin/usuarios", label: "Usuarios" },
            { href: "/admin/equipo", label: "Equipo y zonas" },
          ],
        },
      ],
    },
    {
      titulo: "Promoción",
      items: [
        {
          href: "/admin/sorteos", label: "Comunidad", icon: PartyPopper,
          hijas: [
            { href: "/admin/sorteos", label: "Sorteos" },
            { href: "/admin/encuestas", label: "Encuestas" },
            { href: "/admin/nexo", label: "Nexo Radio" },
          ],
        },
        {
          href: "/admin/popups", label: "Avisos al público", icon: Megaphone,
          hijas: [
            { href: "/admin/popups", label: "Pop-ups" },
            { href: "/admin/notificaciones", label: "Notificaciones push" },
          ],
        },
        {
          href: "/admin/crm", label: "Comercial", icon: Briefcase,
          hijas: [
            { href: "/admin/crm", label: "CRM" },
            { href: "/admin/ofertas", label: "Ofertas por email" },
            { href: "/admin/promociones", label: "Extras y precios" },
            { href: "/admin/enlaces", label: "Enlaces de alta" },
            { href: "/admin/suscripciones", label: "Suscripciones", nota: "Próximamente" },
            { href: "/admin/coins", label: "Coins", nota: "Próximamente" },
          ],
        },
      ],
    },
    {
      titulo: "Datos",
      items: [
        { href: "/admin/estadisticas", label: "Estadísticas", icon: LineChart },
        {
          href: "/admin/salud", label: "Sistema", icon: Stethoscope,
          hijas: [
            { href: "/admin/salud", label: "Salud" },
            { href: "/admin/errores", label: "Errores" },
            { href: "/admin/auditoria", label: "Auditoría" },
          ],
        },
      ],
    },
  ];

  return (
    <PanelShell
      rol={permisos.global || permisos.cargando ? "Administración" : `Admin · ${(permisos.zonas ?? []).join(", ") || "tareas"}`}
      nombre={MARCA.nombre}
      grupos={grupos}
      cabecera={
        <Link href="/admin/crear"
          className="flex min-h-[44px] w-full items-center justify-center gap-2 rounded-lg bg-magenta text-[15px] font-bold text-white hover:bg-magenta-600">
          <Plus size={18} aria-hidden /> Crear nuevo
        </Link>
      }
    >
      {children}
    </PanelShell>
  );
}
