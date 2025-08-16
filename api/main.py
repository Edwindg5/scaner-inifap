# api/main.py
from flask import Flask, request, jsonify, send_file, send_from_directory
from scaner import extract_data_from_pdf
from flask_cors import CORS
import pandas as pd
import io
import os

app = Flask(__name__)
CORS(app)

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

@app.route('/', methods=['GET'])
@app.route('/api', methods=['GET'])
def index():
    return jsonify({"message": "API de análisis de suelos funcionando correctamente"})

@app.route('/api/procesar-pdf', methods=['POST'])
def procesar_pdf():
    try:
        if 'pdf' not in request.files:
            return jsonify({"error": "No se envió el PDF"}), 400
        
        pdf_file = request.files['pdf']
        
        if pdf_file.filename == '':
            return jsonify({"error": "No se seleccionó ningún archivo"}), 400
        
        pdf_bytes = pdf_file.read()
        datos = extract_data_from_pdf(pdf_bytes)
        
        return jsonify(datos)
    except Exception as e:
        return jsonify({"error": f"Error al procesar el PDF: {str(e)}"}), 500

@app.route('/api/descargar-excel', methods=['POST'])
def descargar_excel():
    try:
        data = request.get_json()
        if not data:
            return jsonify({"error": "No se recibieron datos"}), 400
        
        # Convertir a DataFrame de pandas
        df = pd.DataFrame(data)
        
        # Renombrar columnas según el mapeo
        df.rename(columns=COLUMN_MAPPING, inplace=True)
        
        # Definir el orden de las columnas para el Excel
        column_order = [
            'MUNICIPIO', 'LOCALIDAD', 'NOMBRE DEL PRODUCTOR', 'CULTIVO ANTERIOR',
            'ARCILLA', 'LIMO', 'ARENA', 'TEXTURA', 'DA', 'PH', 'MO', 'FOSFORO',
            'N.INORGANICO', 'K', 'MG', 'CA', 'NA', 'AL', 'CIC', 'CIC CALCULADA',
            'H', 'AZUFRE', 'HIERRO', 'COBRE', 'ZINC', 'MANGANESO', 'BORO',
            'CA/MG', 'MG/K', 'CA/K', '(CA₊MG)/K', 'K/MG'
        ]
        
        # Filtrar solo las columnas que existen en los datos
        existing_columns = [col for col in column_order if col in df.columns]
        df = df[existing_columns]
        
        # Crear un archivo Excel en memoria
        output = io.BytesIO()
        with pd.ExcelWriter(output, engine='xlsxwriter') as writer:
            df.to_excel(writer, index=False, sheet_name='Datos_Suelo')
            
            # Formatear el Excel
            workbook = writer.book
            worksheet = writer.sheets['Datos_Suelo']
            
            # Formato para encabezados
            header_format = workbook.add_format({
                'bold': True,
                'text_wrap': True,
                'valign': 'top',
                'fg_color': '#D7E4BC',
                'border': 1
            })
            
            # Aplicar formato a los encabezados
            for col_num, value in enumerate(df.columns.values):
                worksheet.write(0, col_num, value, header_format)
            
            # Autoajustar el ancho de las columnas
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
        return jsonify({"error": f"Error al generar Excel: {str(e)}"}), 500
@app.route('/favicon.ico')
def favicon():
    return send_from_directory(os.path.join(app.root_path, 'static'),
                           'favicon.ico', mimetype='image/vnd.microsoft.icon')

# Para desarrollo local
if __name__ == '__main__':
    app.run(debug=True)