# dashboard.py — VTA v2 · Dashboard con KPIs y gráficos

import customtkinter as ctk
from config import C
from widgets import KPICard, clp
from datetime import datetime

try:
    import matplotlib
    matplotlib.use('TkAgg')
    import matplotlib.pyplot as plt
    from matplotlib.backends.backend_tkagg import FigureCanvasTkAgg
    MATPLOTLIB_OK = True
    plt.rcParams.update({
        'figure.facecolor': C['card'], 'axes.facecolor': C['card'],
        'axes.edgecolor': C['border2'], 'axes.labelcolor': C['gray2'],
        'xtick.color': C['gray2'], 'ytick.color': C['gray2'],
        'text.color': C['white'], 'grid.color': C['border1'],
        'grid.linestyle': '--', 'grid.alpha': 0.4,
    })
except ImportError:
    MATPLOTLIB_OK = False


class ChartCard(ctk.CTkFrame):
    def __init__(self, parent, title, **kwargs):
        super().__init__(parent, fg_color=C['card'], corner_radius=14,
                         border_width=1, border_color=C['border2'], **kwargs)
        ctk.CTkLabel(self, text=title, font=ctk.CTkFont(size=12, weight="bold"),
                     text_color=C['white']).pack(anchor="w", padx=16, pady=(12, 2))
        ctk.CTkFrame(self, height=1, fg_color=C['border1']).pack(fill="x", padx=16)
        self.canvas_frame = ctk.CTkFrame(self, fg_color="transparent")
        self.canvas_frame.pack(fill="both", expand=True, padx=8, pady=(4, 8))

    def set_chart(self, fig):
        for w in self.canvas_frame.winfo_children():
            w.destroy()
        if MATPLOTLIB_OK:
            canvas = FigureCanvasTkAgg(fig, master=self.canvas_frame)
            canvas.draw()
            canvas.get_tk_widget().pack(fill="both", expand=True)


class DashboardView(ctk.CTkScrollableFrame):
    def __init__(self, parent, db, usuario='', usuario_color=''):
        super().__init__(parent, fg_color=C['bg'],
                         scrollbar_button_color=C['border2'],
                         scrollbar_button_hover_color=C['blue'])
        self.db             = db
        self.usuario        = usuario
        self.usuario_color  = usuario_color
        self._figs          = []
        self.grid_columnconfigure(0, weight=1)
        self._build_skeleton()

    def _build_skeleton(self):
        # Header
        hdr = ctk.CTkFrame(self, fg_color="transparent")
        hdr.grid(row=0, column=0, sticky="ew", padx=28, pady=(24, 6))
        hdr.grid_columnconfigure(1, weight=1)

        ctk.CTkLabel(hdr, text="📊  INDICADORES",
                     font=ctk.CTkFont(size=22, weight="bold"),
                     text_color=C['white']).grid(row=0, column=0, sticky="w")

        self._date_lbl = ctk.CTkLabel(hdr, text="",
                                       font=ctk.CTkFont(size=10),
                                       text_color=C['gray3'])
        self._date_lbl.grid(row=0, column=2, sticky="e")

        self._kpi_r1 = ctk.CTkFrame(self, fg_color="transparent")
        self._kpi_r1.grid(row=1, column=0, sticky="ew", padx=28, pady=(0, 6))
        for i in range(4): self._kpi_r1.grid_columnconfigure(i, weight=1)

        self._kpi_r2 = ctk.CTkFrame(self, fg_color="transparent")
        self._kpi_r2.grid(row=2, column=0, sticky="ew", padx=28, pady=(0, 10))
        for i in range(4): self._kpi_r2.grid_columnconfigure(i, weight=1)

        self._chart_r1 = ctk.CTkFrame(self, fg_color="transparent")
        self._chart_r1.grid(row=3, column=0, sticky="ew", padx=28, pady=(0, 8))
        self._chart_r1.grid_columnconfigure(0, weight=3)
        self._chart_r1.grid_columnconfigure(1, weight=2)

        self._chart_r2 = ctk.CTkFrame(self, fg_color="transparent")
        self._chart_r2.grid(row=4, column=0, sticky="ew", padx=28, pady=(0, 28))
        self._chart_r2.grid_columnconfigure(0, weight=1)
        self._chart_r2.grid_columnconfigure(1, weight=1)

    def refresh(self):
        s = self.db.get_dashboard_stats()
        self._figs.clear()
        self._date_lbl.configure(
            text=f"Hola, {self.usuario}  ·  {datetime.now().strftime('%d/%m/%Y  %H:%M')}")
        self._render_kpis(s)
        if MATPLOTLIB_OK:
            self._render_charts(s)

    def _render_kpis(self, s):
        for f in [self._kpi_r1, self._kpi_r2]:
            for w in f.winfo_children(): w.destroy()

        kpis1 = [
            ("En Stock",         str(s['total_stock']),
             f"{s['total_publicados']} pub · {s['total_reservados']} res",
             C['blue'], "🚗"),
            ("Vendidos",         str(s['vendidos_total']),
             f"{s['vendidos_mes']} este mes",
             C['green'], "✅"),
            ("Ganancia Total",   clp(s['ganancia_total']),
             f"{clp(s['ganancia_mes'])} este mes",
             C['yellow'], "💰"),
            ("Tiempo Prom. Venta", f"{s['tiempo_promedio_venta']:.0f} días",
             "desde ingreso hasta venta",
             C['purple'], "⏱️"),
        ]
        kpis2 = [
            ("Valor Inventario", clp(s['valor_inventario']),
             "precio colaboradores en stock",
             C['teal'], "📦"),
            ("Consig. Activas",  str(s['consignaciones_activas']),
             f"{s['consignaciones_vendidas']} vendidas",
             C['green'], "🤝"),
            ("Comisiones Total", clp(s['comisiones_total']),
             f"{clp(s['comisiones_mes'])} este mes",
             C['yellow'], "📋"),
            ("⚠️ Alertas Stock",
             f"{s['alerta_criticos']} críticos",
             f"{s['alerta_warnings']} en advertencia",
             C['red'] if s['alerta_criticos'] > 0 else C['gray3'], "🔴"),
        ]

        for col, (title, value, sub, color, icon) in enumerate(kpis1):
            card = KPICard(self._kpi_r1, title, value, sub, color, icon, height=110)
            card.grid(row=0, column=col, padx=5, pady=2, sticky="ew")
            card.grid_propagate(False)

        for col, (title, value, sub, color, icon) in enumerate(kpis2):
            card = KPICard(self._kpi_r2, title, value, sub, color, icon, height=96)
            card.grid(row=0, column=col, padx=5, pady=2, sticky="ew")
            card.grid_propagate(False)

    def _render_charts(self, s):
        for f in [self._chart_r1, self._chart_r2]:
            for w in f.winfo_children(): w.destroy()

        c1 = ChartCard(self._chart_r1, "📈  Ventas y Ganancia por Mes")
        c1.grid(row=0, column=0, padx=(0, 6), pady=4, sticky="nsew")
        f1 = self._fig_ventas(s)
        c1.set_chart(f1)
        self._figs.append(f1)

        c2 = ChartCard(self._chart_r1, "🏷️  Stock por Marca")
        c2.grid(row=0, column=1, padx=(6, 0), pady=4, sticky="nsew")
        f2 = self._fig_marcas(s)
        c2.set_chart(f2)
        self._figs.append(f2)

        c3 = ChartCard(self._chart_r2, "📋  Estado del Inventario")
        c3.grid(row=0, column=0, padx=(0, 6), pady=4, sticky="nsew")
        f3 = self._fig_estado(s)
        c3.set_chart(f3)
        self._figs.append(f3)

        c4 = ChartCard(self._chart_r2, "💎  Rentabilidad por Marca")
        c4.grid(row=0, column=1, padx=(6, 0), pady=4, sticky="nsew")
        f4 = self._fig_rentabilidad(s)
        c4.set_chart(f4)
        self._figs.append(f4)

    def _fig_ventas(self, s):
        fig, ax = plt.subplots(figsize=(7, 3.4), facecolor=C['card'])
        ax.set_facecolor(C['card'])
        ventas = list(reversed(s.get('ventas_por_mes', [])))
        if ventas:
            meses = [v['mes'] for v in ventas]
            cant  = [v['cantidad'] for v in ventas]
            gan   = [v['ganancia'] / 1_000_000 for v in ventas]
            x = range(len(meses))
            bars = ax.bar(x, cant, color=C['blue'], alpha=0.85, width=0.5, zorder=3)
            for b, v in zip(bars, cant):
                ax.text(b.get_x() + b.get_width()/2, b.get_height() + 0.05,
                        str(v), ha='center', va='bottom', fontsize=8,
                        color=C['white'], fontweight='bold')
            ax2 = ax.twinx()
            ax2.plot(x, gan, color=C['green'], marker='o', linewidth=2, markersize=5, zorder=4)
            ax2.set_ylabel('Ganancia (M$)', color=C['green'], fontsize=8)
            ax2.tick_params(axis='y', colors=C['green'], labelsize=7)
            for sp in ax2.spines.values(): sp.set_visible(False)
            ax.set_xticks(list(x))
            ax.set_xticklabels(meses, rotation=40, ha='right', fontsize=7)
            ax.set_ylabel('Unidades', fontsize=8)
        else:
            ax.text(0.5, 0.5, 'Sin datos de ventas aún',
                    ha='center', va='center', transform=ax.transAxes,
                    color=C['gray3'], fontsize=11)
        for sp in ['top', 'right']: ax.spines[sp].set_visible(False)
        ax.grid(axis='y', zorder=0)
        fig.tight_layout(pad=1.4)
        return fig

    def _fig_marcas(self, s):
        fig, ax = plt.subplots(figsize=(4.2, 3.4), facecolor=C['card'])
        ax.set_facecolor(C['card'])
        data = s.get('stock_por_marca', [])
        if data:
            labels  = [d['marca'] or '—' for d in data[:8]]
            sizes   = [d['cantidad'] for d in data[:8]]
            palette = [C['blue'], C['teal'], C['green'], C['yellow'],
                       C['purple'], C['red'], C['orange'], C['gray2']]
            colors  = palette[:len(labels)]
            wedges, _, ats = ax.pie(
                sizes, autopct='%1.0f%%', pctdistance=0.72, colors=colors,
                wedgeprops=dict(width=0.5, edgecolor=C['card'], linewidth=2), startangle=90)
            for at in ats:
                at.set_color(C['white']); at.set_fontsize(7)
            ax.legend(wedges, [f"{l} ({s})" for l, s in zip(labels, sizes)],
                      loc="lower center", bbox_to_anchor=(0.5, -0.22),
                      ncol=2, fontsize=7, frameon=False, labelcolor=C['gray2'])
        else:
            ax.text(0.5, 0.5, 'Sin stock', ha='center', va='center',
                    transform=ax.transAxes, color=C['gray3'], fontsize=11)
        fig.tight_layout(pad=1.0)
        return fig

    def _fig_estado(self, s):
        fig, ax = plt.subplots(figsize=(5, 2.8), facecolor=C['card'])
        ax.set_facecolor(C['card'])
        data = s.get('estado_data', [])
        cmap = {'En Stock': C['blue'], 'Publicado': C['yellow'],
                'Reservado': C['purple'], 'Vendido': C['green']}
        if data:
            labels = [d['estado'] for d in data]
            values = [d['cantidad'] for d in data]
            colors = [cmap.get(l, C['gray2']) for l in labels]
            bars = ax.barh(labels, values, color=colors, height=0.45, zorder=3)
            for b, v in zip(bars, values):
                ax.text(b.get_width() + 0.1, b.get_y() + b.get_height()/2,
                        str(v), va='center', fontsize=10,
                        color=C['white'], fontweight='bold')
            ax.set_xlim(0, max(values) * 1.3 if values else 10)
        else:
            ax.text(0.5, 0.5, 'Sin datos', ha='center', va='center',
                    transform=ax.transAxes, color=C['gray3'])
        for sp in ['top', 'right']: ax.spines[sp].set_visible(False)
        ax.grid(axis='x', zorder=0)
        fig.tight_layout(pad=1.4)
        return fig

    def _fig_rentabilidad(self, s):
        fig, ax = plt.subplots(figsize=(5, 2.8), facecolor=C['card'])
        ax.set_facecolor(C['card'])
        data = s.get('rentabilidad_marca', [])
        if data:
            marcas = [d['marca'] for d in data[:6]]
            ganancia = [d['ganancia_total'] / 1_000_000 for d in data[:6]]
            bars = ax.bar(range(len(marcas)), ganancia,
                          color=C['green'], alpha=0.85, width=0.5, zorder=3)
            for b, v in zip(bars, ganancia):
                ax.text(b.get_x() + b.get_width()/2, b.get_height() + 0.02,
                        f"${v:.1f}M", ha='center', va='bottom',
                        fontsize=7, color=C['green'])
            ax.set_xticks(range(len(marcas)))
            ax.set_xticklabels(marcas, fontsize=7, rotation=20, ha='right')
            ax.set_ylabel('Ganancia (M$)', fontsize=8)
        else:
            ax.text(0.5, 0.5, 'Sin ventas registradas', ha='center', va='center',
                    transform=ax.transAxes, color=C['gray3'], fontsize=11)
        for sp in ['top', 'right']: ax.spines[sp].set_visible(False)
        ax.grid(axis='y', zorder=0)
        fig.tight_layout(pad=1.4)
        return fig
