//pythonapi-escaner/static/js/index.js
// Variables globales para el manejo de datos

let currentData = null;

// Event listener principal para el formulario
document.getElementById('pdfForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    // Limpiar resultados anteriores
    document.getElementById('resultContainer').classList.add('hidden');
    document.getElementById('errorContainer').classList.add('hidden');
    document.getElementById('resultsList').innerHTML = '';
    
    const fileInput = document.getElementById('pdfFile');
    const submitBtn = document.querySelector('button[type="submit"]');
    
    if (!fileInput.files || fileInput.files.length === 0) {
        showError("Por favor selecciona un archivo PDF para analizar");
        return;
    }

    // Mostrar estado de carga con animación
    const originalContent = submitBtn.innerHTML;
    submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Procesando análisis...';
    submitBtn.style.pointerEvents = 'none';

    const formData = new FormData();
    formData.append('pdf', fileInput.files[0]);

    try {
        // Cambiar la ruta para usar /api/procesar-pdf
        const response = await fetch('/api/procesar-pdf', {
            method: 'POST',
            body: formData
        });

        const responseData = await response.json();
        
        // CORRECCIÓN: Manejar la estructura correcta de la respuesta
        if (!response.ok) {
            showError(responseData.message || "Error desconocido al procesar el PDF");
            return;
        }

        // Verificar si hay error en el status
        if (responseData.status === "error") {
            showError(responseData.message || "Error al procesar el PDF");
            return;
        }

        // Extraer los datos del objeto respuesta
        const data = responseData.data;
        
        // Verificar si data es un array y no está vacío
        if (!Array.isArray(data) || data.length === 0) {
            showError("No se encontraron datos válidos en el archivo PDF");
            return;
        }

        // Verificar si el primer elemento contiene error
        if (data[0] && data[0].error) {
            showError(data[0].error);
            return;
        }

        // Guardar datos globalmente para descarga
        currentData = data;
        
        // Mostrar resultados con efectos visuales
        displayResults(data);
        
        // Mostrar mensaje de éxito
        showSuccess(`Análisis completado: ${data.length} muestra(s) procesada(s) exitosamente`);
        
    } catch (error) {
        showError("Error de conexión: " + error.message);
        console.error("Error:", error);
    } finally {
        // Restaurar botón original
        submitBtn.innerHTML = originalContent;
        submitBtn.style.pointerEvents = 'auto';
    }
});

// Función para mostrar los resultados con diseño mejorado
function displayResults(data) {
    const resultsList = document.getElementById('resultsList');
    
    // Limpiar contenido anterior
    resultsList.innerHTML = '';
    
    // Crear estadísticas generales
    const statsSection = createStatsSection(data);
    resultsList.appendChild(statsSection);

    // Procesar cada resultado individualmente
    data.forEach((result, index) => {
        const resultItem = document.createElement('div');
        resultItem.className = 'result-item';
        
        let html = `
            <h4><i class="fas fa-seedling"></i> Registro ${index + 1}:</h4>
            
            <div class="producer-info">
                <p><strong><i class="fas fa-user"></i> Productor:</strong> ${result.nombre_productor || 'No especificado'}</p>
                <p><strong><i class="fas fa-leaf"></i> Cultivo:</strong> ${result.cultivo_establecer || 'No especificado'}</p>
                <p><strong><i class="fas fa-chart-bar"></i> Rendimiento:</strong> ${result.meta_rendimiento || 'N/A'} t/ha</p>
                <p><strong><i class="fas fa-map-marker-alt"></i> Municipio:</strong> ${result.municipio || 'No especificado'}</p>
                <p><strong><i class="fas fa-location-dot"></i> Localidad:</strong> ${result.localidad || 'No especificado'}</p>
            </div>
            
            <div class="parametros-fisicos">
                <h5><i class="fas fa-layer-group"></i> Parámetros Físicos del Suelo:</h5>
                <table>
                    <thead>
                        <tr>
                            <th><i class="fas fa-flask"></i> Parámetro</th>
                            <th><i class="fas fa-calculator"></i> Valor</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr><td>Limo (%)</td><td>${result.limo || 'N/A'}</td></tr>
                        <tr><td>Arena (%)</td><td>${result.arena || 'N/A'}</td></tr>
                        <tr><td>Arcilla (%)</td><td>${result.arcilla || 'N/A'}</td></tr>
                        <tr><td>Textura</td><td>${result.textura || 'N/A'}</td></tr>
                        <tr><td>Porcentaje de saturación (PS)</td><td>${result.porcentaje_saturacion || 'N/A'}</td></tr>
                        <tr><td>Capacidad de campo (cc)</td><td>${result.capacidad_campo || 'N/A'}</td></tr>
                        <tr><td>Punto de marchitez permanente (pmp)</td><td>${result.punto_marchitez || 'N/A'}</td></tr>
                        <tr><td>Conductividad hidráulica</td><td>${result.conductividad_hidraulica || 'N/A'}</td></tr>
                        <tr><td>Densidad aparente (Dap)</td><td>${result.densidad_aparente || 'N/A'}</td></tr>
                    </tbody>
                </table>
            </div>

            <div class="parametros-fertilidad">
                <h5><i class="fas fa-seedling"></i> Fertilidad del Suelo:</h5>
                <table>
                    <thead>
                        <tr>
                            <th><i class="fas fa-atom"></i> Parámetro</th>
                            <th><i class="fas fa-tachometer-alt"></i> Valor</th>
                            <th><i class="fas fa-clipboard-check"></i> Interpretación</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr>
                            <td>M.O.</td>
                            <td>${result.mo || 'N/A'}</td>
                            <td><span class="interpretation-badge ${getInterpretationClass(result.interp_mo)}">${result.interp_mo || 'N/A'}</span></td>
                        </tr>
                        <tr>
                            <td>Fósforo (P)</td>
                            <td>${result.fosforo || 'N/A'} mg/kg</td>
                            <td><span class="interpretation-badge ${getInterpretationClass(result.interp_fosforo)}">${result.interp_fosforo || 'N/A'}</span></td>
                        </tr>
                        <tr>
                            <td>Nitrógeno Inorgánico</td>
                            <td>${result.nitrogeno || 'N/A'} mg/kg</td>
                            <td><span class="interpretation-badge ${getInterpretationClass(result.interp_nitrogeno)}">${result.interp_nitrogeno || 'N/A'}</span></td>
                        </tr>
                        <tr>
                            <td>Potasio (K)</td>
                            <td>${result.potasio || 'N/A'} mg/kg</td>
                            <td><span class="interpretation-badge ${getInterpretationClass(result.interp_potasio)}">${result.interp_potasio || 'N/A'}</span></td>
                        </tr>
                        <tr>
                            <td>Calcio (Ca)</td>
                            <td>${result.calcio || 'N/A'} mg/kg</td>
                            <td><span class="interpretation-badge ${getInterpretationClass(result.interp_calcio)}">${result.interp_calcio || 'N/A'}</span></td>
                        </tr>
                        <tr>
                            <td>Magnesio (Mg)</td>
                            <td>${result.magnesio || 'N/A'} mg/kg</td>
                            <td><span class="interpretation-badge ${getInterpretationClass(result.interp_magnesio)}">${result.interp_magnesio || 'N/A'}</span></td>
                        </tr>
                        <tr>
                            <td>Sodio (Na)</td>
                            <td>${result.sodio || 'N/A'} mg/kg</td>
                            <td><span class="interpretation-badge ${getInterpretationClass(result.interp_sodio)}">${result.interp_sodio || 'N/A'}</span></td>
                        </tr>
                        <tr>
                            <td>Azufre (S-SO₄)</td>
                            <td>${result.azufre || 'N/A'}</td>
                            <td><span class="interpretation-badge ${getInterpretationClass(result.interp_azufre)}">${result.interp_azufre || 'N/A'}</span></td>
                        </tr>
                    </tbody>
                </table>
            </div>

            <div class="parametros-quimicos">
                <h5><i class="fas fa-vial"></i> Parámetros Químicos del Suelo:</h5>
                <table>
                    <thead>
                        <tr>
                            <th><i class="fas fa-flask"></i> Parámetro</th>
                            <th><i class="fas fa-tachometer-alt"></i> Valor</th>
                            <th><i class="fas fa-clipboard-check"></i> Interpretación</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr>
                            <td>pH (Relación 2:1 agua suelo)</td>
                            <td>${result.ph_agua || 'N/A'}</td>
                            <td><span class="interpretation-badge ${getInterpretationClass(result.interp_ph_agua)}">${result.interp_ph_agua || 'N/A'}</span></td>
                        </tr>
                        <tr>
                            <td>pH (CaCl₂ 0.01 M)</td>
                            <td>${result.ph_cacl2 || 'N/A'}</td>
                            <td><span class="interpretation-badge ${getInterpretationClass(result.interp_ph_cacl2)}">${result.interp_ph_cacl2 || 'N/A'}</span></td>
                        </tr>
                        <tr>
                            <td>pH (KCl 1 M)</td>
                            <td>${result.ph_kcl || 'N/A'}</td>
                            <td><span class="interpretation-badge ${getInterpretationClass(result.interp_ph_kcl)}">${result.interp_ph_kcl || 'N/A'}</span></td>
                        </tr>
                        <tr>
                            <td>Carbonato de calcio equivalente (%)</td>
                            <td>${result.carbonato_calcio || 'N/A'}</td>
                            <td><span class="interpretation-badge ${getInterpretationClass(result.interp_carbonato_calcio)}">${result.interp_carbonato_calcio || 'N/A'}</span></td>
                        </tr>
                        <tr>
                            <td>Conductividad eléctrica (dS/m)</td>
                            <td>${result.conductividad_electrica || 'N/A'}</td>
                            <td><span class="interpretation-badge ${getInterpretationClass(result.interp_conductividad_electrica)}">${result.interp_conductividad_electrica || 'N/A'}</span></td>
                        </tr>
                    </tbody>
                </table>
            </div>

            <div class="parametros-micro">
                <h5><i class="fas fa-microscope"></i> Micronutrientes:</h5>
                <table>
                    <thead>
                        <tr>
                            <th><i class="fas fa-atom"></i> Parámetro</th>
                            <th><i class="fas fa-balance-scale"></i> Unidad</th>
                            <th><i class="fas fa-calculator"></i> Resultado</th>
                            <th><i class="fas fa-clipboard-check"></i> Interpretación</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr>
                            <td>Hierro (Fe)</td>
                            <td>${result.unidad_hierro || 'N/A'}</td>
                            <td>${result.hierro || 'N/A'}</td>
                            <td><span class="interpretation-badge ${getInterpretationClass(result.interp_hierro)}">${result.interp_hierro || 'N/A'}</span></td>
                        </tr>
                        <tr>
                            <td>Cobre (Cu)</td>
                            <td>${result.unidad_cobre || 'N/A'}</td>
                            <td>${result.cobre || 'N/A'}</td>
                            <td><span class="interpretation-badge ${getInterpretationClass(result.interp_cobre)}">${result.interp_cobre || 'N/A'}</span></td>
                        </tr>
                        <tr>
                            <td>Zinc (Zn)</td>
                            <td>${result.unidad_zinc || 'N/A'}</td>
                            <td>${result.zinc || 'N/A'}</td>
                            <td><span class="interpretation-badge ${getInterpretationClass(result.interp_zinc)}">${result.interp_zinc || 'N/A'}</span></td>
                        </tr>
                        <tr>
                            <td>Manganeso (Mn)</td>
                            <td>${result.unidad_manganeso || 'N/A'}</td>
                            <td>${result.manganeso || 'N/A'}</td>
                            <td><span class="interpretation-badge ${getInterpretationClass(result.interp_manganeso)}">${result.interp_manganeso || 'N/A'}</span></td>
                        </tr>
                        <tr>
                            <td>Boro (B)</td>
                            <td>${result.unidad_boro || 'N/A'}</td>
                            <td>${result.boro || 'N/A'}</td>
                            <td><span class="interpretation-badge ${getInterpretationClass(result.interp_boro)}">${result.interp_boro || 'N/A'}</span></td>
                        </tr>
                    </tbody>
                </table>
            </div>

            <div class="parametros-relaciones">
                <h5><i class="fas fa-exchange-alt"></i> Relaciones entre Cationes:</h5>
                <table>
                    <thead>
                        <tr>
                            <th><i class="fas fa-sitemap"></i> Relación</th>
                            <th><i class="fas fa-calculator"></i> Valor</th>
                            <th><i class="fas fa-clipboard-check"></i> Interpretación</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr>
                            <td>Ca/Mg</td>
                            <td>${result.rel_ca_mg || 'N/A'}</td>
                            <td><span class="interpretation-badge ${getInterpretationClass(result.interp_rel_ca_mg)}">${result.interp_rel_ca_mg || 'N/A'}</span></td>
                        </tr>
                        <tr>
                            <td>Mg/K</td>
                            <td>${result.rel_mg_k || 'N/A'}</td>
                            <td><span class="interpretation-badge ${getInterpretationClass(result.interp_rel_mg_k)}">${result.interp_rel_mg_k || 'N/A'}</span></td>
                        </tr>
                        <tr>
                            <td>Ca/K</td>
                            <td>${result.rel_ca_k || 'N/A'}</td>
                            <td><span class="interpretation-badge ${getInterpretationClass(result.interp_rel_ca_k)}">${result.interp_rel_ca_k || 'N/A'}</span></td>
                        </tr>
                        <tr>
                            <td>(Ca+Mg)/K</td>
                            <td>${result.rel_ca_mg_k || 'N/A'}</td>
                            <td><span class="interpretation-badge ${getInterpretationClass(result.interp_rel_ca_mg_k)}">${result.interp_rel_ca_mg_k || 'N/A'}</span></td>
                        </tr>
                        <tr>
                            <td>K/Mg</td>
                            <td>${result.rel_k_mg || 'N/A'}</td>
                            <td><span class="interpretation-badge ${getInterpretationClass(result.interp_rel_k_mg)}">${result.interp_rel_k_mg || 'N/A'}</span></td>
                        </tr>
                    </tbody>
                </table>
            </div>
        `;
        
        resultItem.innerHTML = html;
        resultsList.appendChild(resultItem);
    });

    // Agregar botón de descarga Excel mejorado
    const downloadBtn = createDownloadButton();
    resultsList.appendChild(downloadBtn);
    
    // Mostrar el contenedor de resultados con animación
    document.getElementById('resultContainer').classList.remove('hidden');
    
    // Scroll suave hacia los resultados
    setTimeout(() => {
        document.getElementById('resultContainer').scrollIntoView({ 
            behavior: 'smooth',
            block: 'start'
        });
    }, 300);
}

// Función para crear la sección de estadísticas
function createStatsSection(data) {
    const statsDiv = document.createElement('div');
    statsDiv.style.cssText = `
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
        gap: 1rem;
        margin-bottom: 2rem;
        padding: 1.5rem;
        background: linear-gradient(135deg, var(--light-green), var(--white));
        border-radius: 10px;
        border: 1px solid var(--border-color);
    `;
    
    const municipios = [...new Set(data.map(d => d.municipio).filter(Boolean))].length;
    const cultivos = [...new Set(data.map(d => d.cultivo_establecer).filter(Boolean))].length;
    
    statsDiv.innerHTML = `
        <div style="text-align: center; padding: 1rem; background: var(--white); border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
            <i class="fas fa-vial" style="font-size: 2rem; color: var(--accent-color); margin-bottom: 0.5rem;"></i>
            <div style="font-size: 1.5rem; font-weight: 700; color: var(--primary-color);">${data.length}</div>
            <div style="font-size: 0.9rem; color: var(--text-light);">Muestras Analizadas</div>
        </div>
        <div style="text-align: center; padding: 1rem; background: var(--white); border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
            <i class="fas fa-map-marker-alt" style="font-size: 2rem; color: var(--accent-color); margin-bottom: 0.5rem;"></i>
            <div style="font-size: 1.5rem; font-weight: 700; color: var(--primary-color);">${municipios}</div>
            <div style="font-size: 0.9rem; color: var(--text-light);">Municipios</div>
        </div>
        <div style="text-align: center; padding: 1rem; background: var(--white); border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
            <i class="fas fa-seedling" style="font-size: 2rem; color: var(--accent-color); margin-bottom: 0.5rem;"></i>
            <div style="font-size: 1.5rem; font-weight: 700; color: var(--primary-color);">${cultivos}</div>
            <div style="font-size: 0.9rem; color: var(--text-light);">Tipos de Cultivo</div>
        </div>
    `;
    
    return statsDiv;
}

// Función para crear el botón de descarga mejorado
function createDownloadButton() {
    const downloadContainer = document.createElement('div');
    downloadContainer.style.cssText = `
        display: flex;
        justify-content: center;
        gap: 1rem;
        margin-top: 2rem;
        padding-top: 2rem;
        border-top: 2px solid var(--border-color);
    `;
    
    const downloadBtn = document.createElement('button');
    downloadBtn.className = 'download-btn';
    downloadBtn.innerHTML = `
        <i class="fas fa-file-excel"></i>
        Descargar Análisis en Excel
    `;
    downloadBtn.addEventListener('click', downloadExcel);
    
    downloadContainer.appendChild(downloadBtn);
    return downloadContainer;
}

// Función para determinar la clase CSS de interpretación
function getInterpretationClass(interpretation) {
    if (!interpretation) return '';
    
    const interp = interpretation.toLowerCase();
    if (interp.includes('alto') || interp.includes('muy alto') || interp.includes('excesivo')) {
        return 'interpretation-high';
    } else if (interp.includes('medio') || interp.includes('moderado') || interp.includes('adecuado')) {
        return 'interpretation-medium';
    } else if (interp.includes('bajo') || interp.includes('muy bajo') || interp.includes('deficiente')) {
        return 'interpretation-low';
    }
    return '';
}

// Función para descargar Excel mejorada
async function downloadExcel() {
    if (!currentData) {
        showError("No hay datos para descargar");
        return;
    }

    const downloadBtn = document.querySelector('.download-btn');
    const originalContent = downloadBtn.innerHTML;
    
    try {
        // Mostrar estado de carga
        downloadBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Generando Excel...';
        downloadBtn.style.pointerEvents = 'none';

        // Cambiar la ruta para usar /api/descargar-excel
        const response = await fetch('/api/descargar-excel', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(currentData)
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.message || 'Error al generar el archivo Excel');
        }

        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        
        // Generar nombre de archivo con fecha y hora
        const fecha = new Date().toISOString().split('T')[0];
        const hora = new Date().toTimeString().split(' ')[0].replace(/:/g, '-');
        a.download = `analisis_suelo_INIFAP_${fecha}_${hora}.xlsx`;
        
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
        
        // Mostrar mensaje de éxito
        showSuccess("Archivo Excel descargado exitosamente");
        
    } catch (error) {
        showError("Error al descargar el archivo: " + error.message);
        console.error("Error:", error);
    } finally {
        // Restaurar botón
        downloadBtn.innerHTML = originalContent;
        downloadBtn.style.pointerEvents = 'auto';
    }
}

// Función para mostrar errores con diseño mejorado
function showError(message) {
    const errorContainer = document.getElementById('errorContainer');
    const errorText = document.getElementById('errorText');
    
    errorText.innerHTML = `<strong>Error:</strong> ${message}`;
    errorContainer.classList.remove('hidden');
    
    // Auto-ocultar después de 6 segundos
    setTimeout(() => {
        errorContainer.classList.add('hidden');
    }, 6000);
    
    // Scroll suave al error
    errorContainer.scrollIntoView({ 
        behavior: 'smooth',
        block: 'center'
    });
}

// Función para mostrar mensajes de éxito
function showSuccess(message) {
    // Crear elemento temporal para mostrar éxito
    const successDiv = document.createElement('div');
    successDiv.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: linear-gradient(135deg, var(--accent-color), #45a049);
        color: white;
        padding: 1rem 1.5rem;
        border-radius: 8px;
        box-shadow: 0 4px 12px rgba(76, 175, 80, 0.3);
        z-index: 1000;
        display: flex;
        align-items: center;
        gap: 0.5rem;
        font-weight: 500;
        animation: slideInRight 0.3s ease-out;
        max-width: 300px;
    `;
    
    successDiv.innerHTML = `
        <i class="fas fa-check-circle"></i>
        ${message}
    `;
    
    document.body.appendChild(successDiv);
    
    // Auto-remover después de 4 segundos
    setTimeout(() => {
        successDiv.style.animation = 'slideOutRight 0.3s ease-in forwards';
        setTimeout(() => {
            if (document.body.contains(successDiv)) {
                document.body.removeChild(successDiv);
            }
        }, 300);
    }, 4000);
}

// Event listeners para mejorar la experiencia del usuario
document.addEventListener('DOMContentLoaded', function() {
    // Mejorar la interacción del input de archivo
    const fileInput = document.getElementById('pdfFile');
    const fileDisplay = document.querySelector('.file-input-display');
    
    // Actualizar display cuando se selecciona un archivo
    fileInput.addEventListener('change', function() {
        if (this.files && this.files[0]) {
            updateFileDisplay(this.files[0]);
        }
    });
    
    // Manejo de drag and drop
    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
        fileDisplay.addEventListener(eventName, preventDefaults, false);
    });

    function preventDefaults(e) {
        e.preventDefault();
        e.stopPropagation();
    }

    ['dragenter', 'dragover'].forEach(eventName => {
        fileDisplay.addEventListener(eventName, highlight, false);
    });

    ['dragleave', 'drop'].forEach(eventName => {
        fileDisplay.addEventListener(eventName, unhighlight, false);
    });

    function highlight() {
        fileDisplay.style.borderColor = 'var(--accent-color)';
        fileDisplay.style.background = 'var(--light-green)';
        fileDisplay.style.transform = 'translateY(-2px)';
    }

    function unhighlight() {
        fileDisplay.style.borderColor = 'var(--border-color)';
        fileDisplay.style.background = 'var(--bg-light)';
        fileDisplay.style.transform = 'translateY(0)';
    }

    fileDisplay.addEventListener('drop', handleDrop, false);

    function handleDrop(e) {
        const dt = e.dataTransfer;
        const files = dt.files;
        
        if (files.length > 0) {
            fileInput.files = files;
            updateFileDisplay(files[0]);
        }
    }
});

// Función para actualizar el display del archivo seleccionado
function updateFileDisplay(file) {
    const fileInfo = document.querySelector('.file-info');
    const fileSize = (file.size / 1024 / 1024).toFixed(2);
    
    if (file.type !== 'application/pdf') {
        showError('Por favor selecciona un archivo PDF válido');
        return;
    }
    
    if (file.size > 10 * 1024 * 1024) { // 10MB limit
        showError('El archivo es demasiado grande. Máximo 10MB permitido.');
        return;
    }
    
    fileInfo.innerHTML = `
        <h3><i class="fas fa-file-pdf" style="color: var(--error-color);"></i> ${file.name}</h3>
        <p><i class="fas fa-weight-hanging"></i> Tamaño: ${fileSize} MB</p>
        <p style="margin-top: 0.5rem; font-size: 0.8rem; color: var(--accent-color);">
            <i class="fas fa-check-circle"></i> Archivo PDF listo para procesar
        </p>
    `;
}

// Agregar estilos dinámicos para las interpretaciones
function addInterpretationStyles() {
    const style = document.createElement('style');
    style.textContent = `
        .interpretation-badge {
            font-weight: 500;
            padding: 0.3rem 0.8rem;
            border-radius: 4px;
            font-size: 0.85rem;
            display: inline-block;
            text-align: center;
            min-width: 60px;
        }
        
        .interpretation-high {
            background: linear-gradient(135deg, #E8F5E9, #C8E6C9);
            color: #1B5E20;
            border: 1px solid #4CAF50;
        }
        
        .interpretation-medium {
            background: linear-gradient(135deg, #FFF3E0, #FFE0B2);
            color: #E65100;
            border: 1px solid #FF9800;
        }
        
        .interpretation-low {
            background: linear-gradient(135deg, #FFEBEE, #FFCDD2);
            color: #B71C1C;
            border: 1px solid #F44336;
        }
        
        @keyframes slideInRight {
            from {
                transform: translateX(100%);
                opacity: 0;
            }
            to {
                transform: translateX(0);
                opacity: 1;
            }
        }
        
        @keyframes slideOutRight {
            from {
                transform: translateX(0);
                opacity: 1;
            }
            to {
                transform: translateX(100%);
                opacity: 0;
            }
        }
        
        /* Efectos adicionales para mejorar la UX */
        .result-item {
            animation: fadeInUp 0.5s ease-out;
        }
        
        @keyframes fadeInUp {
            from {
                opacity: 0;
                transform: translateY(20px);
            }
            to {
                opacity: 1;
                transform: translateY(0);
            }
        }
        
        /* Hover effects para las tablas */
        tbody tr {
            transition: all 0.2s ease;
        }
        
        tbody tr:hover {
            background: var(--light-green) !important;
            transform: scale(1.01);
        }
    `;
    document.head.appendChild(style);
}

// Inicializar estilos cuando se carga la página
document.addEventListener('DOMContentLoaded', addInterpretationStyles);