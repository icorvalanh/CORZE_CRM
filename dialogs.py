# dialogs.py — VTA v2 · Formularios mejorados

import customtkinter as ctk
from tkinter import messagebox, filedialog
import os
from datetime import date
from config import C, MARCAS, TIPOS_VEHICULO, TRANSMISIONES, COMBUSTIBLES
from config import ESTADOS_CV, ESTADOS_CONS, ANOS
from widgets import (SectionLabel, VTAEntry, VTACombo, VTATextbox,
                     PrimaryButton, SecondaryButton, DangerButton, SuccessButton,
                     clp)


def _lbl(parent, text, row, col=0, colspan=1):
    l = ctk.CTkLabel(parent, text=text,
                     font=ctk.CTkFont(size=10),
                     text_color=C['gray2'], anchor="w")
    l.grid(row=row, column=col, columnspan=colspan,
           sticky="w", padx=(0, 4), pady=(6, 1))
    return l


def _e(parent, row, col=0, colspan=1, ph='', **kw):
    e = VTAEntry(parent, placeholder=ph, **kw)
    e.grid(row=row, column=col, columnspan=colspan,
           sticky="ew", padx=(0, 6), pady=2)
    return e


def _c(parent, vals, row, col=0, colspan=1, **kw):
    c = VTACombo(parent, vals, **kw)
    c.grid(row=row, column=col, columnspan=colspan,
           sticky="ew", padx=(0, 6), pady=2)
    return c


# ══════════════════════════════════════════════════════════════════════════════
#  BASE DIALOG
# ══════════════════════════════════════════════════════════════════════════════

class BaseDialog(ctk.CTkToplevel):
    def __init__(self, parent, title, width=980, height=740, db=None, tabla=None, reg_id=None):
        super().__init__(parent)
        self.title(title)
        self.geometry(f"{width}x{height}")
        self.resizable(True, True)
        self.configure(fg_color=C['surface'])
        self.grab_set()
        self.lift()
        self.focus_force()
        self.db     = db
        self._tabla  = tabla
        self._reg_id = reg_id
        self.result  = None

        self.update_idletasks()
        x = (self.winfo_screenwidth() - width) // 2
        y = max(0, (self.winfo_screenheight() - height) // 2)
        self.geometry(f"{width}x{height}+{x}+{y}")

        self._build_header(title)
        self._build_tabs()
        self._build_footer()

    def _build_header(self, title):
        hdr = ctk.CTkFrame(self, fg_color=C['card'],
                           corner_radius=0, height=54)
        hdr.pack(fill="x")
        hdr.pack_propagate(False)
        ctk.CTkFrame(hdr, width=4, fg_color=C['blue'],
                     corner_radius=0).pack(side="left", fill="y")
        ctk.CTkLabel(hdr, text=f"  {title}",
                     font=ctk.CTkFont(size=16, weight="bold"),
                     text_color=C['white']).pack(side="left", padx=16, pady=12)

    def _build_tabs(self):
        self._tab_view = ctk.CTkTabview(
            self,
            fg_color=C['surface'],
            segmented_button_fg_color=C['card'],
            segmented_button_selected_color=C['blue'],
            segmented_button_selected_hover_color=C['blue2'],
            segmented_button_unselected_color=C['card'],
            segmented_button_unselected_hover_color=C['card3'],
            text_color=C['white'],
            corner_radius=10,
        )
        self._tab_view.pack(fill="both", expand=True, padx=16, pady=(8, 0))
        self._tab_datos  = self._tab_view.add("  📋  Datos  ")
        self._tab_fotos  = self._tab_view.add("  📸  Fotos  ")
        self._tab_historial = self._tab_view.add("  📝  Historial  ")

        # Configure grid in datos tab
        for i in range(4):
            self._tab_datos.grid_columnconfigure(i, weight=1)

        self._build_form()
        self._build_photos_tab()
        self._build_historial_tab()

    def _build_form(self):
        pass  # override

    def _build_photos_tab(self):
        self._photo_paths = []
        self._photo_labels = []

        top = ctk.CTkFrame(self._tab_fotos, fg_color="transparent")
        top.pack(fill="x", pady=8)

        ctk.CTkButton(
            top, text="📂  Agregar Foto",
            fg_color=C['blue'], hover_color=C['blue2'],
            text_color=C['white'], corner_radius=8,
            height=34, width=150,
            command=self._add_photo
        ).pack(side="left", padx=8)

        ctk.CTkLabel(top, text="Máximo 5 fotos por vehículo",
                     font=ctk.CTkFont(size=10),
                     text_color=C['gray2']).pack(side="left", padx=8)

        self._photos_grid = ctk.CTkScrollableFrame(
            self._tab_fotos, fg_color="transparent",
            scrollbar_button_color=C['border2'],
            scrollbar_button_hover_color=C['blue']
        )
        self._photos_grid.pack(fill="both", expand=True, padx=8, pady=8)
        for i in range(3):
            self._photos_grid.grid_columnconfigure(i, weight=1)

        # Load existing photos if editing
        if self.db and self._tabla and self._reg_id:
            existing = self.db.get_photos(self._tabla, self._reg_id)
            for p in existing:
                self._add_photo_thumb(p, existing=True)

    def _add_photo(self):
        if len(self._photo_paths) >= 5:
            messagebox.showwarning("Límite", "Máximo 5 fotos por vehículo.", parent=self)
            return
        path = filedialog.askopenfilename(
            parent=self,
            title="Seleccionar foto del vehículo",
            filetypes=[("Imágenes", "*.jpg *.jpeg *.png *.webp *.bmp"), ("Todos", "*.*")]
        )
        if path:
            self._photo_paths.append(path)
            self._add_photo_thumb(path)

    def _add_photo_thumb(self, path: str, existing: bool = False):
        try:
            from PIL import Image
            img = Image.open(path)
            img.thumbnail((160, 110))
            photo = ctk.CTkImage(light_image=img, dark_image=img, size=(160, 110))
            idx = len(self._photo_labels)
            frame = ctk.CTkFrame(self._photos_grid, fg_color=C['card2'],
                                 corner_radius=10, border_width=1,
                                 border_color=C['border2'])
            frame.grid(row=idx // 3, column=idx % 3, padx=6, pady=6, sticky="nsew")
            ctk.CTkLabel(frame, image=photo, text="").pack(pady=(8, 2))
            ctk.CTkLabel(frame, text=os.path.basename(path)[:20],
                         font=ctk.CTkFont(size=9), text_color=C['gray2']).pack()
            if not existing:
                ctk.CTkButton(
                    frame, text="✕ Quitar",
                    fg_color=C['red_dim'], hover_color=C['red'],
                    text_color=C['red'], height=24, width=80,
                    font=ctk.CTkFont(size=9),
                    command=lambda f=frame, p=path: self._remove_photo(f, p)
                ).pack(pady=(2, 8))
            self._photo_labels.append(frame)
        except Exception:
            pass

    def _remove_photo(self, frame: ctk.CTkFrame, path: str):
        try:
            self._photo_paths.remove(path)
            frame.destroy()
            self._photo_labels = [f for f in self._photo_labels if f.winfo_exists()]
        except Exception:
            pass

    def _build_historial_tab(self):
        if not self.db or not self._tabla or not self._reg_id:
            ctk.CTkLabel(self._tab_historial,
                         text="Guarda el registro primero para ver el historial.",
                         font=ctk.CTkFont(size=12),
                         text_color=C['gray2']).pack(expand=True)
            return
        hist = self.db.get_historial(self._tabla, self._reg_id)
        if not hist:
            ctk.CTkLabel(self._tab_historial,
                         text="Sin historial registrado.",
                         font=ctk.CTkFont(size=12),
                         text_color=C['gray2']).pack(expand=True)
            return

        sf = ctk.CTkScrollableFrame(self._tab_historial, fg_color="transparent",
                                    scrollbar_button_color=C['border2'],
                                    scrollbar_button_hover_color=C['blue'])
        sf.pack(fill="both", expand=True, padx=8, pady=8)
        sf.grid_columnconfigure(0, weight=1)

        for i, h in enumerate(hist):
            accion_colors = {'CREAR': C['green'], 'EDITAR': C['blue'],
                             'ELIMINAR': C['red']}
            color = accion_colors.get(h.get('accion', ''), C['gray2'])
            row_frame = ctk.CTkFrame(sf, fg_color=C['card2'] if i % 2 == 0 else C['card'],
                                     corner_radius=8, height=40)
            row_frame.grid(row=i, column=0, sticky="ew", pady=2)
            row_frame.grid_propagate(False)
            row_frame.grid_columnconfigure(2, weight=1)

            ctk.CTkLabel(row_frame, text=h.get('accion', ''),
                         font=ctk.CTkFont(size=9, weight="bold"),
                         text_color=color, width=60).grid(row=0, column=0, padx=10, sticky="w")
            ctk.CTkLabel(row_frame, text=h.get('usuario', '—'),
                         font=ctk.CTkFont(size=9), text_color=C['gray1'],
                         width=80).grid(row=0, column=1, padx=4, sticky="w")
            ctk.CTkLabel(row_frame, text=h.get('detalle', ''),
                         font=ctk.CTkFont(size=9), text_color=C['gray2'],
                         anchor="w").grid(row=0, column=2, padx=4, sticky="ew")
            ctk.CTkLabel(row_frame, text=str(h.get('fecha', ''))[:16],
                         font=ctk.CTkFont(size=9), text_color=C['gray3'],
                         width=120).grid(row=0, column=3, padx=10, sticky="e")

    def _build_footer(self):
        footer = ctk.CTkFrame(self, fg_color=C['card'],
                              corner_radius=0, height=58)
        footer.pack(fill="x", side="bottom")
        footer.pack_propagate(False)

        SecondaryButton(footer, "Cancelar", self.destroy, icon="✕").pack(
            side="right", padx=(4, 16), pady=11)
        PrimaryButton(footer, "Guardar", self._on_save, icon="💾", width=150).pack(
            side="right", padx=4, pady=11)

    def _on_save(self):
        pass

    def _to_int(self, widget) -> int:
        val = widget.val().replace('.', '').replace(',', '').replace('$', '').replace(' ', '')
        try:
            return int(val) if val else 0
        except ValueError:
            return 0


# ══════════════════════════════════════════════════════════════════════════════
#  COMPRA-VENTA DIALOG
# ══════════════════════════════════════════════════════════════════════════════

class CompraVentaDialog(BaseDialog):
    def __init__(self, parent, db=None, existing=None, usuario=''):
        self._existing = existing
        self._usuario  = usuario
        title = "✏️  Editar Vehículo · Compra / Venta" if existing else "➕  Nuevo Vehículo · Compra / Venta"
        reg_id = existing.get('id') if existing else None
        super().__init__(parent, title, width=980, height=750,
                         db=db, tabla='compraventa', reg_id=reg_id)
        if existing:
            self._populate(existing)

    def _build_form(self):
        b = ctk.CTkScrollableFrame(self._tab_datos, fg_color="transparent",
                                   scrollbar_button_color=C['border2'],
                                   scrollbar_button_hover_color=C['blue'])
        b.pack(fill="both", expand=True)
        for i in range(4):
            b.grid_columnconfigure(i, weight=1)
        r = 0

        # ── IDENTIFICACIÓN ───────────────────────────────────────────────────
        SectionLabel(b, "IDENTIFICACIÓN DEL VEHÍCULO", row=r, colspan=4); r += 1
        _lbl(b, "Patente *", r, 0);  _lbl(b, "Chasis", r, 1)
        _lbl(b, "Marca *", r, 2);    _lbl(b, "Año *", r, 3)
        r += 1
        self.patente = _e(b, r, 0, ph="Ej: BCDF12")
        self.chasis  = _e(b, r, 1, ph="Número de chasis")
        self.marca   = _c(b, MARCAS, r, 2)
        self.anio    = _c(b, [str(a) for a in ANOS], r, 3)
        r += 1

        _lbl(b, "Tipo Vehículo *", r, 0); _lbl(b, "Modelo *", r, 1, colspan=2)
        _lbl(b, "Color", r, 3)
        r += 1
        self.tipo   = _c(b, TIPOS_VEHICULO, r, 0)
        self.modelo = _e(b, r, 1, colspan=2, ph="Ej: Q5 Sportback 50 TFSI e")
        self.color  = _e(b, r, 3, ph="Ej: Azul Navarra")
        r += 1

        # ── TÉCNICO ──────────────────────────────────────────────────────────
        SectionLabel(b, "CARACTERÍSTICAS TÉCNICAS", row=r, colspan=4); r += 1
        _lbl(b, "Motor", r, 0);         _lbl(b, "Transmisión", r, 1)
        _lbl(b, "Combustible", r, 2);   _lbl(b, "KM Aproximados", r, 3)
        r += 1
        self.motor       = _e(b, r, 0, ph="Código motor")
        self.transmision = _c(b, TRANSMISIONES, r, 1)
        self.combustible = _c(b, COMBUSTIBLES, r, 2)
        self.km_aprox    = _e(b, r, 3, ph="Ej: 45000")
        r += 1

        _lbl(b, "N° Dueños Anteriores", r, 0)
        r += 1
        self.cantidad_duenos = _c(b, ['1', '2', '3', '4', '5+'], r, 0)
        r += 1

        # ── PRECIOS ──────────────────────────────────────────────────────────
        SectionLabel(b, "PRECIOS (CLP $)", row=r, colspan=4); r += 1
        _lbl(b, "Precio Compra *", r, 0)
        _lbl(b, "P. Venta Colaboradores", r, 1)
        _lbl(b, "Valor de Mercado", r, 2)
        _lbl(b, "P. Venta Final", r, 3)
        r += 1
        self.precio_compra   = _e(b, r, 0, ph="Ej: 28000000")
        self.precio_colab    = _e(b, r, 1, ph="Ej: 31990000")
        self.valor_mercado   = _e(b, r, 2, ph="Precio de mercado")
        self.precio_venta    = _e(b, r, 3, ph="Al venderse")
        r += 1

        # ── GESTIÓN ──────────────────────────────────────────────────────────
        SectionLabel(b, "GESTIÓN Y ESTADO", row=r, colspan=4); r += 1
        _lbl(b, "Estado *", r, 0);          _lbl(b, "Fecha Ingreso", r, 1)
        _lbl(b, "Fecha Publicación", r, 2); _lbl(b, "Fecha Venta", r, 3)
        r += 1
        self.estado        = _c(b, ESTADOS_CV, r, 0)
        self.f_ingreso     = _e(b, r, 1, ph=str(date.today()))
        self.f_publicacion = _e(b, r, 2, ph="YYYY-MM-DD")
        self.f_venta       = _e(b, r, 3, ph="YYYY-MM-DD")
        r += 1

        SectionLabel(b, "NOTAS ADICIONALES", row=r, colspan=4); r += 1
        self.notas = VTATextbox(b, height=70)
        self.notas.grid(row=r, column=0, columnspan=4, sticky="ew", pady=(4, 10), padx=(0, 6))

        self.f_ingreso.set_val(str(date.today()))
        self._form_body = b

    def _populate(self, d):
        def s(w, k): w.set_val(d.get(k, ''))
        s(self.patente, 'patente'); s(self.chasis, 'chasis')
        s(self.marca, 'marca');     s(self.anio, 'anio')
        s(self.tipo, 'tipo_vehiculo'); s(self.modelo, 'modelo')
        s(self.color, 'color');     s(self.motor, 'motor')
        s(self.transmision, 'transmision'); s(self.combustible, 'combustible')
        s(self.km_aprox, 'km_aprox'); s(self.cantidad_duenos, 'cantidad_duenos')
        s(self.precio_compra, 'precio_compra'); s(self.precio_colab, 'precio_venta_colaboradores')
        s(self.valor_mercado, 'valor_mercado'); s(self.precio_venta, 'precio_venta_final')
        s(self.estado, 'estado'); s(self.f_ingreso, 'fecha_ingreso')
        s(self.f_publicacion, 'fecha_publicacion'); s(self.f_venta, 'fecha_venta')
        self.notas.set_val(d.get('notas', ''))

    def _on_save(self):
        patente = self.patente.val()
        if not patente:
            messagebox.showerror("Error", "La patente es obligatoria.", parent=self)
            return
        if not self.modelo.val():
            messagebox.showerror("Error", "El modelo es obligatorio.", parent=self)
            return

        self.result = {
            'patente':                    patente.upper(),
            'chasis':                     self.chasis.val().upper(),
            'marca':                      self.marca.val(),
            'anio':                       int(self.anio.val() or 2024),
            'tipo_vehiculo':              self.tipo.val(),
            'modelo':                     self.modelo.val(),
            'color':                      self.color.val(),
            'motor':                      self.motor.val(),
            'transmision':                self.transmision.val(),
            'combustible':                self.combustible.val(),
            'km_aprox':                   self._to_int(self.km_aprox),
            'cantidad_duenos':            int(self.cantidad_duenos.val().replace('+','') or 1),
            'precio_compra':              self._to_int(self.precio_compra),
            'precio_venta_colaboradores': self._to_int(self.precio_colab),
            'valor_mercado':              self._to_int(self.valor_mercado),
            'precio_venta_final':         self._to_int(self.precio_venta),
            'estado':                     self.estado.val(),
            'fecha_ingreso':              self.f_ingreso.val() or str(date.today()),
            'fecha_publicacion':          self.f_publicacion.val(),
            'fecha_venta':                self.f_venta.val(),
            'notas':                      self.notas.val(),
            '_new_photos':                self._photo_paths[:],
        }
        self.destroy()


# ══════════════════════════════════════════════════════════════════════════════
#  CONSIGNACIÓN DIALOG
# ══════════════════════════════════════════════════════════════════════════════

class ConsignacionDialog(BaseDialog):
    def __init__(self, parent, db=None, existing=None, usuario=''):
        self._existing = existing
        self._usuario  = usuario
        title = "✏️  Editar Consignación" if existing else "➕  Nueva Consignación"
        reg_id = existing.get('id') if existing else None
        super().__init__(parent, title, width=980, height=720,
                         db=db, tabla='consignaciones', reg_id=reg_id)
        if existing:
            self._populate(existing)

    def _build_form(self):
        b = ctk.CTkScrollableFrame(self._tab_datos, fg_color="transparent",
                                   scrollbar_button_color=C['border2'],
                                   scrollbar_button_hover_color=C['blue'])
        b.pack(fill="both", expand=True)
        for i in range(4):
            b.grid_columnconfigure(i, weight=1)
        r = 0

        SectionLabel(b, "DATOS DEL PROPIETARIO", row=r, colspan=4); r += 1
        _lbl(b, "Nombre Propietario *", r, 0); _lbl(b, "Contacto / Teléfono", r, 1)
        r += 1
        self.nombre_prop   = _e(b, r, 0, ph="Nombre completo")
        self.contacto_prop = _e(b, r, 1, ph="+56 9 XXXX XXXX")
        r += 1

        SectionLabel(b, "VEHÍCULO", row=r, colspan=4); r += 1
        _lbl(b, "Patente", r, 0); _lbl(b, "Marca *", r, 1)
        _lbl(b, "Modelo *", r, 2, colspan=2)
        r += 1
        self.patente = _e(b, r, 0, ph="Ej: BCDF34")
        self.marca   = _c(b, MARCAS, r, 1)
        self.modelo  = _e(b, r, 2, colspan=2, ph="Ej: Corolla 2.0 XEI")
        r += 1

        _lbl(b, "Año *", r, 0); _lbl(b, "KM", r, 1)
        _lbl(b, "Color", r, 2); _lbl(b, "Transmisión", r, 3)
        r += 1
        self.anio    = _c(b, [str(a) for a in ANOS], r, 0)
        self.km      = _e(b, r, 1, ph="Ej: 85000")
        self.color   = _e(b, r, 2, ph="Ej: Blanco")
        self.transm  = _c(b, TRANSMISIONES, r, 3)
        r += 1

        _lbl(b, "Combustible", r, 0); r += 1
        self.combust = _c(b, COMBUSTIBLES, r, 0); r += 1

        SectionLabel(b, "PRECIOS Y COMISIÓN (CLP $)", row=r, colspan=4); r += 1
        _lbl(b, "Precio Pedido Propietario *", r, 0)
        _lbl(b, "Precio Mínimo Aceptable", r, 1)
        _lbl(b, "Comisión %", r, 2)
        _lbl(b, "Precio Venta Final", r, 3)
        r += 1
        self.precio_pedido  = _e(b, r, 0, ph="Ej: 14000000")
        self.precio_minimo  = _e(b, r, 1, ph="Ej: 13000000")
        self.comision_pct   = _e(b, r, 2, ph="Ej: 5.0")
        self.precio_venta   = _e(b, r, 3, ph="Al venderse")
        r += 1

        SectionLabel(b, "GESTIÓN Y ESTADO", row=r, colspan=4); r += 1
        _lbl(b, "Estado *", r, 0);          _lbl(b, "Fecha Ingreso", r, 1)
        _lbl(b, "Fecha Publicación", r, 2); _lbl(b, "Fecha Venta", r, 3)
        r += 1
        self.estado        = _c(b, ESTADOS_CONS, r, 0)
        self.f_ingreso     = _e(b, r, 1, ph=str(date.today()))
        self.f_publicacion = _e(b, r, 2, ph="YYYY-MM-DD")
        self.f_venta       = _e(b, r, 3, ph="YYYY-MM-DD")
        r += 1

        SectionLabel(b, "NOTAS", row=r, colspan=4); r += 1
        self.notas = VTATextbox(b, height=70)
        self.notas.grid(row=r, column=0, columnspan=4, sticky="ew", pady=(4, 10), padx=(0, 6))

        self.f_ingreso.set_val(str(date.today()))
        self.comision_pct.set_val("5.0")

    def _populate(self, d):
        def s(w, k): w.set_val(d.get(k, ''))
        s(self.nombre_prop, 'nombre_propietario')
        s(self.contacto_prop, 'contacto_propietario')
        s(self.patente, 'patente'); s(self.marca, 'marca')
        s(self.modelo, 'modelo');   s(self.anio, 'anio')
        s(self.km, 'km');           s(self.color, 'color')
        s(self.transm, 'transmision'); s(self.combust, 'combustible')
        s(self.precio_pedido, 'precio_pedido')
        s(self.precio_minimo, 'precio_minimo')
        s(self.comision_pct, 'comision_porcentaje')
        s(self.precio_venta, 'precio_venta_final')
        s(self.estado, 'estado'); s(self.f_ingreso, 'fecha_ingreso')
        s(self.f_publicacion, 'fecha_publicacion'); s(self.f_venta, 'fecha_venta')
        self.notas.set_val(d.get('notas', ''))

    def _on_save(self):
        if not self.nombre_prop.val():
            messagebox.showerror("Error", "El nombre del propietario es obligatorio.", parent=self)
            return
        if not self.marca.val() or not self.modelo.val():
            messagebox.showerror("Error", "Marca y Modelo son obligatorios.", parent=self)
            return

        self.result = {
            'nombre_propietario':   self.nombre_prop.val(),
            'contacto_propietario': self.contacto_prop.val(),
            'patente':              self.patente.val().upper(),
            'marca':                self.marca.val(),
            'modelo':               self.modelo.val(),
            'anio':                 int(self.anio.val() or 2024),
            'km':                   self._to_int(self.km),
            'color':                self.color.val(),
            'transmision':          self.transm.val(),
            'combustible':          self.combust.val(),
            'precio_pedido':        self._to_int(self.precio_pedido),
            'precio_minimo':        self._to_int(self.precio_minimo),
            'comision_porcentaje':  float(self.comision_pct.val() or 5.0),
            'comision_monto':       0,
            'precio_venta_final':   self._to_int(self.precio_venta),
            'estado':               self.estado.val(),
            'fecha_ingreso':        self.f_ingreso.val() or str(date.today()),
            'fecha_publicacion':    self.f_publicacion.val(),
            'fecha_venta':          self.f_venta.val(),
            'notas':                self.notas.val(),
        }
        self.destroy()


# ══════════════════════════════════════════════════════════════════════════════
#  QUICK-SELL DIALOG
# ══════════════════════════════════════════════════════════════════════════════

class QuickSellDialog(ctk.CTkToplevel):
    def __init__(self, parent, vehicle: dict):
        super().__init__(parent)
        self.title("✅  Marcar como Vendido")
        self.geometry("440x320")
        self.resizable(False, False)
        self.configure(fg_color=C['surface'])
        self.grab_set()
        self.lift()
        self.result = None

        self.update_idletasks()
        x = (self.winfo_screenwidth() - 440) // 2
        y = (self.winfo_screenheight() - 320) // 2
        self.geometry(f"440x320+{x}+{y}")

        self._build(vehicle)

    def _build(self, v: dict):
        # Header
        hdr = ctk.CTkFrame(self, fg_color=C['green_dim'], corner_radius=0, height=50)
        hdr.pack(fill="x")
        hdr.pack_propagate(False)
        ctk.CTkLabel(hdr, text=f"  ✅  {v.get('patente','—')} · {v.get('marca','')} {v.get('modelo','')}",
                     font=ctk.CTkFont(size=14, weight="bold"),
                     text_color=C['green']).pack(side="left", padx=14, pady=12)

        body = ctk.CTkFrame(self, fg_color="transparent")
        body.pack(fill="both", expand=True, padx=24, pady=16)

        # Precio compra reference
        pc = int(v.get('precio_compra', 0) or 0)
        vm = int(v.get('valor_mercado', 0) or 0)
        vc = int(v.get('precio_venta_colaboradores', 0) or 0)
        ctk.CTkLabel(body, text=f"P. Compra: {clp(pc)}   |   V. Mercado: {clp(vm)}   |   P. Colaboradores: {clp(vc)}",
                     font=ctk.CTkFont(size=10), text_color=C['gray2']).pack(anchor="w", pady=(0, 12))

        ctk.CTkLabel(body, text="Precio de Venta Final *",
                     font=ctk.CTkFont(size=11), text_color=C['gray1']).pack(anchor="w")
        self.precio_entry = VTAEntry(body, placeholder="Ej: 32000000")
        self.precio_entry.pack(fill="x", pady=(4, 10))
        if vc:
            self.precio_entry.set_val(str(vc))

        ctk.CTkLabel(body, text="Fecha de Venta",
                     font=ctk.CTkFont(size=11), text_color=C['gray1']).pack(anchor="w")
        self.fecha_entry = VTAEntry(body, placeholder=str(date.today()))
        self.fecha_entry.set_val(str(date.today()))
        self.fecha_entry.pack(fill="x", pady=(4, 16))

        self._gan_lbl = ctk.CTkLabel(body, text="",
                                      font=ctk.CTkFont(size=13, weight="bold"),
                                      text_color=C['green'])
        self._gan_lbl.pack()

        self.precio_entry.bind("<KeyRelease>", lambda e: self._update_gan(pc))

        # Footer
        footer = ctk.CTkFrame(self, fg_color=C['card'], corner_radius=0, height=54)
        footer.pack(fill="x", side="bottom")
        footer.pack_propagate(False)
        SecondaryButton(footer, "Cancelar", self.destroy, icon="✕").pack(
            side="right", padx=(4, 16), pady=10)
        SuccessButton(footer, "Confirmar Venta", self._confirm, icon="✅", width=160).pack(
            side="right", padx=4, pady=10)

    def _update_gan(self, pc: int):
        try:
            pv = int(self.precio_entry.val().replace('.','').replace(',','').replace('$','') or 0)
            gan = pv - pc
            color = C['green'] if gan >= 0 else C['red']
            sign  = '+' if gan >= 0 else ''
            self._gan_lbl.configure(
                text=f"Ganancia estimada: {sign}{clp(gan)}",
                text_color=color
            )
        except Exception:
            self._gan_lbl.configure(text="")

    def _confirm(self):
        raw = self.precio_entry.val().replace('.','').replace(',','').replace('$','')
        try:
            precio = int(raw)
        except ValueError:
            messagebox.showerror("Error", "Ingresa un precio válido.", parent=self)
            return
        if precio <= 0:
            messagebox.showerror("Error", "El precio debe ser mayor a 0.", parent=self)
            return
        self.result = {
            'precio_venta': precio,
            'fecha_venta':  self.fecha_entry.val() or str(date.today()),
        }
        self.destroy()


# ══════════════════════════════════════════════════════════════════════════════
#  CONFIRM DIALOG
# ══════════════════════════════════════════════════════════════════════════════

class ConfirmDialog(ctk.CTkToplevel):
    def __init__(self, parent, message, title="Confirmar acción", level='danger'):
        super().__init__(parent)
        self.title(title)
        self.geometry("440x190")
        self.resizable(False, False)
        self.configure(fg_color=C['surface'])
        self.grab_set()
        self.result = False

        self.update_idletasks()
        x = (self.winfo_screenwidth() - 440) // 2
        y = (self.winfo_screenheight() - 190) // 2
        self.geometry(f"440x190+{x}+{y}")

        color = C['red'] if level == 'danger' else C['yellow']
        hdr = ctk.CTkFrame(self, fg_color=C['card'], corner_radius=0, height=48)
        hdr.pack(fill="x")
        hdr.pack_propagate(False)
        ctk.CTkLabel(hdr, text=f"  {title}",
                     font=ctk.CTkFont(size=14, weight="bold"),
                     text_color=color).pack(side="left", padx=14, pady=12)

        ctk.CTkLabel(self, text=message,
                     font=ctk.CTkFont(size=12),
                     text_color=C['gray1'],
                     wraplength=380).pack(expand=True, padx=24, pady=12)

        footer = ctk.CTkFrame(self, fg_color=C['card'],
                              corner_radius=0, height=54)
        footer.pack(fill="x", side="bottom")
        footer.pack_propagate(False)
        SecondaryButton(footer, "Cancelar", self.destroy).pack(
            side="right", padx=(4, 16), pady=10)
        DangerButton(footer, "Eliminar", self._ok, icon="🗑️", width=130).pack(
            side="right", padx=4, pady=10)

    def _ok(self):
        self.result = True
        self.destroy()


# ══════════════════════════════════════════════════════════════════════════════
#  EXPORT DIALOG
# ══════════════════════════════════════════════════════════════════════════════

class ExportDialog(ctk.CTkToplevel):
    def __init__(self, parent, db, tipo='compraventa'):
        super().__init__(parent)
        self.title("📤  Exportar datos")
        self.geometry("380x280")
        self.resizable(False, False)
        self.configure(fg_color=C['surface'])
        self.grab_set()
        self.db   = db
        self.tipo = tipo

        self.update_idletasks()
        x = (self.winfo_screenwidth() - 380) // 2
        y = (self.winfo_screenheight() - 280) // 2
        self.geometry(f"380x280+{x}+{y}")
        self._build()

    def _build(self):
        hdr = ctk.CTkFrame(self, fg_color=C['card'], corner_radius=0, height=48)
        hdr.pack(fill="x")
        hdr.pack_propagate(False)
        ctk.CTkLabel(hdr, text="  📤  Exportar Inventario",
                     font=ctk.CTkFont(size=14, weight="bold"),
                     text_color=C['blue']).pack(side="left", padx=14)

        body = ctk.CTkFrame(self, fg_color="transparent")
        body.pack(fill="both", expand=True, padx=24, pady=20)

        ctk.CTkLabel(body, text="Filtrar por estado:",
                     font=ctk.CTkFont(size=11), text_color=C['gray1']).pack(anchor="w")
        self.estado_combo = VTACombo(body, ['Todos'] + ESTADOS_CV)
        self.estado_combo.pack(fill="x", pady=(4, 16))

        ctk.CTkLabel(body, text="Formato de exportación:",
                     font=ctk.CTkFont(size=11), text_color=C['gray1']).pack(anchor="w")

        btn_row = ctk.CTkFrame(body, fg_color="transparent")
        btn_row.pack(fill="x", pady=(8, 0))

        ctk.CTkButton(
            btn_row, text="📊  Excel (.xlsx)",
            fg_color=C['green_dim'], hover_color=C['green'],
            text_color=C['green'], corner_radius=8, height=40, width=150,
            font=ctk.CTkFont(size=12, weight="bold"),
            command=self._export_excel
        ).pack(side="left", padx=(0, 10))

        ctk.CTkButton(
            btn_row, text="📄  CSV (.csv)",
            fg_color=C['blue_sub'], hover_color=C['blue3'],
            text_color=C['blue'], corner_radius=8, height=40, width=150,
            font=ctk.CTkFont(size=12, weight="bold"),
            command=self._export_csv
        ).pack(side="left")

        self._result_lbl = ctk.CTkLabel(body, text="",
                                         font=ctk.CTkFont(size=10),
                                         text_color=C['green'],
                                         wraplength=320)
        self._result_lbl.pack(pady=(12, 0))

    def _get_estado(self) -> str:
        val = self.estado_combo.val()
        return '' if val == 'Todos' else val

    def _export_excel(self):
        path = self.db.export_compraventa_excel(self._get_estado())
        if path:
            self._result_lbl.configure(text=f"✅ Guardado en: {path}", text_color=C['green'])
            try:
                os.startfile(path)
            except Exception:
                pass
        else:
            self._result_lbl.configure(
                text="⚠️ Instala openpyxl: pip install openpyxl", text_color=C['yellow'])

    def _export_csv(self):
        path = self.db.export_compraventa_csv(self._get_estado())
        if path:
            self._result_lbl.configure(text=f"✅ Guardado en: {path}", text_color=C['green'])
            try:
                os.startfile(path)
            except Exception:
                pass
        else:
            self._result_lbl.configure(text="⚠️ Error al exportar.", text_color=C['red'])
