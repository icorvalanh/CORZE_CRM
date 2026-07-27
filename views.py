# views.py — VTA v2 · Vistas de inventario con panel de detalle y alertas

import customtkinter as ctk
from tkinter import messagebox
from datetime import datetime
from config import C, ESTADOS_CV, ESTADOS_CONS, ALERT_DAYS_WARNING, ALERT_DAYS_CRITICAL
from widgets import (clp, badge_colors, PrimaryButton, SecondaryButton,
                     DangerButton, SuccessButton, SectionLabel, Toast)
from dialogs import (CompraVentaDialog, ConsignacionDialog, ConfirmDialog,
                     QuickSellDialog, ExportDialog)


def _age_color(dias: int) -> str:
    if dias >= ALERT_DAYS_CRITICAL:
        return C['red_dim']
    if dias >= ALERT_DAYS_WARNING:
        return '#2D2500'
    return ''


# ══════════════════════════════════════════════════════════════════════════════
#  TABLE WIDGET
# ══════════════════════════════════════════════════════════════════════════════

class VTATable(ctk.CTkScrollableFrame):
    ROW_H = 40

    def __init__(self, parent, columns, on_select=None, on_double_click=None, **kwargs):
        super().__init__(parent, fg_color="transparent",
                         scrollbar_button_color=C['border2'],
                         scrollbar_button_hover_color=C['blue'], **kwargs)
        self.columns        = columns
        self.on_select      = on_select
        self.on_double_click = on_double_click
        self._rows          = []
        self._row_frames    = []
        self._selected_idx  = None
        self._build_header()

    def _build_header(self):
        hdr = ctk.CTkFrame(self, fg_color=C['card3'],
                           corner_radius=8, height=34)
        hdr.pack(fill="x", pady=(0, 2))
        hdr.pack_propagate(False)
        for col_text, col_w, _ in self.columns:
            ctk.CTkLabel(hdr, text=col_text, width=col_w, anchor="w",
                         font=ctk.CTkFont(size=9, weight="bold"),
                         text_color=C['blue']).pack(side="left", padx=(10, 0))

    def load(self, rows: list):
        for f in self._row_frames:
            try: f.destroy()
            except Exception: pass
        self._row_frames.clear()
        self._rows = rows
        self._selected_idx = None
        for i, row in enumerate(rows):
            self._add_row(i, row)

    def _add_row(self, idx: int, row: dict):
        dias = int(row.get('dias_en_stock', 0) or 0)
        estado = str(row.get('estado', ''))
        age_bg = _age_color(dias) if estado != 'Vendido' else ''
        alt_bg = '#101820' if idx % 2 == 1 else C['surface']
        bg     = age_bg if age_bg else alt_bg

        frame = ctk.CTkFrame(self, fg_color=bg, corner_radius=6, height=self.ROW_H)
        frame.pack(fill="x", pady=1)
        frame.pack_propagate(False)

        for col_text, col_w, key in self.columns:
            value = row.get(key, '')
            if key == 'estado':
                fg, tc = badge_colors(str(value))
                cell = ctk.CTkFrame(frame, fg_color=fg, corner_radius=5,
                                    width=col_w - 10, height=22)
                cell.pack(side="left", padx=(10, 2), pady=9)
                cell.pack_propagate(False)
                ctk.CTkLabel(cell, text=str(value),
                             font=ctk.CTkFont(size=8, weight="bold"),
                             text_color=tc).pack(expand=True)
            elif key in ('precio_compra', 'precio_venta_colaboradores',
                         'precio_venta_final', 'valor_mercado',
                         'ganancia', 'precio_pedido', 'precio_minimo', 'comision_monto'):
                tc = C['green'] if key == 'ganancia' and int(value or 0) > 0 else C['gray1']
                ctk.CTkLabel(frame, text=clp(value), width=col_w, anchor="w",
                             font=ctk.CTkFont(size=9), text_color=tc
                             ).pack(side="left", padx=(10, 0))
            elif key == 'dias_en_stock':
                if estado == 'Vendido':
                    tc = C['gray3']
                elif dias >= ALERT_DAYS_CRITICAL:
                    tc = C['red']
                elif dias >= ALERT_DAYS_WARNING:
                    tc = C['yellow']
                else:
                    tc = C['gray2']
                ctk.CTkLabel(frame, text=str(value) if value else '—',
                             width=col_w, anchor="w",
                             font=ctk.CTkFont(size=9, weight="bold" if dias >= ALERT_DAYS_WARNING else "normal"),
                             text_color=tc).pack(side="left", padx=(10, 0))
            else:
                ctk.CTkLabel(frame, text=str(value) if value else '—',
                             width=col_w, anchor="w",
                             font=ctk.CTkFont(size=9),
                             text_color=C['gray1']
                             ).pack(side="left", padx=(10, 0))

        frame.bind("<Button-1>",        lambda e, i=idx: self._on_click(i))
        frame.bind("<Double-Button-1>", lambda e, i=idx: self._on_dbl(i))
        for child in frame.winfo_children():
            child.bind("<Button-1>",        lambda e, i=idx: self._on_click(i))
            child.bind("<Double-Button-1>", lambda e, i=idx: self._on_dbl(i))
        self._row_frames.append(frame)

    def _on_click(self, idx: int):
        if self._selected_idx is not None:
            try:
                old = self._row_frames[self._selected_idx]
                dias   = int(self._rows[self._selected_idx].get('dias_en_stock', 0) or 0)
                estado = str(self._rows[self._selected_idx].get('estado', ''))
                age_bg = _age_color(dias) if estado != 'Vendido' else ''
                alt_bg = '#101820' if self._selected_idx % 2 == 1 else C['surface']
                old.configure(fg_color=age_bg if age_bg else alt_bg)
            except Exception:
                pass
        self._selected_idx = idx
        try:
            self._row_frames[idx].configure(fg_color=C['blue_glow'])
        except Exception:
            pass
        if self.on_select:
            self.on_select(self._rows[idx] if idx < len(self._rows) else None)

    def _on_dbl(self, idx: int):
        if self.on_double_click and idx < len(self._rows):
            self.on_double_click(self._rows[idx])

    def get_selected(self):
        if self._selected_idx is not None and self._selected_idx < len(self._rows):
            return self._rows[self._selected_idx]
        return None


# ══════════════════════════════════════════════════════════════════════════════
#  DETAIL PANEL
# ══════════════════════════════════════════════════════════════════════════════

class DetailPanel(ctk.CTkFrame):
    def __init__(self, parent, db, tabla='compraventa', **kwargs):
        super().__init__(parent, fg_color=C['card'],
                         corner_radius=14,
                         border_width=1,
                         border_color=C['border2'], **kwargs)
        self.db    = db
        self._tabla = tabla
        self._row  = None
        self._build_empty()

    def _build_empty(self):
        self._empty = ctk.CTkLabel(
            self, text="Selecciona un vehículo\npara ver los detalles",
            font=ctk.CTkFont(size=12), text_color=C['gray3'],
            justify="center"
        )
        self._empty.pack(expand=True)

    def load(self, row: dict):
        self._row = row
        for w in self.winfo_children():
            w.destroy()

        sf = ctk.CTkScrollableFrame(self, fg_color="transparent",
                                    scrollbar_button_color=C['border2'],
                                    scrollbar_button_hover_color=C['blue'])
        sf.pack(fill="both", expand=True, padx=2, pady=2)

        # Header strip
        estado = str(row.get('estado', ''))
        fg_s, tc_s = badge_colors(estado)
        hdr = ctk.CTkFrame(sf, fg_color=fg_s, corner_radius=8, height=28)
        hdr.pack(fill="x", pady=(8, 4), padx=10)
        hdr.pack_propagate(False)
        ctk.CTkLabel(hdr, text=estado,
                     font=ctk.CTkFont(size=10, weight="bold"),
                     text_color=tc_s).pack(side="left", padx=12)

        dias = int(row.get('dias_en_stock', 0) or 0)
        if dias > 0:
            dias_color = C['red'] if dias >= ALERT_DAYS_CRITICAL else (
                C['yellow'] if dias >= ALERT_DAYS_WARNING else C['gray2'])
            ctk.CTkLabel(hdr, text=f"{dias} días en stock",
                         font=ctk.CTkFont(size=9, weight="bold"),
                         text_color=dias_color).pack(side="right", padx=10)

        # Title
        ctk.CTkLabel(sf,
                     text=f"{row.get('marca', '')} {row.get('modelo', '')}",
                     font=ctk.CTkFont(size=14, weight="bold"),
                     text_color=C['white'], wraplength=240).pack(padx=12, pady=(6, 2), anchor="w")
        ctk.CTkLabel(sf,
                     text=f"{row.get('anio', '')}  ·  {row.get('tipo_vehiculo', '')}",
                     font=ctk.CTkFont(size=10), text_color=C['gray2']).pack(padx=12, anchor="w")

        ctk.CTkFrame(sf, height=1, fg_color=C['border1']).pack(fill="x", padx=12, pady=8)

        # Fields
        def field(label, value, color=None):
            row_f = ctk.CTkFrame(sf, fg_color="transparent")
            row_f.pack(fill="x", padx=12, pady=2)
            ctk.CTkLabel(row_f, text=label, width=120, anchor="w",
                         font=ctk.CTkFont(size=9), text_color=C['gray3']).pack(side="left")
            ctk.CTkLabel(row_f, text=str(value) if value else '—', anchor="w",
                         font=ctk.CTkFont(size=9, weight="bold"),
                         text_color=color or C['gray1']).pack(side="left")

        field("Patente", row.get('patente', ''), C['blue'])
        field("Chasis", row.get('chasis', ''))
        field("Color", row.get('color', ''))
        field("Motor", row.get('motor', ''))
        field("Transmisión", row.get('transmision', ''))
        field("Combustible", row.get('combustible', ''))
        field("KM", f"{int(row.get('km_aprox', 0) or 0):,}".replace(',', '.') + " km")
        field("N° Dueños", row.get('cantidad_duenos', ''))

        if self._tabla == 'compraventa':
            ctk.CTkFrame(sf, height=1, fg_color=C['border1']).pack(fill="x", padx=12, pady=8)
            field("P. Compra",       clp(row.get('precio_compra', 0)), C['gray1'])
            field("P. Colaboradores", clp(row.get('precio_venta_colaboradores', 0)), C['blue'])
            field("V. Mercado",      clp(row.get('valor_mercado', 0)), C['gray2'])
            field("P. Venta Final",  clp(row.get('precio_venta_final', 0)),
                  C['green'] if row.get('precio_venta_final', 0) else C['gray3'])
            ganancia = int(row.get('ganancia', 0) or 0)
            field("Ganancia",        clp(ganancia),
                  C['green'] if ganancia > 0 else C['gray3'])
        else:
            field("Propietario", row.get('nombre_propietario', ''))
            field("Contacto",    row.get('contacto_propietario', ''))
            ctk.CTkFrame(sf, height=1, fg_color=C['border1']).pack(fill="x", padx=12, pady=8)
            field("P. Pedido",  clp(row.get('precio_pedido', 0)))
            field("P. Mínimo",  clp(row.get('precio_minimo', 0)))
            field("Comisión %", f"{row.get('comision_porcentaje', 0)}%")
            field("Comisión $", clp(row.get('comision_monto', 0)), C['green'])
            field("P. Venta Final", clp(row.get('precio_venta_final', 0)), C['green'])

        ctk.CTkFrame(sf, height=1, fg_color=C['border1']).pack(fill="x", padx=12, pady=8)
        field("F. Ingreso",     row.get('fecha_ingreso', ''))
        field("F. Publicación", row.get('fecha_publicacion', '') or '—')
        field("F. Venta",       row.get('fecha_venta', '') or '—')
        field("Creado por",     row.get('usuario_creacion', '') or '—')
        field("Editado por",    row.get('usuario_ultima_edicion', '') or '—')

        if row.get('notas'):
            ctk.CTkFrame(sf, height=1, fg_color=C['border1']).pack(fill="x", padx=12, pady=8)
            ctk.CTkLabel(sf, text="Notas", font=ctk.CTkFont(size=9),
                         text_color=C['gray3']).pack(padx=12, anchor="w")
            ctk.CTkLabel(sf, text=row['notas'], font=ctk.CTkFont(size=9),
                         text_color=C['gray2'], wraplength=230,
                         justify="left").pack(padx=12, pady=(2, 8), anchor="w")

        # Photos
        if self.db:
            photos = self.db.get_photos(self._tabla, row.get('id', 0))
            if photos:
                ctk.CTkFrame(sf, height=1, fg_color=C['border1']).pack(fill="x", padx=12, pady=8)
                ctk.CTkLabel(sf, text="Fotos",
                             font=ctk.CTkFont(size=9), text_color=C['gray3']
                             ).pack(padx=12, anchor="w")
                try:
                    from PIL import Image
                    prow = ctk.CTkFrame(sf, fg_color="transparent")
                    prow.pack(fill="x", padx=12, pady=4)
                    for p in photos[:4]:
                        if os.path.exists(p):
                            img = Image.open(p)
                            img.thumbnail((70, 50))
                            ph = ctk.CTkImage(light_image=img, dark_image=img, size=(70, 50))
                            ctk.CTkLabel(prow, image=ph, text="").pack(side="left", padx=3)
                except Exception:
                    pass

    def clear(self):
        for w in self.winfo_children():
            w.destroy()
        self._build_empty()


# ══════════════════════════════════════════════════════════════════════════════
#  TOOLBAR
# ══════════════════════════════════════════════════════════════════════════════

class Toolbar(ctk.CTkFrame):
    def __init__(self, parent, on_add, on_edit, on_delete, on_refresh,
                 on_search, on_filter, on_quick_sell=None, on_duplicate=None,
                 on_export=None, filter_states=None, **kwargs):
        super().__init__(parent, fg_color=C['card'],
                         corner_radius=12, height=56, **kwargs)
        self.pack_propagate(False)
        self._build(on_add, on_edit, on_delete, on_refresh, on_search,
                    on_filter, on_quick_sell, on_duplicate, on_export,
                    filter_states or [])

    def _build(self, on_add, on_edit, on_delete, on_refresh, on_search,
               on_filter, on_quick_sell, on_duplicate, on_export, filter_states):
        left = ctk.CTkFrame(self, fg_color="transparent")
        left.pack(side="left", fill="y", padx=10)

        PrimaryButton(left, "Agregar", on_add, icon="➕").pack(side="left", padx=(0, 4), pady=10)
        SecondaryButton(left, "Editar", on_edit, icon="✏️").pack(side="left", padx=3, pady=10)
        DangerButton(left, "Eliminar", on_delete, icon="🗑️", width=110).pack(side="left", padx=3, pady=10)

        if on_quick_sell:
            SuccessButton(left, "Vender", on_quick_sell, icon="✅", width=110).pack(
                side="left", padx=3, pady=10)

        if on_duplicate:
            ctk.CTkButton(
                left, text="⊕  Duplicar", command=on_duplicate,
                fg_color=C['purple_dim'], hover_color=C['purple'],
                text_color=C['purple'], corner_radius=10,
                height=36, width=110
            ).pack(side="left", padx=3, pady=10)

        # Divider
        ctk.CTkFrame(left, width=1, fg_color=C['border2']).pack(side="left", fill="y", padx=6, pady=10)
        SecondaryButton(left, "Actualizar", on_refresh, icon="🔄", width=120).pack(
            side="left", padx=3, pady=10)

        if on_export:
            ctk.CTkButton(
                left, text="📤  Exportar", command=on_export,
                fg_color=C['green_dim'], hover_color=C['green'],
                text_color=C['green'], corner_radius=10,
                height=36, width=120
            ).pack(side="left", padx=3, pady=10)

        right = ctk.CTkFrame(self, fg_color="transparent")
        right.pack(side="right", fill="y", padx=10)

        # Filter
        self.filter_combo = ctk.CTkComboBox(
            right, values=['Todos'] + filter_states,
            fg_color=C['card2'], border_color=C['border2'],
            button_color=C['blue3'], button_hover_color=C['blue2'],
            dropdown_fg_color=C['card'], dropdown_hover_color=C['blue_glow'],
            dropdown_text_color=C['white'], text_color=C['white'],
            corner_radius=8, width=140, height=34,
            command=on_filter
        )
        self.filter_combo.set('Todos')
        self.filter_combo.pack(side="right", padx=(4, 0), pady=10)
        ctk.CTkLabel(right, text="Estado:",
                     font=ctk.CTkFont(size=10),
                     text_color=C['gray2']).pack(side="right", padx=4)

        self.search_entry = ctk.CTkEntry(
            right,
            placeholder_text="🔍  Buscar patente, modelo, marca...",
            fg_color=C['card2'], border_color=C['border2'],
            border_width=1, text_color=C['white'],
            placeholder_text_color=C['gray3'],
            corner_radius=8, width=250, height=34
        )
        self.search_entry.pack(side="right", padx=(0, 8), pady=10)
        self.search_entry.bind("<KeyRelease>",
                               lambda e: on_search(self.search_entry.get()))


# ══════════════════════════════════════════════════════════════════════════════
#  STATS STRIP
# ══════════════════════════════════════════════════════════════════════════════

class StatsStrip(ctk.CTkFrame):
    def __init__(self, parent, keys: list, **kwargs):
        super().__init__(parent, fg_color=C['card'], corner_radius=10, height=42, **kwargs)
        self.pack_propagate(False)
        self._labels = {}
        for key in keys:
            lbl = ctk.CTkLabel(self, text="",
                               font=ctk.CTkFont(size=10),
                               text_color=C['gray2'])
            lbl.pack(side="left", padx=18, fill="y")
            self._labels[key] = lbl

    def update(self, key: str, text: str, color: str = None):
        if key in self._labels:
            kw = {'text': text}
            if color:
                kw['text_color'] = color
            self._labels[key].configure(**kw)


# ══════════════════════════════════════════════════════════════════════════════
#  COMPRA-VENTA VIEW
# ══════════════════════════════════════════════════════════════════════════════

class CompraVentaView(ctk.CTkFrame):
    COLUMNS = [
        ("Patente",     76,  'patente'),
        ("Marca",       76,  'marca'),
        ("Año",         42,  'anio'),
        ("Modelo",      170, 'modelo'),
        ("KM",          56,  'km_aprox'),
        ("Color",       90,  'color'),
        ("P. Compra",   94,  'precio_compra'),
        ("P. Colab.",   104, 'precio_venta_colaboradores'),
        ("V. Mercado",  94,  'valor_mercado'),
        ("P. Venta",    94,  'precio_venta_final'),
        ("Ganancia",    84,  'ganancia'),
        ("Estado",      84,  'estado'),
        ("Días",        38,  'dias_en_stock'),
        ("Ingreso",     78,  'fecha_ingreso'),
        ("Editado por", 80,  'usuario_ultima_edicion'),
    ]

    def __init__(self, parent, db, usuario='', root=None):
        super().__init__(parent, fg_color=C['bg'], corner_radius=0)
        self.db      = db
        self.usuario = usuario
        self.root    = root
        self._all    = []
        self._build()
        # Keyboard shortcuts
        if root:
            root.bind('<Control-n>', lambda e: self._on_add())
            root.bind('<Control-e>', lambda e: self._on_edit())
            root.bind('<Control-f>', lambda e: self._focus_search())
        self.refresh()

    def _build(self):
        # Header
        hdr = ctk.CTkFrame(self, fg_color="transparent")
        hdr.pack(fill="x", padx=24, pady=(20, 8))
        hdr.grid_columnconfigure(1, weight=1)

        ctk.CTkLabel(hdr, text="🚗  COMPRA / VENTA",
                     font=ctk.CTkFont(size=20, weight="bold"),
                     text_color=C['white']).grid(row=0, column=0, sticky="w")

        self._count_lbl = ctk.CTkLabel(hdr, text="",
                                        font=ctk.CTkFont(size=10),
                                        text_color=C['gray2'])
        self._count_lbl.grid(row=0, column=2, sticky="e")

        # Alert strip — se muestra solo cuando hay alertas
        self._alert_frame = ctk.CTkFrame(self, fg_color="transparent")
        # NO se empaqueta aquí; se hace dinámicamente en _update_alerts

        # Toolbar
        self._toolbar = Toolbar(
            self,
            on_add=self._on_add, on_edit=self._on_edit,
            on_delete=self._on_delete, on_refresh=self.refresh,
            on_search=self._on_search, on_filter=self._on_filter,
            on_quick_sell=self._on_quick_sell,
            on_duplicate=self._on_duplicate,
            on_export=self._on_export,
            filter_states=ESTADOS_CV,
        )
        self._toolbar.pack(fill="x", padx=24, pady=(0, 6))

        # Stats strip
        self._stats = StatsStrip(self, ['stock', 'pub', 'res', 'vend', 'gan'])
        self._stats.pack(fill="x", padx=24, pady=(0, 6))

        # Main area: table + detail panel
        main = ctk.CTkFrame(self, fg_color="transparent")
        main.pack(fill="both", expand=True, padx=24, pady=(0, 4))
        main.grid_columnconfigure(0, weight=1)
        main.grid_rowconfigure(0, weight=1)

        self._table = VTATable(
            main, columns=self.COLUMNS,
            on_select=self._on_select,
            on_double_click=self._on_edit_row
        )
        self._table.grid(row=0, column=0, sticky="nsew")

        self._detail = DetailPanel(main, db=self.db, tabla='compraventa', width=270)
        self._detail.grid(row=0, column=1, sticky="nsew", padx=(8, 0))

        # Status bar
        self._status = ctk.CTkFrame(self, fg_color=C['card'],
                                     corner_radius=0, height=26)
        self._status.pack(fill="x", side="bottom")
        self._status.pack_propagate(False)
        self._status_lbl = ctk.CTkLabel(self._status, text="",
                                         font=ctk.CTkFont(size=9),
                                         text_color=C['gray3'])
        self._status_lbl.pack(side="left", padx=12, fill="y")

    def _focus_search(self):
        self._toolbar.search_entry.focus_set()

    def refresh(self):
        self._all = self.db.get_all_compraventa()
        self._table.load(self._all)
        self._update_stats(self._all)
        self._update_alerts(self._all)
        n = len(self._all)
        self._count_lbl.configure(text=f"{n} vehículo{'s' if n!=1 else ''}")
        self._status_lbl.configure(
            text=f"Actualizado: {datetime.now().strftime('%d/%m/%Y %H:%M')}  ·  {self.db.get_firebase_status()}"
        )

    def _update_stats(self, rows):
        stock = sum(1 for r in rows if r['estado'] == 'En Stock')
        pub   = sum(1 for r in rows if r['estado'] == 'Publicado')
        res   = sum(1 for r in rows if r['estado'] == 'Reservado')
        vend  = sum(1 for r in rows if r['estado'] == 'Vendido')
        gan   = sum(int(r.get('ganancia',0) or 0) for r in rows if r['estado']=='Vendido')
        self._stats.update('stock', f"📦 Stock: {stock}", C['blue'])
        self._stats.update('pub',   f"📢 Publicados: {pub}", C['yellow'])
        self._stats.update('res',   f"🔒 Reservados: {res}", C['purple'])
        self._stats.update('vend',  f"✅ Vendidos: {vend}", C['green'])
        self._stats.update('gan',   f"💰 Ganancia: {clp(gan)}", C['green'])

    def _update_alerts(self, rows):
        for w in self._alert_frame.winfo_children():
            w.destroy()

        criticos = [r for r in rows
                    if r.get('estado') != 'Vendido'
                    and int(r.get('dias_en_stock', 0) or 0) >= ALERT_DAYS_CRITICAL]
        warnings = [r for r in rows
                    if r.get('estado') != 'Vendido'
                    and ALERT_DAYS_WARNING <= int(r.get('dias_en_stock', 0) or 0) < ALERT_DAYS_CRITICAL]

        hay_alertas = bool(criticos or warnings)

        # Empaquetar o desempaquetar según si hay alertas
        if hay_alertas:
            if not self._alert_frame.winfo_ismapped():
                self._alert_frame.pack(fill="x", padx=24, pady=(0, 4),
                                       before=self._toolbar)
        else:
            if self._alert_frame.winfo_ismapped():
                self._alert_frame.pack_forget()

        if criticos:
            strip = ctk.CTkFrame(self._alert_frame, fg_color=C['red_dim'],
                                 corner_radius=8, height=28)
            strip.pack(fill="x", pady=2)
            strip.pack_propagate(False)
            ctk.CTkLabel(
                strip,
                text=f"  🔴  {len(criticos)} vehículo{'s' if len(criticos)>1 else ''} con más de {ALERT_DAYS_CRITICAL} días en stock",
                font=ctk.CTkFont(size=10, weight="bold"),
                text_color=C['red']
            ).pack(side="left", padx=10, fill="y")

        if warnings:
            strip = ctk.CTkFrame(self._alert_frame, fg_color=C['yellow_dim'],
                                 corner_radius=8, height=28)
            strip.pack(fill="x", pady=2)
            strip.pack_propagate(False)
            ctk.CTkLabel(
                strip,
                text=f"  🟡  {len(warnings)} vehículo{'s' if len(warnings)>1 else ''} con más de {ALERT_DAYS_WARNING} días sin vender",
                font=ctk.CTkFont(size=10, weight="bold"),
                text_color=C['yellow']
            ).pack(side="left", padx=10, fill="y")

    def _on_select(self, row):
        if row:
            self._detail.load(row)
        else:
            self._detail.clear()

    def _on_search(self, query: str):
        if not query.strip():
            self._table.load(self._all)
            self._count_lbl.configure(text=f"{len(self._all)} vehículos")
            return
        r = self.db.search_compraventa(query)
        self._table.load(r)
        self._count_lbl.configure(text=f"{len(r)} resultado{'s' if len(r)!=1 else ''}")

    def _on_filter(self, estado: str):
        rows = self._all if estado == 'Todos' else [r for r in self._all if r['estado']==estado]
        self._table.load(rows)
        self._count_lbl.configure(text=f"{len(rows)} vehículo{'s' if len(rows)!=1 else ''}")

    def _on_add(self):
        dlg = CompraVentaDialog(self, db=self.db, usuario=self.usuario)
        self.wait_window(dlg)
        if dlg.result:
            photos = dlg.result.pop('_new_photos', [])
            ok, err = self.db.add_compraventa(dlg.result, self.usuario)
            if ok:
                # Save photos
                if photos:
                    last_id = self.db.conn.execute(
                        "SELECT id FROM compraventa ORDER BY id DESC LIMIT 1").fetchone()['id']
                    for p in photos:
                        self.db.add_photo('compraventa', last_id, p)
                self.refresh()
                if self.root:
                    Toast.show(self.root, "Vehículo agregado correctamente", 'success')
            else:
                messagebox.showerror("Error", f"No se pudo agregar: {err}", parent=self)

    def _on_edit(self):
        row = self._table.get_selected()
        if not row:
            messagebox.showinfo("Aviso", "Selecciona un vehículo de la lista.", parent=self)
            return
        self._on_edit_row(row)

    def _on_edit_row(self, row: dict):
        dlg = CompraVentaDialog(self, db=self.db, existing=row, usuario=self.usuario)
        self.wait_window(dlg)
        if dlg.result:
            photos = dlg.result.pop('_new_photos', [])
            ok, err = self.db.update_compraventa(row['id'], dlg.result, self.usuario)
            if ok:
                for p in photos:
                    self.db.add_photo('compraventa', row['id'], p)
                self.refresh()
                if self.root:
                    Toast.show(self.root, "Vehículo actualizado", 'success')
            else:
                messagebox.showerror("Error", f"No se pudo actualizar: {err}", parent=self)

    def _on_delete(self):
        row = self._table.get_selected()
        if not row:
            messagebox.showinfo("Aviso", "Selecciona un vehículo.", parent=self)
            return
        dlg = ConfirmDialog(
            self,
            f"¿Eliminar {row.get('patente','—')} — {row.get('marca','')} {row.get('modelo','')}?\n\nEsta acción no se puede deshacer."
        )
        self.wait_window(dlg)
        if dlg.result:
            ok = self.db.delete_compraventa(row['id'], self.usuario)
            if ok:
                self._detail.clear()
                self.refresh()
                if self.root:
                    Toast.show(self.root, "Vehículo eliminado", 'warning')

    def _on_quick_sell(self):
        row = self._table.get_selected()
        if not row:
            messagebox.showinfo("Aviso", "Selecciona un vehículo.", parent=self)
            return
        if row.get('estado') == 'Vendido':
            messagebox.showinfo("Aviso", "Este vehículo ya fue vendido.", parent=self)
            return
        dlg = QuickSellDialog(self, row)
        self.wait_window(dlg)
        if dlg.result:
            ok, err = self.db.quick_sell_compraventa(
                row['id'], dlg.result['precio_venta'], dlg.result['fecha_venta'], self.usuario)
            if ok:
                self.refresh()
                if self.root:
                    Toast.show(self.root, "¡Venta registrada exitosamente! 🎉", 'success')
            else:
                messagebox.showerror("Error", err, parent=self)

    def _on_duplicate(self):
        row = self._table.get_selected()
        if not row:
            messagebox.showinfo("Aviso", "Selecciona un vehículo.", parent=self)
            return
        ok, err = self.db.duplicate_compraventa(row['id'], self.usuario)
        if ok:
            self.refresh()
            if self.root:
                Toast.show(self.root, "Vehículo duplicado", 'info')
        else:
            messagebox.showerror("Error", err, parent=self)

    def _on_export(self):
        dlg = ExportDialog(self, self.db, tipo='compraventa')
        self.wait_window(dlg)


# ══════════════════════════════════════════════════════════════════════════════
#  CONSIGNACIONES VIEW
# ══════════════════════════════════════════════════════════════════════════════

class ConsignacionesView(ctk.CTkFrame):
    COLUMNS = [
        ("Propietario",  120, 'nombre_propietario'),
        ("Contacto",     100, 'contacto_propietario'),
        ("Patente",      66,  'patente'),
        ("Marca",        76,  'marca'),
        ("Modelo",       140, 'modelo'),
        ("Año",          42,  'anio'),
        ("KM",           56,  'km'),
        ("P. Pedido",    94,  'precio_pedido'),
        ("P. Mínimo",    84,  'precio_minimo'),
        ("Comis. %",     56,  'comision_porcentaje'),
        ("Comis. $",     84,  'comision_monto'),
        ("P. Final",     84,  'precio_venta_final'),
        ("Estado",       84,  'estado'),
        ("Ingreso",      78,  'fecha_ingreso'),
    ]

    def __init__(self, parent, db, usuario='', root=None):
        super().__init__(parent, fg_color=C['bg'], corner_radius=0)
        self.db      = db
        self.usuario = usuario
        self.root    = root
        self._all    = []
        self._build()
        self.refresh()

    def _build(self):
        hdr = ctk.CTkFrame(self, fg_color="transparent")
        hdr.pack(fill="x", padx=24, pady=(20, 8))
        hdr.grid_columnconfigure(1, weight=1)
        ctk.CTkLabel(hdr, text="🤝  CONSIGNACIONES",
                     font=ctk.CTkFont(size=20, weight="bold"),
                     text_color=C['white']).grid(row=0, column=0, sticky="w")
        self._count_lbl = ctk.CTkLabel(hdr, text="",
                                        font=ctk.CTkFont(size=10),
                                        text_color=C['gray2'])
        self._count_lbl.grid(row=0, column=2, sticky="e")

        self._toolbar = Toolbar(
            self,
            on_add=self._on_add, on_edit=self._on_edit,
            on_delete=self._on_delete, on_refresh=self.refresh,
            on_search=self._on_search, on_filter=self._on_filter,
            filter_states=ESTADOS_CONS,
        )
        self._toolbar.pack(fill="x", padx=24, pady=(0, 6))

        self._stats = StatsStrip(self, ['proceso', 'pub', 'vend', 'devuel', 'comis'])
        self._stats.pack(fill="x", padx=24, pady=(0, 6))

        main = ctk.CTkFrame(self, fg_color="transparent")
        main.pack(fill="both", expand=True, padx=24, pady=(0, 4))
        main.grid_columnconfigure(0, weight=1)
        main.grid_rowconfigure(0, weight=1)

        self._table = VTATable(
            main, columns=self.COLUMNS,
            on_select=self._on_select,
            on_double_click=self._on_edit_row
        )
        self._table.grid(row=0, column=0, sticky="nsew")

        self._detail = DetailPanel(main, db=self.db, tabla='consignaciones', width=270)
        self._detail.grid(row=0, column=1, sticky="nsew", padx=(8, 0))

        self._status = ctk.CTkFrame(self, fg_color=C['card'], corner_radius=0, height=26)
        self._status.pack(fill="x", side="bottom")
        self._status.pack_propagate(False)
        self._status_lbl = ctk.CTkLabel(self._status, text="",
                                         font=ctk.CTkFont(size=9),
                                         text_color=C['gray3'])
        self._status_lbl.pack(side="left", padx=12, fill="y")

    def refresh(self):
        self._all = self.db.get_all_consignaciones()
        self._table.load(self._all)
        self._update_stats(self._all)
        n = len(self._all)
        self._count_lbl.configure(text=f"{n} consignación{'es' if n!=1 else ''}")
        self._status_lbl.configure(
            text=f"Actualizado: {datetime.now().strftime('%d/%m/%Y %H:%M')}  ·  {self.db.get_firebase_status()}"
        )

    def _update_stats(self, rows):
        proceso = sum(1 for r in rows if r['estado'] == 'En Proceso')
        pub     = sum(1 for r in rows if r['estado'] == 'Publicado')
        vend    = sum(1 for r in rows if r['estado'] == 'Vendido')
        devuel  = sum(1 for r in rows if r['estado'] == 'Devuelto')
        comis   = sum(int(r.get('comision_monto',0) or 0) for r in rows if r['estado']=='Vendido')
        self._stats.update('proceso', f"🔄 En Proceso: {proceso}", C['blue'])
        self._stats.update('pub',     f"📢 Publicadas: {pub}", C['yellow'])
        self._stats.update('vend',    f"✅ Vendidas: {vend}", C['green'])
        self._stats.update('devuel',  f"↩️ Devueltas: {devuel}", C['red'])
        self._stats.update('comis',   f"💰 Comisiones: {clp(comis)}", C['green'])

    def _on_select(self, row):
        if row:
            self._detail.load(row)
        else:
            self._detail.clear()

    def _on_search(self, query: str):
        if not query.strip():
            self._table.load(self._all)
            return
        r = self.db.search_consignaciones(query)
        self._table.load(r)

    def _on_filter(self, estado: str):
        rows = self._all if estado == 'Todos' else [r for r in self._all if r['estado']==estado]
        self._table.load(rows)

    def _on_add(self):
        dlg = ConsignacionDialog(self, db=self.db, usuario=self.usuario)
        self.wait_window(dlg)
        if dlg.result:
            ok, err = self.db.add_consignacion(dlg.result, self.usuario)
            if ok:
                self.refresh()
                if self.root:
                    Toast.show(self.root, "Consignación agregada", 'success')
            else:
                messagebox.showerror("Error", err, parent=self)

    def _on_edit(self):
        row = self._table.get_selected()
        if not row:
            messagebox.showinfo("Aviso", "Selecciona una consignación.", parent=self)
            return
        self._on_edit_row(row)

    def _on_edit_row(self, row: dict):
        dlg = ConsignacionDialog(self, db=self.db, existing=row, usuario=self.usuario)
        self.wait_window(dlg)
        if dlg.result:
            ok, err = self.db.update_consignacion(row['id'], dlg.result, self.usuario)
            if ok:
                self.refresh()
                if self.root:
                    Toast.show(self.root, "Consignación actualizada", 'success')
            else:
                messagebox.showerror("Error", err, parent=self)

    def _on_delete(self):
        row = self._table.get_selected()
        if not row:
            messagebox.showinfo("Aviso", "Selecciona una consignación.", parent=self)
            return
        dlg = ConfirmDialog(
            self,
            f"¿Eliminar consignación de {row.get('nombre_propietario','—')} — {row.get('marca','')} {row.get('modelo','')}?\n\nEsta acción no se puede deshacer."
        )
        self.wait_window(dlg)
        if dlg.result:
            ok = self.db.delete_consignacion(row['id'], self.usuario)
            if ok:
                self._detail.clear()
                self.refresh()
                if self.root:
                    Toast.show(self.root, "Consignación eliminada", 'warning')
