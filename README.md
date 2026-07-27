# 🚗 VTA — Vende Tu Auto · Gestor de Inventario v2.0

---

## 📁 Estructura del proyecto

```
vta_v2/
├── main.py           ← 🚀 PUNTO DE ENTRADA
├── config.py         ← Usuarios, colores, listas maestras
├── database.py       ← SQLite + Firebase opcional
├── login.py          ← Pantalla de inicio de sesión con PIN
├── dashboard.py      ← KPIs + 4 gráficos
├── views.py          ← Tablas de Compra/Venta y Consignaciones
├── dialogs.py        ← Formularios de ingreso y edición
├── widgets.py        ← Componentes UI reutilizables
├── build.spec        ← Para generar .exe con PyInstaller
├── requirements.txt
├── assets/
│   └── logo.png
├── vehicle_photos/   ← Fotos de vehículos (se crea automático)
├── exports/          ← Exports Excel/CSV (se crea automático)
└── vta_database.db   ← Base de datos SQLite (se crea automático)
```

---

## ⚙️ Instalación rápida

```bash
# 1. Instalar dependencias
pip install -r requirements.txt

# 2. Ejecutar
python main.py
```

---

## 👤 Cambiar usuarios y PINs

Abre `config.py` y edita la sección `USERS`:

```python
USERS = {
    "Felipe": {
        "pin":    "1234",   # ← cambia aquí
        "color":  "#00AEEF",
        "avatar": "FE",
    },
    "Valentina": {
        "pin":    "5678",   # ← cambia aquí
        "color":  "#9B59B6",
        "avatar": "VA",
    },
}
```

Puedes cambiar nombres, PINs, colores y avatares libremente.

---

## 🔥 Configurar Firebase (opcional)

1. Ve a https://console.firebase.google.com/
2. Crea un proyecto → Firestore Database → Modo producción
3. Configuración del proyecto → Cuentas de servicio → Generar nueva clave privada
4. Guarda el `.json` como `firebase_credentials.json` en la carpeta del proyecto
5. Instala el SDK: `pip install firebase-admin`
6. Reinicia la app — verás 🔥 Firebase activo en la barra lateral

---

## 🖥️ Generar ejecutable (.exe / .app)

```bash
pip install pyinstaller
pyinstaller build.spec
```

El ejecutable queda en `dist/VTA/VTA.exe` (Windows) o `dist/VTA/VTA` (macOS).
Solo distribuye la carpeta `dist/VTA/` completa — contiene todo lo necesario.

---

## ✅ Funcionalidades v2.0

### 🔐 Login con 2 usuarios
- Pantalla de inicio con selección de usuario y PIN de 4 dígitos
- Cada acción registra quién la realizó
- Botón de cierre de sesión desde la barra lateral

### 📊 Dashboard
- 8 KPIs: stock, ventas, ganancia, tiempo promedio, valor inventario, alertas, consignaciones, comisiones
- 4 gráficos: ventas por mes, stock por marca, estado inventario, rentabilidad por marca

### 🚗 Compra / Venta
Todos los campos de la planilla original más:
- Transmisión, Combustible, N° Dueños
- **Valor de Mercado**
- Ganancia calculada automáticamente
- Días en stock calculados en tiempo real

### 🤝 Consignaciones
- Datos del propietario (nombre + contacto)
- Precio pedido, precio mínimo, comisión % → monto calculado automáticamente

### ⚠️ Alertas de stock antiguo
- 🟡 Advertencia a los 30 días sin vender
- 🔴 Crítico a los 60 días sin vender
- Cambia los límites en `config.py`: `ALERT_DAYS_WARNING` y `ALERT_DAYS_CRITICAL`

### 📸 Fotos por vehículo
- Hasta 5 fotos por vehículo
- Se ven en el panel de detalle lateral

### 📋 Panel de detalle lateral
- Al seleccionar cualquier fila se muestra toda la información en el panel derecho

### 📝 Historial de cambios
- Registro de quién creó, editó o eliminó cada registro

### ✅ Marcar vendido rápido
- Botón "Vender" en la toolbar → formulario mínimo con precio y fecha
- Calcula y muestra la ganancia estimada en tiempo real

### ⊕ Duplicar vehículo
- Copia un registro limpiando patente, chasis y datos de venta

### 📤 Exportar a Excel / CSV
- Exporta el inventario completo o filtrado por estado

### ⌨️ Atajos de teclado
| Atajo | Acción |
|-------|--------|
| Ctrl+N | Nuevo vehículo/consignación |
| Ctrl+E | Editar seleccionado |
| Ctrl+F | Enfocar barra de búsqueda |

---

## 🛠️ Solución de problemas

**ModuleNotFoundError: customtkinter**
```bash
pip install customtkinter
```

**Gráficos no aparecen**
```bash
pip install matplotlib numpy
```

**Fotos no cargan**
```bash
pip install Pillow
```

**Export a Excel no funciona**
```bash
pip install openpyxl
```
