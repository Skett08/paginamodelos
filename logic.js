/**
 * Motor matematico del proyecto.
 * Contiene: Redes Bayesianas, Cadenas de Markov, HMM.
 */

// ================================================================
// 1. UTILIDADES MATEMATICAS
// ================================================================

const MathUtils = {
    
    // Normaliza una distribución de probabilidad para que sume 1.
    normalizar: (distribucion) => {
        const suma = Object.values(distribucion).reduce((a, b) => a + b, 0);
        if (suma === 0) return distribucion;
        
        const normalizada = {};
        for (let estado in distribucion) {
            normalizada[estado] = distribucion[estado] / suma;
        }
        return normalizada;
    },

    
    // Genera las combinaciones de la Tabla de Probabilidad (CPT) 
    productoCartesiano: (arrays) => {
        return arrays.reduce((acc, curr) => 
            acc.flatMap(a => curr.map(c => [].concat(a, c))), [[]]
        );
    },

    multiplicarVectorMatriz: (vector, matriz) => {
        const resultado = new Array(vector.length).fill(0);
        for (let j = 0; j < vector.length; j++) {
            for (let i = 0; i < vector.length; i++) {
                resultado[j] += vector[i] * matriz[i][j];
            }
        }
        return resultado;
    },

    sonIguales: (v1, v2, tolerancia = 0.0001) => {
        for (let i = 0; i < v1.length; i++) {
            if (Math.abs(v1[i] - v2[i]) > tolerancia) return false;
        }
        return true;
    }
};

// ================================================================
// 2. REDES BAYESIANAS
// ================================================================

class NodoBayesiano {
    constructor(id, nombre, estados = ["True", "False"]) {
        this.id = id;
        this.nombre = nombre;
        this.estados = estados;
        this.padres = [];
        this.hijos = [];
        this.cpt = {}; 
    }

    agregarPadre(nodoPadre) {
        if (!this.padres.includes(nodoPadre)) {
            this.padres.push(nodoPadre);
            nodoPadre.hijos.push(this);
        }
    }

    // Establece las probabilidades condicionales.
    setProbabilidades(tabla) {
        this.cpt = tabla;
    }


    // Obtiene la probabilidad de que este nodo esté en un estado 'x', dados los estados de sus padres.
    getProbabilidad(estadoInteres, evidenciaPadres) {
        if (this.padres.length === 0) { // 1. Si no tiene padres, es probabilidad a priori
            return this.cpt["root"] ? this.cpt["root"][estadoInteres] : 0;
        }

    // 2. Construir la clave de búsqueda basada en el orden de los padres
        const clave = this.padres.map(p => evidenciaPadres[p.id]).join("_");

        if (this.cpt[clave] && this.cpt[clave][estadoInteres] !== undefined) {
            return this.cpt[clave][estadoInteres];
        } else {
            console.error(`Clave CPT no encontrada para ${this.nombre}: ${clave}`);
            return 0;
        }
    }
}

class RedBayesiana {
    constructor() {
        this.nodos = {};
    }

    agregarNodo(id, nombre, estados) {
        const nuevoNodo = new NodoBayesiano(id, nombre, estados);
        this.nodos[id] = nuevoNodo;
        return nuevoNodo;
    }

    conectar(idPadre, idHijo) {
        if (this.nodos[idPadre] && this.nodos[idHijo]) {
            this.nodos[idHijo].agregarPadre(this.nodos[idPadre]);
        }
    }

    // Algoritmo 1: Inferencia por Enumeración (Exacta).
    inferenciaEnumeracion(idQuery, evidencia) {
        const nodoQuery = this.nodos[idQuery];
        const distribucion = {};

        for (let estado of nodoQuery.estados) {
            const evidenciaExtendida = { ...evidencia, [idQuery]: estado };
            distribucion[estado] = this.enumerarTodo(Object.values(this.nodos), evidenciaExtendida);
        }

        return MathUtils.normalizar(distribucion);
    }

    // Función recursiva auxiliar para Enumeración.
    enumerarTodo(vars, evidencia) {
        if (vars.length === 0) return 1.0;

        const Y = vars[0];
        const resto = vars.slice(1);

        if (evidencia[Y.id]) {
            const prob = Y.getProbabilidad(evidencia[Y.id], evidencia);
            return prob * this.enumerarTodo(resto, evidencia);
        } else {
            let suma = 0;
            for (let estado of Y.estados) {
                const evidenciaExtendida = { ...evidencia, [Y.id]: estado };
                const prob = Y.getProbabilidad(estado, evidenciaExtendida);
                suma += prob * this.enumerarTodo(resto, evidenciaExtendida);
            }
            return suma;
        }
    }
}

// ================================================================
// 3. CADENAS DE MARKOV (Markov Chain)
// ================================================================

class CadenaMarkov {
    constructor() {
        this.estados = [];
        this.matrizTransicion = [];
        this.nodos = {};
    }

    setEstados(listaEstados) {
        this.estados = listaEstados;
    }

    setMatriz(matriz) {
        // Validar que filas sumen 1
        this.matrizTransicion = matriz;
    }

    agregarNodo(id, nombre) {
        // Es idéntico a Bayes, solo que aquí representan "Estados"
        const nuevoEstado = new NodoBayesiano(id, nombre, []); 
        this.nodos[id] = nuevoEstado;
        return nuevoEstado;
    }
    conectar(idOrigen, idDestino) {
        const origen = this.nodos[idOrigen];
        const destino = this.nodos[idDestino];
        
        if (!origen.hijos.includes(destino)) {
            origen.hijos.push(destino);
            destino.padres.push(origen);
        }
    }
    
    setProbabilidadTransicion(idOrigen, idDestino, probabilidad) {
        const origen = this.nodos[idOrigen];
        if (!origen.transiciones) origen.transiciones = {};
        
        origen.transiciones[idDestino] = probabilidad;
    }
    
    // Valida que la suma de transiciones salientes de cada estado sea 1. 
    validarMatriz() {
        const errores = [];
        for (const id in this.nodos) {
            const nodo = this.nodos[id];
            let suma = 0;
            if (nodo.transiciones) {
                suma = Object.values(nodo.transiciones).reduce((a, b) => a + b, 0);
            }
            
            if (Math.abs(suma - 1.0) > 0.01) {
                errores.push(`El estado ${nodo.nombre} suma ${suma.toFixed(2)} (debe ser 1.0)`);
            }
        }
        return errores;
    }
    
    calcularEstacionaria() {
        // 1. Convertir el grafo a una matriz numérica NxN
        const ids = Object.keys(this.nodos);
        const N = ids.length;
        if (N === 0) return null;
        const matriz = Array(N).fill(0).map(() => Array(N).fill(0));
        ids.forEach((idOrigen, i) => {
            const nodo = this.nodos[idOrigen];
            ids.forEach((idDestino, j) => {
                if (nodo.transiciones && nodo.transiciones[idDestino]) {
                    matriz[i][j] = nodo.transiciones[idDestino];
                }
            });
        });

        // 2. Método de las Potencias
        let vector = Array(N).fill(1 / N);
        let iteraciones = 0;
        const maxIter = 1000;

        while (iteraciones < maxIter) {
            const nuevoVector = MathUtils.multiplicarVectorMatriz(vector, matriz);
            
            if (MathUtils.sonIguales(vector, nuevoVector)) {
                break;
            }
            
            vector = nuevoVector;
            iteraciones++;
        }

        // Retornar resultado mapeado a los IDs
        const resultado = {};
        ids.forEach((id, i) => {
            resultado[id] = vector[i];
        });
        
        return resultado;
    }
}

// ================================================================
// 4. MODELOS OCULTOS DE MARKOV (HMM)
// ================================================================

class HMM {
    constructor() {
        this.nodos = {};
    }

    agregarNodo(id, nombre) {
        const nuevoEstado = new NodoBayesiano(id, nombre);
        nuevoEstado.transiciones = {};
        nuevoEstado.emisiones = {};
        this.nodos[id] = nuevoEstado;
        return nuevoEstado;
    }

    conectar(idOrigen, idDestino) {
        const origen = this.nodos[idOrigen];
        const destino = this.nodos[idDestino];
        if(!origen.hijos.includes(destino)) {
            origen.hijos.push(destino);
            destino.padres.push(origen);
        }
    }

    setProbabilidadTransicion(idOrigen, idDestino, probabilidad) {
        const origen = this.nodos[idOrigen];
        if (!origen.transiciones) origen.transiciones = {};
        origen.transiciones[idDestino] = probabilidad;
    }

    setEmision(idEstado, observacion, probabilidad) {
        const estado = this.nodos[idEstado];
        estado.emisiones[observacion] = probabilidad;
    }

    // Algoritmo de Viterbi
    viterbi(observaciones) {
        const estados = Object.values(this.nodos);
        const T = observaciones.length;
        if (T === 0 || estados.length === 0) return [];

        let delta = []; 
        let psi = [];   

        // 1. Inicializacion (t = 0)
        let paso0 = {};
        let psi0 = {};
        const pi = 1.0 / estados.length; 

        estados.forEach(estado => {
            const obs = observaciones[0];
            const b = estado.emisiones[obs] || 1e-10; 
            paso0[estado.id] = Math.log(pi) + Math.log(b);
            psi0[estado.id] = null;
        });
        delta.push(paso0);
        psi.push(psi0);

        // 2. Recursion (t = 1 hasta T-1)
        for (let t = 1; t < T; t++) {
            let pasoActual = {};
            let psiActual = {};
            const obs = observaciones[t];
            estados.forEach(estadoJ => {
                let maxProb = -Infinity;
                let mejorEstadoPrevio = null;
                const b = estadoJ.emisiones[obs] || 1e-10;

                estados.forEach(estadoI => {
                    const probPrev = delta[t-1][estadoI.id];
                    // PROTECCIÓN 2: Validación extra para transiciones
                    const a_ij = (estadoI.transiciones && estadoI.transiciones[estadoJ.id]) || 1e-10;
                    const prob = probPrev + Math.log(a_ij) + Math.log(b);
                    if (prob > maxProb) {
                        maxProb = prob;
                        mejorEstadoPrevio = estadoI.id;
                    }
                });

                pasoActual[estadoJ.id] = maxProb;
                psiActual[estadoJ.id] = mejorEstadoPrevio;
            });

            delta.push(pasoActual);
            psi.push(psiActual);
        }

        // 3. Terminacion y Backtracking
        let maxProbFinal = -Infinity;
        let mejorEstadoFinal = null;
        
        estados.forEach(e => {
            const val = delta[T-1][e.id];
            if (val > maxProbFinal) {
                maxProbFinal = val;
                mejorEstadoFinal = e.id;
            }
        });

        if (!mejorEstadoFinal) {
            console.warn("Viterbi: No se encontro camino probable. Usando estado por defecto.");
            mejorEstadoFinal = estados[0].id;
        }

        const camino = [mejorEstadoFinal];
        let estadoActual = mejorEstadoFinal;

        for (let t = T - 1; t > 0; t--) {
            let previo = psi[t][estadoActual]; // Vuelve al estadio previo si psi es null
            
            if (!previo) {
                let mejorRescate = null;
                let maxRescate = -Infinity;
                estados.forEach(e => {
                    if (delta[t-1][e.id] > maxRescate) {
                        maxRescate = delta[t-1][e.id];
                        mejorRescate = e.id;
                    }
                });
                previo = mejorRescate || estados[0].id;
            }
            
            estadoActual = previo;
            camino.unshift(estadoActual);
        }

        return camino;
    }

     // Algoritmo Forward
    forward(observaciones) {
        const estados = Object.values(this.nodos);
        const T = observaciones.length;
        if (T === 0 || estados.length === 0) return 0;

        let alpha = [];

        // 1. Inicializacion (t = 0)
        let paso0 = {};
        const pi = 1.0 / estados.length;

        estados.forEach(estado => {
            const obs = observaciones[0];
            const b = estado.emisiones[obs] || 0; 
            paso0[estado.id] = pi * b;
        });
        alpha.push(paso0);

        // 2. Recursion (t = 1 hasta T - 1)
        for (let t = 1; t < T; t++) {
            let pasoActual = {};
            const obs = observaciones[t];

            estados.forEach(estadoJ => {
                let suma = 0;
                const b = estadoJ.emisiones[obs] || 0;

                // Suma sobre todos los estados previos posibles
                estados.forEach(estadoI => {
                    const alphaPrev = alpha[t-1][estadoI.id];
                    const a_ij = (estadoI.transiciones && estadoI.transiciones[estadoJ.id]) || 0;
                    
                    suma += alphaPrev * a_ij;
                });

                pasoActual[estadoJ.id] = suma * b;
            });
            alpha.push(pasoActual);
        }

        // 3. Suma total de las probabilidades finales
        let probabilidadTotal = 0;
        estados.forEach(e => {
            probabilidadTotal += alpha[T-1][e.id];
        });

        return probabilidadTotal;
    }

    // Algoritmo Forward-Backward (Suavizado)
    forwardBackward(observaciones) {
        const estados = Object.values(this.nodos);
        const T = observaciones.length;
        if (T === 0 || estados.length === 0) return null;

        const N = estados.length;

        // 1. FORWARD (Alpha)
        let alpha = [];
        
        // Inicializacion (t = 0)
        let alpha0 = {};
        const pi = 1.0 / N;
        estados.forEach(e => {
            const b = e.emisiones[observaciones[0]] || 1e-10;
            alpha0[e.id] = pi * b;
        });
        alpha.push(alpha0);

        // Recursion Forward
        for (let t = 1; t < T; t++) {
            let actual = {};
            estados.forEach(j => {
                let suma = 0;
                const b = j.emisiones[observaciones[t]] || 1e-10;
                
                estados.forEach(i => {
                    const prev = alpha[t-1][i.id];
                    const a = (i.transiciones && i.transiciones[j.id]) || 1e-10;
                    suma += prev * a;
                });
                actual[j.id] = suma * b;
            });
            alpha.push(actual);
        }

        // 2. BACKWARD (Beta)
        let beta = new Array(T).fill(null).map(() => ({}));
        
        // Inicializacion (t = T - 1): Beta es 1.0 para todos
        estados.forEach(e => {
            beta[T-1][e.id] = 1.0;
        });

        // Recursion Backward (desde T - 2 hasta 0)
        for (let t = T - 2; t >= 0; t--) {
            estados.forEach(i => {
                let suma = 0;
                estados.forEach(j => {
                    const a = (i.transiciones && i.transiciones[j.id]) || 1e-10;
                    const b = j.emisiones[observaciones[t+1]] || 1e-10;
                    const betaNext = beta[t+1][j.id];
                    
                    suma += a * b * betaNext;
                });
                beta[t][i.id] = suma;
            });
        }

        // 3. SUAVIZADO (Gamma)
        let gamma = []; // Resultado final

        for (let t = 0; t < T; t++) {
            let gammaPaso = {};
            let sumaNormalizacion = 0;

            // Calcular numerador (Alpha * Beta)
            estados.forEach(e => {
                const val = alpha[t][e.id] * beta[t][e.id];
                gammaPaso[e.id] = val;
                sumaNormalizacion += val;
            });

            if (sumaNormalizacion === 0) sumaNormalizacion = 1e-10;

            estados.forEach(e => {
                gammaPaso[e.id] = gammaPaso[e.id] / sumaNormalizacion;
            });

            gamma.push(gammaPaso);
        }

        return gamma;
    }
}

// ================================================================
// 5. CLASES AUXILIARES PARA ELIMINACION DE VARIABLES
// ================================================================

class Factor {
    constructor(variables, valores) {
        this.variables = variables;
        this.valores = valores;
    }

    // Producto Punto a Punto
    multiplicar(otroFactor) {
        const nuevasVars = [...new Set([...this.variables, ...otroFactor.variables])];
        const nuevoValores = {};
        for (let clave1 in this.valores) {
            for (let clave2 in otroFactor.valores) {
                if (this.sonCompatibles(clave1, clave2, this.variables, otroFactor.variables)) {
                    // Unir claves
                    const combinada = this.unirClaves(clave1, clave2, this.variables, otroFactor.variables, nuevasVars);
                    const val = this.valores[clave1] * otroFactor.valores[clave2];
                    nuevoValores[combinada] = val;
                }
            }
        }
        return new Factor(nuevasVars, nuevoValores);
    }

    // Suma sobre una variable para eliminarla
    sumarFuera(idVarEliminar) {
        const indice = this.variables.indexOf(idVarEliminar);
        if (indice === -1) return this;

        const nuevasVars = this.variables.filter(v => v !== idVarEliminar);
        const nuevoValores = {};

        for (let clave in this.valores) {
            const estados = clave.split("_");
            const estadosRestantes = estados.filter((_, i) => i !== indice);
            const nuevaClave = estadosRestantes.join("_");

            if (!nuevoValores[nuevaClave]) nuevoValores[nuevaClave] = 0;
            nuevoValores[nuevaClave] += this.valores[clave];
        }

        return new Factor(nuevasVars, nuevoValores);
    }

    // Helpers internos para manejo de strings de claves
    sonCompatibles(clave1, clave2, vars1, vars2) {
        const estados1 = clave1.split("_");
        const estados2 = clave2.split("_");
        
        for (let i = 0; i < vars1.length; i++) {
            const varComun = vars1[i];
            const idxEn2 = vars2.indexOf(varComun);
            if (idxEn2 !== -1) {
                if (estados1[i] !== estados2[idxEn2]) return false;
            }
        }
        return true;
    }

    unirClaves(clave1, clave2, vars1, vars2, nuevasVars) {
        const estados1 = clave1.split("_");
        const estados2 = clave2.split("_");
        const resultado = [];

        nuevasVars.forEach(v => {
            const idx1 = vars1.indexOf(v);
            if (idx1 !== -1) resultado.push(estados1[idx1]);
            else {
                const idx2 = vars2.indexOf(v);
                resultado.push(estados2[idx2]);
            }
        });
        return resultado.join("_");
    }
}

// =============================
// EXTENSION DE RED BAYESIANA
// =============================

RedBayesiana.prototype.inferenciaEliminacion = function(idQuery, evidencia) {
    // 1. Crear Factores Iniciales
    let factores = [];
    
    for (const id in this.nodos) {
        const nodo = this.nodos[id];
        const varsFactor = [...nodo.padres.map(p => p.id), nodo.id];
        const tablaFactor = {};      
        const todosEstados = varsFactor.map(vid => this.nodos[vid].estados);
        const combinaciones = MathUtils.productoCartesiano(todosEstados);

        combinaciones.forEach(comb => {
            let compatible = true;
            varsFactor.forEach((vid, idx) => {
                if (evidencia[vid] && evidencia[vid] !== comb[idx]) compatible = false;
            });

            if (compatible) {
                const estadoNodo = comb[comb.length - 1];
                const estadosPadres = comb.slice(0, comb.length - 1);
                
                const clavePadres = nodo.padres.length === 0 ? "root" : estadosPadres.join("_");
                const prob = nodo.cpt[clavePadres] ? nodo.cpt[clavePadres][estadoNodo] : 0;
                const varsFinales = [];
                const estadosFinales = [];
                
                varsFactor.forEach((vid, idx) => {
                    if (!evidencia[vid]) {
                        varsFinales.push(vid);
                        estadosFinales.push(comb[idx]);
                    }
                });
                
                const claveFinal = varsFinales.length > 0 ? estadosFinales.join("_") : "constante";
                if (!tablaFactor[claveFinal]) tablaFactor[claveFinal] = 0;
                tablaFactor[claveFinal] += prob; // Sumar por si colapsan varias filas
            }
        });
        
        const varsEnFactor = varsFactor.filter(v => !evidencia[v]);
        factores.push(new Factor(varsEnFactor, tablaFactor));
    }

    // 2. Determina el orden de eliminacion
    const varsOcultas = Object.keys(this.nodos).filter(id => id !== idQuery && !evidencia[id]);
    
    // 3. Proceso de Eliminacion
    varsOcultas.forEach(varEliminar => {
        const factoresConVar = factores.filter(f => f.variables.includes(varEliminar));
        const factoresSinVar = factores.filter(f => !f.variables.includes(varEliminar));
        
        if (factoresConVar.length > 0) {
            let nuevoFactor = factoresConVar[0];
            for (let i = 1; i < factoresConVar.length; i++) {
                nuevoFactor = nuevoFactor.multiplicar(factoresConVar[i]);
            }
            
            nuevoFactor = nuevoFactor.sumarFuera(varEliminar);            
            factores = [...factoresSinVar, nuevoFactor];
        }
    });

    // 4. Multiplicar Factores Restantes
    let factorFinal = factores[0];
    for (let i = 1; i < factores.length; i++) {
        factorFinal = factorFinal.multiplicar(factores[i]);
    }

    // 5. Normalizacion
    return MathUtils.normalizar(factorFinal.valores);
};