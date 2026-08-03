# config.py — CORZE CRM v1.0

APP_NAME    = "Corze — Energía Inteligente"
APP_VERSION = "1.0"

USERS = {
    "Ignacio Corvalán": {
        "pin":    "1357",
        "color":  "#F5A623",
        "avatar": "IC",
        "role":   "admin",
    },
    "Enrique Corvalán H": {
        "pin":    "1357",
        "color":  "#3498DB",
        "avatar": "ECH",
        "role":   "admin",
    },
    "Enrique Corvalán J": {
        "pin":    "1357",
        "color":  "#2ECC71",
        "avatar": "ECJ",
        "role":   "admin",
    },
    "José Zelada": {
        "pin":    "1357",
        "color":  "#9B59B6",
        "avatar": "JZ",
        "role":   "admin",
    },
}

# ─── CATEGORÍAS DE PRODUCTOS SOLARES ─────────────────────────────────────────
CATEGORIAS_PRODUCTO = [
    "Panel Solar",
    "Inversor",
    "Batería",
    "Estructura",
    "Material Eléctrico",
    "Accesorio",
    "Otro",
]

# ─── ETAPAS PIPELINE ──────────────────────────────────────────────────────────
ETAPAS_PIPELINE = [
    "Nuevo Lead",
    "Intento Llamado 1",
    "Intento Llamado 2",
    "Contactado",
    "Esperando Cuenta Luz",
    "Visita Técnica Agendada",
    "Presupuesto Sin Validar",
    "Presupuesto Enviado",
    "En Negociación",
    "Aprobada",
    "Contrato Firmado",
    "En Instalación",
    "Proyecto Finalizado",
    "Post Venta 1",
    "Post Venta 2",
    "Cerrado",
    "Cliente Perdido",
]
