# database.py — VTA Web v2.1 · Inventario unificado

import os, json
from datetime import datetime
from typing import Optional, List, Dict, Any

import firebase_admin
from firebase_admin import credentials, firestore
ALERT_DAYS_WARNING  = 30
ALERT_DAYS_CRITICAL = 60


class FirebaseDB:
    def __init__(self):
        if not firebase_admin._apps:
            cred_json = os.environ.get('FIREBASE_CREDENTIALS_JSON')
            if cred_json:
                # Normalizar: reemplazar \\n literales por \n reales en la private_key
                cred_dict = json.loads(cred_json)
                if 'private_key' in cred_dict:
                    cred_dict['private_key'] = cred_dict['private_key'].replace('\\n', '\n')
                cred = credentials.Certificate(cred_dict)
            else:
                cred = credentials.Certificate('firebase_credentials.json')
            firebase_admin.initialize_app(cred)
        self.db = firestore.client()

    @staticmethod
    def _now():  return datetime.now().strftime('%Y-%m-%d %H:%M:%S')
    @staticmethod
    def _today(): return datetime.now().strftime('%Y-%m-%d')
    @staticmethod
    def _calc_dias(ingreso, hasta=''):
        try:
            d1 = datetime.strptime(ingreso[:10], '%Y-%m-%d')
            d2 = datetime.strptime(hasta[:10], '%Y-%m-%d') if hasta else datetime.now()
            return max(0, (d2 - d1).days)
        except: return 0

    def _doc(self, doc) -> dict:
        d = doc.to_dict(); d['id'] = doc.id; return d

    def _log(self, doc_id, accion, usuario, detalle=''):
        try:
            self.db.collection('historial').add({
                'doc_id': doc_id, 'accion': accion,
                'usuario': usuario, 'detalle': detalle, 'fecha': self._now()
            })
        except: pass

    # ── INVENTARIO UNIFICADO ──────────────────────────────────────────────────
    def add_inventario(self, data: dict) -> tuple:
        try:
            data.setdefault('fecha_ingreso', self._today())
            data.setdefault('tipo_registro', 'INTERNO')
            data.setdefault('estado', 'En Stock')
            data.setdefault('ganancia', 0)
            data.setdefault('comision_monto', 0)
            data['dias_en_stock'] = self._calc_dias(data.get('fecha_ingreso', self._today()))
            data['created_at']    = self._now()
            data['updated_at']    = self._now()
            ref = self.db.collection('inventario').add(data)
            self._log(ref[1].id, 'CREAR', data.get('usuario_creacion', ''),
                      f"{data.get('tipo_registro')} · {data.get('patente','')} {data.get('marca','')} {data.get('modelo','')}")
            return True, ref[1].id
        except Exception as e:
            return False, str(e)

    def get_all_inventario(self, tipo='', estado='', query='', strip_photos=False) -> List[dict]:
        try:
            col  = self.db.collection('inventario').order_by(
                'created_at', direction=firestore.Query.DESCENDING)
            docs = [self._doc(d) for d in col.stream()]
            if strip_photos:
                for d in docs: d.pop('foto_portada', None)
            # Filtros en Python (Firestore tiene límites con múltiples where)
            if tipo:   docs = [r for r in docs if r.get('tipo_registro') == tipo]
            if estado: docs = [r for r in docs if r.get('estado') == estado]
            if query:
                q = query.lower()
                docs = [r for r in docs if
                    q in str(r.get('patente','')).lower() or
                    q in str(r.get('marca','')).lower() or
                    q in str(r.get('modelo','')).lower() or
                    q in str(r.get('color','')).lower() or
                    q in str(r.get('nombre_propietario','')).lower() or
                    q in str(r.get('chasis','')).lower()]
            # Calcular días en stock en tiempo real
            for r in docs:
                if r.get('estado') != 'Vendido' and r.get('fecha_ingreso'):
                    r['dias_en_stock'] = self._calc_dias(r['fecha_ingreso'])
            return docs
        except Exception as e:
            print(f'Error get_all_inventario: {e}')
            return []

    def get_inventario_by_id(self, doc_id: str) -> Optional[dict]:
        try:
            doc = self.db.collection('inventario').document(doc_id).get()
            return self._doc(doc) if doc.exists else None
        except: return None

    def update_inventario(self, doc_id: str, data: dict) -> tuple:
        try:
            data.pop('id', None)
            if data.get('estado') == 'Vendido':
                if not data.get('fecha_venta'):
                    data['fecha_venta'] = self._today()
                # Calcular ganancia o comisión
                if data.get('tipo_registro') == 'CONSIGNACIÓN':
                    pct     = float(data.get('comision_porcentaje', 5))
                    pedido  = int(data.get('precio_pedido', 0) or 0)
                    pventa  = int(data.get('precio_venta_final', 0) or 0)
                    # Comisión sobre precio_pedido (acordado con el propietario)
                    # Si precio_venta_final > precio_pedido, cobrar sobre precio_venta_final
                    base = max(pedido, pventa)
                    data['comision_monto'] = int(base * pct / 100)
                else:
                    pc = int(data.get('precio_compra', 0) or 0)
                    pv = int(data.get('precio_venta_final', 0) or 0)
                    data['ganancia'] = max(0, pv - pc)
            if data.get('fecha_ingreso'):
                fv = data.get('fecha_venta', '') if data.get('estado') == 'Vendido' else ''
                data['dias_en_stock'] = self._calc_dias(data['fecha_ingreso'], fv)
            data['updated_at'] = self._now()
            self.db.collection('inventario').document(doc_id).update(data)
            self._log(doc_id, 'EDITAR', data.get('usuario_ultima_edicion', ''),
                      f"Estado: {data.get('estado','')}")
            return True, ''
        except Exception as e:
            return False, str(e)

    def delete_inventario(self, doc_id: str, usuario='') -> bool:
        try:
            self._log(doc_id, 'ELIMINAR', usuario)
            self.db.collection('inventario').document(doc_id).delete()
            return True
        except: return False

    def quick_sell_inventario(self, doc_id: str, precio: int, fecha: str, usuario: str) -> tuple:
        row = self.get_inventario_by_id(doc_id)
        if not row: return False, 'No encontrado'
        row['estado']             = 'Vendido'
        row['precio_venta_final'] = precio
        row['fecha_venta']        = fecha or self._today()
        row['usuario_ultima_edicion'] = usuario
        return self.update_inventario(doc_id, row)

    def duplicate_inventario(self, doc_id: str, usuario: str) -> tuple:
        row = self.get_inventario_by_id(doc_id)
        if not row: return False, 'No encontrado'
        row.pop('id', None)
        row['patente']           = ''
        row['chasis']            = ''
        row['estado']            = 'En Stock'
        row['precio_venta_final']= 0
        row['ganancia']          = 0
        row['comision_monto']    = 0
        row['fecha_venta']       = ''
        row['fecha_publicacion'] = ''
        row['fecha_ingreso']     = self._today()
        row['usuario_creacion']  = usuario
        row['notas']             = f"[Copia] " + row.get('notas', '')
        row.pop('created_at', None); row.pop('updated_at', None)
        return self.add_inventario(row)

    # ── DASHBOARD ─────────────────────────────────────────────────────────────
    def get_dashboard_stats(self) -> dict:
        s: Dict[str, Any] = {
            'total_stock':0,'total_publicados':0,'total_reservados':0,
            'vendidos_total':0,'vendidos_mes':0,
            'ganancia_total':0,'ganancia_mes':0,
            'comisiones_total':0,'comisiones_mes':0,
            'valor_inventario':0,'tiempo_promedio_venta':0.0,
            'internos_activos':0,'consignaciones_activas':0,'consignaciones_vendidas':0,
            'alerta_criticos':0,'alerta_warnings':0,
            'ventas_por_mes':[],'stock_por_marca':[],
            'estado_data':[],'rentabilidad_marca':[],
            'consig_estado_data':[],
            # nuevos KPIs
            'dias_promedio_stock_activo':0.0,
            'vehiculos_60dias':0,
            'precio_promedio_venta':0,
            'margen_promedio_pct':0.0,
            'stock_antiguedad':[],
        }
        try:
            mes  = datetime.now().strftime('%Y-%m')
            docs = self.get_all_inventario()

            estado_c: Dict[str,int] = {}
            for r in docs:
                e = r.get('estado','')
                estado_c[e] = estado_c.get(e, 0) + 1
            s['total_stock']      = estado_c.get('En Stock', 0)
            s['total_publicados'] = estado_c.get('Publicado', 0)
            s['total_reservados'] = estado_c.get('Reservado', 0)
            s['vendidos_total']   = estado_c.get('Vendido', 0)
            s['estado_data']      = [{'estado':k,'cantidad':v} for k,v in estado_c.items()]

            vendidos = [r for r in docs if r.get('estado')=='Vendido']
            s['vendidos_mes']     = sum(1 for r in vendidos if str(r.get('fecha_venta','')).startswith(mes))
            s['ganancia_total']   = sum(int(r.get('ganancia',0) or 0) for r in vendidos if r.get('tipo_registro')=='INTERNO')
            s['ganancia_mes']     = sum(int(r.get('ganancia',0) or 0) for r in vendidos if r.get('tipo_registro')=='INTERNO' and str(r.get('fecha_venta','')).startswith(mes))
            s['comisiones_total'] = sum(int(r.get('comision_monto',0) or 0) for r in vendidos if r.get('tipo_registro')=='CONSIGNACIÓN')
            s['comisiones_mes']   = sum(int(r.get('comision_monto',0) or 0) for r in vendidos if r.get('tipo_registro')=='CONSIGNACIÓN' and str(r.get('fecha_venta','')).startswith(mes))

            activos = [r for r in docs if r.get('estado') != 'Vendido']
            s['valor_inventario']        = sum(int(r.get('precio_venta_colaboradores',0) or 0) for r in activos if r.get('tipo_registro')=='INTERNO')
            s['internos_activos']        = sum(1 for r in activos if r.get('tipo_registro')=='INTERNO')
            s['consignaciones_activas']  = sum(1 for r in activos if r.get('tipo_registro')=='CONSIGNACIÓN')

            dias_list = [int(r.get('dias_en_stock',0) or 0) for r in vendidos if r.get('dias_en_stock')]
            s['tiempo_promedio_venta'] = round(sum(dias_list)/len(dias_list),1) if dias_list else 0.0

            for r in activos:
                if r.get('fecha_ingreso'):
                    d = self._calc_dias(r['fecha_ingreso'])
                    if d >= ALERT_DAYS_CRITICAL:   s['alerta_criticos'] += 1
                    elif d >= ALERT_DAYS_WARNING:  s['alerta_warnings'] += 1

            mes_data: Dict[str,dict] = {}
            for r in vendidos:
                m = str(r.get('fecha_venta',''))[:7]
                if not m: continue
                if m not in mes_data: mes_data[m] = {'mes':m,'cantidad':0,'ganancia':0}
                mes_data[m]['cantidad'] += 1
                mes_data[m]['ganancia'] += int(r.get('ganancia',0) or 0) + int(r.get('comision_monto',0) or 0)
            s['ventas_por_mes'] = sorted(mes_data.values(), key=lambda x: x['mes'])[-10:]

            mc: Dict[str,int] = {}
            for r in activos:
                m = r.get('marca','Otro')
                mc[m] = mc.get(m, 0) + 1
            s['stock_por_marca'] = sorted([{'marca':k,'cantidad':v} for k,v in mc.items()], key=lambda x:-x['cantidad'])[:10]

            mg: Dict[str,dict] = {}
            for r in vendidos:
                m = r.get('marca','Otro')
                if m not in mg: mg[m] = {'marca':m,'vendidos':0,'ganancia_total':0}
                mg[m]['vendidos'] += 1
                mg[m]['ganancia_total'] += int(r.get('ganancia',0) or 0) + int(r.get('comision_monto',0) or 0)
            s['rentabilidad_marca'] = sorted(mg.values(), key=lambda x:-x['ganancia_total'])[:8]

            # ── Métricas de rotación y antigüedad ─────────────────────────────
            dias_activos_lista = []
            for r in activos:
                if r.get('fecha_ingreso'):
                    dias_activos_lista.append(self._calc_dias(r['fecha_ingreso']))
                elif r.get('dias_en_stock'):
                    dias_activos_lista.append(int(r.get('dias_en_stock', 0) or 0))
            if dias_activos_lista:
                s['dias_promedio_stock_activo'] = round(sum(dias_activos_lista) / len(dias_activos_lista), 1)
            s['vehiculos_60dias'] = sum(1 for d in dias_activos_lista if d >= 60)

            antig = {'0-30d': 0, '31-60d': 0, '61-90d': 0, '90+d': 0}
            for d in dias_activos_lista:
                if d <= 30:   antig['0-30d'] += 1
                elif d <= 60: antig['31-60d'] += 1
                elif d <= 90: antig['61-90d'] += 1
                else:         antig['90+d'] += 1
            s['stock_antiguedad'] = [{'rango': k, 'cantidad': v} for k, v in antig.items()]

            # ── Precio y margen promedio ───────────────────────────────────────
            precios_v = [int(r.get('precio_venta', 0) or 0) for r in vendidos
                         if r.get('tipo_registro') == 'INTERNO' and int(r.get('precio_venta', 0) or 0) > 0]
            s['precio_promedio_venta'] = round(sum(precios_v) / len(precios_v)) if precios_v else 0

            margen_pcts = []
            for r in vendidos:
                if r.get('tipo_registro') == 'INTERNO':
                    pv  = int(r.get('precio_venta', 0) or 0)
                    gan = int(r.get('ganancia', 0) or 0)
                    if pv > 0:
                        margen_pcts.append(gan / pv * 100)
            s['margen_promedio_pct'] = round(sum(margen_pcts) / len(margen_pcts), 2) if margen_pcts else 0.0

            s['consignaciones_vendidas'] = sum(1 for r in vendidos if r.get('tipo_registro') == 'CONSIGNACIÓN')

        except Exception as e:
            print(f'Stats error: {e}')
        return s

    # ── CRM ───────────────────────────────────────────────────────────────────
    def get_conversaciones(self) -> list:
        try:
            docs = self.db.collection('crm_conversaciones').stream()
            convs = [self._doc(d) for d in docs]
            return sorted(convs, key=lambda x: x.get('ultima_hora', ''), reverse=True)
        except Exception as e:
            print(f'Error get_conversaciones: {e}')
            return []

    def get_or_create_conversacion(self, sender_id: str, canal: str,
                                    nombre: str = '', telefono: str = '') -> dict:
        try:
            docs = list(self.db.collection('crm_conversaciones')
                        .where('sender_id', '==', sender_id)
                        .where('canal', '==', canal).limit(1).stream())
            if docs:
                return self._doc(docs[0])
            data = {
                'sender_id': sender_id, 'canal': canal,
                'nombre_cliente': nombre, 'telefono': telefono,
                'estado': 'nuevo', 'asignado_a': '',
                'ultimo_mensaje': '', 'ultima_hora': self._now(),
                'no_leidos': 0, 'total_mensajes': 0,
                'fecha_inicio': self._now(),
                'vehiculo_id': None, 'vehiculo_vinculado': None,
                'notas': '',
            }
            ref = self.db.collection('crm_conversaciones').add(data)
            data['id'] = ref[1].id
            return data
        except Exception as e:
            print(f'Error get_or_create_conv: {e}')
            return {}

    def create_lead(self, nombre: str, telefono: str, email: str = '',
                    canal: str = 'manual', vehiculo_interes: str = '',
                    notas: str = '', etapa: str = 'Nuevo',
                    origen: str = 'manual') -> dict:
        """Crea un nuevo lead manualmente en el CRM."""
        try:
            import uuid
            sender_id = f'manual_{uuid.uuid4().hex[:8]}'
            data = {
                'sender_id':       sender_id,
                'canal':           canal,
                'nombre_cliente':  nombre,
                'telefono':        telefono,
                'email':           email,
                'estado':          'nuevo',
                'etapa_crm':       etapa,
                'asignado_a':      '',
                'ultimo_mensaje':  f'Lead creado: {vehiculo_interes or "sin vehículo"}',
                'ultima_hora':     self._now(),
                'no_leidos':       0,
                'total_mensajes':  0,
                'fecha_inicio':    self._now(),
                'vehiculo_id':     None,
                'vehiculo_vinculado': None,
                'vehiculo_interes':vehiculo_interes,
                'notas':           notas,
                'origen':          origen,
            }
            ref  = self.db.collection('crm_conversaciones').add(data)
            data['id'] = ref[1].id
            return data
        except Exception as e:
            print(f'Error create_lead: {e}')
            return {}

    def update_conversacion(self, conv_id: str, data: dict) -> bool:
        try:
            data['updated_at'] = self._now()
            self.db.collection('crm_conversaciones').document(conv_id).update(data)
            return True
        except Exception as e:
            print(f'Error update_conv: {e}')
            return False

    def add_mensaje(self, conv_id: str, contenido: str, direccion: str,
                    nombre_remitente: str = '', leido: bool = False,
                    msg_id: str = '') -> bool:
        try:
            from google.cloud.firestore_v1 import Increment as FSIncrement
            self.db.collection('crm_mensajes').add({
                'conv_id': conv_id, 'contenido': contenido,
                'direccion': direccion, 'nombre_remitente': nombre_remitente,
                'leido': leido, 'msg_id': msg_id,
                'timestamp': self._now(),
            })
            update_data = {
                'ultimo_mensaje': contenido[:80],
                'ultima_hora':    self._now(),
                'total_mensajes': FSIncrement(1),
            }
            if direccion == 'entrante':
                update_data['no_leidos'] = FSIncrement(1)
                update_data['estado']    = 'nuevo'
            self.db.collection('crm_conversaciones').document(conv_id).update(update_data)
            return True
        except Exception as e:
            print(f'Error add_mensaje: {e}')
            return False

    def get_mensajes(self, conv_id: str) -> list:
        """Sin order_by para evitar requerir índice compuesto en Firestore.
           Ordenamos en Python después."""
        try:
            docs = self.db.collection('crm_mensajes')\
                .where('conv_id', '==', conv_id).stream()
            msgs = [self._doc(d) for d in docs]
            return sorted(msgs, key=lambda x: x.get('timestamp', ''))
        except Exception as e:
            print(f'Error get_mensajes: {e}')
            return []

    def marcar_leido(self, conv_id: str):
        try:
            self.db.collection('crm_conversaciones').document(conv_id).update(
                {'no_leidos': 0})
        except Exception: pass

    # ── FOTOS (subcollección inventario/{id}/fotos) ───────────────────────────
    def get_fotos(self, doc_id: str) -> List[dict]:
        try:
            docs = self.db.collection('inventario').document(doc_id)\
                       .collection('fotos').order_by('orden').stream()
            return [self._doc(d) for d in docs]
        except Exception as e:
            print(f'Error get_fotos: {e}')
            return []

    def add_foto(self, doc_id: str, foto_b64: str, nombre: str, usuario: str) -> tuple:
        try:
            fotos    = self.get_fotos(doc_id)
            orden    = len(fotos)
            portada  = orden == 0
            ref = self.db.collection('inventario').document(doc_id)\
                      .collection('fotos').add({
                'foto':            foto_b64,
                'nombre':          nombre or f'foto_{orden+1}',
                'portada':         portada,
                'orden':           orden,
                'object_position': 'center center',
                'usuario_upload':  usuario,
                'created_at':      self._now(),
            })
            update = {'total_fotos': orden + 1}
            if portada:
                update['foto_portada'] = foto_b64
            self.db.collection('inventario').document(doc_id).update(update)
            return True, ref[1].id
        except Exception as e:
            return False, str(e)

    def delete_foto(self, doc_id: str, foto_id: str) -> bool:
        try:
            col     = self.db.collection('inventario').document(doc_id).collection('fotos')
            snap    = col.document(foto_id).get()
            era_portada = snap.to_dict().get('portada', False) if snap.exists else False
            col.document(foto_id).delete()
            restantes = self.get_fotos(doc_id)
            update    = {'total_fotos': len(restantes)}
            if era_portada and restantes:
                col.document(restantes[0]['id']).update({'portada': True})
                update['foto_portada'] = restantes[0].get('foto', '')
            elif not restantes:
                update['foto_portada'] = ''
            self.db.collection('inventario').document(doc_id).update(update)
            return True
        except Exception as e:
            print(f'Error delete_foto: {e}')
            return False

    def set_foto_portada(self, doc_id: str, foto_id: str) -> bool:
        try:
            col = self.db.collection('inventario').document(doc_id).collection('fotos')
            for f in col.stream():
                f.reference.update({'portada': False})
            foto_ref = col.document(foto_id)
            foto_ref.update({'portada': True})
            foto_data = foto_ref.get().to_dict() or {}
            self.db.collection('inventario').document(doc_id).update(
                {'foto_portada': foto_data.get('foto', '')})
            return True
        except Exception as e:
            print(f'Error set_foto_portada: {e}')
            return False

    def update_foto(self, doc_id: str, foto_id: str, data: dict) -> bool:
        try:
            allowed = {'object_position', 'nombre', 'foto'}
            clean   = {k: v for k, v in data.items() if k in allowed}
            self.db.collection('inventario').document(doc_id)\
                .collection('fotos').document(foto_id).update(clean)
            if 'foto' in clean:
                portada = self.db.collection('inventario').document(doc_id)\
                    .collection('fotos').document(foto_id).get().to_dict() or {}
                if portada.get('portada'):
                    self.db.collection('inventario').document(doc_id)\
                        .update({'foto_portada': clean['foto']})
            return True
        except Exception as e:
            print(f'Error update_foto: {e}')
            return False

    def reorder_fotos(self, doc_id: str, order: list) -> bool:
        try:
            col = self.db.collection('inventario').document(doc_id).collection('fotos')
            for i, fid in enumerate(order):
                col.document(fid).update({'orden': i})
            return True
        except Exception as e:
            print(f'Error reorder_fotos: {e}')
            return False

    # ── CALENDARIO ───────────────────────────────────────────────────────────
    def get_eventos_calendario(self, mes: str = '') -> List[dict]:
        try:
            docs = [self._doc(d) for d in self.db.collection('calendario').stream()]
            if mes:
                docs = [r for r in docs if str(r.get('fecha', '')).startswith(mes)]
            return sorted(docs, key=lambda x: (x.get('fecha', ''), x.get('hora_inicio', '')))
        except Exception as e:
            print(f'Error get_eventos_calendario: {e}')
            return []

    def add_evento_calendario(self, data: dict) -> tuple:
        try:
            data['created_at'] = self._now()
            data['updated_at'] = self._now()
            ref = self.db.collection('calendario').add(data)
            return True, ref[1].id
        except Exception as e:
            return False, str(e)

    def update_evento_calendario(self, doc_id: str, data: dict) -> tuple:
        try:
            data.pop('id', None)
            data['updated_at'] = self._now()
            self.db.collection('calendario').document(doc_id).update(data)
            return True, None
        except Exception as e:
            return False, str(e)

    def delete_evento_calendario(self, doc_id: str) -> bool:
        try:
            self.db.collection('calendario').document(doc_id).delete()
            return True
        except Exception as e:
            print(f'Error delete_evento_calendario: {e}')
            return False

    # ── BUSCADOR — Guardados marketplace ─────────────────────────────────────
    def get_guardados_buscador(self) -> List[dict]:
        try:
            docs = [self._doc(d) for d in self.db.collection('buscador_guardados').stream()]
            return sorted(docs, key=lambda x: x.get('created_at', ''), reverse=True)
        except Exception as e:
            print(f'Error get_guardados_buscador: {e}')
            return []

    def add_guardado_buscador(self, data: dict) -> tuple:
        try:
            data['created_at'] = self._now()
            ref = self.db.collection('buscador_guardados').add(data)
            return True, ref[1].id
        except Exception as e:
            return False, str(e)

    def delete_guardado_buscador(self, doc_id: str) -> bool:
        try:
            self.db.collection('buscador_guardados').document(doc_id).delete()
            return True
        except Exception as e:
            return False

    # ── CONFIGURACIÓN GENERAL (metas, costos fijos, templates) ───────────────
    def get_meta(self, mes: str) -> dict:
        try:
            doc = self.db.collection('config').document(f'meta_{mes}').get()
            return doc.to_dict() or {} if doc.exists else {}
        except Exception:
            return {}

    def save_meta(self, mes: str, unidades: int, ingresos: int) -> bool:
        try:
            self.db.collection('config').document(f'meta_{mes}').set(
                {'mes': mes, 'unidades': unidades, 'ingresos': ingresos})
            return True
        except Exception as e:
            print(f'Error save_meta: {e}')
            return False

    def get_costos_fijos(self) -> list:
        try:
            doc = self.db.collection('config').document('costos_fijos').get()
            d = doc.to_dict() if doc.exists else {}
            return d.get('items', [])
        except Exception:
            return []

    def save_costos_fijos(self, items: list) -> bool:
        try:
            self.db.collection('config').document('costos_fijos').set({'items': items})
            return True
        except Exception as e:
            print(f'Error save_costos_fijos: {e}')
            return False

    def get_wa_templates(self) -> list:
        try:
            doc = self.db.collection('config').document('wa_templates').get()
            d = doc.to_dict() if doc.exists else {}
            return d.get('templates', [])
        except Exception:
            return []

    def save_wa_templates(self, templates: list) -> bool:
        try:
            self.db.collection('config').document('wa_templates').set({'templates': templates})
            return True
        except Exception as e:
            print(f'Error save_wa_templates: {e}')
            return False

    def get_gemini_key(self) -> str:
        try:
            doc = self.db.collection('config').document('gemini').get()
            return (doc.to_dict() or {}).get('api_key', '') if doc.exists else ''
        except Exception:
            return ''

    def save_gemini_key(self, api_key: str) -> bool:
        try:
            self.db.collection('config').document('gemini').set({'api_key': api_key})
            return True
        except Exception as e:
            print(f'Error save_gemini_key: {e}')
            return False

    def get_anthropic_key(self) -> str:
        try:
            doc = self.db.collection('config').document('anthropic').get()
            return (doc.to_dict() or {}).get('api_key', '') if doc.exists else ''
        except Exception:
            return ''

    def save_anthropic_key(self, api_key: str) -> bool:
        try:
            self.db.collection('config').document('anthropic').set({'api_key': api_key})
            return True
        except Exception as e:
            print(f'Error save_anthropic_key: {e}')
            return False

    def get_notas_voz(self, vehiculo_id: str) -> list:
        try:
            docs = [self._doc(d) for d in
                    self.db.collection('notas_voz').where('vehiculo_id', '==', vehiculo_id).stream()]
            return sorted(docs, key=lambda x: x.get('fecha', ''), reverse=True)
        except Exception:
            return []

    def add_nota_voz(self, vehiculo_id: str, data: dict) -> str:
        try:
            data['vehiculo_id'] = vehiculo_id
            data['fecha']       = self._now()
            ref = self.db.collection('notas_voz').add(data)
            return ref[1].id
        except Exception as e:
            print(f'Error add_nota_voz: {e}')
            return ''

    def delete_nota_voz(self, nota_id: str) -> bool:
        try:
            self.db.collection('notas_voz').document(nota_id).delete()
            return True
        except Exception:
            return False

    def get_precio_mercado_cache(self, cache_key: str) -> dict:
        try:
            doc = self.db.collection('config').document(f'pm_{cache_key}').get()
            if not doc.exists:
                return {}
            d = doc.to_dict() or {}
            # expire after 24h
            from datetime import timedelta
            ts = d.get('cached_at', '')
            if ts:
                from dateutil import parser as dp
                age = datetime.now() - dp.parse(ts).replace(tzinfo=None)
                if age > timedelta(hours=24):
                    return {}
            return d
        except Exception:
            return {}

    def set_precio_mercado_cache(self, cache_key: str, data: dict) -> bool:
        try:
            data['cached_at'] = self._now()
            self.db.collection('config').document(f'pm_{cache_key}').set(data)
            return True
        except Exception:
            return False

    # ── BUSCADOR — Config FB cookies ──────────────────────────────────────────
    def get_fb_config(self) -> dict:
        try:
            doc = self.db.collection('config').document('fb_marketplace').get()
            return doc.to_dict() or {}
        except Exception:
            return {}

    def save_fb_config(self, data: dict) -> bool:
        try:
            data['updated_at'] = self._now()
            self.db.collection('config').document('fb_marketplace').set(data, merge=True)
            return True
        except Exception as e:
            print(f'Error save_fb_config: {e}')
            return False

    # ── FINANZAS CORZE ────────────────────────────────────────────────────────
    def _next_finanzas_id(self) -> str:
        try:
            count = len(list(self.db.collection('finanzas_corze').limit(9999).stream()))
            return f"CORZE-{datetime.now().year}-{count+1:05d}"
        except Exception:
            return f"CORZE-{datetime.now().strftime('%Y%m%d%H%M%S')}"

    def get_all_finanzas(self, tipo: str = '', mes: str = '') -> List[dict]:
        try:
            col  = self.db.collection('finanzas_corze').order_by(
                'fecha', direction=firestore.Query.DESCENDING)
            docs = [self._doc(d) for d in col.stream()]
            if tipo:
                docs = [r for r in docs if r.get('tipo') == tipo]
            if mes:
                docs = [r for r in docs if str(r.get('fecha', '')).startswith(mes)]
            return docs
        except Exception as e:
            print(f'Error get_all_finanzas: {e}')
            return []

    def add_finanza(self, data: dict) -> tuple:
        try:
            data['id_interno']  = self._next_finanzas_id()
            data['created_at']  = self._now()
            data['updated_at']  = self._now()
            ref = self.db.collection('finanzas_corze').add(data)
            return True, ref[1].id
        except Exception as e:
            return False, str(e)

    def update_finanza(self, doc_id: str, data: dict) -> tuple:
        try:
            data.pop('id', None)
            data['updated_at'] = self._now()
            self.db.collection('finanzas_corze').document(doc_id).update(data)
            return True, None
        except Exception as e:
            return False, str(e)

    def delete_finanza(self, doc_id: str) -> bool:
        try:
            self.db.collection('finanzas_corze').document(doc_id).delete()
            return True
        except Exception as e:
            print(f'Error delete_finanza: {e}')
            return False

    # ── TAREAS ───────────────────────────────────────────────────────────────
    def get_all_tareas(self, estado: str = '', asignado: str = '') -> List[dict]:
        try:
            docs = [self._doc(d) for d in self.db.collection('tareas').stream()]
            docs.sort(key=lambda x: (x.get('estado') == 'completada', x.get('fecha_limite', '')))
            if estado:
                docs = [r for r in docs if r.get('estado') == estado]
            if asignado and asignado != 'Todos':
                docs = [r for r in docs if r.get('asignado_a') in (asignado, 'Todos')]
            return docs
        except Exception as e:
            print(f'Error get_all_tareas: {e}')
            return []

    def add_tarea(self, data: dict) -> tuple:
        try:
            data.setdefault('estado', 'pendiente')
            data.setdefault('prioridad', 'media')
            data.setdefault('recordatorio', 1)
            data['created_at'] = self._now()
            data['updated_at'] = self._now()
            ref = self.db.collection('tareas').add(data)
            return True, ref[1].id
        except Exception as e:
            return False, str(e)

    def update_tarea(self, doc_id: str, data: dict) -> tuple:
        try:
            data.pop('id', None)
            data['updated_at'] = self._now()
            self.db.collection('tareas').document(doc_id).update(data)
            return True, None
        except Exception as e:
            return False, str(e)

    def delete_tarea(self, doc_id: str) -> bool:
        try:
            self.db.collection('tareas').document(doc_id).delete()
            return True
        except Exception as e:
            print(f'Error delete_tarea: {e}')
            return False

    def toggle_tarea(self, doc_id: str, completada: bool, usuario: str) -> bool:
        try:
            update = {
                'estado':     'completada' if completada else 'pendiente',
                'updated_at': self._now(),
            }
            if completada:
                update['completada_at']  = self._now()
                update['completada_por'] = usuario
            else:
                update['completada_at']  = None
                update['completada_por'] = None
            self.db.collection('tareas').document(doc_id).update(update)
            return True
        except Exception as e:
            print(f'Error toggle_tarea: {e}')
            return False

    def get_tareas_urgentes_count(self) -> int:
        """Pendientes vencidas o que vencen hoy."""
        try:
            today = self._today()
            docs  = [self._doc(d) for d in self.db.collection('tareas')
                     .where('estado', '==', 'pendiente').stream()]
            return sum(1 for r in docs if str(r.get('fecha_limite', ''))[:10] <= today)
        except Exception as e:
            print(f'Error get_tareas_urgentes_count: {e}')
            return 0

    def get_finanzas_by_vehiculo(self, doc_id: str) -> List[dict]:
        return []

    def get_historial_vehiculo(self, doc_id: str) -> List[dict]:
        try:
            docs = [self._doc(d) for d in
                    self.db.collection('historial').where('doc_id', '==', doc_id).stream()]
            return sorted(docs, key=lambda x: x.get('fecha', ''), reverse=True)
        except Exception as e:
            print(f'Error get_historial_vehiculo: {e}')
            return []

    def get_docs_por_vencer(self, dias: int = 30) -> List[dict]:
        from datetime import timedelta
        try:
            hoy      = datetime.now().date()
            umbral   = (hoy + timedelta(days=dias)).strftime('%Y-%m-%d')
            hoy_str  = hoy.strftime('%Y-%m-%d')
            campos   = ['fecha_permiso_circ', 'fecha_soap', 'fecha_revision_tec']
            docs     = [r for r in self.get_all_inventario()
                        if r.get('estado') not in ('Vendido',)]
            alertas  = []
            for r in docs:
                for campo in campos:
                    val = str(r.get(campo, '') or '')[:10]
                    if val and val <= umbral:
                        estado_doc = 'vencido' if val < hoy_str else 'por_vencer'
                        alertas.append({
                            'vehiculo_id':  r.get('id'),
                            'patente':      r.get('patente', ''),
                            'marca':        r.get('marca', ''),
                            'modelo':       r.get('modelo', ''),
                            'campo':        campo,
                            'fecha':        val,
                            'estado':       estado_doc,
                        })
            return sorted(alertas, key=lambda x: x.get('fecha', ''))
        except Exception as e:
            print(f'Error get_docs_por_vencer: {e}')
            return []

    def get_finanzas_resumen(self, mes: str = '') -> dict:
        try:
            docs          = self.get_all_finanzas(mes=mes)
            ing_list      = [r for r in docs if r.get('tipo') == 'ingreso']
            cos_list      = [r for r in docs if r.get('tipo') == 'costo']
            transf_list   = [r for r in docs if r.get('tipo') == 'transferencia']
            ingresos      = sum(int(r.get('monto', 0) or 0) for r in ing_list)
            costos        = sum(int(r.get('monto', 0) or 0) for r in cos_list)
            monto_transf  = sum(int(r.get('monto', 0) or 0) for r in transf_list)
            n_ing         = len(ing_list)
            n_cos         = len(cos_list)
            ticket_prom   = round(ingresos / n_ing) if n_ing > 0 else 0
            margen_pct    = round((ingresos - costos) / ingresos * 100, 2) if ingresos > 0 else 0.0
            return {
                'ingresos':      ingresos,
                'costos':        costos,
                'balance':       ingresos - costos,
                'total_transf':  len(transf_list),
                'monto_transf':  monto_transf,
                'n_ingresos':    n_ing,
                'n_costos':      n_cos,
                'n_total':       len(docs),
                'ticket_promedio': ticket_prom,
                'margen_pct':    margen_pct,
            }
        except Exception as e:
            print(f'Error get_finanzas_resumen: {e}')
            return {'ingresos': 0, 'costos': 0, 'balance': 0, 'total_transf': 0,
                    'n_ingresos': 0, 'n_costos': 0, 'n_total': 0,
                    'ticket_promedio': 0, 'margen_pct': 0.0}

    # ── FLIPPING ──────────────────────────────────────────────────────────────
    def add_flipping(self, data: dict) -> tuple:
        try:
            data.setdefault('estado', 'En evaluación')
            data.setdefault('calificacion', '')
            data.setdefault('costos', [])
            data.setdefault('participantes', [])
            data.setdefault('documentos_ok', False)
            data.setdefault('sin_embargo', False)
            data.setdefault('sin_deuda_alimenticia', False)
            data['created_at'] = self._now()
            data['updated_at'] = self._now()
            # Calcular ganancia neta
            data = self._calc_flipping_ganancia(data)
            ref = self.db.collection('flipping').add(data)
            return True, ref[1].id
        except Exception as e:
            return False, str(e)

    def get_all_flipping(self, query='', calificacion='', estado='') -> list:
        try:
            col  = self.db.collection('flipping').order_by(
                'created_at', direction=firestore.Query.DESCENDING)
            docs = [self._doc(d) for d in col.stream()]
            if calificacion:
                docs = [r for r in docs if r.get('calificacion') == calificacion]
            if estado:
                docs = [r for r in docs if r.get('estado') == estado]
            if query:
                q = query.lower()
                docs = [r for r in docs if
                    q in str(r.get('patente', '')).lower() or
                    q in str(r.get('marca', '')).lower() or
                    q in str(r.get('modelo', '')).lower()]
            for r in docs:
                r = self._calc_flipping_ganancia(r)
            return docs
        except Exception as e:
            print(f'Error get_all_flipping: {e}')
            return []

    def get_flipping_by_id(self, doc_id: str):
        try:
            doc = self.db.collection('flipping').document(doc_id).get()
            if not doc.exists:
                return None
            r = self._doc(doc)
            return self._calc_flipping_ganancia(r)
        except:
            return None

    def update_flipping(self, doc_id: str, data: dict) -> tuple:
        try:
            data.pop('id', None)
            data['updated_at'] = self._now()
            data = self._calc_flipping_ganancia(data)
            self.db.collection('flipping').document(doc_id).update(data)
            return True, None
        except Exception as e:
            return False, str(e)

    def delete_flipping(self, doc_id: str, usuario: str = '') -> bool:
        try:
            self.db.collection('flipping').document(doc_id).delete()
            return True
        except:
            return False

    @staticmethod
    def _calc_flipping_ganancia(data: dict) -> dict:
        precio_compra = int(data.get('precio_compra_estimado') or 0)
        precio_venta  = int(data.get('precio_venta_estimado') or 0)
        costos        = data.get('costos') or []
        total_costos  = sum(int(c.get('monto') or 0) for c in costos if isinstance(c, dict))
        ganancia_bruta = precio_venta - precio_compra
        ganancia_neta  = ganancia_bruta - total_costos
        data['total_costos']   = total_costos
        data['ganancia_bruta'] = ganancia_bruta
        data['ganancia_neta']  = ganancia_neta
        # Calcular ganancia por participante
        participantes = data.get('participantes') or []
        for p in participantes:
            pct = float(p.get('porcentaje') or 0)
            p['ganancia_calculada'] = int(ganancia_neta * pct / 100)
        data['participantes'] = participantes
        return data

    # ══════════════════════════════════════════════════════════════════════════
    #  CAR HUNTER
    # ══════════════════════════════════════════════════════════════════════════

    def add_carhunter(self, data: dict) -> tuple:
        try:
            data = dict(data)
            data.pop('id', None)
            data['created_at'] = self._now()
            data['updated_at'] = self._now()
            ref = self.db.collection('carhunter').document()
            ref.set(data)
            return True, ref.id
        except Exception as e:
            return False, str(e)

    def get_all_carhunter(self, cliente: str = '', estado: str = '',
                          prioridad: str = '', query: str = '') -> list:
        try:
            docs = [self._doc(d) for d in self.db.collection('carhunter')
                    .order_by('created_at', direction='DESCENDING').stream()]
            if cliente:
                docs = [r for r in docs if r.get('cliente', '') == cliente]
            if estado:
                docs = [r for r in docs if r.get('estado', '') == estado]
            if prioridad:
                docs = [r for r in docs if r.get('prioridad', '') == prioridad]
            if query:
                q = query.lower()
                docs = [r for r in docs if
                    q in str(r.get('cliente', '')).lower() or
                    q in str(r.get('marca', '')).lower() or
                    q in ' '.join(r.get('modelos') or []).lower()]
            return docs
        except Exception as e:
            print(f'Error get_all_carhunter: {e}')
            return []

    def get_carhunter_by_id(self, doc_id: str):
        try:
            doc = self.db.collection('carhunter').document(doc_id).get()
            if not doc.exists:
                return None
            return self._doc(doc)
        except:
            return None

    def update_carhunter(self, doc_id: str, data: dict) -> tuple:
        try:
            data = dict(data)
            data.pop('id', None)
            data['updated_at'] = self._now()
            self.db.collection('carhunter').document(doc_id).update(data)
            return True, None
        except Exception as e:
            return False, str(e)

    def delete_carhunter(self, doc_id: str, usuario: str = '') -> bool:
        try:
            self.db.collection('carhunter').document(doc_id).delete()
            return True
        except:
            return False

    # ── PRODUCTOS SOLAR ───────────────────────────────────────────────────────
    def add_producto(self, data: dict) -> tuple:
        try:
            data.setdefault('activo', True)
            data.setdefault('stock_actual', 0)
            data.setdefault('stock_minimo', 0)
            data.setdefault('precio_costo', 0)
            data.setdefault('precio_venta', 0)
            data.setdefault('potencia_w', 0)
            data.setdefault('unidad', 'unidad')
            data['created_at'] = self._now()
            data['updated_at'] = self._now()
            ref = self.db.collection('productos_solar').add(data)
            return True, ref[1].id
        except Exception as e:
            return False, str(e)

    def get_all_productos(self, categoria='', query='', solo_activos=True) -> list:
        try:
            col = self.db.collection('productos_solar').order_by(
                'created_at', direction=firestore.Query.DESCENDING)
            docs = [self._doc(d) for d in col.stream()]
            if solo_activos:
                docs = [r for r in docs if r.get('activo', True)]
            if categoria:
                docs = [r for r in docs if r.get('categoria', '') == categoria]
            if query:
                q = query.lower()
                docs = [r for r in docs if
                    q in str(r.get('nombre', '')).lower() or
                    q in str(r.get('codigo', '')).lower() or
                    q in str(r.get('marca', '')).lower() or
                    q in str(r.get('modelo', '')).lower() or
                    q in str(r.get('descripcion', '')).lower()]
            return docs
        except Exception as e:
            print(f'Error get_all_productos: {e}')
            return []

    def get_producto_by_id(self, doc_id) -> dict:
        try:
            doc = self.db.collection('productos_solar').document(doc_id).get()
            return self._doc(doc) if doc.exists else None
        except:
            return None

    def update_producto(self, doc_id, data) -> tuple:
        try:
            data.pop('id', None)
            data['updated_at'] = self._now()
            self.db.collection('productos_solar').document(doc_id).update(data)
            return True, ''
        except Exception as e:
            return False, str(e)

    def delete_producto(self, doc_id) -> bool:
        try:
            self.db.collection('productos_solar').document(doc_id).delete()
            return True
        except:
            return False

    # ── PRESUPUESTOS ──────────────────────────────────────────────────────────
    def _next_presupuesto_folio(self) -> str:
        try:
            year = datetime.now().year
            col = self.db.collection('presupuestos')
            docs = list(col.stream())
            # Contar los del año actual
            year_prefix = f'CORZE-{year}-'
            max_num = 0
            for d in docs:
                folio = (d.to_dict() or {}).get('folio', '')
                if folio.startswith(year_prefix):
                    try:
                        num = int(folio.replace(year_prefix, ''))
                        max_num = max(max_num, num)
                    except:
                        pass
            return f'CORZE-{year}-{max_num + 1:04d}'
        except Exception:
            import random
            return f'CORZE-{datetime.now().year}-{random.randint(1000, 9999)}'

    def add_presupuesto(self, data: dict) -> tuple:
        try:
            data['folio'] = self._next_presupuesto_folio()
            data.setdefault('estado', 'borrador')
            data.setdefault('items', [])
            data.setdefault('subtotal_bruto', 0)
            data.setdefault('descuento_general_pct', 0)
            data.setdefault('monto_descuento', 0)
            data.setdefault('subtotal_neto', 0)
            data.setdefault('incluye_iva', False)
            data.setdefault('monto_iva', 0)
            data.setdefault('total', 0)
            data.setdefault('validez_dias', 10)
            data.setdefault('email_enviado', False)
            data.setdefault('fecha_envio', '')
            data['created_at'] = self._now()
            data['updated_at'] = self._now()
            ref = self.db.collection('presupuestos').add(data)
            return True, ref[1].id
        except Exception as e:
            return False, str(e)

    def get_all_presupuestos(self, estado='', query='') -> list:
        try:
            col = self.db.collection('presupuestos').order_by(
                'created_at', direction=firestore.Query.DESCENDING)
            docs = [self._doc(d) for d in col.stream()]
            if estado:
                docs = [r for r in docs if r.get('estado') == estado]
            if query:
                q = query.lower()
                docs = [r for r in docs if
                    q in str(r.get('folio', '')).lower() or
                    q in str(r.get('nombre_cliente', '')).lower() or
                    q in str(r.get('email_cliente', '')).lower() or
                    q in str(r.get('telefono_cliente', '')).lower()]
            return docs
        except Exception as e:
            print(f'Error get_all_presupuestos: {e}')
            return []

    def get_presupuesto_by_id(self, doc_id) -> dict:
        try:
            doc = self.db.collection('presupuestos').document(doc_id).get()
            return self._doc(doc) if doc.exists else None
        except:
            return None

    def update_presupuesto(self, doc_id, data) -> tuple:
        try:
            data.pop('id', None)
            data['updated_at'] = self._now()
            self.db.collection('presupuestos').document(doc_id).update(data)
            return True, ''
        except Exception as e:
            return False, str(e)

    def delete_presupuesto(self, doc_id) -> bool:
        try:
            self.db.collection('presupuestos').document(doc_id).delete()
            return True
        except:
            return False

    # ── LEADS / PIPELINE CRM ─────────────────────────────────────────────────
    def add_lead(self, data: dict) -> tuple:
        try:
            data.setdefault('etapa', 'Nuevo Lead')
            data.setdefault('origen', 'manual')
            data.setdefault('historial', [])
            data.setdefault('presupuestos_ids', [])
            data.setdefault('asignado_a', '')
            data['created_at'] = self._now()
            data['updated_at'] = self._now()
            # Agregar primer entrada al historial
            data['historial'] = [{
                'accion': 'Lead creado',
                'usuario': data.get('creado_por', ''),
                'fecha': self._now(),
                'detalle': f"Origen: {data.get('origen', 'manual')}",
            }]
            ref = self.db.collection('leads').add(data)
            return True, ref[1].id
        except Exception as e:
            return False, str(e)

    def get_all_leads(self, etapa='', asignado='', query='') -> list:
        try:
            col = self.db.collection('leads').order_by(
                'created_at', direction=firestore.Query.DESCENDING)
            docs = [self._doc(d) for d in col.stream()]
            if etapa:
                docs = [r for r in docs if r.get('etapa') == etapa]
            if asignado:
                docs = [r for r in docs if r.get('asignado_a') == asignado]
            if query:
                q = query.lower()
                docs = [r for r in docs if
                    q in str(r.get('nombre', '')).lower() or
                    q in str(r.get('apellido', '')).lower() or
                    q in str(r.get('email', '')).lower() or
                    q in str(r.get('telefono', '')).lower() or
                    q in str(r.get('empresa', '')).lower()]
            return docs
        except Exception as e:
            print(f'Error get_all_leads: {e}')
            return []

    def get_lead_by_id(self, doc_id) -> dict:
        try:
            doc = self.db.collection('leads').document(doc_id).get()
            return self._doc(doc) if doc.exists else None
        except:
            return None

    def get_lead_by_email(self, email_addr: str) -> dict:
        try:
            docs = [self._doc(d) for d in
                    self.db.collection('leads').where('email', '==', email_addr.lower().strip()).stream()]
            return docs[0] if docs else None
        except Exception as e:
            print(f'Error get_lead_by_email: {e}')
            return None

    def update_lead(self, doc_id, data) -> tuple:
        try:
            data.pop('id', None)
            data['updated_at'] = self._now()
            self.db.collection('leads').document(doc_id).update(data)
            return True, ''
        except Exception as e:
            return False, str(e)

    def delete_lead(self, doc_id) -> bool:
        try:
            self.db.collection('leads').document(doc_id).delete()
            return True
        except:
            return False

    def add_historial_lead(self, lead_id, accion, usuario, detalle='') -> bool:
        try:
            from google.cloud.firestore_v1 import ArrayUnion
            entrada = {
                'accion': accion,
                'usuario': usuario,
                'fecha': self._now(),
                'detalle': detalle,
            }
            self.db.collection('leads').document(lead_id).update({
                'historial': ArrayUnion([entrada]),
                'updated_at': self._now(),
            })
            return True
        except Exception as e:
            print(f'Error add_historial_lead: {e}')
            return False

    # ── TRABAJADORES ──────────────────────────────────────────────────────────
    def add_trabajador(self, data: dict) -> tuple:
        try:
            data.setdefault('activo', True)
            data.setdefault('color', '#F5A623')
            data.setdefault('avatar', '')
            data['created_at'] = self._now()
            data['updated_at'] = self._now()
            ref = self.db.collection('trabajadores').add(data)
            return True, ref[1].id
        except Exception as e:
            return False, str(e)

    def get_all_trabajadores(self, solo_activos=True) -> list:
        try:
            col = self.db.collection('trabajadores').order_by(
                'created_at', direction=firestore.Query.DESCENDING)
            docs = [self._doc(d) for d in col.stream()]
            if solo_activos:
                docs = [r for r in docs if r.get('activo', True)]
            return docs
        except Exception as e:
            print(f'Error get_all_trabajadores: {e}')
            return []

    def get_trabajador_by_id(self, doc_id) -> dict:
        try:
            doc = self.db.collection('trabajadores').document(doc_id).get()
            return self._doc(doc) if doc.exists else None
        except:
            return None

    def update_trabajador(self, doc_id, data) -> tuple:
        try:
            data.pop('id', None)
            data['updated_at'] = self._now()
            self.db.collection('trabajadores').document(doc_id).update(data)
            return True, ''
        except Exception as e:
            return False, str(e)

    def delete_trabajador(self, doc_id) -> bool:
        try:
            self.db.collection('trabajadores').document(doc_id).delete()
            return True
        except:
            return False

    # ── DASHBOARD CORZE ───────────────────────────────────────────────────────
    def get_corze_dashboard_stats(self) -> dict:
        from config import ETAPAS_PIPELINE
        s = {
            'leads_activos': 0,
            'leads_mes': 0,
            'contratos_mes': 0,
            'contratos_total': 0,
            'ingresos_aprobados': 0,
            'ingresos_mes': 0,
            'presupuestos_mes': 0,
            'presupuestos_total': 0,
            'valor_pipeline': 0,
            'tasa_conversion': 0.0,
            'leads_por_etapa': [],
            'ingresos_por_mes': [],
            'tareas_pendientes': 0,
        }
        try:
            mes = datetime.now().strftime('%Y-%m')
            etapas_ganadas = {'Contrato Firmado', 'En Instalación', 'Proyecto Finalizado', 'Post Venta'}
            etapas_activas = set(ETAPAS_PIPELINE) - {'Proyecto Finalizado', 'Post Venta'}

            leads = self.get_all_leads()
            etapa_count: Dict[str, int] = {e: 0 for e in ETAPAS_PIPELINE}
            for lead in leads:
                etapa = lead.get('etapa', '')
                if etapa in etapa_count:
                    etapa_count[etapa] += 1
                if etapa in etapas_activas:
                    s['leads_activos'] += 1
                if etapa in etapas_ganadas:
                    s['contratos_total'] += 1
                created = str(lead.get('created_at', ''))[:7]
                if created == mes:
                    s['leads_mes'] += 1
                    if etapa in etapas_ganadas:
                        s['contratos_mes'] += 1

            s['leads_por_etapa'] = [
                {'etapa': e, 'cantidad': etapa_count[e]} for e in ETAPAS_PIPELINE
            ]

            total_leads = len(leads)
            if total_leads > 0:
                s['tasa_conversion'] = round(s['contratos_total'] / total_leads * 100, 1)

            presupuestos = self.get_all_presupuestos()
            ingresos_mes_map: Dict[str, float] = {}
            for p in presupuestos:
                total = p.get('total', 0) or 0
                estado = p.get('estado', '')
                created = str(p.get('created_at', ''))[:7]
                if created == mes:
                    s['presupuestos_mes'] += 1
                s['presupuestos_total'] += 1
                if estado == 'aprobado':
                    s['ingresos_aprobados'] += total
                    if created == mes:
                        s['ingresos_mes'] += total
                if estado in ('enviado', 'aprobado'):
                    s['valor_pipeline'] += total
                if created:
                    ingresos_mes_map[created] = ingresos_mes_map.get(created, 0) + (
                        total if estado == 'aprobado' else 0)

            meses_sorted = sorted(ingresos_mes_map.keys())[-12:]
            def _fmt_mes(m):
                if not m: return m
                y, mo = m.split('-')
                nombres = ['','Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic']
                return nombres[int(mo)] + ' ' + y[2:]
            s['ingresos_por_mes'] = [
                {'mes': m, 'mes_label': _fmt_mes(m), 'ingresos': ingresos_mes_map[m]}
                for m in meses_sorted
            ]

            try:
                tareas = list(self.db.collection('tareas').stream())
                s['tareas_pendientes'] = sum(
                    1 for t in tareas
                    if (t.to_dict() or {}).get('estado', '') not in ('completada', 'cancelada')
                )
            except:
                pass

        except Exception as e:
            print(f'Error get_corze_dashboard_stats: {e}')
        return s
