"use client";

import { usePathname } from "next/navigation";
import { ReactNode, useEffect, useState } from "react";
import {
  LayoutDashboard, Inbox, CalendarDays, Store, Megaphone, Disc3, Users, Star, ClipboardList,
  Bell, BellRing, Tag, Mail, Contact, Link2, LineChart, CreditCard, Stethoscope, Flag, MessageSquareWarning, Plus, LifeBuoy, Bug,
  ListTodo, ShieldCheck, History, Home,
} from "lucide-react";
import { Gift, SmilePlus } from "lucide-react"; // equipo D (sorteos, encuestas)
import { Radio } from "lucide-react"; // equipo B (Nexo Radio)
import { usePermisosAdmin } from "@/components/admin/roles";
import PanelShell, { type GrupoPanel } from "@/components/panel/PanelShell";
import { leerContadores, type Contadores } from "@/lib/adminContadores";
import Link from "next/link";

/**
 * Barra lateral del admin, como la del admin antiguo (Inicio · Locales ·
 * Tardeos · DJs · Usuarios · Banner · Registro · Onboarding · Analytics) pero
 * agrupada por trabajo y con lo pendiente contado al lado.
 *
 * Suscripciones está, pero marcada "Desactivado": los cobros siguen apagados
 * (`ajustes.planes_activos`) hasta cerrar las reglas con el cliente.
 */
export default function AdminShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [c, setC] = useState<Contadores | null>(null);
  // Zona/tarea del admin (lote 69) y su local si también es dueño (caso Sergi).
  const permisos = usePermisosAdmin();

  useEffect(() => { leerContadores().then(setC).catch(() => setC(null)); }, [pathname]);

  const revisar = c ? (c.localesPorVerificar ?? 0) + (c.reclamaciones ?? 0) + (c.resenas ?? 0) + (c.flyers ?? 0) : null;

  const grupos: GrupoPanel[] = [
    {
      items: [
        { href: "/admin", label: "Inicio", icon: LayoutDashboard, exacto: true },
        { href: "/admin/revisar", label: "Por revisar", icon: Inbox, badge: revisar },
        { href: "/admin/cola", label: "Cola de trabajo", icon: ListTodo },
      ],
    },
    // Admin que además tiene local (Sergi: Local + Admin Tarragona): acceso directo a su panel.
    ...(permisos.miLocal ? [{
      titulo: "Mi negocio",
      items: [{ href: "/local", label: `Mi local · ${permisos.miLocal.nombre}`, icon: Home }],
    }] : []),
    {
      titulo: "Contenido",
      items: [
        { href: "/admin/tardeos", label: "Tardeos", icon: CalendarDays },
        { href: "/admin/locales", label: "Locales", icon: Store },
        { href: "/admin/promotores", label: "Promotores", icon: Megaphone },
        { href: "/admin/djs", label: "DJs", icon: Disc3 },
        { href: "/admin/usuarios", label: "Usuarios", icon: Users },
        { href: "/admin/destacados", label: "Destacados (portada)", icon: Star },
        { href: "/admin/registro", label: "Registro de asistencias", icon: ClipboardList },
      ],
    },
    {
      titulo: "Moderación",
      items: [
        { href: "/admin/reclamaciones", label: "Reclamaciones", icon: Flag, badge: c?.reclamaciones },
        { href: "/admin/moderacion", label: "Reseñas y flyers", icon: MessageSquareWarning, badge: c ? (c.resenas ?? 0) + (c.flyers ?? 0) : null },
        { href: "/admin/denuncias", label: "Denuncias comunidad", icon: Flag },
      ],
    },
    {
      titulo: "Marketing",
      items: [
        { href: "/admin/popups", label: "Pop-ups", icon: Bell },
        { href: "/admin/notificaciones", label: "Notificaciones push", icon: BellRing },
        { href: "/admin/promociones", label: "Promociones y precios", icon: Tag },
        { href: "/admin/sorteos", label: "Sorteos", icon: Gift },
        { href: "/admin/nexo", label: "Nexo Radio", icon: Radio },
        { href: "/admin/encuestas", label: "Encuestas", icon: SmilePlus },
        { href: "/admin/estadisticas", label: "Estadísticas", icon: LineChart },
      ],
    },
    {
      titulo: "Comercial",
      items: [
        { href: "/admin/enlaces", label: "Enlaces para locales", icon: Link2 },
        { href: "/admin/ofertas", label: "Ofertas por email", icon: Mail },
        { href: "/admin/crm", label: "CRM", icon: Contact },
        { href: "/admin/suscripciones", label: "Suscripciones", icon: CreditCard, nota: "Apagado" },
        { href: "/admin/coins", label: "Coins", icon: CreditCard, nota: "Apagado" },
      ],
    },
    {
      titulo: "Sistema",
      items: [
        { href: "/admin/incidencias", label: "Incidencias", icon: LifeBuoy, badge: c?.incidencias },
        { href: "/admin/errores", label: "Errores", icon: Bug },
        { href: "/admin/equipo", label: "Equipo y zonas", icon: ShieldCheck },
        { href: "/admin/auditoria", label: "Auditoría", icon: History },
        { href: "/admin/salud", label: "Salud", icon: Stethoscope },
      ],
    },
  ];

  return (
    <PanelShell
      rol={permisos.global || permisos.cargando ? "Administración" : `Admin · ${(permisos.zonas ?? []).join(", ") || "tareas"}`}
      nombre="TardeosClub"
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
