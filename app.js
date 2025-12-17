/**
 * Controlador de la Interfaz de Usuario.
 */

// ================================================================
// 1. VARIABLES GLOBALES
// ================================================================

let modoActual = "RB"; // Valores: "RB" (Red Bayesiana), "CM" (Markov), "HMM"
let sistema = new RedBayesiana(); // Iniciamos con Bayes
let network = null;
let nodesDataSet = new vis.DataSet();
let edgesDataSet = new vis.DataSet();

// ================================================================
// 2. INICIALIZACION
// ================================================================

document.addEventListener('DOMContentLoaded', () => {
    const container = document.getElementById('network');
    
    const data = {
        nodes: nodesDataSet,
        edges: edgesDataSet
    };
    
    const options = {
        nodes: {
            shape: 'ellipse',
            color: {
                background: '#ffffff',
                border: '#4b73ec',
                highlight: { background: '#eef2ff', border: '#1a237e' }
            },
            font: { color: '#000000', size: 16 },
            borderWidth: 2,
            shadow: true
        },
        edges: {
            arrows: 'to',
            color: { color: '#848484', highlight: '#1a237e' },
            smooth: { type: 'cubicBezier' }
        },
        physics: {
            enabled: true,
            solver: 'forceAtlas2Based',
            stabilization: { iterations: 150 }
        },
        interaction: {
            hover: true,
            navigationButtons: true,
            keyboard: true
        },
        interaction: {
            hover: true,
            navigationButtons: true,
            keyboard: true,
            multiselect: true  // Nota: Dejar esto en true. Es lo que permite seleccionar multiples nodos
        }
    };

    network = new vis.Network(container, data, options);
    
    console.log("Sistema visual iniciado.");
    crearNodoInicial(); 

    document.getElementById('modoSelector').addEventListener('change', (e) => {
        cambiarModo(e.target.value);
    });
});

function cambiarModo(nuevoModo) {
    if(!confirm("Al cambiar de modo se borrará el grafo actual. ¿Continuar?")) {
        document.getElementById('modoSelector').value = modoActual;
        return;
    }

    modoActual = nuevoModo;
    nodesDataSet.clear();
    edgesDataSet.clear();
    
    // Cambio entre logicas y actualizacion de interfaces
    if (modoActual === "RB") {
        sistema = new RedBayesiana();
        document.getElementById('ejemplosCarga').innerHTML = `
            <option value="">-- Cargar Ejemplo RB --</option>
            <option value="alarma">1. Alarma - Terremoto</option>
            <option value="medica">2. Diagnóstico Médico</option>
            <option value="fallas">3. Diagnóstico de Fallas</option>
            <option value="clima">4. Predicción Climática</option>
        `;
        // Mouestra el panel de inferencia Bayesiana
        document.querySelector('h3:nth-of-type(2)').style.display = 'block';
        document.getElementById('selectorQuery').parentElement.style.display = 'block';
        // Muestra el panel Bayesiano, oculta Markov
        document.getElementById('panelInferenciaBayes').style.display = 'block';
        document.getElementById('panelMarkov').style.display = 'none';
        document.querySelector('h3:nth-of-type(2)').style.display = 'block';
        document.getElementById('selectorQuery').style.display = 'block';
        document.getElementById('contenedorEvidencia').style.display = 'block';
        document.querySelector('.btn[onclick="ejecutarInferencia()"]').style.display = 'block';
    } 
    else if (modoActual === "CM") { // Usamos Cadena de Markov
        sistema = new CadenaMarkov();
        document.getElementById('ejemplosCarga').innerHTML = `
            <option value="">-- Cargar Ejemplo Markov --</option>
            <option value="clima_markov">1. Clima (Sol/Lluvia)</option>
        `;
        // Oculta todo lo de Bayes
        ocultarPanelBayes();
        document.querySelector('h3:nth-of-type(2)').style.display = 'none';
        document.getElementById('selectorQuery').style.display = 'none';
        document.getElementById('contenedorEvidencia').style.display = 'none';
        document.querySelector('.btn[onclick="ejecutarInferencia()"]').style.display = 'none';
        document.getElementById('resultadoOutput').style.display = 'none';

        // Muestra Markov
        document.getElementById('panelMarkov').style.display = 'block';
    }
    else if (modoActual === "HMM") {
        sistema = new HMM(); // Usamos HMM
        document.getElementById('ejemplosCarga').innerHTML = `
            <option value="">-- Cargar Ejemplo HMM --</option>
            <option value="medico_hmm">1. Médico (Salud/Síntomas)</option>
        `;
        
        // Oculta los otros paneles
        document.querySelector('h3:nth-of-type(2)').style.display = 'none';
        document.getElementById('selectorQuery').style.display = 'none';
        document.getElementById('contenedorEvidencia').style.display = 'none';
        document.querySelector('.btn[onclick="ejecutarInferencia()"]').style.display = 'none';
        document.getElementById('panelMarkov').style.display = 'none';
        
        // Muestra HMM
        document.getElementById('panelHMM').style.display = 'block';
        
        agregarLog("Modo HMM activo. Recuerda definir Transiciones Y Emisiones.");
    }

    agregarLog(`Modo cambiado a: ${modoActual}`);
}

function ocultarPanelBayes() {
    const sidebar = document.querySelector('.sidebar');
    document.getElementById('selectorQuery').innerHTML = "<option>No disponible en Markov</option>";
    document.getElementById('contenedorEvidencia').innerHTML = "<small>Irrelevante en Markov</small>";
}

// ================================================================
// 3. FUNCIONES DE DIBUJO
// ================================================================

function redibujar() {
    nodesDataSet.clear();
    edgesDataSet.clear();
    const nodosVisuales = [];
    const aristasVisuales = [];
    for (const id in sistema.nodos) {
        const nodo = sistema.nodos[id];
        nodosVisuales.push({ 
            id: nodo.id, 
            label: nodo.nombre + `\n(${nodo.id})`
        });

        nodo.hijos.forEach(hijo => {
            let etiqueta = "";            
            if (modoActual === "CM" && nodo.transiciones && nodo.transiciones[hijo.id] !== undefined) {
                etiqueta = String(nodo.transiciones[hijo.id]);
            }

            aristasVisuales.push({ 
                from: nodo.id, 
                to: hijo.id,
                label: etiqueta,
                font: { align: 'top' }
            });
        });
    }

    nodesDataSet.add(nodosVisuales);
    edgesDataSet.add(aristasVisuales);
    network.fit(); 
    
    if(modoActual === "RB") actualizarSelectoresInferencia();
}

// ================================================================
// 4. EJEMPLOS
// ================================================================

function cargarEjemplo() {
    const selector = document.getElementById('ejemplosCarga');
    const seleccion = selector.value;

    if (!seleccion) {
        alert("Por favor selecciona un ejemplo de la lista.");
        return;
    }
    
    if (seleccion === "clima_markov") {
        sistema = new CadenaMarkov();
        modoActual = "CM";
    } 
    else if (seleccion === "medico_hmm") {
        sistema = new HMM();
        modoActual = "HMM";
    } 
    else {
        sistema = new RedBayesiana();
        modoActual = "RB";
    }
    
    document.getElementById('modoSelector').value = modoActual;
    
    if (modoActual === "RB") {
        document.getElementById('panelMarkov').style.display = 'none';
        document.getElementById('panelHMM').style.display = 'none';
        document.querySelector('h3:nth-of-type(2)').style.display = 'block';
        document.getElementById('selectorQuery').style.display = 'block';
        document.getElementById('contenedorEvidencia').style.display = 'block';
        document.querySelector('.btn[onclick="ejecutarInferencia()"]').style.display = 'block';
    } else if (modoActual === "CM") {
        document.getElementById('panelMarkov').style.display = 'block';
        document.getElementById('panelHMM').style.display = 'none';
        document.querySelector('h3:nth-of-type(2)').style.display = 'none';
        document.getElementById('selectorQuery').style.display = 'none';
        document.getElementById('contenedorEvidencia').style.display = 'none';
        document.querySelector('.btn[onclick="ejecutarInferencia()"]').style.display = 'none';
    } else if (modoActual === "HMM") {
        document.getElementById('panelMarkov').style.display = 'none';
        document.getElementById('panelHMM').style.display = 'block';
        document.querySelector('h3:nth-of-type(2)').style.display = 'none';
        document.getElementById('selectorQuery').style.display = 'none';
        document.getElementById('contenedorEvidencia').style.display = 'none';
        document.querySelector('.btn[onclick="ejecutarInferencia()"]').style.display = 'none';
    }

    // Ejecuta el ejemplo seleccionado
    switch(seleccion) {
        case "alarma": crearEjemploAlarma(); break;
        case "medica": crearEjemploMedica(); break;
        case "fallas": crearEjemploFallas(); break;
        case "clima":  crearEjemploClima();  break;
        case "clima_markov": crearEjemploClimaMarkov(); break;
        case "medico_hmm":   crearEjemploMedicoHMM(); break;
        default:
            alert("Ejemplo no implementado.");
            return;
    }

    redibujar();
    agregarLog(`Ejemplo '${seleccion}' cargado correctamente en modo ${modoActual}.`);
}

 // Configura la Red de Alarma - Terremoto
 function crearEjemploAlarma() {

    // 1. Crea Nodos
    const b = sistema.agregarNodo("B", "Robo");
    const e = sistema.agregarNodo("E", "Terremoto");
    const a = sistema.agregarNodo("A", "Alarma");
    const j = sistema.agregarNodo("J", "Juan Llama");
    const m = sistema.agregarNodo("M", "María Llama");

    // 2. Conecta (Padre -> Hijo)
    sistema.conectar("B", "A"); // Robo causa Alarma
    sistema.conectar("E", "A"); // Terremoto causa Alarma
    sistema.conectar("A", "J"); // Alarma hace que Juan llame
    sistema.conectar("A", "M"); // Alarma hace que Maria llame

    // 3. Definimos Probabilidades
    
    // Raices
    b.setProbabilidades({ "root": { "True": 0.001, "False": 0.999 } });
    e.setProbabilidades({ "root": { "True": 0.002, "False": 0.998 } });

    // Alarma (Padres: B, E)
    a.setProbabilidades({
        "True_True":   { "True": 0.95, "False": 0.05 },
        "True_False":  { "True": 0.94, "False": 0.06 },
        "False_True":  { "True": 0.29, "False": 0.71 },
        "False_False": { "True": 0.001, "False": 0.999 }
    });

    // Juan (Padre: A)
    j.setProbabilidades({
        "True":  { "True": 0.90, "False": 0.10 },
        "False": { "True": 0.05, "False": 0.95 }
    });

    // Maria (Padre: A)
    m.setProbabilidades({
        "True":  { "True": 0.70, "False": 0.30 },
        "False": { "True": 0.01, "False": 0.99 }
    });
}

// ================================================================
// 5. FUNCIONES AUXILIARES UI
// ================================================================

function agregarLog(mensaje) {
    const panel = document.getElementById('consolePanel');
    const linea = document.createElement('div');
    linea.innerText = `> ${mensaje}`;
    panel.appendChild(linea);
    panel.scrollTop = panel.scrollHeight;
    panel.style.display = 'block';
}

function crearNodo() {
    const nombre = prompt("Nombre del nodo:");
    const id = prompt("ID único (ej: A, B, C):");
    if(nombre && id) {
        sistema.agregarNodo(id, nombre);
        redibujar();
        agregarLog(`Nodo ${nombre} agregado.`);
    }
}

function crearNodoInicial() {
    const n = sistema.agregarNodo("Start", "Inicio");
    n.setProbabilidades({"root": {"True": 0.5, "False": 0.5}});
    redibujar();
    agregarLog("Sistema listo. Carga un ejemplo o agrega nodos.");
}

// ================================================================
// 6. FUNCIONES DE EDICION
// ================================================================

function crearNodo() {
    const nombre = prompt("Ingresa el nombre del nodo (Ej: Lluvia):");
    if (!nombre) return;

    const idSugerido = nombre.charAt(0).toUpperCase();
    let id = prompt("Ingresa un ID único para el nodo (Ej: L):", idSugerido);
    if (!id) return;
    id = id.trim();
    if (sistema.nodos[id]) {
        alert("¡Error! Ya existe un nodo con ese ID. Intenta con otro.");
        return;
    }

    sistema.agregarNodo(id, nombre);    
    nodesDataSet.add({
        id: id,
        label: nombre + `\n(${id})`
    });

    agregarLog(`Nodo creado: ${nombre} (${id})`);
}

function conectarNodos() {
    const seleccion = network.getSelection();
    const listaNodos = seleccion.nodes;

    // CASO 1: Auto-conexion (Bucle)
    if (listaNodos.length === 1) {
        if (modoActual === "CM" || modoActual === "HMM") {
            const id = listaNodos[0];
            const nodo = sistema.nodos[id];
            
            const yaExiste = nodo.hijos.some(h => h.id === id);
            if(yaExiste) {
                alert("Este nodo ya está conectado consigo mismo.");
                return;
            }

            sistema.conectar(id, id);
            edgesDataSet.add({ from: id, to: id });
            agregarLog(`Auto-conexión creada: ${id} -> ${id}`);
        } else {
            alert("En Redes Bayesianas no se permite conectar un nodo consigo mismo.");
        }
        return;
    }

    // CASO 2: Conexion Normal (A -> B)
    if (listaNodos.length === 2) {
        const idPadre = listaNodos[0];
        const idHijo = listaNodos[1];

        const nodoPadre = sistema.nodos[idPadre];
        const yaConectado = nodoPadre.hijos.some(h => h.id === idHijo);

        if (yaConectado) {
            alert("Ya existe una conexión de " + idPadre + " a " + idHijo);
            return;
        }

        sistema.conectar(idPadre, idHijo);
        edgesDataSet.add({ from: idPadre, to: idHijo });
        agregarLog(`Conexión creada: ${idPadre} -> ${idHijo}`);
        return;
    }

    // CASO 3: Error de seleccion
    alert("Para conectar:\n- Selecciona 2 nodos para crear una flecha.\n- Selecciona 1 solo nodo para crear un bucle (Solo Markov/HMM).");
}

function borrarSeleccion() {
    const seleccion = network.getSelection();
    
    if (seleccion.nodes.length === 0 && seleccion.edges.length === 0) {
        alert("Selecciona nodos o flechas para eliminar.");
        return;
    }

    if(!confirm("¿Estás seguro de eliminar los elementos seleccionados?")) return;

    seleccion.nodes.forEach(idNodo => {
        delete sistema.nodos[idNodo];

        Object.values(sistema.nodos).forEach(n => {
            n.padres = n.padres.filter(p => p.id !== idNodo);
            n.hijos = n.hijos.filter(h => h.id !== idNodo);
        });
    });

    seleccion.edges.forEach(idArista => {
        const arista = edgesDataSet.get(idArista);
        if(arista) {
            const padre = sistema.nodos[arista.from];
            const hijo = sistema.nodos[arista.to];
            if(padre && hijo) {
                hijo.padres = hijo.padres.filter(p => p.id !== padre.id);
                padre.hijos = padre.hijos.filter(h => h.id !== hijo.id);
            }
        }
    });

    redibujar();
    agregarLog("Elementos eliminados correctamente.");
}

// ======================
// 7. GESTION DE CPT
// ======================

let nodoSeleccionadoId = null;

function editarProbabilidades() {
    const seleccion = network.getSelection();
    if (seleccion.nodes.length !== 1) { alert("Selecciona un nodo."); return; }
    const id = seleccion.nodes[0];
    const nodo = sistema.nodos[id];
    nodoSeleccionadoId = id;

    if (modoActual === "RB") {
        generarTablaCPT(nodo);
        document.getElementById('modalCPT').style.display = 'flex';
    } 
    else if (modoActual === "CM") {
        editarTransicionesMarkov(nodo);
    }
    else if (modoActual === "HMM") {
        const tipo = prompt("¿Qué deseas editar?\n1. Transiciones (A: cambio de estado)\n2. Emisiones (B: observaciones del estado)\n\nEscribe 1 o 2:");
        
        if (tipo === "1") {
            editarTransicionesMarkov(nodo);
        } else if (tipo === "2") {
            editarEmisionesHMM(nodo);
        }
    }
}

function editarTransicionesMarkov(nodo) {
    document.getElementById('modalTitulo').innerText = `Transiciones desde: ${nodo.nombre}`;
    document.getElementById('modalDescripcion').innerText = "Define la probabilidad de ir hacia los siguientes estados (La suma debe ser 1.0).";
    
    const contenedor = document.getElementById('tablaContainer');
    contenedor.innerHTML = "";

    if (nodo.hijos.length === 0) {
        contenedor.innerHTML = "<p style='color:red;'>Este estado no tiene conexiones salientes. Conéctalo a otros nodos primero.</p>";
        document.getElementById('modalCPT').style.display = 'flex';
        return;
    }

    const tabla = document.createElement('table');
    tabla.className = "cpt-table";
    
    tabla.innerHTML = `
        <thead>
            <tr>
                <th>Hacia el Estado</th>
                <th>Probabilidad (0-1)</th>
            </tr>
        </thead>
        <tbody></tbody>
    `;

    const tbody = tabla.querySelector('tbody');

    nodo.hijos.forEach(hijo => {
        const tr = document.createElement('tr');
        
        const tdNombre = document.createElement('td');
        tdNombre.innerText = `${hijo.nombre} (${hijo.id})`;
        tr.appendChild(tdNombre);

        const tdInput = document.createElement('td');
        const input = document.createElement('input');
        input.type = "number"; 
        input.step = "0.01"; input.min = "0"; input.max = "1";
        
        const valorPrevio = (nodo.transiciones && nodo.transiciones[hijo.id] !== undefined) 
                            ? nodo.transiciones[hijo.id] 
                            : 0;
        input.value = valorPrevio;
        input.dataset.destinoid = hijo.id;
        
        tdInput.appendChild(input);
        tr.appendChild(tdInput);
        tbody.appendChild(tr);
    });

    const trTotal = document.createElement('tr');
    trTotal.innerHTML = `<td><strong>TOTAL</strong></td><td id='sumaTotal'>0.00</td>`;
    tbody.appendChild(trTotal);

    contenedor.appendChild(tabla);
    
    const inputs = contenedor.querySelectorAll('input');
    
    function actualizarSuma() {
        let suma = 0;
        inputs.forEach(inp => suma += parseFloat(inp.value || 0));
        const visual = document.getElementById('sumaTotal');
        visual.innerText = suma.toFixed(2);
        visual.style.color = Math.abs(suma - 1) < 0.01 ? "green" : "red";
    }
    
    inputs.forEach(inp => inp.addEventListener('input', actualizarSuma));
    actualizarSuma();

    const btnGuardar = document.querySelector('.modal-footer .btn:last-child');
    const nuevoBtn = btnGuardar.cloneNode(true);
    btnGuardar.parentNode.replaceChild(nuevoBtn, btnGuardar);
    nuevoBtn.onclick = guardarTransicionesMarkov;
    nuevoBtn.innerText = "Guardar Transiciones";
    document.getElementById('modalCPT').style.display = 'flex';
}

function guardarTransicionesMarkov() {
    if (!nodoSeleccionadoId) return;
    const nodo = sistema.nodos[nodoSeleccionadoId];
    const inputs = document.querySelectorAll('#tablaContainer input');
    
    let suma = 0;
    const nuevasTransiciones = {};

    inputs.forEach(inp => {
        const val = parseFloat(inp.value);
        if (val < 0) { alert("No se permiten negativos"); return; }
        suma += val;
        nuevasTransiciones[inp.dataset.destinoid] = val;
    });

    if (Math.abs(suma - 1.0) > 0.01) {
        if(!confirm(`La suma de probabilidades es ${suma.toFixed(2)}. Debería ser 1.0. ¿Guardar de todos modos?`)) {
            return;
        }
    }

    nodo.transiciones = nuevasTransiciones;
    sistema.nodos[nodo.id] = nodo;

    agregarLog(`Transiciones actualizadas para ${nodo.nombre}`);
    redibujar();
    cerrarModal();
}

function cerrarModal() {
    document.getElementById('modalCPT').style.display = 'none';
    nodoSeleccionadoId = null;
}

function generarTablaCPT(nodo) {
    const contenedor = document.getElementById('tablaContainer');
    contenedor.innerHTML = "";

    const tabla = document.createElement('table');
    tabla.className = "cpt-table";

    const thead = document.createElement('thead');
    const headerRow = document.createElement('tr');    
    nodo.padres.forEach(p => {
        const th = document.createElement('th');
        th.innerText = p.nombre;
        th.style.backgroundColor = "#eef2ff";
        headerRow.appendChild(th);
    });

    const thTrue = document.createElement('th'); thTrue.innerText = "P(True)";
    const thFalse = document.createElement('th'); thFalse.innerText = "P(False)";
    headerRow.appendChild(thTrue);
    headerRow.appendChild(thFalse);
    thead.appendChild(headerRow);
    tabla.appendChild(thead);

    const tbody = document.createElement('tbody');
    
    let combinaciones = [[]];
    if (nodo.padres.length > 0) {
        const estadosPadres = nodo.padres.map(p => p.estados);
        combinaciones = MathUtils.productoCartesiano(estadosPadres);
    }

    combinaciones.forEach(comb => {
        const tr = document.createElement('tr');
        comb.forEach(estado => {
            const td = document.createElement('td');
            td.innerText = estado;
            tr.appendChild(td);
        });

        const clave = nodo.padres.length === 0 ? "root" : comb.join("_");
        const valActual = nodo.cpt[clave] ? nodo.cpt[clave]["True"] : 0.5;

        const tdInput = document.createElement('td');
        const input = document.createElement('input');
        input.type = "number";
        input.step = "0.01";
        input.min = "0";
        input.max = "1";
        input.value = valActual;
        input.dataset.clave = clave;
        
        input.oninput = function() {
            const val = parseFloat(this.value);
            const celdaFalse = this.parentElement.nextElementSibling;
            if(!isNaN(val) && val >= 0 && val <= 1) {
                celdaFalse.innerText = (1 - val).toFixed(2);
                celdaFalse.style.color = "black";
            } else {
                celdaFalse.innerText = "Error";
                celdaFalse.style.color = "red";
            }
        };

        tdInput.appendChild(input);
        tr.appendChild(tdInput);
        const tdFalse = document.createElement('td');
        tdFalse.innerText = (1 - valActual).toFixed(2);
        tdFalse.style.backgroundColor = "#f9f9f9";
        tr.appendChild(tdFalse);

        tbody.appendChild(tr);
    });

    tabla.appendChild(tbody);
    contenedor.appendChild(tabla);
}

function guardarCPT() {
    if (!nodoSeleccionadoId) return;

    const nodo = sistema.nodos[nodoSeleccionadoId];
    const inputs = document.querySelectorAll('#tablaContainer input');
    const nuevaCPT = {};
    let error = false;

    inputs.forEach(input => {
        const pTrue = parseFloat(input.value);
        const clave = input.dataset.clave;

        if (isNaN(pTrue) || pTrue < 0 || pTrue > 1) {
            error = true;
            input.style.border = "2px solid red";
        } else {
            input.style.border = "1px solid #ccc";
            nuevaCPT[clave] = {
                "True": pTrue,
                "False": parseFloat((1 - pTrue).toFixed(5))
            };
        }
    });

    if (error) {
        alert("Hay valores inválidos. Asegúrate de que estén entre 0.0 y 1.0");
        return;
    }

    nodo.setProbabilidades(nuevaCPT);
    agregarLog(`Probabilidades actualizadas para el nodo ${nodo.nombre}`);
    cerrarModal();
}

// ================================================================
// 8. MODULO DE INFERENCIA
// ================================================================

function actualizarSelectoresInferencia() {
    const selector = document.getElementById('selectorQuery');
    selector.innerHTML = '<option value="">-- Selecciona un Nodo --</option>';

    for (const id in sistema.nodos) {
        const nodo = sistema.nodos[id];
        const option = document.createElement('option');
        option.value = nodo.id;
        option.innerText = nodo.nombre;
        selector.appendChild(option);
    }
    
    document.getElementById('contenedorEvidencia').innerHTML = '<small>Selecciona un nodo arriba primero.</small>';
    document.getElementById('resultadoOutput').style.display = 'none';
}

function actualizarPanelEvidencia() {
    const idQuery = document.getElementById('selectorQuery').value;
    const container = document.getElementById('contenedorEvidencia');
    container.innerHTML = "";

    if (!idQuery) {
        container.innerHTML = '<small style="color: #666; display: block; text-align: center; margin-top: 50px;">Selecciona un nodo arriba primero.</small>';
        return;
    }

    let contador = 0;
    for (const id in sistema.nodos) {
        if (id === idQuery) continue; 

        const nodo = sistema.nodos[id];
        contador++;
        
        const div = document.createElement('div');
        div.style.display = "flex"; 
        div.style.justifyContent = "space-between";
        div.style.alignItems = "center";
        div.style.marginBottom = "8px";
        div.style.paddingBottom = "5px";
        div.style.borderBottom = "1px solid #eee";
        
        const label = document.createElement('span');
        label.innerText = nodo.nombre;
        label.style.fontWeight = "500";
        label.style.fontSize = "13px";
        label.style.color = "#333";
        
        const select = document.createElement('select');
        select.className = "evidencia-selector";
        select.dataset.nodoid = id;
        select.style.padding = "4px";
        select.style.borderRadius = "4px";
        select.style.border = "1px solid #ccc";
        select.style.maxWidth = "120px";

        const optDefault = document.createElement('option');
        optDefault.value = "";
        optDefault.innerText = "---";
        select.appendChild(optDefault);

        nodo.estados.forEach(estado => {
            const opt = document.createElement('option');
            opt.value = estado;
            opt.innerText = estado;
            select.appendChild(opt);
        });

        div.appendChild(label);
        div.appendChild(select);
        container.appendChild(div);
    }
    
    if (contador === 0) {
        container.innerHTML = '<small>No hay otros nodos para usar como evidencia.</small>';
    }
}

 // Recolecta datos y llama a logic.js
 function ejecutarInferencia() {
    const idQuery = document.getElementById('selectorQuery').value;
    if (!idQuery) {
        alert("Por favor selecciona qué variable quieres consultar.");
        return;
    }

    const evidencia = {};
    const selectores = document.querySelectorAll('.evidencia-selector');
    selectores.forEach(sel => {
        if (sel.value !== "") { 
            evidencia[sel.dataset.nodoid] = sel.value;
        }
    });

    const usarEliminacion = document.getElementById('chkAlgoritmoEliminacion').checked;
    const nombreAlgoritmo = usarEliminacion ? "Eliminación de Variables" : "Enumeración Exacta";

    agregarLog(`Iniciando cálculo con: ${nombreAlgoritmo}...`);
    
    try {
        let distribucion;
        
        const t0 = performance.now();

        if (usarEliminacion) {
            distribucion = sistema.inferenciaEliminacion(idQuery, evidencia);
        } else {
            distribucion = sistema.inferenciaEnumeracion(idQuery, evidencia);
        }
        
        const t1 = performance.now();
        agregarLog(`Cálculo completado en ${(t1 - t0).toFixed(2)} ms.`);

        mostrarResultadoInferencia(idQuery, distribucion, evidencia);
    } catch (e) {
        console.error(e);
        alert("Ocurrió un error matemático. Revisa la consola (F12) para detalles.");
    }
}

function mostrarResultadoInferencia(idQuery, dist, evidencia) {
    const output = document.getElementById('resultadoOutput');
    const nodo = sistema.nodos[idQuery];
    
    let html = `<strong>Resultado para ${nodo.nombre}:</strong><br>`;
    
    for (const estado in dist) {
        const prob = dist[estado];
        const porcentaje = (prob * 100).toFixed(2);
        
        const color = prob > 0.5 ? '#28a745' : '#dc3545';
        
        html += `
            <div style="margin-top: 5px;">
                <div style="display:flex; justify-content:space-between;">
                    <span>${estado}:</span>
                    <span>${porcentaje}%</span>
                </div>
                <div style="background:#ddd; height:8px; border-radius:4px; overflow:hidden;">
                    <div style="background:${color}; width:${porcentaje}%; height:100%;"></div>
                </div>
            </div>
        `;
    }

    output.innerHTML = html;
    output.style.display = 'block';    
    agregarLog(`Resultado: ${JSON.stringify(dist)}`);
}

function calcularMarkov() {
    const errores = sistema.validarMatriz();
    if (errores.length > 0) {
        alert("Advertencia: La matriz no es válida (las sumas no dan 1):\n- " + errores.join("\n- "));
    }

    const estacionaria = sistema.calcularEstacionaria();
    if (!estacionaria) return;

    const div = document.getElementById('resultadoMarkov');
    div.style.display = 'block';
    let html = "<strong>Probabilidades a largo plazo:</strong><br>";

    for (const id in estacionaria) {
        const prob = estacionaria[id];
        const porcentaje = (prob * 100).toFixed(2);
        const nombre = sistema.nodos[id].nombre;
        
        html += `
            <div style="margin-top: 8px;">
                <div style="display:flex; justify-content:space-between; font-size:14px;">
                    <span>${nombre}:</span>
                    <strong>${porcentaje}%</strong>
                </div>
                <div style="background:#ddd; height:6px; border-radius:3px; margin-top:2px;">
                    <div style="background:#6f42c1; width:${porcentaje}%; height:100%;"></div>
                </div>
            </div>
        `;
    }
    div.innerHTML = html;
    agregarLog("Cálculo estacionario completado.");
}

function editarEmisionesHMM(nodo) {
    document.getElementById('modalTitulo').innerText = `Emisiones de: ${nodo.nombre}`;
    document.getElementById('modalDescripcion').innerText = "Define la probabilidad de observar cada síntoma/objeto dado este estado.";
    
    const contenedor = document.getElementById('tablaContainer');
    contenedor.innerHTML = "";

    const tabla = document.createElement('table');
    tabla.className = "cpt-table";
    tabla.innerHTML = `
        <thead>
            <tr><th>Observación (Texto)</th><th>Probabilidad</th><th>Acción</th></tr>
        </thead>
        <tbody id="bodyEmisiones"></tbody>
    `;
    contenedor.appendChild(tabla);

    const btnAdd = document.createElement('button');
    btnAdd.innerText = "+ Agregar Observación";
    btnAdd.className = "btn";
    btnAdd.style.fontSize = "12px"; btnAdd.style.padding = "5px";
    btnAdd.onclick = () => agregarFilaEmision("", 0);
    contenedor.appendChild(btnAdd);
    const tbody = tabla.querySelector('tbody');

    function agregarFilaEmision(nombre, prob) {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td><input type="text" value="${nombre}" placeholder="Ej: Tos" class="obs-name"></td>
            <td><input type="number" step="0.01" value="${prob}" class="obs-prob"></td>
            <td><button onclick="this.parentElement.parentElement.remove()" style="color:red;">X</button></td>
        `;
        tbody.appendChild(tr);
    }

    if (nodo.emisiones) {
        for (const [obs, prob] of Object.entries(nodo.emisiones)) {
            agregarFilaEmision(obs, prob);
        }
    }

    const btnGuardar = document.querySelector('.modal-footer .btn:last-child');
    const nuevoBtn = btnGuardar.cloneNode(true);
    btnGuardar.parentNode.replaceChild(nuevoBtn, btnGuardar);
    nuevoBtn.innerText = "Guardar Emisiones";
    
    nuevoBtn.onclick = () => {
        const nuevasEmisiones = {};
        const filas = tbody.querySelectorAll('tr');
        let suma = 0;
        
        filas.forEach(tr => {
            const nombre = tr.querySelector('.obs-name').value.trim();
            const prob = parseFloat(tr.querySelector('.obs-prob').value);
            if(nombre && !isNaN(prob)) {
                nuevasEmisiones[nombre] = prob;
                suma += prob;
            }
        });
        
        if (Math.abs(suma - 1.0) > 0.01) alert("Advertencia: Las emisiones deberían sumar 1.0");

        nodo.emisiones = nuevasEmisiones;
        agregarLog(`Emisiones actualizadas para ${nodo.nombre}`);
        cerrarModal();
    };

    document.getElementById('modalCPT').style.display = 'flex';
}

function calcularViterbi() {
    const input = document.getElementById('inputSecuencia').value;
    if (!input) { alert("Escribe una secuencia de observaciones."); return; }
    const observaciones = input.split(',').map(s => s.trim());
    
    agregarLog(`Decodificando secuencia: ${observaciones.join(" -> ")}`);
    
    try {
        const caminoIds = sistema.viterbi(observaciones);
        
        // Mostrar resultado
        const div = document.getElementById('resultadoHMM');
        div.style.display = 'block';
        
        // Convertir IDs a Nombres
        const caminoNombres = caminoIds.map(id => sistema.nodos[id].nombre);
        
        div.innerHTML = `
            <strong>Secuencia Oculta Más Probable:</strong><br>
            <div style="font-size: 18px; margin-top: 10px; color: #d63384;">
                ${caminoNombres.join(" ➡ ")}
            </div>
        `;
        
        network.selectNodes(caminoIds);
        
    } catch (e) {
        console.error(e);
        alert("Error en Viterbi. Revisa que las observaciones existan en tus tablas de emisión.");
    }
}

function calcularForward() {
    const input = document.getElementById('inputSecuencia').value;
    if (!input) { alert("Escribe una secuencia de observaciones."); return; }
    
    const observaciones = input.split(',').map(s => s.trim());
    
    agregarLog(`Calculando probabilidad Forward para: ${observaciones.join(", ")}`);
    
    try {
        const probabilidad = sistema.forward(observaciones);
        
        const div = document.getElementById('resultadoHMM');
        div.style.display = 'block';
        
        let textoProb = probabilidad.toFixed(6);
        if (probabilidad < 0.0001 && probabilidad > 0) {
            textoProb = probabilidad.toExponential(4);
        }
        const porcentaje = (probabilidad * 100).toFixed(4) + "%";
        
        div.innerHTML = `
            <div style="border-bottom:1px solid #fcc2d7; padding-bottom:10px; margin-bottom:10px;">
                <strong>Probabilidad de la Secuencia (Forward):</strong><br>
                <span style="font-size: 24px; color: #0aa2c0; font-weight: bold;">
                    ${textoProb}
                </span>
                <span style="color: #666;">(${porcentaje})</span>
            </div>
            ${div.innerHTML} 
        `;
        
    } catch (e) {
        console.error(e);
        alert("Error en Forward. Revisa tus probabilidades.");
    }
}

function calcularForwardBackward() {
    const input = document.getElementById('inputSecuencia').value;
    if (!input) { alert("Escribe una secuencia de observaciones."); return; }
    
    const observaciones = input.split(',').map(s => s.trim());
    agregarLog(`Calculando suavizado (Forward-Backward)...`);

    try {
        const gamma = sistema.forwardBackward(observaciones);
        
        const div = document.getElementById('resultadoHMM');
        div.style.display = 'block';

        let htmlTabla = `
            <div style="margin-top: 15px; border-top: 1px solid #ddd; padding-top: 10px;">
                <strong>Probabilidades Suavizadas (P(Estado | Toda la Secuencia)):</strong>
                <table class="cpt-table" style="font-size: 13px; margin-top: 5px;">
                    <thead>
                        <tr>
                            <th>Tiempo (t)</th>
                            <th>Observación</th>
                            ${Object.values(sistema.nodos).map(n => `<th>${n.nombre}</th>`).join('')}
                        </tr>
                    </thead>
                    <tbody>
        `;

        gamma.forEach((paso, t) => {
            htmlTabla += `<tr>`;
            htmlTabla += `<td>t=${t}</td>`;
            htmlTabla += `<td><strong>${observaciones[t]}</strong></td>`;
            
            Object.values(sistema.nodos).forEach(n => {
                const prob = paso[n.id];
                const porc = (prob * 100).toFixed(1) + "%";
                const estilo = prob > 0.5 ? "font-weight:bold; color:#d9660a; background:#fff3cd;" : "";
                
                htmlTabla += `<td style="${estilo}">${porc}</td>`;
            });
            htmlTabla += `</tr>`;
        });

        htmlTabla += `</tbody></table></div>`;

        div.innerHTML += htmlTabla;
        
    } catch (e) {
        console.error(e);
        alert("Error en Forward-Backward.");
    }
}


 // Ejemplo 2: Red Médica (Gripe -> Síntomas)
 function crearEjemploMedica() {
    const gripe = sistema.agregarNodo("G", "Gripe");
    const alergia = sistema.agregarNodo("A", "Alergia");
    const tos = sistema.agregarNodo("T", "Tos");
    const fiebre = sistema.agregarNodo("F", "Fiebre");

    sistema.conectar("G", "T"); // Gripe causa Tos
    sistema.conectar("G", "F"); // Gripe causa Fiebre
    sistema.conectar("A", "T"); // Alergia causa Tos

    // Probabilidades
    gripe.setProbabilidades({ "root": { "True": 0.05, "False": 0.95 } });   // 5% tiene gripe
    alergia.setProbabilidades({ "root": { "True": 0.40, "False": 0.60 } }); // 40% tiene alergia

    // Fiebre (Depende de Gripe)
    fiebre.setProbabilidades({
        "True":  { "True": 0.90, "False": 0.10 },
        "False": { "True": 0.01, "False": 0.99 }
    });

    // Tos (Depende de Gripe y Alergia)
    tos.setProbabilidades({
        "True_True":   { "True": 0.95, "False": 0.05 },
        "True_False":  { "True": 0.80, "False": 0.20 },
        "False_True":  { "True": 0.70, "False": 0.30 },
        "False_False": { "True": 0.05, "False": 0.95 }
    });
}


 // Ejemplo 3: Diagnóstico de Fallas
 function crearEjemploFallas() {
    const energia = sistema.agregarNodo("E", "Falla Energía");
    const disco = sistema.agregarNodo("D", "Falla Disco");
    const pantalla = sistema.agregarNodo("P", "Pantalla Azul");
    const inicio = sistema.agregarNodo("I", "Error Inicio");

    sistema.conectar("E", "I"); // Sin energia falla el inicio
    sistema.conectar("D", "I"); // Disco dañado falla el inicio
    sistema.conectar("D", "P"); // Disco dañado causa pantalla azul

    energia.setProbabilidades({ "root": { "True": 0.10, "False": 0.90 } });
    disco.setProbabilidades({ "root": { "True": 0.05, "False": 0.95 } });

    // Pantalla Azul (dado Disco)
    pantalla.setProbabilidades({
        "True":  { "True": 0.90, "False": 0.10 },
        "False": { "True": 0.01, "False": 0.99 }
    });

    // Error Inicio (dado Energia y Disco)
    inicio.setProbabilidades({
        "True_True":   { "True": 1.00, "False": 0.00 },
        "True_False":  { "True": 1.00, "False": 0.00 }, // Si falla energíi, falla inicio seguro
        "False_True":  { "True": 0.80, "False": 0.20 },
        "False_False": { "True": 0.00, "False": 1.00 }
    });
}


 // Ejemplo 4: Predicción Climática
 function crearEjemploClima() {
    const nublado = sistema.agregarNodo("N", "Nublado");
    const aspersor = sistema.agregarNodo("A", "Aspersor"); // Riego automatico
    const lluvia = sistema.agregarNodo("L", "Lluvia");
    const pasto = sistema.agregarNodo("P", "Pasto Mojado");

    sistema.conectar("N", "A"); // Si esta nublado, apagamos el aspersor
    sistema.conectar("N", "L"); // Si esta nublado, es probable que llueva
    sistema.conectar("A", "P"); // Aspersor moja el pasto
    sistema.conectar("L", "P"); // Lluvia moja el pasto

    nublado.setProbabilidades({ "root": { "True": 0.50, "False": 0.50 } });

    // Aspersor (P(A=True|Nublado=True) es bajo)
    aspersor.setProbabilidades({
        "True":  { "True": 0.10, "False": 0.90 },
        "False": { "True": 0.50, "False": 0.50 }
    });

    // Lluvia (P(L=True|Nublado=True) es alto)
    lluvia.setProbabilidades({
        "True":  { "True": 0.80, "False": 0.20 },
        "False": { "True": 0.20, "False": 0.80 }
    });

    // Pasto Mojado (Depende de Aspersor y Shuvia)
    pasto.setProbabilidades({
        "True_True":   { "True": 0.99, "False": 0.01 },
        "True_False":  { "True": 0.90, "False": 0.10 },
        "False_True":  { "True": 0.90, "False": 0.10 },
        "False_False": { "True": 0.00, "False": 1.00 }
    });
}

 // Ejemplo Markov: Clima (Simple)
 function crearEjemploClimaMarkov() {
    const sol = sistema.agregarNodo("S", "Sol");
    const lluvia = sistema.agregarNodo("L", "Lluvia");

    sistema.conectar("S", "S"); // Mañana sigue Soleado
    sistema.conectar("S", "L"); // Mañana llueve
    sistema.conectar("L", "L"); // Mañana sigue lloviendo
    sistema.conectar("L", "S"); // Mañana sale sol

    // Probabilidades de Transicion
    // Sol tiende a quedarse (0.8), Lluvia cambia mas rápido (0.6 a Sol)
    sistema.setProbabilidadTransicion("S", "S", 0.8);
    sistema.setProbabilidadTransicion("S", "L", 0.2);
    
    sistema.setProbabilidadTransicion("L", "L", 0.4);
    sistema.setProbabilidadTransicion("L", "S", 0.6);
}


 // Ejemplo HMM: Diagnóstico Médico (Oculto: Salud, Visible: Sintomas)
function crearEjemploMedicoHMM() {
    // Estados Ocultos
    const sano = sistema.agregarNodo("S", "Sano");
    const enfermo = sistema.agregarNodo("E", "Enfermo");

    // Transiciones
    sistema.conectar("S", "S"); sistema.setProbabilidadTransicion("S", "S", 0.7);
    sistema.conectar("S", "E"); sistema.setProbabilidadTransicion("S", "E", 0.3);
    sistema.conectar("E", "E"); sistema.setProbabilidadTransicion("E", "E", 0.6);
    sistema.conectar("E", "S"); sistema.setProbabilidadTransicion("E", "S", 0.4);

    // Emisiones (Matriz B) - Observaciones: "Normal", "Mareo", "Fiebre"
    sano.emisiones = {
        "Normal": 0.80,
        "Mareo": 0.15,
        "Fiebre": 0.05
    };

    enfermo.emisiones = {
        "Normal": 0.10,
        "Mareo": 0.50,
        "Fiebre": 0.40
    };
    
    agregarLog("Ejemplo cargado. Prueba la secuencia: Mareo, Fiebre, Normal");
}