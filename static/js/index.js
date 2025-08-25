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
    
    // Ocultar botón de descarga superior si existe
    hideTopDownloadButton();
    
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
        
        // Mostrar botón de descarga en la parte superior PRIMERO
        showTopDownloadButton();
        
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

// Función para mostrar el botón de descarga en la parte superior
function showTopDownloadButton() {
    // Verificar si ya existe el contenedor
    let topDownloadContainer = document.getElementById('topDownloadContainer');
    
    if (!topDownloadContainer) {
        // Crear el contenedor del botón superior
        topDownloadContainer = document.createElement('div');
        topDownloadContainer.id = 'topDownloadContainer';
        topDownloadContainer.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            z-index: 1000;
            background: white;
            border-radius: 10px;
            box-shadow: 0 8px 32px rgba(0,0,0,0.15);
            padding: 1rem;
            border: 2px solid var(--accent-color);
            animation: slideInFromTop 0.5s ease-out;
        `;
        
        // Crear el botón
        const topDownloadBtn = document.createElement('button');
        topDownloadBtn.className = 'top-download-btn';
        topDownloadBtn.innerHTML = `
            <i class="fas fa-file-excel"></i>
            Descargar Excel
        `;
        topDownloadBtn.addEventListener('click', downloadExcel);
        
        topDownloadContainer.appendChild(topDownloadBtn);
        document.body.appendChild(topDownloadContainer);
    } else {
        // Si ya existe, solo mostrarlo
        topDownloadContainer.style.display = 'block';
        topDownloadContainer.style.animation = 'slideInFromTop 0.5s ease-out';
    }
}

// Función para ocultar el botón de descarga superior
function hideTopDownloadButton() {
    const topDownloadContainer = document.getElementById('topDownloadContainer');
    if (topDownloadContainer) {
        topDownloadContainer.style.animation = 'slideOutToTop 0.3s ease-in forwards';
        setTimeout(() => {
            topDownloadContainer.style.display = 'none';
        }, 300);
    }
}

// Función para mostrar los resultados con diseño mejorado
// Función optimizada para mostrar resultados de PDFs grandes
function displayResults(data) {
    const resultsList = document.getElementById('resultsList');
    
    // Limpiar contenido anterior
    resultsList.innerHTML = '';
    
    // Crear estadísticas generales
    const statsSection = createStatsSection(data);
    resultsList.appendChild(statsSection);
    
    // Para PDFs muy grandes, mostrar en lotes para no sobrecargar el DOM
    const BATCH_SIZE = 20; // Mostrar 20 registros por lote
    let currentBatch = 0;
    
    function renderBatch() {
        const start = currentBatch * BATCH_SIZE;
        const end = Math.min(start + BATCH_SIZE, data.length);
        
        for (let i = start; i < end; i++) {
            const result = data[i];
            const resultItem = createResultItem(result, i + 1);
            resultsList.appendChild(resultItem);
        }
        
        currentBatch++;
        
        // Si hay más datos, crear botón para cargar más
        if (end < data.length) {
            const loadMoreBtn = document.createElement('button');
            loadMoreBtn.textContent = `Cargar más registros (${end}/${data.length})`;
            loadMoreBtn.className = 'load-more-btn';
            loadMoreBtn.style.cssText = `
                width: 100%;
                padding: 1rem;
                margin: 1rem 0;
                background: var(--accent-color);
                color: white;
                border: none;
                border-radius: 8px;
                font-size: 1rem;
                cursor: pointer;
                transition: all 0.3s ease;
            `;
            
            loadMoreBtn.addEventListener('click', () => {
                loadMoreBtn.remove();
                renderBatch();
            });
            
            resultsList.appendChild(loadMoreBtn);
        }
    }
    
    // Renderizar primer lote
    renderBatch();
    
    // Mostrar el contenedor con animación
    document.getElementById('resultContainer').classList.remove('hidden');
    
    // Scroll suave
    setTimeout(() => {
        document.getElementById('resultContainer').scrollIntoView({ 
            behavior: 'smooth',
            block: 'start'
        });
    }, 300);
}

// Función auxiliar para crear un item de resultado
function createResultItem(result, index) {
    const resultItem = document.createElement('div');
    resultItem.className = 'result-item';
    
    // HTML simplificado para mejor rendimiento
    resultItem.innerHTML = `
        <h4><i class="fas fa-seedling"></i> Registro ${index}:</h4>
        
        <div class="producer-info">
            <p><strong><i class="fas fa-user"></i> Productor:</strong> ${result.nombre_productor || 'No especificado'}</p>
            <p><strong><i class="fas fa-leaf"></i> Cultivo:</strong> ${result.cultivo_establecer || 'No especificado'}</p>
            <p><strong><i class="fas fa-map-marker-alt"></i> Municipio:</strong> ${result.municipio || 'No especificado'}</p>
        </div>
        
        <div class="parametros-principales">
            <h5><i class="fas fa-vial"></i> Parámetros Principales:</h5>
            <div class="params-grid">
                <div class="param-item">
                    <span class="param-label">pH:</span>
                    <span class="param-value">${result.ph_agua || 'N/A'}</span>
                </div>
                <div class="param-item">
                    <span class="param-label">M.O.:</span>
                    <span class="param-value">${result.mo || 'N/A'}</span>
                </div>
                <div class="param-item">
                    <span class="param-label">Fósforo:</span>
                    <span class="param-value">${result.fosforo || 'N/A'} mg/kg</span>
                </div>
                <div class="param-item">
                    <span class="param-label">Potasio:</span>
                    <span class="param-value">${result.potasio || 'N/A'} mg/kg</span>
                </div>
            </div>
        </div>
    `;
    
    return resultItem;
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

    // Obtener todos los botones de descarga (tanto el superior como cualquier otro)
    const downloadBtns = document.querySelectorAll('.download-btn, .top-download-btn');
    const originalContents = [];
    
    try {
        // Mostrar estado de carga en todos los botones
        downloadBtns.forEach((btn, index) => {
            originalContents[index] = btn.innerHTML;
            btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Generando...';
            btn.style.pointerEvents = 'none';
        });

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
        // Restaurar todos los botones
        downloadBtns.forEach((btn, index) => {
            btn.innerHTML = originalContents[index] || '<i class="fas fa-file-excel"></i> Descargar Excel';
            btn.style.pointerEvents = 'auto';
        });
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
        left: 20px;
        background: linear-gradient(135deg, var(--accent-color), #45a049);
        color: white;
        padding: 1rem 1.5rem;
        border-radius: 8px;
        box-shadow: 0 4px 12px rgba(76, 175, 80, 0.3);
        z-index: 999;
        display: flex;
        align-items: center;
        gap: 0.5rem;
        font-weight: 500;
        animation: slideInLeft 0.3s ease-out;
        max-width: 300px;
    `;
    
    successDiv.innerHTML = `
        <i class="fas fa-check-circle"></i>
        ${message}
    `;
    
    document.body.appendChild(successDiv);
    
    // Auto-remover después de 4 segundos
    setTimeout(() => {
        successDiv.style.animation = 'slideOutLeft 0.3s ease-in forwards';
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
    
    if (file.size > 1024 * 1024 * 1024) { // 1GB límite
        showError('El archivo es demasiado grande. Máximo 1GB permitido.');
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

// Agregar estilos dinámicos para las interpretaciones y animaciones
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
        
        /* Estilos para el botón de descarga superior */
        .top-download-btn {
            background: linear-gradient(135deg, var(--accent-color) 0%, var(--secondary-color) 100%);
            color: var(--white);
            border: none;
            padding: 0.8rem 1.5rem;
            font-size: 0.9rem;
            font-weight: 600;
            border-radius: 8px;
            cursor: pointer;
            transition: all 0.3s ease;
            display: flex;
            align-items: center;
            gap: 0.5rem;
            text-decoration: none;
            box-shadow: 0 4px 12px rgba(76, 175, 80, 0.2);
        }

        .top-download-btn:hover {
            transform: translateY(-2px);
            box-shadow: 0 6px 16px rgba(76, 175, 80, 0.4);
        }
        
        /* Animaciones */
        @keyframes slideInFromTop {
            from {
                transform: translateY(-100%);
                opacity: 0;
            }
            to {
                transform: translateY(0);
                opacity: 1;
            }
        }
        
        @keyframes slideOutToTop {
            from {
                transform: translateY(0);
                opacity: 1;
            }
            to {
                transform: translateY(-100%);
                opacity: 0;
            }
        }
        
        @keyframes slideInLeft {
            from {
                transform: translateX(-100%);
                opacity: 0;
            }
            to {
                transform: translateX(0);
                opacity: 1;
            }
        }
        
        @keyframes slideOutLeft {
            from {
                transform: translateX(0);
                opacity: 1;
            }
            to {
                transform: translateX(-100%);
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