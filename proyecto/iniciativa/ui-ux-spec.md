# UI/UX Spec — WinLabs Analytics

> Basado en el AppShell de AI-GEO-platform con primary azul en lugar de rojo.
> Última actualización: 2026-06-01

---

## Fuente

**Geist Sans** — de Vercel, compacta y técnica, ideal para dashboards de datos.

```ts
// apps/*/app/layout.tsx
import { GeistSans } from "geist/font/sans";
```

Instalación: `pnpm add geist --filter @wla/cliente --filter @wla/cmp`

---

## Paleta de colores

| Token | Valor | Uso |
|---|---|---|
| `--primary` | `#dc2626` | Botones, links, títulos de página, ítem activo sidebar, accents |
| `--sidebar` | `#1e2530` | Fondo del sidebar |
| `--topbar` | `#2c3540` | Fondo del topbar |
| `--background` | `#f6f7f5` | Fondo del área de contenido |
| `--card` | `#ffffff` | Fondo de cards / panels |
| `--border` | `#e2e5e0` | Bordes de cards y separadores en contenido claro |
| `--sidebar-border` | `rgba(255,255,255,0.08)` | Separadores dentro del sidebar |
| `--foreground` | `#111214` | Texto principal |
| `--muted-foreground` | `#6b7280` | Texto secundario / labels |

---

## Login pages (split layout)

### Estructura
```
┌────────────────────────┬─────────────────┐
│  Hero (flex: 1.1)      │ Form (flex: 0.9) │
│  bg: #1a1f24 + overlay │ bg: white        │
│                        │                  │
│  [WL] WinLabs          │ eyebrow (blue)   │
│  Analytics             │ título bold      │
│                        │ subtítulo muted  │
│  Headline bold         │                  │
│  grande (2xl+)         │ [Organización]   │
│                        │ [Email]          │
│  KPI cards (2col)      │ [Contraseña]     │
│  al fondo              │ [Entrar] button  │
└────────────────────────┴─────────────────┘
```

### Hero side
- Fondo: `#1a1f24` con overlay gradiente oscuro
- Logo: cuadrado `WL` azul (`#dc2626`) + "WinLabs Analytics"
- Pill con punto azul: texto descriptivo del producto
- Headline: blanco, bold, max 3 líneas
- KPI preview cards: `rgba(255,255,255,0.07)` bg + `rgba(255,255,255,0.12)` border
- Texto KPI: blanco / verde para positivo / rojo para negativo

### Form side
- Fondo: blanco
- Eyebrow: `#dc2626`, 11px, 600 weight, "Acceso seguro"
- Título: 22px, 700 weight
- Subtítulo: 13px, muted
- Inputs: borde `0.5px solid var(--border)`, foco `1.5px solid #dc2626`, border-radius 6px
- Botón: `#dc2626`, blanco, full-width, 600 weight
- Link "¿Olvidaste tu contraseña?": `#dc2626`, 11px

### CMP vs Cliente
- **Cliente**: 3 campos (Organización + Email + Contraseña)
- **CMP**: 2 campos (Email + Contraseña) + eyebrow "Console interna"

---

## Dashboard layout

### Sidebar (width: 220px colapsado → 64px icon-only)
- Fondo: `#1e2530`
- Header: logo `WL` azul cuadrado + "WinLabs / Analytics" cuando expandido
- Nombre del tenant (Cliente) o "Console" (CMP): chip gris debajo del logo
- Nav items: icon + label, `color: rgba(255,255,255,0.6)`, hover `rgba(255,255,255,0.08)`
- Item activo: `bg: #fff1f1` (azul muy claro), `color: #1e2530`, `font-weight: 600`
- Separadores: `rgba(255,255,255,0.08)`
- Footer: avatar iniciales + nombre + email truncado

### Topbar (height: 48px)
- Fondo: `#2c3540`
- Derecha: TenantSwitcher (dropdown) + bell notification + avatar
- Sin logo (el logo vive en el sidebar)

### Content area
- Fondo: `#f6f7f5`
- Page title: `color: #dc2626`, 20px, 700 weight (igual que AI-GEO con rojo → azul)
- Cards: blanco, `border: 0.5px solid #e2e5e0`, border-radius 8px
- KPI cards: grid 2-4 columnas, valor grande (24px bold), label muted arriba, delta abajo

---

## Componentes a crear/actualizar en packages/ui

### Nuevos
- `AppShell` (server) — resuelve user + tenant + nav
- `AppShellFrame` (client) — sidebar collapsed/expanded + grid
- `Topbar` — tenant switcher + notifications + user menu
- `SidebarNav` — grupos + items + estado activo
- `PageHeader` — eyebrow (blue) + title + actions slot
- `KpiCard` — label + valor grande + delta
- `DataPanel` — card contenedora para tablas/charts
- `EmptyState` — icon + texto + CTA

### Actualizar
- `globals.css` — tokens de color, Geist Sans, variables sidebar/topbar
- `packages/ui/src/tokens.ts` — exportar los nuevos tokens

---

## Variables CSS (globals.css)

```css
@import url('...geist font...');

:root {
  --font-sans: 'Geist Sans', system-ui, sans-serif;
  --background: #f6f7f5;
  --foreground: #111214;
  --card: #ffffff;
  --card-foreground: #111214;
  --border: #e2e5e0;
  --input: #e2e5e0;
  --primary: #dc2626;
  --primary-foreground: #ffffff;
  --muted: #eceee8;
  --muted-foreground: #6b7280;
  --accent: #d7dbd2;
  --accent-foreground: #111214;
  --destructive: #dc2626;
  --destructive-foreground: #ffffff;
  --success: #16a34a;
  --warning: #d97706;
  --ring: #dc2626;
  --radius: 0.5rem;
  --sidebar: #1e2530;
  --sidebar-foreground: #f5f5f0;
  --sidebar-border: rgba(255,255,255,0.08);
  --sidebar-accent: rgba(255,255,255,0.08);
  --sidebar-active-bg: #fff1f1;
  --sidebar-active-fg: #1e2530;
  --topbar: #2c3540;
  --topbar-foreground: #f5f5f0;
  --topbar-border: rgba(255,255,255,0.12);
}
```


---

## Correcciones v2 (2026-06-01)

- **Primary color:** `#dc2626` (rojo) — reemplaza el azul `#2563eb`
- **Active nav bg:** `#fff1f1` (rojo muy claro)
- **Sidebar:** colapsado por default (64px, solo iconos). Expandido: 220px con labels. Toggle = icono hamburguesa / flecha.
- **Usuario en topbar:** el avatar + nombre + dropdown de usuario va en el topbar (derecha), NO en el footer del sidebar. En el sidebar no hay footer de usuario.
- **Topbar (de izq a der):** [vacío / breadcrumb futuro] → [flex-1] → TenantSwitcher + Bell + UserMenu
