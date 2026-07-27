# main.py — VTA Automotora v2.0 · Punto de entrada principal

import customtkinter as ctk
import os, sys

ctk.set_appearance_mode("dark")
ctk.set_default_color_theme("blue")

from config import C, APP_NAME, APP_VERSION, USERS
from database import DatabaseManager
from login import ask_login
from dashboard import DashboardView
from views import CompraVentaView, ConsignacionesView
from widgets import UserAvatar, Toast


class NavButton(ctk.CTkButton):
    def __init__(self, parent, icon, label, command, **kwargs):
        super().__init__(parent, text=f"  {icon}   {label}", command=command,
                         anchor="w", height=44, corner_radius=10,
                         fg_color="transparent", hover_color=C['blue_glow'],
                         text_color=C['gray2'], font=ctk.CTkFont(size=13), **kwargs)

    def set_active(self, active: bool):
        if active:
            self.configure(fg_color=C['blue_glow'], text_color=C['blue'],
                           font=ctk.CTkFont(size=13, weight="bold"))
        else:
            self.configure(fg_color="transparent", text_color=C['gray2'],
                           font=ctk.CTkFont(size=13))


class VTAApp(ctk.CTk):
    PAGES = [
        ('📊', 'Indicadores',    'dashboard'),
        ('🚗', 'Compra / Venta', 'compraventa'),
        ('🤝', 'Consignaciones', 'consignaciones'),
    ]

    def __init__(self, usuario: str, usuario_color: str):
        super().__init__()
        self.usuario       = usuario
        self.usuario_color = usuario_color
        self.title(f"{APP_NAME} v{APP_VERSION}  ·  {usuario}")
        self.geometry("1440x860")
        self.minsize(1100, 660)
        self.configure(fg_color=C['bg'])

        # Center
        self.update_idletasks()
        x = (self.winfo_screenwidth() - 1440) // 2
        y = max(0, (self.winfo_screenheight() - 860) // 2)
        self.geometry(f"1440x860+{x}+{y}")

        self.db           = DatabaseManager()
        self._active_page = None
        self._nav_btns    = {}
        self._pages       = {}

        self._build_layout()
        self._bind_keys()
        self._navigate('dashboard')

    def _build_layout(self):
        self._container = ctk.CTkFrame(self, fg_color=C['bg'])
        self._container.pack(fill="both", expand=True)
        self._container.grid_columnconfigure(1, weight=1)
        self._container.grid_rowconfigure(0, weight=1)
        self._build_sidebar()
        self._content = ctk.CTkFrame(self._container, fg_color=C['bg'], corner_radius=0)
        self._content.grid(row=0, column=1, sticky="nsew")
        self._content.grid_rowconfigure(0, weight=1)
        self._content.grid_columnconfigure(0, weight=1)

    def _build_sidebar(self):
        sb = ctk.CTkFrame(self._container, width=230, fg_color=C['surface'], corner_radius=0)
        sb.grid(row=0, column=0, sticky="nsew")
        sb.grid_propagate(False)
        sb.grid_rowconfigure(10, weight=1)

        # Logo
        logo_frame = ctk.CTkFrame(sb, fg_color="transparent", height=110)
        logo_frame.grid(row=0, column=0, sticky="ew", padx=14, pady=(20, 6))
        logo_frame.grid_propagate(False)
        logo_shown = False
        try:
            from PIL import Image
            path = os.path.join(os.path.dirname(__file__), 'assets', 'logo.png')
            if os.path.exists(path):
                img = Image.open(path)
                w, h = img.size
                tw = 180; th = int(h * tw / w)
                lo = ctk.CTkImage(light_image=img, dark_image=img, size=(tw, min(th, 76)))
                ctk.CTkLabel(logo_frame, image=lo, text="").pack(expand=True, pady=6)
                logo_shown = True
        except Exception:
            pass
        if not logo_shown:
            ctk.CTkLabel(logo_frame, text="VTA",
                         font=ctk.CTkFont(size=44, weight="bold"),
                         text_color=C['blue']).pack(expand=True, pady=(20, 0))
            ctk.CTkLabel(logo_frame, text="VENDE TU AUTO",
                         font=ctk.CTkFont(size=9), text_color=C['gray3']).pack()

        # Divider
        ctk.CTkFrame(sb, height=1, fg_color=C['border1']).grid(
            row=1, column=0, sticky="ew", padx=16, pady=4)

        # Menu label
        ctk.CTkLabel(sb, text="  MENÚ PRINCIPAL",
                     font=ctk.CTkFont(size=8), text_color=C['gray3'],
                     anchor="w").grid(row=2, column=0, sticky="w", padx=16, pady=(10, 4))

        # Nav buttons
        nav_row = 3
        for icon, label, key in self.PAGES:
            btn = NavButton(sb, icon, label, command=lambda k=key: self._navigate(k))
            btn.grid(row=nav_row, column=0, sticky="ew", padx=10, pady=1)
            self._nav_btns[key] = btn
            nav_row += 1

        # Spacer
        ctk.CTkFrame(sb, fg_color="transparent").grid(row=10, column=0, sticky="nsew")

        # Shortcuts hint
        ctk.CTkFrame(sb, height=1, fg_color=C['border1']).grid(
            row=11, column=0, sticky="ew", padx=16, pady=4)
        ctk.CTkLabel(sb, text="  Ctrl+N  Nuevo   Ctrl+E  Editar\n  Ctrl+F  Buscar",
                     font=ctk.CTkFont(size=8), text_color=C['gray3'],
                     justify="left", anchor="w").grid(
            row=12, column=0, sticky="w", padx=16, pady=(2, 8))

        # Firebase status
        ctk.CTkFrame(sb, height=1, fg_color=C['border1']).grid(
            row=13, column=0, sticky="ew", padx=16, pady=2)
        db_txt = "🔥 Firebase activo" if self.db.use_firebase else "📁 SQLite local"
        db_col = C['green'] if self.db.use_firebase else C['gray3']
        ctk.CTkLabel(sb, text=db_txt, font=ctk.CTkFont(size=9),
                     text_color=db_col, anchor="w").grid(
            row=14, column=0, sticky="w", padx=16, pady=(4, 2))

        # User section
        ctk.CTkFrame(sb, height=1, fg_color=C['border1']).grid(
            row=15, column=0, sticky="ew", padx=16, pady=4)
        user_frame = ctk.CTkFrame(sb, fg_color="transparent")
        user_frame.grid(row=16, column=0, sticky="ew", padx=12, pady=(4, 16))

        avatar = ctk.CTkLabel(
            user_frame, text=USERS.get(self.usuario, {}).get('avatar', self.usuario[:2].upper()),
            width=36, height=36, corner_radius=18,
            fg_color=C['card3'],
            font=ctk.CTkFont(size=13, weight="bold"),
            text_color=self.usuario_color
        )
        avatar.pack(side="left", padx=(2, 8))
        info = ctk.CTkFrame(user_frame, fg_color="transparent")
        info.pack(side="left", fill="both", expand=True)
        ctk.CTkLabel(info, text=self.usuario,
                     font=ctk.CTkFont(size=11, weight="bold"),
                     text_color=C['gray1'], anchor="w").pack(anchor="w")
        ctk.CTkLabel(info, text="Sesión activa",
                     font=ctk.CTkFont(size=8),
                     text_color=C['gray3'], anchor="w").pack(anchor="w")

        # Cerrar sesión
        ctk.CTkButton(
            sb, text="↩  Cerrar sesión",
            fg_color="transparent", hover_color=C['red_dim'],
            text_color=C['gray3'], font=ctk.CTkFont(size=9),
            anchor="w", height=28, corner_radius=8,
            command=self._logout
        ).grid(row=17, column=0, sticky="ew", padx=10, pady=(0, 10))

    def _bind_keys(self):
        self.bind('<Control-n>', lambda e: self._fwd_key('add'))
        self.bind('<Control-e>', lambda e: self._fwd_key('edit'))
        self.bind('<Control-f>', lambda e: self._fwd_key('search'))
        self.bind('<Escape>',    lambda e: None)

    def _fwd_key(self, action):
        page = self._pages.get(self._active_page)
        if not page:
            return
        if action == 'add'    and hasattr(page, '_on_add'):    page._on_add()
        elif action == 'edit' and hasattr(page, '_on_edit'):   page._on_edit()
        elif action == 'search' and hasattr(page, '_focus_search'): page._focus_search()

    def _navigate(self, key: str):
        for k, btn in self._nav_btns.items():
            btn.set_active(k == key)
        for p in self._pages.values():
            p.grid_remove()
        if key not in self._pages:
            self._pages[key] = self._create_page(key)
        page = self._pages[key]
        page.grid(row=0, column=0, sticky="nsew")
        if hasattr(page, 'refresh'):
            page.refresh()
        self._active_page = key

    def _create_page(self, key: str):
        if key == 'dashboard':
            return DashboardView(self._content, self.db, self.usuario, self.usuario_color)
        elif key == 'compraventa':
            return CompraVentaView(self._content, self.db, self.usuario, root=self)
        elif key == 'consignaciones':
            return ConsignacionesView(self._content, self.db, self.usuario, root=self)
        placeholder = ctk.CTkFrame(self._content, fg_color=C['bg'])
        ctk.CTkLabel(placeholder, text=key, text_color=C['gray3']).pack(expand=True)
        return placeholder

    def _logout(self):
        self.db.close()
        self.destroy()
        _run_login()

    def on_close(self):
        self.db.close()
        self.destroy()


def _run_login():
    root = ctk.CTk()
    root.withdraw()
    usuario, color = ask_login(root)
    root.destroy()
    if usuario:
        app = VTAApp(usuario, color)
        app.protocol("WM_DELETE_WINDOW", app.on_close)
        app.mainloop()


def main():
    _run_login()


if __name__ == "__main__":
    main()
