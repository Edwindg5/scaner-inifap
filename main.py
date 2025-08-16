from flask import Flask, request, jsonify, send_file, render_template, send_from_directory
from api.scaner import extract_data_from_pdf
from flask_cors import CORS
import pandas as pd
import io
import os
import json

# Verificar versiones de dependencias críticas
import sys
required_python = (3, 9)
if sys.version_info < required_python:
    raise RuntimeError(f"Python {required_python[0]}.{required_python[1]} or later is required")

# Configuración de pandas para reducir uso de memoria
pd.set_option('mode.use_inf_as_na', True)
pd.set_option('display.max_columns', None)

app = Flask(__name__, template_folder='templates', static_folder='static')
CORS(app)

# Configuración específica para Vercel
app.config['JSONIFY_PRETTYPRINT_REGULAR'] = False
app.config['MAX_CONTENT_LENGTH'] = 16 * 1024 * 1024  # 16MB max upload

# Mapeo de columnas para el Excel
COLUMN_MAPPING = {
    'nombre_productor': 'NOMBRE DEL PRODUCTOR',
    'municipio': 'MUNICIPIO',
    'localidad': 'LOCALIDAD',
    'cultivo_establecer': 'CULTIVO ANTERIOR',
    'arcilla': 'ARCILLA',
    'limo': 'LIMO',
    'arena': 'ARENA',
    'textura': 'TEXTURA',
    'densidad_aparente': 'DA',
    'ph_agua': 'PH',
    'mo': 'MO',
    'fosforo': 'FOSFORO',
    'nitrogeno': 'N.INORGANICO',
    'potasio': 'K',
    'magnesio': 'MG',
    'calcio': 'CA',
    'sodio': 'NA',
    'al': 'AL',
    'cic': 'CIC',
    'cic_calculada': 'CIC CALCULADA',
    'h': 'H',
    'azufre': 'AZUFRE',
    'hierro': 'HIERRO',
    'cobre': 'COBRE',
    'zinc': 'ZINC',
    'manganeso': 'MANGANESO',
    'boro': 'BORO',
    'rel_ca_mg': 'CA/MG',
    'rel_mg_k': 'MG/K',
    'rel_ca_k': 'CA/K',
    'rel_ca_mg_k': '(CA₊MG)/K',
    'rel_k_mg': 'K/MG'
}

@app.route('/')
def index():
    """Servir la página principal"""
    return render_template('index.html')

@app.route('/static/<path:path>')
def serve_static(path):
    """Servir archivos estáticos"""
    return send_from_directory('static', path)

@app.route('/api')
def api_info():
    return jsonify({
        "message": "API de análisis de suelos funcionando correctamente",
        "status": "active",
        "version": "1.0.0"
    })

@app.route('/api/procesar-pdf', methods=['POST'])
def procesar_pdf():
    try:
        if 'pdf' not in request.files:
            return jsonify({
                "status": "error",
                "message": "No se envió el PDF",
                "code": 400
            }), 400
        
        pdf_file = request.files['pdf']
        
        if pdf_file.filename == '':
            return jsonify({
                "status": "error",
                "message": "No se seleccionó ningún archivo",
                "code": 400
            }), 400
        
        # Limitar tamaño del archivo (8MB máximo)
        if request.content_length > 8 * 1024 * 1024:
            return jsonify({
                "status": "error",
                "message": "El archivo es demasiado grande (máximo 8MB)",
                "code": 413
            }), 413
        
        pdf_bytes = pdf_file.read()
        datos = extract_data_from_pdf(pdf_bytes)
        
        return jsonify({
            "status": "success",
            "data": datos,
            "code": 200
        })
    except Exception as e:
        return jsonify({
            "status": "error",
            "message": f"Error al procesar el PDF: {str(e)}",
            "code": 500
        }), 500

@app.route('/api/descargar-excel', methods=['POST'])
def descargar_excel():
    try:
        data = request.get_json()
        if not data:
            return jsonify({
                "status": "error",
                "message": "No se recibieron datos",
                "code": 400
            }), 400
        
        # Convertir a DataFrame de pandas
        df = pd.DataFrame(data)
        
        # Renombrar columnas según el mapeo
        df.rename(columns=COLUMN_MAPPING, inplace=True)
        
        # Definir el orden de las columnas
        column_order = [
            'MUNICIPIO', 'LOCALIDAD', 'NOMBRE DEL PRODUCTOR', 'CULTIVO ANTERIOR',
            'ARCILLA', 'LIMO', 'ARENA', 'TEXTURA', 'DA', 'PH', 'MO', 'FOSFORO',
            'N.INORGANICO', 'K', 'MG', 'CA', 'NA', 'AL', 'CIC', 'CIC CALCULADA',
            'H', 'AZUFRE', 'HIERRO', 'COBRE', 'ZINC', 'MANGANESO', 'BORO',
            'CA/MG', 'MG/K', 'CA/K', '(CA₊MG)/K', 'K/MG'
        ]
        
        # Filtrar columnas existentes
        existing_columns = [col for col in column_order if col in df.columns]
        df = df[existing_columns]
        
        # Crear archivo Excel en memoria
        output = io.BytesIO()
        with pd.ExcelWriter(output, engine='xlsxwriter') as writer:
            df.to_excel(writer, index=False, sheet_name='Datos_Suelo')
            
            workbook = writer.book
            worksheet = writer.sheets['Datos_Suelo']
            
            header_format = workbook.add_format({
                'bold': True,
                'text_wrap': True,
                'valign': 'top',
                'fg_color': '#D7E4BC',
                'border': 1
            })
            
            for col_num, value in enumerate(df.columns.values):
                worksheet.write(0, col_num, value, header_format)
            
            for i, col in enumerate(df.columns):
                max_len = max(
                    df[col].astype(str).map(len).max(),
                    len(col)
                ) + 2
                worksheet.set_column(i, i, max_len)
        
        output.seek(0)
        
        return send_file(
            output,
            mimetype='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            as_attachment=True,
            download_name='resultados_analisis_suelo.xlsx'
        )
    except Exception as e:
        return jsonify({
            "status": "error",
            "message": f"Error al generar Excel: {str(e)}",
            "code": 500
        }), 500

# Handler específico para Vercel
def vercel_handler(request):
    with app.app_context():
        response = app.full_dispatch_request()(request)
        return response

# Punto de entrada para Vercel
if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5000))
    debug = os.environ.get('FLASK_ENV') == 'development'
    app.run(host='0.0.0.0', port=port, debug=debug)