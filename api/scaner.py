# appi/scaner.py
import pdfplumber
import re
import io
import unicodedata
from typing import Dict, List, Optional, Tuple

# =========================
# API principal
# =========================
def extract_data_from_pdf(pdf_bytes: bytes) -> List[Dict[str, str]]:
    resultados: List[Dict[str, str]] = []
    try:
        with pdfplumber.open(io.BytesIO(pdf_bytes)) as pdf:
            for page in pdf.pages:
                text = page.extract_text() or ""

                if not re.search(r"DATOS\s+Y\s+CONDICIONES", text, re.IGNORECASE):
                    if not re.search(r"(MICRONUTRIENTES|Hierro\s*\(Fe\))", text, re.IGNORECASE):
                        continue
                    
                registro = _extract_page_record(page, text)
                resultados.append(registro)

        return resultados if resultados else [{"error": "No se encontraron secciones requeridas en el PDF"}]
    except Exception as e:
        return [{"error": f"Error al procesar el PDF: {str(e)}"}]


# =========================
# Helpers de extracción de una página
# =========================
def _extract_page_record(page: pdfplumber.page.Page, page_text: str) -> Dict[str, str]:
    datos_sec = _slice_between(
        page_text,
        r"DATOS Y CONDICIONES DE LA MUESTRA",
        r"(?:RESULTADOS|PARÁMETROS QUÍMICOS DEL SUELO)"
    ) or page_text

    def find(pattern: str, src: Optional[str] = None, default: str = "No encontrado") -> str:
        s = src if src is not None else datos_sec
        m = re.search(pattern, s, re.IGNORECASE)
        return m.group(1).strip() if m else default

    # Datos básicos
    productor = find(r"Nombre del productor\s+([A-ZÁÉÍÓÚÑ\s]+?)(?=\s*Coordenadas|$)", page_text)
    cultivo = find(r"Cultivo a establecer\s+([A-ZÁÉÍÓÚÑ\s]+?)(?=\s+Meta de rendimiento|\n)")
    rendimiento = find(r"Meta de rendimiento\s+([\d.]+)\s*t/ha", datos_sec)
    municipio = find(r"Municipio\s+([A-ZÁÉÍÓÚÑ\s]+?)(?=\s+\bLocalidad\b)")
    localidad = find(r"Localidad\s+([A-ZÁÉÍÓÚÑ\s]+?)(?=\s+\bCantidad\b|\n)")

    # Físicos
    arcilla = find(r"Arcilla\s*\(%\)\s+([\d.]+)", page_text)
    limo    = find(r"Limo\s*\(%\)\s+([\d.]+)", page_text)
    arena   = find(r"Arena\s*\(%\)\s+([\d.]+)", page_text)
    textura = find(r"Textura\s+([A-Za-zÁÉÍÓÚÑáéíóúñ]+)", page_text)

    porcentaje_saturacion     = find(r"Porcentaje de saturación\s*\(PS\)\s+([^\s]+)", page_text)
    capacidad_campo           = find(r"Capacidad de campo\s*\(cc\)\s+([^\s]+)", page_text)
    punto_marchitez           = find(r"Punto de marchitez permanente\s*\(pmp\)\s+([^\s]+)", page_text)
    conductividad_hidraulica  = find(r"Conductividad hidráulica\s+([^\s]+)", page_text)
    densidad_aparente         = find(r"Densidad aparente\s*\(Dap\)\s+([^\s]+)", page_text)

    # Fertilidad
    fert_vals, fert_interps = _extract_fertility_by_layout(page)

    # Parámetros químicos
    quim_vals, quim_interps = _extract_chemical_params_by_layout(page)

    # Micronutrientes (unidad, valor, interpretación)
    micro_vals, micro_units, micro_interps = _extract_micronutrients(page)

    # Relaciones entre cationes (valor, interpretación por columna)
    rel_vals, rel_interps = _extract_cation_relations(page)

    # Armar respuesta
    res: Dict[str, str] = {
        "nombre_productor": productor,
        "cultivo_establecer": cultivo,
        "meta_rendimiento": rendimiento,
        "municipio": municipio,
        "localidad": localidad,

        # Físicos
        "arcilla": arcilla,
        "limo": limo,
        "arena": arena,
        "textura": textura,
        "porcentaje_saturacion": porcentaje_saturacion,
        "capacidad_campo": capacidad_campo,
        "punto_marchitez": punto_marchitez,
        "conductividad_hidraulica": conductividad_hidraulica,
        "densidad_aparente": densidad_aparente,
    }
    res.update(_create_default_fertility_data())
    res.update(_create_default_chemical_data())
    res.update(_create_default_micro_data())
    res.update(_create_default_rel_data())

    # Fertilidad
    if fert_vals:
        keys = ["mo", "fosforo", "nitrogeno", "potasio", "calcio", "magnesio", "sodio", "azufre"]
        for i, k in enumerate(keys):
            if i < len(fert_vals):
                v = fert_vals[i]
                res[k] = "No analizado" if v.upper() == "N/A" else v

    if fert_interps:
        keys = ["mo", "fosforo", "nitrogeno", "potasio", "calcio", "magnesio", "sodio", "azufre"]
        for i, k in enumerate(keys):
            if i < len(fert_interps):
                res[f"interp_{k}"] = fert_interps[i].title()

    # Químicos
    if quim_vals:
        keys = ["ph_agua", "ph_cacl2", "ph_kcl", "carbonato_calcio", "conductividad_electrica"]
        for i, k in enumerate(keys):
            if i < len(quim_vals):
                v = quim_vals[i]
                res[k] = "No analizado" if v.upper() == "N/A" else v

    if quim_interps:
        keys = ["ph_agua", "ph_cacl2", "ph_kcl", "carbonato_calcio", "conductividad_electrica"]
        for i, k in enumerate(keys):
            if i < len(quim_interps):
                res[f"interp_{k}"] = quim_interps[i].title()

    # Micronutrientes
    micro_keys = ["hierro", "cobre", "zinc", "manganeso", "boro"]
    for i, k in enumerate(micro_keys):
        if i < len(micro_vals):
            res[k] = micro_vals[i]
        if i < len(micro_units):
            res[f"unidad_{k}"] = micro_units[i]
        if i < len(micro_interps):
            res[f"interp_{k}"] = micro_interps[i].title()

    # Relaciones entre cationes
    rel_keys = ["rel_ca_mg", "rel_mg_k", "rel_ca_k", "rel_ca_mg_k", "rel_k_mg"]
    for i, k in enumerate(rel_keys):
        if i < len(rel_vals):
            res[k] = rel_vals[i]
        if i < len(rel_interps):
            res[f"interp_{k}"] = rel_interps[i].capitalize()

    return res


def _slice_between(text: str, start_pat: str, end_pat: str) -> Optional[str]:
    m = re.search(start_pat + r"(.*?)" + end_pat, text, re.IGNORECASE | re.DOTALL)
    return m.group(1) if m else None


# =========================
# Limpieza para interpretaciones micronutrientes
# =========================
def _normalize_text(s: str) -> str:
    s = s.lower()
    s = ''.join(c for c in unicodedata.normalize("NFKD", s) if not unicodedata.combining(c))
    return re.sub(r'\s+', ' ', s).strip()

def _clean_interpretation(texto: str) -> str:
    LABELS = [
        "muy alto", "alto",
        "moderadamente alto", "mod. alto",
        "medio",
        "moderadamente bajo", "mod. bajo",
        "bajo", "muy bajo"
    ]
    CANON = {
        "mod. alto": "moderadamente alto",
        "mod. bajo": "moderadamente bajo",
    }
    t = _normalize_text(texto)
    for lab in LABELS:
        if lab in t:
            return CANON.get(lab, lab)
    return texto.strip()


# =========================
# Fertilidad por layout
# =========================
def _extract_fertility_by_layout(page: pdfplumber.page.Page) -> Tuple[List[str], List[str]]:
    words = page.extract_words(x_tolerance=2, y_tolerance=2, keep_blank_chars=False)
    for w in words:
        w["ymid"] = (w["top"] + w["bottom"]) / 2.0

    header_candidates: Dict[int, set] = {}
    for w in words:
        if w["text"] in ("M.O", "Fósforo", "Potasio", "Calcio", "Azufre"):
            y = round(w["ymid"])
            header_candidates.setdefault(y, set()).add(w["text"])
    if not header_candidates:
        return [], []

    y_header = max(header_candidates.items(), key=lambda kv: len(kv[1]))[0]

    resultado_tokens = [w for w in words if w["text"].lower().startswith("resultado") and y_header + 5 < w["ymid"] < y_header + 80]
    if not resultado_tokens:
        return [], []

    y_res = sorted(resultado_tokens, key=lambda w: w["ymid"])[0]["ymid"]
    line_res = _words_at_y(words, y_res)

    idx_res = _index_of(line_res, lambda t: t["text"].lower().startswith("resultado"))
    right_res = line_res[idx_res + 1:] if idx_res is not None else []
    isnum = lambda t: bool(re.match(r"^\d+(?:[.,]\d+)?$", t)) or t.upper() == "N/A"
    vals = [t["text"].replace(",", ".") for t in right_res if isnum(t["text"])]

    interp_tokens = [w for w in words if w["text"].lower().startswith("interpretación") and y_res + 5 < w["ymid"] < y_res + 40]
    interps: List[str] = []
    if interp_tokens:
        y_int = sorted(interp_tokens, key=lambda w: w["ymid"])[0]["ymid"]
        line_int = _words_at_y(words, y_int)
        idx_int = _index_of(line_int, lambda t: t["text"].lower().startswith("interpretación"))
        tail = [t["text"].lower() for t in (line_int[idx_int + 1:] if idx_int is not None else [])]

        stitched: List[str] = []
        i = 0
        while i < len(tail):
            tok = tail[i]
            if tok == "muy" and i + 1 < len(tail):
                stitched.append("muy " + tail[i + 1])
                i += 2
            elif tok == "mod." and i + 1 < len(tail):
                stitched.append("mod. " + tail[i + 1])
                i += 2
            else:
                stitched.append(tok)
                i += 1
        interps = stitched

    return vals[:8], interps[:8]


# =========================
# Químicos por layout (con recorte para Conductividad eléctrica)
# =========================
def _extract_chemical_params_by_layout(page: pdfplumber.page.Page) -> Tuple[List[str], List[str]]:
    text = page.extract_text() or ""

    expected_params = [
        "pH (Relación 2:1 agua suelo)",
        "pH (CaCl2 0.01 M)",
        "pH (KCl 1 M)",
        "Carbonato de calcio equivalente (%)",
        "Conductividad eléctrica"
    ]

    result_vals: List[str] = []
    interp_vals: List[str] = []

    for param in expected_params:
        if "Conductividad eléctrica" in param:
            val_match = re.search(r"Conductividad eléctrica.*?\s([\d.,]+)", text, re.IGNORECASE)
            interp_match = re.search(
                r"Conductividad eléctrica.*?[\d.,]+\s+([A-Za-zÁÉÍÓÚÜÑáéíóúü\s]+?)(?=\sM\.O|\sN\s|\sP\s|$)",
                text, re.IGNORECASE)
        else:
            val_match = re.search(re.escape(param) + r"\s+([^\s]+)", text, re.IGNORECASE)
            interp_match = re.search(re.escape(param) + r"\s+[^\s]+\s+(.+)", text, re.IGNORECASE)

        result_vals.append(val_match.group(1) if val_match else "No encontrado")
        interp_vals.append(interp_match.group(1).strip() if interp_match else "No disponible")

    return result_vals, interp_vals


# =========================
# Micronutrientes - Versión final corregida
# =========================
def _extract_micronutrients(page):
    import re, unicodedata

    def _norm(s: str) -> str:
        import unicodedata, re
        s = ''.join(c for c in unicodedata.normalize("NFKD", s) if not unicodedata.combining(c))
        s = s.lower()
        s = s.replace('mod. ', 'mod ').replace('mod  ', 'mod ')
        s = s.replace('mod alto', 'moderadamente alto')
        s = s.replace('mod bajo', 'moderadamente bajo')
        
        s = s.replace("baj o", "bajo")
        s = s.replace("muy baj", "muy bajo")
        s = s.replace("muy ba jo", "muy bajo")
        s = re.sub(r'\s+', ' ', s).strip()
        return s


    def _classify_label(text: str) -> str:
        t = _norm(text)
        
        t = re.sub(r"muy\s*baj\s*o", "muy bajo", t)
        t = re.sub(r"muy\s*ba\s*jo", "muy bajo", t)
        
        # Ordenado por longitud para que “moderadamente alto” gane a “alto”
        labels = [
            'moderadamente alto',
            'moderadamente bajo',
            'muy alto',
            'muy bajo',
            'alto',
            'medio',
            'bajo',
        ]
        for lab in labels:
            if re.search(r'\b' + re.escape(lab) + r'\b', t):
                return lab.title()
        return 'No disponible'

    words = page.extract_words(x_tolerance=3, y_tolerance=3, keep_blank_chars=False)
    if not words:
        return ([], [], [])

    # y medio para cada palabra
    for w in words:
        w['ymid'] = (w['top'] + w['bottom']) / 2.0

    # 1) Localiza el título MICRONUTRIENTES y la fila de encabezados
    micro_hdr = [w for w in words if w['text'].upper() == 'MICRONUTRIENTES']
    if not micro_hdr:
        return ([], [], [])

    y_hdr = sorted(micro_hdr, key=lambda w: w['ymid'])[0]['ymid']

    header_row = None
    for y in sorted({round(w['ymid']) for w in words if y_hdr + 2 < w['ymid'] < y_hdr + 60}):
        line = sorted([w for w in words if abs(w['ymid'] - y) <= 3], key=lambda t: t['x0'])
        texts = [t['text'] for t in line]
        if (any(t in ['Parámetro', 'Parametro'] for t in texts)
                and 'Unidad' in texts and 'Resultado' in texts
                and any(t in ['Interpretación', 'Interpretacion'] for t in texts)):
            header_row = (y, line)
            break

    if not header_row:
        return ([], [], [])

    y_cols, cols_line = header_row
    centers = {t['text']: (t['x0'] + t['x1']) / 2.0 for t in cols_line}
    c_param = centers.get('Parámetro', centers.get('Parametro'))
    c_unid = centers.get('Unidad')
    c_res  = centers.get('Resultado')
    c_interp = centers.get('Interpretación', centers.get('Interpretacion'))

    def _bucket(line):
        # Asigna cada token a la columna cuyo centro esté más cerca
        b = {'parametro': [], 'unidad': [], 'resultado': [], 'interpretacion': []}
        for tok in line:
            xmid = (tok['x0'] + tok['x1']) / 2.0
            nearest = min(
                [('parametro', c_param), ('unidad', c_unid), ('resultado', c_res), ('interpretacion', c_interp)],
                key=lambda kv: abs(xmid - kv[1]) if kv[1] is not None else 1e9
            )[0]
            b[nearest].append(tok)
        return b

    # 2) Recorre líneas de la tabla hasta el siguiente bloque
    lines = []
    for y in sorted({round(w['ymid']) for w in words if y_cols + 2 < w['ymid'] < y_cols + 180}):
        line = sorted([w for w in words if abs(w['ymid'] - y) <= 3], key=lambda t: t['x0'])
        # Cortamos cuando aparece el siguiente bloque visible
        if any('RELACIONES' in w['text'].upper() for w in line):
            break
        lines.append((y, line))

    objetivos = ['Hierro', 'Cobre', 'Zinc', 'Manganeso', 'Boro']
    encontrados = {}
    for y, line in lines:
        b = _bucket(line)

        # Detecta el nutriente en la columna "Parámetro"
        param_text = " ".join(t['text'] for t in b['parametro']).strip()
        m = re.search(r'(Hierro|Cobre|Zinc|Manganeso|Boro)\b.*', param_text, flags=re.I)
        if not m:
            continue
        nutriente = m.group(1).capitalize()
        if nutriente in encontrados:
            continue

        # Unidad y valor
        unidad = " ".join(t['text'] for t in b['unidad']).strip() or "mg kg¯¹"
        val_tokens = [t['text'] for t in b['resultado'] if re.match(r'^[\d.,]+$', t['text'])]
        valor = val_tokens[-1].replace(',', '.') if val_tokens else 'No encontrado'

         # Interpretación: primero la columna de "Interpretación"
        interp_tokens = [t["text"] for t in b["interpretacion"] if not re.match(r"^[\d.,]+$", t["text"])]
        interp_raw = " ".join(interp_tokens).strip()

        if not interp_raw:
            # fallback 1: cualquier texto en la fila que no sea nombre, número ni unidad
            forbidden = set([nutriente, valor, unidad])
            all_tokens = [t["text"] for t in line if t["text"] not in forbidden and not re.match(r"^[\d.,]+$", t["text"])]
            interp_raw = " ".join(all_tokens).strip()

        if not interp_raw and c_interp is not None and c_res is not None:
            # fallback 2: búsqueda extendida ±30 px
            x_left = (c_res + c_interp) / 2.0
            nearby = [
                tok for tok in words
                if (y - 30) <= tok["ymid"] <= (y + 30)
                and ((tok["x0"] + tok["x1"]) / 2.0) >= (x_left - 10)
                and not re.match(r"^[\d.,]+$", tok["text"])
            ]
            interp_raw = " ".join(t["text"] for t in sorted(nearby, key=lambda t: t["x0"])).strip()


        interpretacion = _classify_label(interp_raw)

        encontrados[nutriente] = {
            'valor': valor,
            'unidad': unidad,
            'interpretacion': interpretacion,
        }

    # 3) Devuelve en orden fijo
    valores, unidades, interps = [], [], []
    for n in objetivos:
        d = encontrados.get(n, None)
        if d:
            valores.append(d['valor'])
            unidades.append(d['unidad'])
            interps.append(d['interpretacion'])
        else:
            valores.append('No encontrado')
            unidades.append('No encontrado')
            interps.append('No disponible')

    return (valores, unidades, interps)

# =========================
# Relaciones entre cationes
# =========================
def _is_rel_interp_noise(s: str) -> bool:
    t = _normalize_text(s)
    return (
        t in {"g", "n/a", "na", "me", "me/100", "me 100"} or
        bool(re.search(r"\bme\s*/\s*100\b", t))
    )

def _clean_rel_interp(s: str) -> str:
    t = _normalize_text(s)
    t = re.sub(r"\bme\s*/\s*100\b", "", t)
    t = re.sub(r"\bn\s*/\s*a\b", "", t)
    t = t.replace("n/a", "")
    t = re.sub(r"\bg\b", "", t)
    t = re.sub(r"\s+", " ", t).strip()
    return t

def _extract_cation_relations(page: pdfplumber.page.Page) -> Tuple[List[str], List[str]]:
    """
    Extrae en orden: Ca/Mg, Mg/K, Ca/K, (Ca+Mg)/K, K/Mg
    Devuelve (valores, interpretaciones).
    """
    words = page.extract_words(x_tolerance=2, y_tolerance=2, keep_blank_chars=False)
    for w in words:
        w["ymid"] = (w["top"] + w["bottom"]) / 2.0

    # 1) localizar el título
    title_ws = [w for w in words if "RELACIONES" in w["text"].upper()]
    if not title_ws:
        return [], []
    y_title = sorted(title_ws, key=lambda w: w["ymid"])[0]["ymid"]

    # 2) buscar la fila de encabezados (con nombres de relaciones)
    labels = ["Ca/Mg", "Mg/K", "Ca/K", "(Ca+Mg)/K", "K/Mg"]
    candidate_rows = []
    for y in sorted({round(w["ymid"]) for w in words if y_title + 5 < w["ymid"] < y_title + 120}):
        line = _words_at_y(words, y)
        texts = " ".join(t["text"] for t in line)
        hits = sum(1 for lab in labels if lab in texts)
        if hits >= 3:
            candidate_rows.append((y, line, hits))
    if not candidate_rows:
        return [], []

    y_header, header_line, _ = sorted(candidate_rows, key=lambda t: (-t[2], t[0]))[0]

    # posiciones x para cada etiqueta
    header_tokens = []
    for lab in labels:
        toks = [t for t in header_line if t["text"] == lab]
        if toks:
            header_tokens.append((lab, (toks[0]["x0"] + toks[0]["x1"]) / 2.0))
        else:
            header_tokens.append((lab, None))
    xs_known = [x for _, x in header_tokens if x is not None]
    if xs_known:
        xmin, xmax = min(xs_known), max(xs_known)
        approx = [xmin + i * (xmax - xmin) / (len(labels) - 1) for i in range(len(labels))]
        header_tokens = [(lab, x if x is not None else approx[i]) for i, (lab, x) in enumerate(header_tokens)]
    else:
        approx = [100 + i * 120 for i in range(len(labels))]
        header_tokens = [(lab, approx[i]) for i, lab in enumerate(labels)]

    # 3) fila de valores (la primera fila con números)
    number_rows = []
    for y in sorted({round(w["ymid"]) for w in words if y_header + 5 < w["ymid"] < y_header + 80}):
        line = _words_at_y(words, y)
        if not line:
            continue
        nums = [t for t in line if re.match(r"^\d+(?:[.,]\d+)?$", t["text"])]
        if len(nums) >= 1:
            number_rows.append((y, line))
    if not number_rows:
        return [], []
    y_values, line_values = sorted(number_rows, key=lambda t: t[0])[0]

    # 4) fila de interpretaciones (solo palabras, sin ruido)
    interp_rows = []
    for y in sorted({round(w["ymid"]) for w in words if y_values + 2 < w["ymid"] < y_values + 60}):
        line = _words_at_y(words, y)
        words_only = [t for t in line if not re.match(r"^\d", t["text"])]
        if len(words_only) >= 1:
            interp_rows.append((y, line))
    line_interp = interp_rows[0][1] if interp_rows else []

    def bucket_by_header(line_tokens):
        buckets = {lab: [] for lab, _ in header_tokens}
        for tok in line_tokens:
            xmid = (tok["x0"] + tok["x1"]) / 2.0
            lab_near = min(header_tokens, key=lambda hx: abs((hx[1] or 0) - xmid))[0]
            buckets[lab_near].append(tok["text"])
        return buckets

    b_vals = bucket_by_header([t for t in line_values if re.match(r"^[\d.,]+$", t["text"])])
    # ⬇️ Filtra tokens de interpretación con ruido (Me/100, g, n/a, etc.)
    interp_tokens_filtered = [
        t for t in line_interp
        if not re.match(r"^[\d.,]+$", t["text"]) and not _is_rel_interp_noise(t["text"])
    ]
    b_interps = bucket_by_header(interp_tokens_filtered)

    # Valores: tomar el último número (evita pegues previos)
    values = []
    for lab, _ in header_tokens:
        nums = b_vals.get(lab, [])
        if nums:
            values.append(nums[-1].replace(",", "."))
        else:
            values.append("No encontrado")

    # Interpretaciones: limpiar ruido residual
    interps = []
    for l, _ in header_tokens:
        raw = " ".join(b_interps.get(l, [])).strip()
        clean = _clean_rel_interp(raw)
        interps.append(clean if clean else "No disponible")

    return values, interps


# =========================
# Helpers
# =========================
def _words_at_y(words: List[dict], y: float, tol: float = 3.0) -> List[dict]:
    line = [w for w in words if abs(w["ymid"] - y) <= tol]
    return sorted(line, key=lambda w: w["x0"])


def _index_of(seq: List[dict], pred) -> Optional[int]:
    for i, el in enumerate(seq):
        if pred(el):
            return i
    return None


# =========================
# Defaults
# =========================
def _create_default_fertility_data() -> Dict[str, str]:
    return {
        "mo": "No encontrado",
        "fosforo": "No encontrado",
        "nitrogeno": "No encontrado",
        "potasio": "No encontrado",
        "calcio": "No encontrado",
        "magnesio": "No encontrado",
        "sodio": "No encontrado",
        "azufre": "No encontrado",
        "interp_mo": "No disponible",
        "interp_fosforo": "No disponible",
        "interp_nitrogeno": "No disponible",
        "interp_potasio": "No disponible",
        "interp_calcio": "No disponible",
        "interp_magnesio": "No disponible",
        "interp_sodio": "No disponible",
        "interp_azufre": "No disponible",
    }

def _create_default_chemical_data() -> Dict[str, str]:
    return {
        "ph_agua": "No encontrado",
        "ph_cacl2": "No encontrado",
        "ph_kcl": "No encontrado",
        "carbonato_calcio": "No encontrado",
        "conductividad_electrica": "No encontrado",
        "interp_ph_agua": "No disponible",
        "interp_ph_cacl2": "No disponible",
        "interp_ph_kcl": "No disponible",
        "interp_carbonato_calcio": "No disponible",
        "interp_conductividad_electrica": "No disponible",
    }

def _create_default_micro_data() -> Dict[str, str]:
    return {
        "hierro": "No encontrado", "unidad_hierro": "No encontrado", "interp_hierro": "No disponible",
        "cobre": "No encontrado", "unidad_cobre": "No encontrado", "interp_cobre": "No disponible",
        "zinc": "No encontrado", "unidad_zinc": "No encontrado", "interp_zinc": "No disponible",
        "manganeso": "No encontrado", "unidad_manganeso": "No encontrado", "interp_manganeso": "No disponible",
        "boro": "No encontrado", "unidad_boro": "No encontrado", "interp_boro": "No disponible",
    }

def _create_default_rel_data() -> Dict[str, str]:
    return {
        "rel_ca_mg": "No encontrado", "interp_rel_ca_mg": "No disponible",
        "rel_mg_k": "No encontrado",  "interp_rel_mg_k": "No disponible",
        "rel_ca_k": "No encontrado",  "interp_rel_ca_k": "No disponible",
        "rel_ca_mg_k": "No encontrado","interp_rel_ca_mg_k": "No disponible",
        "rel_k_mg": "No encontrado",  "interp_rel_k_mg": "No disponible",
    }