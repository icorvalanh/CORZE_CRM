# config.py — VTA Web v2.1

APP_NAME    = "VTA — Vende Tu Auto"
APP_VERSION = "2.1 Web"

USERS = {
    "Ignacio Corvalan": {
        "pin":    "3312",
        "color":  "#00AEEF",
        "avatar": "IC",
        "role":   "admin",
    },
    "Nicolas Corvalan": {
        "pin":    "3312",
        "color":  "#9B59B6",
        "avatar": "NC",
        "role":   "admin",
    },
    "Nicolas Isuani": {
        "pin":    "1357",
        "color":  "#27AE60",
        "avatar": "NI",
        "role":   "flipping",
    },
    "Benjamin Troncoso": {
        "pin":    "1357",
        "color":  "#E67E22",
        "avatar": "BT",
        "role":   "flipping",
    },
}

# ─── MARCAS AMPLIADAS ─────────────────────────────────────────────────────────
MARCAS = sorted([
    # Europeas — Premium / Lujo
    'ALFA ROMEO','ASTON MARTIN','AUDI','BENTLEY','BMW','BUGATTI',
    'DS AUTOMOBILES','FERRARI','LAMBORGHINI','MASERATI','MCLAREN',
    'MERCEDES-BENZ','MINI','PORSCHE','ROLLS-ROYCE',
    # Europeas — Masivas
    'CITROEN','CUPRA','DACIA','FIAT','FORD EUROPE','JAGUAR','LAND ROVER',
    'OPEL','PEUGEOT','RENAULT','SEAT','SKODA','SMART','VOLVO','VOLKSWAGEN',
    # Americanas
    'CHEVROLET','CHRYSLER','DODGE','FORD','GMC','JEEP','LINCOLN','RAM','TESLA',
    # Japonesas
    'DAIHATSU','HONDA','ISUZU','LEXUS','MAZDA','MITSUBISHI','NISSAN',
    'SUBARU','SUZUKI','TOYOTA',
    # Coreanas
    'GENESIS','HYUNDAI','KIA','SSANGYONG',
    # Chinas — Establecidas en Chile
    'AION','BAIC','BESTUNE','BYD','CHANGAN','CHERY','DFSK',
    'DONGFENG','EXEED','FAW','FOTON','GAC','GEELY','GREAT WALL','GWM',
    'HAVAL','JAC','JETOUR','JMC','KING LONG','LYNK & CO','MAXUS',
    'MG','NETA','OMODA','SAIC','SKYWELL','VOYAH','ZEEKR','ZOTYE',
    # Otro
    'OTRO',
])

# ─── MODELOS COMUNES POR MARCA (para sugerencias) ─────────────────────────────
MODELOS_SUGERIDOS = {
    'TOYOTA':       ['Corolla','Yaris','RAV4','Hilux','Land Cruiser','C-HR','Camry','Prius','Rush','Fortuner'],
    'VOLKSWAGEN':   ['Golf','Polo','Tiguan','T-Cross','T-Roc','Passat','Amarok','Taos','ID.4','Touareg'],
    'HYUNDAI':      ['Tucson','Santa Fe','Elantra','Accent','Creta','Kona','Ioniq 5','Palisade','i10','i20'],
    'KIA':          ['Sportage','Sorento','Seltos','Stinger','Rio','Cerato','Carnival','EV6','Niro','Picanto'],
    'MAZDA':        ['CX-5','CX-30','CX-9','Mazda3','Mazda6','MX-5','BT-50','CX-50','CX-60'],
    'HONDA':        ['CR-V','HR-V','Civic','Jazz','Accord','Pilot','ZR-V','BR-V','City'],
    'NISSAN':       ['Qashqai','X-Trail','Kicks','Sentra','Frontier','Leaf','Murano','Navara','Pathfinder'],
    'CHEVROLET':    ['Tracker','Sail','Captiva','S10','Blazer','Groove','Equinox','Silverado','Trailblazer'],
    'FORD':         ['Explorer','Escape','F-150','Ranger','Bronco','EcoSport','Mustang','Territory','Focus'],
    'MITSUBISHI':   ['ASX','Eclipse Cross','Outlander','Outlander PHEV','L200','Montero','Pajero'],
    'SUBARU':       ['Forester','XV','Outback','Impreza','Legacy','BRZ','Crosstrek','WRX'],
    'MERCEDES-BENZ':['Clase A','Clase C','Clase E','GLA','GLC','GLE','CLA','AMG GT','EQA','Sprinter'],
    'BMW':          ['Serie 1','Serie 3','Serie 5','X1','X3','X5','M3','M5','iX','i4'],
    'AUDI':         ['A3','A4','A6','Q3','Q5','Q7','e-tron','RS3','TT','Q2'],
    'PEUGEOT':      ['208','308','3008','5008','2008','508','e-208','Partner','Landtrek'],
    'RENAULT':      ['Duster','Stepway','Kwid','Captur','Logan','Sandero','Koleos','Oroch','Megane'],
    'JEEP':         ['Wrangler','Cherokee','Grand Cherokee','Compass','Renegade','Gladiator'],
    'FIAT':         ['Argo','Cronos','Pulse','Fastback','Toro','Mobi','500','Doblo'],
    'JAC':          ['T8','T9','JS4','JS6','S4','E10X','Sei4'],
    'BYD':          ['Atto 3','Han','Tang','Dolphin','Seal','Yuan Plus','Song Pro'],
    'MG':           ['ZS','HS','RX5','5','Marvel R','One','Extender'],
    'HAVAL':        ['H6','H2','H9','Jolion','Dargo','Big Dog'],
    'GREAT WALL':   ['Wingle','Cannon','Poer'],
    'CHERY':        ['Tiggo 2','Tiggo 4','Tiggo 7','Tiggo 8','Arrizo 5','QQ'],
    'SUZUKI':       ['Swift','Vitara','S-Cross','Jimny','Ignis','Grand Vitara','Dzire'],
    'VOLKSWAGEN':   ['Golf','Polo','Tiguan','T-Cross','T-Roc','Passat','Amarok','Taos'],
    'SKODA':        ['Octavia','Fabia','Karoq','Kodiaq','Scala','Superb','Kamiq'],
    'SEAT':         ['Ibiza','León','Ateca','Arona','Tarraco'],
    'CUPRA':        ['Formentor','Born','Ateca','Leon'],
    'VOLVO':        ['XC40','XC60','XC90','S60','S90','V60','C40'],
    'LAND ROVER':   ['Defender','Discovery','Range Rover','Range Rover Sport','Freelander'],
    'PORSCHE':      ['Cayenne','Macan','Panamera','911','Taycan','718'],
    'LEXUS':        ['UX','NX','RX','ES','IS','LS','GX','LX'],
    'RAM':          ['1500','2500','3500','ProMaster'],
    'DODGE':        ['Challenger','Charger','Durango','Journey'],
    'ISUZU':        ['D-Max','MU-X','N-Series'],
    'MAXUS':        ['T60','D90','EV80','Deliver 9'],
    'FOTON':        ['Tunland','View','Aumark'],
}

# ─── TIPOS DE VEHÍCULO ────────────────────────────────────────────────────────
TIPOS_VEHICULO = [
    'AUTOMÓVIL','STATION WAGON','SUV','CAMIONETA DOBLE CABINA',
    'CAMIONETA SIMPLE CABINA','VAN PASAJEROS','VAN CARGA',
    'FURGÓN','CONVERTIBLE','COUPÉ','HATCHBACK','MINIVAN','PICKUP',
    'MOTO','CUATRIMOTO','MOTO DE AGUA','LANCHA','OTRO',
]

# ─── TRANSMISIONES (con 4x4) ──────────────────────────────────────────────────
TRANSMISIONES = [
    'Automática',
    'Automática CVT',
    'Automática DSG',
    'Automática S-Tronic',
    'Automática Tiptronic',
    'Manual',
    'Otro',
]

TRACCIONES = [
    'Delantera (FWD)',
    'Trasera (RWD)',
    'Integral (AWD)',
    'Integral (4x4)',
    'Integral Selectiva (4WD)',
]

# ─── COMBUSTIBLES ─────────────────────────────────────────────────────────────
COMBUSTIBLES = [
    'Bencina','Diésel','Eléctrico','Híbrido (HEV)',
    'Híbrido Enchufable (PHEV)','Gas Natural','Gas Licuado',
]

# ─── TIPO DE REGISTRO (unificado) ─────────────────────────────────────────────
TIPOS_REGISTRO = ['INTERNO', 'CONSIGNACIÓN']

# ─── ESTADOS UNIFICADOS ───────────────────────────────────────────────────────
ESTADOS = ['En Stock', 'Publicado', 'Reservado', 'Vendido', 'Devuelto']

# ─── ALERTAS ──────────────────────────────────────────────────────────────────
ANOS = list(range(2027, 1949, -1))
ALERT_DAYS_WARNING  = 30
ALERT_DAYS_CRITICAL = 60
