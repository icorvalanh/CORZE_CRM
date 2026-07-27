# widgets.py — VTA v2 · Componentes UI reutilizables

import customtkinter as ctk
from config import C


def clp(amount) -> str:
    try:
        n = int(amount)
        if n == 0:
            return "—"
        return f"${n:,.0f}".replace(",", ".")
    except (TypeError, ValueError):
        return "—"


def badge_colors(estado: str) -> tuple:
    m = {
        'En Stock':   (C['blue_sub'],    C['blue']),
        'Publicado':  (C['yellow_dim'],  C['yellow']),
        'Reservado':  (C['purple_dim'],  C['purple']),
        'Vendido':    (C['green_dim'],   C['green']),
        'En Proceso': (C['blue_sub'],    C['blue']),
        'Devuelto':   (C['red_dim'],     C['red']),
    }
    return m.get(estado, (C['card3'], C['gray2']))


# ─── Tooltip simple ───────────────────────────────────────────────────────────
class Tooltip:
    def __init__(self, widget, text: str):
        self.widget = widget
        self.text   = text
        self.tip    = None
        widget.bind("<Enter>", self._show)
        widget.bind("<Leave>", self._hide)

    def _show(self, _=None):
        x, y = self.widget.winfo_rootx() + 20, self.widget.winfo_rooty() + 28
        self.tip = ctk.CTkToplevel(self.widget)
        self.tip.wm_overrideredirect(True)
        self.tip.geometry(f"+{x}+{y}")
        self.tip.configure(fg_color=C['card3'])
        ctk.CTkLabel(self.tip, text=self.text,
                     font=ctk.CTkFont(size=11),
                     text_color=C['gray1'],
                     corner_radius=6).pack(padx=8, pady=4)

    def _hide(self, _=None):
        if self.tip:
            self.tip.destroy()
            self.tip = None


# ─── Avatar circular de usuario ───────────────────────────────────────────────
class UserAvatar(ctk.CTkLabel):
    def __init__(self, parent, initials: str, color: str, size: int = 36, **kwargs):
        super().__init__(
            parent,
            text=initials,
            width=size, height=size,
            corner_radius=size // 2,
            fg_color=color,
            font=ctk.CTkFont(size=size // 3, weight="bold"),
            text_color=C['white'],
            **kwargs
        )


# ─── Separador horizontal ─────────────────────────────────────────────────────
class Divider(ctk.CTkFrame):
    def __init__(self, parent, **kwargs):
        super().__init__(parent, height=1,
                         fg_color=C['border1'], **kwargs)


# ─── KPI Card mejorada ────────────────────────────────────────────────────────
class KPICard(ctk.CTkFrame):
    def __init__(self, parent, title, value, subtitle='', color=None,
                 icon='', delta='', **kwargs):
        color = color or C['blue']
        super().__init__(
            parent,
            fg_color=C['card'],
            corner_radius=14,
            border_width=1,
            border_color=C['border2'],
            **kwargs
        )
        self._build(title, value, subtitle, color, icon, delta)

    def _build(self, title, value, subtitle, color, icon, delta):
        # Left accent stripe
        stripe = ctk.CTkFrame(self, width=4, fg_color=color, corner_radius=4)
        stripe.pack(side="left", fill="y", padx=(0, 0))

        inner = ctk.CTkFrame(self, fg_color="transparent")
        inner.pack(fill="both", expand=True, padx=16, pady=12)

        # Top row: icon + title
        top = ctk.CTkFrame(inner, fg_color="transparent")
        top.pack(fill="x")
        if icon:
            ctk.CTkLabel(top, text=icon, font=ctk.CTkFont(size=15),
                         text_color=color).pack(side="left")
        ctk.CTkLabel(top, text=f"  {title}",
                     font=ctk.CTkFont(size=10),
                     text_color=C['gray2']).pack(side="left")
        if delta:
            ctk.CTkLabel(top, text=delta,
                         font=ctk.CTkFont(size=9, weight="bold"),
                         text_color=C['green']).pack(side="right")

        # Value
        ctk.CTkLabel(inner, text=value,
                     font=ctk.CTkFont(size=26, weight="bold"),
                     text_color=color).pack(anchor="w", pady=(6, 0))

        # Subtitle
        if subtitle:
            ctk.CTkLabel(inner, text=subtitle,
                         font=ctk.CTkFont(size=9),
                         text_color=C['gray3']).pack(anchor="w", pady=(2, 0))


# ─── Tarjeta de alerta ────────────────────────────────────────────────────────
class AlertCard(ctk.CTkFrame):
    def __init__(self, parent, text: str, level='warning', **kwargs):
        color = C['red'] if level == 'critical' else C['yellow']
        dim   = C['red_dim'] if level == 'critical' else C['yellow_dim']
        super().__init__(parent, fg_color=dim, corner_radius=10,
                         border_width=1, border_color=color, **kwargs)
        ctk.CTkLabel(self, text=text,
                     font=ctk.CTkFont(size=11),
                     text_color=color,
                     wraplength=300).pack(padx=12, pady=8)


# ─── Botón de acción primario ─────────────────────────────────────────────────
class PrimaryButton(ctk.CTkButton):
    def __init__(self, parent, text, command, icon='', width=130, **kwargs):
        super().__init__(
            parent,
            text=f"{icon}  {text}" if icon else text,
            command=command,
            fg_color=C['blue'],
            hover_color=C['blue2'],
            text_color=C['white'],
            font=ctk.CTkFont(size=12, weight="bold"),
            corner_radius=10,
            height=36,
            width=width,
            **kwargs
        )


class SecondaryButton(ctk.CTkButton):
    def __init__(self, parent, text, command, icon='', width=120, **kwargs):
        super().__init__(
            parent,
            text=f"{icon}  {text}" if icon else text,
            command=command,
            fg_color=C['card3'],
            hover_color=C['border3'],
            text_color=C['gray1'],
            font=ctk.CTkFont(size=12),
            corner_radius=10,
            height=36,
            width=width,
            **kwargs
        )


class DangerButton(ctk.CTkButton):
    def __init__(self, parent, text, command, icon='', width=120, **kwargs):
        super().__init__(
            parent,
            text=f"{icon}  {text}" if icon else text,
            command=command,
            fg_color=C['red_dim'],
            hover_color=C['red'],
            text_color=C['red'],
            font=ctk.CTkFont(size=12),
            corner_radius=10,
            height=36,
            width=width,
            **kwargs
        )


class SuccessButton(ctk.CTkButton):
    def __init__(self, parent, text, command, icon='', width=120, **kwargs):
        super().__init__(
            parent,
            text=f"{icon}  {text}" if icon else text,
            command=command,
            fg_color=C['green_dim'],
            hover_color=C['green'],
            text_color=C['green'],
            font=ctk.CTkFont(size=12, weight="bold"),
            corner_radius=10,
            height=36,
            width=width,
            **kwargs
        )


# ─── Section header ───────────────────────────────────────────────────────────
class SectionLabel(ctk.CTkFrame):
    def __init__(self, parent, text, row=None, col=0, colspan=4, **kwargs):
        super().__init__(parent, fg_color=C['blue_glow'],
                         corner_radius=6, height=26, **kwargs)
        ctk.CTkLabel(self, text=f"  {text}",
                     font=ctk.CTkFont(size=10, weight="bold"),
                     text_color=C['blue']).pack(side="left", padx=10)
        if row is not None:
            self.grid(row=row, column=col, columnspan=colspan,
                      sticky="ew", pady=(10, 2))

    def pack_in(self, **kwargs):
        self.pack(fill="x", **kwargs)


# ─── VTA Entry campo ──────────────────────────────────────────────────────────
class VTAEntry(ctk.CTkEntry):
    def __init__(self, parent, placeholder='', **kwargs):
        super().__init__(
            parent,
            placeholder_text=placeholder,
            fg_color=C['card2'],
            border_color=C['border2'],
            border_width=1,
            text_color=C['white'],
            placeholder_text_color=C['gray3'],
            corner_radius=8,
            **kwargs
        )

    def val(self) -> str:
        return self.get().strip()

    def set_val(self, v):
        self.delete(0, "end")
        self.insert(0, str(v) if v is not None else "")


class VTACombo(ctk.CTkComboBox):
    def __init__(self, parent, values, **kwargs):
        super().__init__(
            parent,
            values=values,
            fg_color=C['card2'],
            border_color=C['border2'],
            button_color=C['blue3'],
            button_hover_color=C['blue2'],
            dropdown_fg_color=C['card'],
            dropdown_hover_color=C['blue_glow'],
            dropdown_text_color=C['white'],
            text_color=C['white'],
            corner_radius=8,
            **kwargs
        )
        if values:
            self.set(values[0])

    def val(self) -> str:
        return self.get()

    def set_val(self, v):
        try:
            self.set(str(v))
        except Exception:
            pass


class VTATextbox(ctk.CTkTextbox):
    def __init__(self, parent, height=80, **kwargs):
        super().__init__(
            parent,
            height=height,
            fg_color=C['card2'],
            border_color=C['border2'],
            border_width=1,
            text_color=C['white'],
            corner_radius=8,
            **kwargs
        )

    def val(self) -> str:
        return self.get("1.0", "end").strip()

    def set_val(self, v):
        self.delete("1.0", "end")
        self.insert("1.0", str(v) if v else "")


# ─── Notificación Toast ───────────────────────────────────────────────────────
class Toast:
    @staticmethod
    def show(parent_root, message: str, level: str = 'success', duration: int = 3000):
        colors = {
            'success': (C['green_dim'], C['green']),
            'error':   (C['red_dim'],   C['red']),
            'info':    (C['blue_sub'],  C['blue']),
            'warning': (C['yellow_dim'],C['yellow']),
        }
        bg, fg = colors.get(level, (C['card3'], C['gray1']))
        icons  = {'success': '✓', 'error': '✕', 'info': 'ℹ', 'warning': '⚠'}
        icon   = icons.get(level, '')

        t = ctk.CTkToplevel(parent_root)
        t.wm_overrideredirect(True)
        t.configure(fg_color=bg)

        sw = parent_root.winfo_screenwidth()
        sh = parent_root.winfo_screenheight()
        w, h = 340, 52
        t.geometry(f"{w}x{h}+{sw - w - 30}+{sh - h - 60}")
        t.attributes('-alpha', 0.0)
        t.lift()

        frame = ctk.CTkFrame(t, fg_color=bg, corner_radius=10,
                             border_width=1, border_color=fg)
        frame.pack(fill="both", expand=True, padx=2, pady=2)
        ctk.CTkLabel(frame, text=f" {icon}  {message}",
                     font=ctk.CTkFont(size=12),
                     text_color=fg).pack(expand=True, padx=12)

        # Fade in
        alpha = 0.0
        def fade_in():
            nonlocal alpha
            alpha = min(alpha + 0.1, 1.0)
            try:
                t.attributes('-alpha', alpha)
                if alpha < 1.0:
                    t.after(30, fade_in)
                else:
                    t.after(duration, fade_out)
            except Exception:
                pass

        def fade_out():
            nonlocal alpha
            alpha = max(alpha - 0.1, 0.0)
            try:
                t.attributes('-alpha', alpha)
                if alpha > 0:
                    t.after(30, fade_out)
                else:
                    t.destroy()
            except Exception:
                pass

        t.after(50, fade_in)
