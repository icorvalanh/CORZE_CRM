# scraper_fb.py — Facebook Marketplace scraper vía Playwright
import re, json
from urllib.parse import quote

try:
    from playwright.sync_api import sync_playwright
    PLAYWRIGHT_OK = True
except ImportError:
    PLAYWRIGHT_OK = False


# ── URL builder ────────────────────────────────────────────────────────────────
# Usa la URL de browse por categoría+ubicación (no search personalizado).
# Esto muestra TODOS los vehículos publicados, ordenados por más reciente.
def build_url(query='', precio_min=None, precio_max=None, ciudad='santiago'):
    params = ['sortBy=creation_time_descend', 'daysSinceListed=30']
    if precio_min: params.append(f'minPrice={int(precio_min)}')
    if precio_max: params.append(f'maxPrice={int(precio_max)}')
    if query:      params.append(f'query={quote(query)}')

    # URL de browse por ciudad — muestra todos los publicados en esa ubicación
    base = f'https://www.facebook.com/marketplace/{ciudad}/vehicles/'
    return base + '?' + '&'.join(params)


# ── Cookie parsing ─────────────────────────────────────────────────────────────
def parse_cookies(raw: str) -> list:
    out = []
    for part in raw.strip().split(';'):
        part = part.strip()
        if '=' not in part:
            continue
        name, _, value = part.partition('=')
        name = name.strip()
        if not name:
            continue
        out.append({'name': name, 'value': value.strip(),
                    'domain': '.facebook.com', 'path': '/'})
    return out


# ── GraphQL parser ─────────────────────────────────────────────────────────────
def parse_graphql(body: str) -> list:
    items = []
    for line in body.split('\n'):
        line = line.strip()
        if not line or not line.startswith('{'):
            continue
        try:
            obj = json.loads(line)
            items.extend(_walk(obj))
        except Exception:
            pass
    return items


def _walk(obj, depth=0) -> list:
    if depth > 15 or not isinstance(obj, dict):
        return []
    items = []

    typename = obj.get('__typename', '')
    if typename in ('MarketplaceFeedListingUnit', 'MarketplaceListingCard',
                    'MarketplaceFeedListing', 'MarketplaceSearchFeedUnit'):
        listing = obj.get('listing', obj)
        it = _to_item(listing)
        if it:
            items.append(it)
    elif 'marketplace_listing_title' in obj:
        it = _to_item(obj)
        if it:
            items.append(it)

    for key in ('edges', 'nodes', 'feed_units', 'marketplace_search',
                'data', 'node', 'listing', 'results',
                'sponsored_feed_units', 'organic_feed_units',
                'viewer', 'marketplace_home_units'):
        val = obj.get(key)
        if isinstance(val, list):
            for v in val:
                items.extend(_walk(v, depth + 1))
        elif isinstance(val, dict):
            items.extend(_walk(val, depth + 1))
    return items


def _to_item(d: dict):
    lid   = str(d.get('id') or d.get('listing_id') or '')
    title = (d.get('marketplace_listing_title') or
             d.get('name') or d.get('title') or '')
    if not lid or not title or not lid.isdigit():
        return None

    # Precio
    price_obj = d.get('listing_price') or d.get('price') or {}
    price_num, price_str = None, ''
    if isinstance(price_obj, dict):
        raw = (price_obj.get('amount') or
               price_obj.get('amount_with_offset_in_subunits') or '')
        if raw:
            try:
                price_num = int(float(str(raw).replace(',', '.')))
            except Exception:
                pass
        price_str = price_obj.get('formatted_amount') or ''

    # Foto
    photo = d.get('primary_listing_photo') or d.get('listing_photos', [{}])
    if isinstance(photo, list) and photo:
        photo = photo[0]
    thumb = ''
    if isinstance(photo, dict):
        img   = photo.get('image') or {}
        thumb = img.get('uri') or img.get('uri_original') or ''

    # Ciudad
    loc  = d.get('location') or {}
    city = ''
    if isinstance(loc, dict):
        geo  = loc.get('reverse_geocode') or {}
        city = geo.get('city') or geo.get('state') or ''

    # Subtítulo
    subtitle = ''
    for key in ('custom_sub_titles_with_rendering_flags', 'listing_details',
                'attribute_data', 'additional_information'):
        subs = d.get(key) or []
        if isinstance(subs, list):
            for s in subs:
                if isinstance(s, dict):
                    txt = s.get('subtitle') or s.get('text') or s.get('value') or ''
                    if txt:
                        subtitle = txt; break
        elif isinstance(subs, str) and subs:
            subtitle = subs
        if subtitle:
            break

    return {
        'id':        lid,
        'titulo':    title,
        'precio':    price_num,
        'precio_txt': price_str or (f'${price_num:,}'.replace(',', '.') if price_num else 'Consultar'),
        'thumbnail': thumb.replace('http://', 'https://'),
        'url':       f'https://www.facebook.com/marketplace/item/{lid}/',
        'ciudad':    city,
        'subtitulo': subtitle,
        'fuente':    'facebook',
    }


# ── DOM fallback ───────────────────────────────────────────────────────────────
def parse_dom(page) -> list:
    items = []
    seen  = set()
    try:
        links = page.query_selector_all('a[href*="/marketplace/item/"]')
    except Exception:
        return []

    for link in links:
        try:
            href = link.get_attribute('href') or ''
            m    = re.search(r'/marketplace/item/(\d+)', href)
            if not m:
                continue
            lid = m.group(1)
            if lid in seen:
                continue
            seen.add(lid)

            img_el    = link.query_selector('img')
            thumbnail = (img_el.get_attribute('src') or '') if img_el else ''

            spans = link.query_selector_all('span')
            texts = [s.inner_text().strip() for s in spans if s.inner_text().strip()]

            price_txt = next(
                (t for t in texts if re.search(r'\$|CLP|\d{3}\.\d{3}', t)), None)
            price_num = None
            if price_txt:
                digits = re.sub(r'[^\d]', '', price_txt)
                try:
                    price_num = int(digits) if len(digits) >= 4 else None
                except Exception:
                    pass

            non_price = [t for t in texts if t != price_txt and 4 < len(t) < 150]
            title     = max(non_price, key=len) if non_price else ''
            if not title:
                continue

            items.append({
                'id':        lid,
                'titulo':    title,
                'precio':    price_num,
                'precio_txt': price_txt or 'Consultar',
                'thumbnail': thumbnail.replace('http://', 'https://'),
                'url':       f'https://www.facebook.com/marketplace/item/{lid}/',
                'ciudad':    '',
                'subtitulo': '',
                'fuente':    'facebook',
            })
        except Exception:
            continue

    return items


# ── Scraper principal ──────────────────────────────────────────────────────────
def scrape(query='', precio_min=None, precio_max=None,
           anio_min=None, anio_max=None,
           cookies_str='', ciudad='santiago', max_results=24) -> dict:

    if not PLAYWRIGHT_OK:
        return {'items': [], 'error': 'Playwright no disponible.', 'total': 0, 'debug': {}}

    if not cookies_str or not cookies_str.strip():
        return {
            'items': [],
            'error': 'Debes configurar la sesión de Facebook primero. '
                     'Haz clic en ⚙️ Configurar sesión.',
            'total': 0,
            'debug': {'motivo': 'sin_cookies'},
        }

    url      = build_url(query, precio_min, precio_max, ciudad)
    captured = []
    items    = []
    error    = None
    debug    = {'url': url, 'graphql_responses': 0, 'dom_links': 0,
                'page_title': '', 'page_url': ''}

    try:
        with sync_playwright() as pw:
            browser = pw.chromium.launch(
                headless=True,
                args=[
                    '--no-sandbox',
                    '--disable-setuid-sandbox',
                    '--disable-dev-shm-usage',
                    '--disable-gpu',
                    '--disable-blink-features=AutomationControlled',
                    '--disable-features=IsolateOrigins,site-per-process',
                ],
            )
            ctx = browser.new_context(
                user_agent=(
                    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) '
                    'AppleWebKit/537.36 (KHTML, like Gecko) '
                    'Chrome/124.0.0.0 Safari/537.36'
                ),
                locale='es-CL',
                timezone_id='America/Santiago',
                viewport={'width': 1366, 'height': 768},
                extra_http_headers={
                    'Accept-Language': 'es-CL,es;q=0.9,en;q=0.8',
                    'sec-ch-ua': '"Chromium";v="124","Google Chrome";v="124"',
                    'sec-ch-ua-platform': '"Windows"',
                },
            )

            # Inyectar cookies de sesión FB
            ctx.add_cookies(parse_cookies(cookies_str))

            page = ctx.new_page()

            # Ocultar señales de automatización
            page.add_init_script("""
                Object.defineProperty(navigator, 'webdriver', {get: () => undefined});
                Object.defineProperty(navigator, 'plugins', {get: () => [1,2,3]});
                Object.defineProperty(navigator, 'languages', {get: () => ['es-CL','es','en']});
                window.chrome = { runtime: {} };
            """)

            # Capturar TODO el tráfico GraphQL de FB
            def on_response(resp):
                try:
                    url_r = resp.url
                    if resp.status == 200 and 'facebook.com' in url_r and (
                        'graphql' in url_r or '/api/' in url_r
                    ):
                        body = resp.text()
                        if len(body) > 100:
                            captured.append(body)
                except Exception:
                    pass

            page.on('response', on_response)

            # Navegar y esperar contenido
            page.goto(url, wait_until='domcontentloaded', timeout=35000)

            # Esperar hasta que aparezcan listings O hasta 12 segundos
            try:
                page.wait_for_selector(
                    'a[href*="/marketplace/item/"]',
                    timeout=12000
                )
            except Exception:
                pass  # Continuamos igual; puede que esté en login o sin resultados

            # Scroll para activar lazy load
            for _ in range(3):
                page.mouse.wheel(0, 600)
                page.wait_for_timeout(800)

            # Recopilar debug
            debug['page_title'] = page.title() or ''
            debug['page_url']   = page.url or ''
            debug['graphql_responses'] = len(captured)
            debug['dom_links']  = len(page.query_selector_all('a[href*="/marketplace/item/"]'))

            # Detectar login/bloqueo
            title = debug['page_title'].lower()
            pg_url = debug['page_url'].lower()
            is_login = (
                'login' in pg_url or
                'log in' in title or
                'inicia sesión' in title or
                'facebook – inicia' in title or
                debug['dom_links'] == 0 and debug['graphql_responses'] == 0
            )

            # 1. Parsear GraphQL
            for body in captured:
                items.extend(parse_graphql(body))

            # Deduplicar
            seen_ids = set()
            deduped  = []
            for it in items:
                if it['id'] not in seen_ids:
                    seen_ids.add(it['id'])
                    deduped.append(it)
            items = deduped

            # 2. DOM fallback
            if not items:
                items = parse_dom(page)
                debug['dom_items'] = len(items)

            # Error orientativo si no encontró nada y parece login
            if not items and is_login:
                error = (
                    f'Facebook solicitó inicio de sesión (URL: {debug["page_url"][:60]}). '
                    'Las cookies pueden estar vencidas o incompletas. '
                    'Reconfigura la sesión en ⚙️ Configurar sesión.'
                )

            browser.close()

    except Exception as exc:
        error = str(exc)
        items = []

    # ── Filtro local por query (FB devuelve resultados amplios/relacionados) ──
    if query and items:
        # Dividir en palabras y exigir que TODAS aparezcan en el título
        palabras = [p.lower() for p in query.split() if len(p) >= 2]
        filtered = []
        for it in items:
            titulo = it.get('titulo', '').lower()
            if all(p in titulo for p in palabras):
                filtered.append(it)
        # Si el filtro estricto no devuelve nada, intentar con al menos la mitad de palabras
        if not filtered and palabras:
            mitad = max(1, len(palabras) // 2)
            for it in items:
                titulo = it.get('titulo', '').lower()
                coincidencias = sum(1 for p in palabras if p in titulo)
                if coincidencias >= mitad:
                    filtered.append(it)
        items = filtered

    # ── Filtro año local ──────────────────────────────────────────────────────
    if (anio_min or anio_max) and items:
        filtered = []
        for it in items:
            text = f"{it.get('titulo','')} {it.get('subtitulo','')}"
            m    = re.search(r'\b(19|20)\d{2}\b', text)
            if m:
                yr = int(m.group())
                if anio_min and yr < int(anio_min): continue
                if anio_max and yr > int(anio_max): continue
            filtered.append(it)
        items = filtered

    return {
        'items': items[:max_results],
        'total': len(items),
        'error': error,
        'debug': debug,
    }
