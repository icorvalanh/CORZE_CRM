# login.py — VTA v2 · Pantalla de Login

import customtkinter as ctk
from tkinter import filedialog
import os
import json

from config import C, USERS, APP_NAME

PROFILE_PHOTOS_FILE = 'profile_photos.json'


def _load_profile_photos() -> dict:
    try:
        if os.path.exists(PROFILE_PHOTOS_FILE):
            with open(PROFILE_PHOTOS_FILE, 'r') as f:
                return json.load(f)
    except Exception:
        pass
    return {}


def _save_profile_photos(data: dict):
    try:
        with open(PROFILE_PHOTOS_FILE, 'w') as f:
            json.dump(data, f)
    except Exception:
        pass


class LoginScreen(ctk.CTkToplevel):
    def __init__(self, parent):
        super().__init__(parent)
        self.title(f"{APP_NAME} — Iniciar Sesión")

        W, H = 560, 720
        self.geometry(f"{W}x{H}")
        self.resizable(False, False)
        self.configure(fg_color=C['bg'])
        self.grab_set()
        self.lift()
        self.focus_force()

        self.update_idletasks()
        x = (self.winfo_screenwidth()  - W) // 2
        y = max(20, (self.winfo_screenheight() - H) // 2)
        self.geometry(f"{W}x{H}+{x}+{y}")

        self.selected_user   = None
        self.result          = None
        self._pin            = ""
        self._profile_photos = _load_profile_photos()
        self._user_frames    = {}
        self._photo_images   = {}

        self._build()
        self.protocol("WM_DELETE_WINDOW", self._on_close)
        self.bind("<Key>", self._on_keypress)

    # ══════════════════════════════════════════════════════════════════════════
    def _build(self):
        # ── Logo ──────────────────────────────────────────────────────────────
        logo_frame = ctk.CTkFrame(self, fg_color="transparent", height=96)
        logo_frame.pack(fill="x", padx=30, pady=(20, 0))
        logo_frame.pack_propagate(False)
        self._load_logo(logo_frame)

        # ── Card ──────────────────────────────────────────────────────────────
        card = ctk.CTkFrame(self,
                            fg_color=C['card'],
                            corner_radius=20,
                            border_width=1,
                            border_color=C['border2'])
        card.pack(fill="both", expand=True, padx=28, pady=(12, 24))

        # Título
        ctk.CTkLabel(card,
                     text="Selecciona tu usuario",
                     font=ctk.CTkFont(size=16, weight="bold"),
                     text_color=C['white']).pack(pady=(20, 2))

        ctk.CTkLabel(card,
                     text="Ingresa el PIN con los botones o con el teclado",
                     font=ctk.CTkFont(size=10),
                     text_color=C['gray2']).pack(pady=(0, 12))

        # ── Tarjetas de usuario ───────────────────────────────────────────────
        user_row = ctk.CTkFrame(card, fg_color="transparent")
        user_row.pack(pady=(0, 10))
        for username, info in USERS.items():
            self._make_user_card(user_row, username, info)

        # Divider
        ctk.CTkFrame(card, height=1, fg_color=C['border1']).pack(
            fill="x", padx=24, pady=(4, 12))

        # ── Display PIN ───────────────────────────────────────────────────────
        self._pin_display = ctk.CTkLabel(
            card,
            text="○   ○   ○   ○",
            font=ctk.CTkFont(size=30, weight="bold"),
            text_color=C['gray3']
        )
        self._pin_display.pack(pady=(0, 12))

        # ── Teclado numérico ──────────────────────────────────────────────────
        pad = ctk.CTkFrame(card, fg_color="transparent")
        pad.pack(pady=(0, 8))

        keys = [('1', C['card2'], C['card3'], C['white'], "bold"),
                ('2', C['card2'], C['card3'], C['white'], "bold"),
                ('3', C['card2'], C['card3'], C['white'], "bold"),
                ('4', C['card2'], C['card3'], C['white'], "bold"),
                ('5', C['card2'], C['card3'], C['white'], "bold"),
                ('6', C['card2'], C['card3'], C['white'], "bold"),
                ('7', C['card2'], C['card3'], C['white'], "bold"),
                ('8', C['card2'], C['card3'], C['white'], "bold"),
                ('9', C['card2'], C['card3'], C['white'], "bold"),
                ('⌫', C['card3'], C['border3'], C['gray1'], "normal"),
                ('0', C['card2'], C['card3'], C['white'], "bold"),
                ('✓', C['blue'],  C['blue2'],  C['white'], "bold")]

        for idx, (label, fg, hv, tc, fw) in enumerate(keys):
            ctk.CTkButton(
                pad,
                text=label,
                width=84, height=56,
                corner_radius=12,
                fg_color=fg, hover_color=hv,
                text_color=tc,
                font=ctk.CTkFont(size=22, weight=fw),
                command=lambda k=label: self._on_btn(k)
            ).grid(row=idx // 3, column=idx % 3, padx=5, pady=5)

        # ── Mensaje de estado ─────────────────────────────────────────────────
        self._status_lbl = ctk.CTkLabel(
            card, text="",
            font=ctk.CTkFont(size=12, weight="bold"),
            text_color=C['red'],
            wraplength=460
        )
        self._status_lbl.pack(pady=(4, 16))

    # ── Logo ──────────────────────────────────────────────────────────────────
    def _load_logo(self, parent):
        try:
            from PIL import Image
            path = os.path.join(os.path.dirname(__file__), 'assets', 'logo.png')
            if os.path.exists(path):
                img = Image.open(path).convert("RGBA")
                img.thumbnail((240, 86), Image.LANCZOS)
                w, h = img.size
                logo_img = ctk.CTkImage(light_image=img, dark_image=img, size=(w, h))
                lbl = ctk.CTkLabel(parent, image=logo_img, text="", fg_color="transparent")
                lbl.image = logo_img
                lbl.pack(expand=True)
                return
        except Exception:
            pass
        ctk.CTkLabel(parent, text="VTA",
                     font=ctk.CTkFont(size=48, weight="bold"),
                     text_color=C['blue']).pack(expand=True)

    # ── Tarjeta de usuario ────────────────────────────────────────────────────
    def _make_user_card(self, parent, username: str, info: dict):
        color = info['color']

        frame = ctk.CTkFrame(parent,
                             fg_color=C['card2'],
                             corner_radius=14,
                             border_width=2,
                             border_color=C['border2'],
                             width=196, height=168)
        frame.pack(side="left", padx=10)
        frame.pack_propagate(False)

        # Contenedor avatar (referenciado para redibujar al cambiar foto)
        avatar_container = ctk.CTkFrame(frame, fg_color="transparent")
        avatar_container.pack(pady=(14, 0))
        self._render_avatar(username, info, avatar_container, color, size=66)

        ctk.CTkLabel(frame,
                     text=username,
                     font=ctk.CTkFont(size=12, weight="bold"),
                     text_color=C['gray1']).pack(pady=(6, 2))

        ctk.CTkButton(
            frame,
            text="📷  foto de perfil",
            width=110, height=22,
            corner_radius=6,
            fg_color="transparent",
            hover_color=C['card3'],
            text_color=C['gray3'],
            font=ctk.CTkFont(size=9),
            command=lambda u=username, i=info, ac=avatar_container, c=color:
                self._change_photo(u, i, ac, c)
        ).pack(pady=(0, 10))

        # Bind para seleccionar (sin interferir con el botón de foto)
        frame.bind("<Button-1>", lambda e, u=username, f=frame: self._select_user(u, f))
        for child in frame.winfo_children():
            if not isinstance(child, ctk.CTkButton):
                child.bind("<Button-1>",
                           lambda e, u=username, f=frame: self._select_user(u, f))

        self._user_frames[username] = (frame, color, avatar_container, info)

    def _render_avatar(self, username, info, container, color, size=66):
        for w in container.winfo_children():
            w.destroy()

        photo_path = self._profile_photos.get(username, '')
        shown = False

        if photo_path and os.path.exists(photo_path):
            try:
                from PIL import Image, ImageDraw
                img = Image.open(photo_path).convert("RGBA").resize((size, size), Image.LANCZOS)
                mask = Image.new("L", (size, size), 0)
                ImageDraw.Draw(mask).ellipse((0, 0, size, size), fill=255)
                circle = Image.new("RGBA", (size, size), (0, 0, 0, 0))
                circle.paste(img, mask=mask)
                ph = ctk.CTkImage(light_image=circle, dark_image=circle, size=(size, size))
                lbl = ctk.CTkLabel(container, image=ph, text="", fg_color="transparent")
                lbl.image = ph
                lbl.pack()
                self._photo_images[username] = ph
                shown = True
            except Exception:
                pass

        if not shown:
            ctk.CTkLabel(
                container,
                text=info.get('avatar', username[:2].upper()),
                width=size, height=size,
                corner_radius=size // 2,
                fg_color=C['card3'],
                font=ctk.CTkFont(size=size // 3, weight="bold"),
                text_color=color
            ).pack()

    def _change_photo(self, username, info, avatar_container, color):
        path = filedialog.askopenfilename(
            parent=self,
            title=f"Foto de perfil — {username}",
            filetypes=[("Imágenes", "*.jpg *.jpeg *.png *.webp *.bmp"),
                       ("Todos", "*.*")]
        )
        if not path:
            return
        self._profile_photos[username] = path
        _save_profile_photos(self._profile_photos)
        self._render_avatar(username, info, avatar_container, color, size=66)

    # ── PIN ───────────────────────────────────────────────────────────────────
    def _on_btn(self, key: str):
        if not self.selected_user and key not in ('⌫', '✓'):
            self._set_status("⚠️  Selecciona un usuario primero", 'warning')
            return
        if key == '✓':
            self._verify_pin()
        elif key == '⌫':
            self._pin = self._pin[:-1]
            self._set_status("")
            self._update_display()
        elif len(self._pin) < 4 and key.isdigit():
            self._pin += key
            self._set_status("")
            self._update_display()
            if len(self._pin) == 4:
                self.after(110, self._verify_pin)

    def _on_keypress(self, event):
        key = event.char
        if key.isdigit():
            self._on_btn(key)
        elif event.keysym in ('BackSpace', 'Delete'):
            self._on_btn('⌫')
        elif event.keysym in ('Return', 'KP_Enter'):
            self._verify_pin()

    def _update_display(self):
        if not self.selected_user:
            return
        _, color, _, _ = self._user_frames[self.selected_user]
        filled = '●' * len(self._pin)
        empty  = '○' * (4 - len(self._pin))
        self._pin_display.configure(
            text='   '.join(list(filled + empty)),
            text_color=color if self._pin else C['gray3']
        )

    def _verify_pin(self):
        if not self.selected_user:
            self._set_status("⚠️  Selecciona un usuario primero", 'warning')
            return
        if len(self._pin) < 4:
            self._set_status("⚠️  Ingresa los 4 dígitos del PIN", 'warning')
            return

        _, color, _, _ = self._user_frames[self.selected_user]
        correct = USERS[self.selected_user]['pin']

        if self._pin == correct:
            # ✅ ACCESO AUTORIZADO
            self._pin_display.configure(
                text='✓   ✓   ✓   ✓', text_color=C['green'])
            self._set_status(
                f"✅  ACCESO AUTORIZADO — Bienvenido/a, {self.selected_user}",
                'success')
            # Resaltar borde verde
            frame, *_ = self._user_frames[self.selected_user]
            frame.configure(border_color=C['green'])
            self.after(1300, self._grant_access)
        else:
            # ⛔ PIN INCORRECTO
            self._pin_display.configure(
                text='✕   ✕   ✕   ✕', text_color=C['red'])
            self._set_status("⛔  PIN incorrecto — inténtalo de nuevo", 'error')
            # Vibrar borde rojo
            frame, *_ = self._user_frames[self.selected_user]
            orig_color = USERS[self.selected_user]['color']
            frame.configure(border_color=C['red'])
            self._pin = ""
            self.after(900, lambda: (
                frame.configure(border_color=orig_color),
                self._update_display()
            ))

    def _grant_access(self):
        color = USERS[self.selected_user]['color']
        self.result = (self.selected_user, color)
        self.destroy()

    def _set_status(self, msg: str, level: str = 'error'):
        color_map = {
            'error':   C['red'],
            'success': C['green'],
            'warning': C['yellow'],
        }
        self._status_lbl.configure(
            text=msg,
            text_color=color_map.get(level, C['gray2'])
        )

    # ── Selección usuario ─────────────────────────────────────────────────────
    def _select_user(self, username: str, clicked_frame: ctk.CTkFrame):
        self.selected_user = username
        self._pin = ""
        self._set_status("")

        _, color, _, _ = self._user_frames[username]
        for u, (f, c, *_) in self._user_frames.items():
            f.configure(border_color=C['border2'], fg_color=C['card2'])
        clicked_frame.configure(border_color=color, fg_color=C['card3'])
        self._update_display()

    def _on_close(self):
        self.result = None
        self.destroy()


# ── Entry point ───────────────────────────────────────────────────────────────
def ask_login(root) -> tuple:
    dlg = LoginScreen(root)
    root.wait_window(dlg)
    return dlg.result if dlg.result else (None, None)
