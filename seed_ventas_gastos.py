"""Importa Ventas y Gastos CORZE desde el Excel a Firestore. Uso: python3 seed_ventas_gastos.py"""
import os, sys
os.environ['FIRESTORE_EMULATOR_HOST'] = ''  # asegura prod

import firebase_admin
from firebase_admin import credentials, firestore

CRED_FILE = os.path.join(os.path.dirname(__file__), 'firebase_credentials.json')
cred = credentials.Certificate(CRED_FILE)
firebase_admin.initialize_app(cred)
db = firestore.client()

VENTAS = [
    dict(id_venta='VTA-001', fecha_venta='2026-07-17', num_cotizacion='COT-0321',
         cliente='Mario Lopez', proyecto='PRY-001', vendedor='Enrique Corvalán J',
         monto_venta=7000000, forma_pago='Transferencia',
         estado_instalacion='Pendiente instalación', fecha_entrega='2026-07-31',
         comision_pct=0, comision_monto=0, notas=''),
    dict(id_venta='VTA-002', fecha_venta='2026-07-19', num_cotizacion='COT-0322',
         cliente='Nicolas Pinilla Candia', proyecto='PRY-002', vendedor='Enrique Corvalán H',
         monto_venta=8154920, forma_pago='Tarjeta crédito',
         estado_instalacion='Pendiente instalación', fecha_entrega='2026-07-27',
         comision_pct=0, comision_monto=0, notas=''),
]

GASTOS = [
    dict(id_gasto='GTO-001', fecha='2026-06-23', categoria='Transporte y combustible',
         descripcion='Combustible y peaje Rapel', monto_neto=47800, iva=0, monto_total=47800,
         metodo_pago='Tarjeta crédito', responsable='Ignacio Corvalán', empresa='Copec', num_documento='Boleta'),
    dict(id_gasto='GTO-002', fecha='2026-06-24', categoria='Indumentaria',
         descripcion='Ropa corporativa', monto_neto=457327, iva=86892, monto_total=544219,
         metodo_pago='Tarjeta crédito', responsable='Enrique Corvalán H', empresa='Texora', num_documento='Boleta'),
    dict(id_gasto='GTO-003', fecha='2026-07-06', categoria='Indumentaria',
         descripcion='Bordado ropa corporativa', monto_neto=94500, iva=17955, monto_total=112455,
         metodo_pago='Transferencia', responsable='Enrique Corvalán H', empresa='Roca Estampa', num_documento='230'),
    dict(id_gasto='GTO-004', fecha='2026-07-04', categoria='Transporte y combustible',
         descripcion='Combustible y peaje Rapel', monto_neto=80000, iva=0, monto_total=80000,
         metodo_pago='Tarjeta crédito', responsable='Enrique Corvalán J', empresa='Copec', num_documento='Boleta'),
    dict(id_gasto='GTO-005', fecha='2026-07-04', categoria='Marketing',
         descripcion='Promo 6 meses Integralia', monto_neto=2400000, iva=0, monto_total=2400000,
         metodo_pago='Tarjeta crédito', responsable='Enrique Corvalán H', empresa='Integralia', num_documento='Factura pendiente'),
    dict(id_gasto='GTO-006', fecha='2026-07-01', categoria='Transporte y combustible',
         descripcion='Compra camioneta L200', monto_neto=9000000, iva=0, monto_total=9000000,
         metodo_pago='Transferencia', responsable='Empresa', empresa='', num_documento=''),
    dict(id_gasto='GTO-007', fecha='2026-07-08', categoria='Transporte y combustible',
         descripcion='Arreglo camioneta L200', monto_neto=250000, iva=0, monto_total=250000,
         metodo_pago='Transferencia', responsable='Enrique Corvalán H', empresa='Dario Lozano del Rio', num_documento='Particular Directo'),
    dict(id_gasto='GTO-008', fecha='2026-07-10', categoria='Transporte y combustible',
         descripcion='Arreglo camioneta L200', monto_neto=450000, iva=0, monto_total=450000,
         metodo_pago='Transferencia', responsable='Enrique Corvalán H', empresa='Dario Lozano del Rio', num_documento='Particular Directo'),
    dict(id_gasto='GTO-009', fecha='2026-07-20', categoria='Materiales proyectos',
         descripcion='Inv Solis 8 / 2 Bat Dyness 16kwh', monto_neto=4462122, iva=847803, monto_total=5309925,
         metodo_pago='Tarjeta crédito', responsable='Enrique Corvalán H', empresa='Natura Energy', num_documento='15934'),
    dict(id_gasto='GTO-010', fecha='2026-07-21', categoria='Materiales proyectos',
         descripcion='Materiales Casa 116 y Lopez', monto_neto=241861, iva=45954, monto_total=287815,
         metodo_pago='Tarjeta crédito', responsable='Enrique Corvalán H', empresa='Ferrelectric', num_documento='197585'),
    dict(id_gasto='GTO-011', fecha='2026-07-21', categoria='Herramientas',
         descripcion='Rotomartillo, Cascos de seguridad y Broca', monto_neto=268770, iva=51066, monto_total=319836,
         metodo_pago='Tarjeta crédito', responsable='Enrique Corvalán H', empresa='Pernos Kim', num_documento='768830'),
    dict(id_gasto='GTO-012', fecha='2026-07-21', categoria='Indumentaria',
         descripcion='Guantes', monto_neto=39960, iva=7592, monto_total=39960,
         metodo_pago='Tarjeta crédito', responsable='Enrique Corvalán H', empresa='Mercado Libre', num_documento='Boleta'),
    dict(id_gasto='GTO-013', fecha='2026-07-21', categoria='Herramientas',
         descripcion='Chicharra y dados allen 6mm', monto_neto=25126, iva=4774, monto_total=29900,
         metodo_pago='Tarjeta crédito', responsable='Enrique Corvalán H', empresa='Pernos Patricio', num_documento='206504'),
    dict(id_gasto='GTO-014', fecha='2026-07-21', categoria='Materiales proyectos',
         descripcion='Materiales Casa 116 y Lopez', monto_neto=361977, iva=68776, monto_total=430753,
         metodo_pago='Tarjeta crédito', responsable='Enrique Corvalán H', empresa='Guzman', num_documento=''),
    dict(id_gasto='GTO-015', fecha='2026-07-21', categoria='Materiales proyectos',
         descripcion='Materiales Casa 116 y Lopez', monto_neto=1752161, iva=332911, monto_total=2085072,
         metodo_pago='Tarjeta crédito', responsable='Enrique Corvalán H', empresa='Emat', num_documento='Factura pendiente'),
    dict(id_gasto='GTO-016', fecha='2026-07-23', categoria='Materiales proyectos',
         descripcion='Paneles Lopez', monto_neto=931980, iva=177076, monto_total=1109056,
         metodo_pago='Tarjeta crédito', responsable='Enrique Corvalán H', empresa='Dark Energy', num_documento='Factura pendiente'),
    dict(id_gasto='GTO-017', fecha='2026-07-23', categoria='Indumentaria',
         descripcion='Polar y pantalones', monto_neto=70178, iva=13334, monto_total=83512,
         metodo_pago='Tarjeta crédito', responsable='Enrique Corvalán H', empresa='Texora', num_documento='714374'),
    dict(id_gasto='GTO-018', fecha='2026-07-21', categoria='Materiales proyectos',
         descripcion='Materiales Casa 116 y Lopez', monto_neto=75068, iva=14263, monto_total=89331,
         metodo_pago='Tarjeta crédito', responsable='Enrique Corvalán H', empresa='Vitel', num_documento='1497204'),
    dict(id_gasto='GTO-019', fecha='2026-07-23', categoria='Herramientas',
         descripcion='Knock Out', monto_neto=57800, iva=10982, monto_total=68782,
         metodo_pago='Tarjeta crédito', responsable='Enrique Corvalán H', empresa='Inse', num_documento='32915'),
    dict(id_gasto='GTO-020', fecha='2026-07-24', categoria='Transporte y combustible',
         descripcion='Arreglo camioneta L200', monto_neto=100226, iva=0, monto_total=100226,
         metodo_pago='Transferencia', responsable='Enrique Corvalán H', empresa='Dario Lozano del Rio', num_documento='Particular Directo'),
    dict(id_gasto='GTO-021', fecha='2026-07-23', categoria='Transporte y combustible',
         descripcion='Flete EMAT - Casa 116', monto_neto=50000, iva=0, monto_total=50000,
         metodo_pago='Transferencia', responsable='Enrique Corvalán H', empresa='Manuel Bravo (Niño Feliz)', num_documento='Particular Directo'),
]

from datetime import datetime

def seed_collection(col_name, rows, id_field):
    col = db.collection(col_name)
    # Borra docs existentes con mismo id_field para evitar duplicados
    existing = {d.to_dict().get(id_field): d.id for d in col.stream()}
    for row in rows:
        row['created_at'] = row.get('created_at', datetime.now().isoformat())
        row['updated_at'] = datetime.now().isoformat()
        key = row.get(id_field)
        if key and key in existing:
            col.document(existing[key]).set(row)
            print(f'  actualizado {key}')
        else:
            col.add(row)
            print(f'  creado {key}')

print('Importando ventas...')
seed_collection('ventas_corze', VENTAS, 'id_venta')

print('Importando gastos...')
seed_collection('gastos_corze', GASTOS, 'id_gasto')

print('Listo.')
