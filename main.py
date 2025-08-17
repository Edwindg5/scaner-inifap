from flask import Flask, request, jsonify, send_file, render_template, send_from_directory
from api.scaner import extract_data_from_pdf
from flask_cors import CORS
from openpyxl import Workbook
from openpyxl.styles import Font, PatternFill, Border, Side, Alignment
import io
import os
import json

app = Flask(__name__, template_folder='templates', static_folder='static')
CORS(app)

# Configuración específica para Vercel
app.config['JSONIFY_PRETTYPRINT_REGULAR'] = False
app.config['MAX_CONTENT_LENGTH'] = 16 * 1024 * 1024  # 16MB max upload


@app.route('/')
def index():
    return render_template('index.html')

@app.route('/static/<path:path>')
def serve_static(path):
    return send_from_directory('static', path)

@app.route('/api')
def api_info():
    return jsonify({"message": "API funcionando", "status": "active"})

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
        
        # Crear libro de Excel usando openpyxl
        workbook = Workbook()
        sheet = workbook.active
        sheet.title = "Datos_Suelo"
        
        # Definir el orden de las columnas y sus mapeos
        column_mapping = {
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
        
        # Obtener las columnas disponibles
        available_columns = []
        if data:
            first_row = data[0]
            for key in column_mapping:
                if key in first_row:
                    available_columns.append((key, column_mapping[key]))
        
        # Escribir encabezados
        headers = [header for _, header in available_columns]
        for col_idx, header in enumerate(headers, 1):
            cell = sheet.cell(row=1, column=col_idx, value=header)
            cell.font = Font(bold=True)
            cell.fill = PatternFill(start_color="D7E4BC", end_color="D7E4BC", fill_type="solid")
            cell.border = Border(
                left=Side(style='thin'),
                right=Side(style='thin'),
                top=Side(style='thin'),
                bottom=Side(style='thin')
            )
            cell.alignment = Alignment(horizontal='center', vertical='center')
        
        # Escribir datos
        for row_idx, record in enumerate(data, 2):
            for col_idx, (key, _) in enumerate(available_columns, 1):
                value = record.get(key, 'N/A')
                cell = sheet.cell(row=row_idx, column=col_idx, value=value)
                cell.border = Border(
                    left=Side(style='thin'),
                    right=Side(style='thin'),
                    top=Side(style='thin'),
                    bottom=Side(style='thin')
                )
        
        # Ajustar ancho de columnas
        for col_idx, (_, header) in enumerate(available_columns, 1):
            # Calcular ancho basado en el header y contenido
            max_length = len(header)
            for row_idx in range(2, len(data) + 2):
                cell_value = sheet.cell(row=row_idx, column=col_idx).value
                if cell_value:
                    max_length = max(max_length, len(str(cell_value)))
            
            adjusted_width = min(max_length + 2, 30)  # Máximo 30 caracteres
            sheet.column_dimensions[sheet.cell(row=1, column=col_idx).column_letter].width = adjusted_width
        
        # Guardar en memoria
        output = io.BytesIO()
        workbook.save(output)
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

# IMPORTANTE: Función requerida para Vercel
def handler(request):
    """
    Punto de entrada principal para Vercel.
    Esta función debe existir y ser llamada 'handler'
    """
    with app.app_context():
        # Crear un contexto de request Flask compatible
        from werkzeug.wrappers import Request
        flask_request = Request(request.environ if hasattr(request, 'environ') else {})
        
        # Procesar la request con Flask
        response = app.full_dispatch_request()
        return response


if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5000))
    app.run(host="0.0.0.0", port=port)