# Arranque — Nueva sesión de implementación

> Paquete listo para abrir una nueva sesión (Cowork / Claude Code) con Opus 4.6 y arrancar el desarrollo de WinLabs Analytics desde M0.
>
> Última actualización: 2026-05-19.

---

## 1. Qué hay en esta carpeta

```
arranque/
├── README.md              ← este archivo (instrucciones)
├── prompt-inicial.md      ← prompt para pegar al iniciar la nueva sesión
├── CLAUDE.md              ← archivo listo para copiar a la raíz del repo
└── skills/                ← skills listos para .claude/skills/ del repo
    ├── SKILL-6-generate-documentation.md
    ├── SKILL-7-cmp-db-modeling.md
    ├── SKILL-9-ai-agent-tooling-integration.md
    ├── SKILL-10-prisma-seed-and-migrate.md
    ├── SKILL-11-performance-cache-strategy.md
    ├── add-table.md
    └── add-crud.md
```

---

## 2. Antes de abrir la sesión nueva

Ten listo:

- ☐ El folder `D:\Win-Devs\winlabs-analytics\` con todo este `proyecto/` (la nueva sesión lo va a montar como workspace).
- ☐ Una decisión sobre el **nombre del repo** (sugerido: `winlabs-analytics`).
- ☐ Cuenta GitHub donde crearás el repo privado (la podés crear manualmente cuando lo decidas — no es prerequisito para empezar).
- ☐ Postgres 16+ instalado localmente + pgAdmin 4.
- ☐ Node.js 20 LTS + pnpm instalados.

> Si no tenés algún pre-requisito todavía, podés arrancar igual: el agente te va a guiar y vos los instalás en paralelo.

---

## 3. Cómo abrir la sesión nueva

1. **Abrí Cowork** (o el cliente que uses) con modelo **Opus 4.6** seleccionado.
2. **Montá el folder** `D:\Win-Devs\winlabs-analytics\` como workspace (igual que en esta sesión).
3. **Pegá el prompt inicial** desde `prompt-inicial.md` en el primer mensaje.
4. El agente arrancará leyendo `proyecto/README.md` y `proyecto/09-setup-inicial.md` para tener contexto y proponerte el primer paso.

---

## 4. Cómo copiar el CLAUDE.md y los skills al repo

Una vez que el agente te ayude a crear el repo `winlabs-analytics`:

1. **`CLAUDE.md`** → copialo a la raíz del repo (mismo nivel que `package.json`).
2. **Skills** → creá la carpeta `.claude/skills/` y copiá todos los `.md` de `arranque/skills/` ahí.

```
winlabs-analytics/                  ← raíz del repo nuevo
├── CLAUDE.md                       ← copiado desde arranque/
├── .claude/
│   └── skills/
│       ├── SKILL-6-generate-documentation.md
│       ├── SKILL-7-cmp-db-modeling.md
│       ├── SKILL-9-ai-agent-tooling-integration.md
│       ├── SKILL-10-prisma-seed-and-migrate.md
│       ├── SKILL-11-performance-cache-strategy.md
│       ├── add-table.md
│       └── add-crud.md
├── proyecto/                       ← mové todo lo que está en D:\Win-Devs\winlabs-analytics\proyecto\
├── apps/
├── packages/
├── docs/
└── package.json
```

> Decisión: el folder `proyecto/` se mueve adentro del repo nuevo cuando el repo exista. Hasta entonces vive en `D:\Win-Devs\winlabs-analytics\` como raíz suelta.

---

## 5. Qué skills van a crearse después (no urgente en M0)

Estos los podés crear en sesiones futuras cuando empieces las fases relevantes:

- `add-integration.md` — cuando arranques Fase 4 / M2 (file connectors).
- `add-dashboard.md` — cuando arranques Fase 4 / M3 (primer dashboard).
- `add-ai-tool.md` — cuando registres tu primera tool del agente (M5+).

El agente puede ayudarte a generarlos cuando los necesites.

---

## 6. Tip operativo

Cuando abras la sesión nueva, lo primero que el agente debería hacer es:

1. Leer `proyecto/README.md` para ver el mapa.
2. Leer `proyecto/09-setup-inicial.md` para saber qué toca hacer ahora.
3. Confirmar con vos los **3 decisiones abiertas críticas** que bloquean el arranque (ver `proyecto/DECISIONS.md` Open-3 subdomain vs path-based, Open-6 acceso APIs, T0 efectivo).
4. Proponerte el **Paso 1** del setup y empezar.

Si el agente no hace esto solo, podés decirle: *"Leé `proyecto/README.md` y `proyecto/09-setup-inicial.md` y proponeme el primer paso concreto."*
