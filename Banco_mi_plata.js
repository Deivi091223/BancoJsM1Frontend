// ==========================================================================
// SISTEMA BANCARIO "MI PLATA" - Taller de Programación
// ==========================================================================
// Esta aplicación funciona 100% por consola del navegador: no está
// vinculada a botones ni campos de un HTML. Toda la interacción se hace
// con prompt() (para pedir datos) y alert()/console.log() (para mostrar
// resultados). Los datos se guardan en localStorage, así que si cierras
// y vuelves a abrir la consola, los usuarios y sus saldos siguen ahí.
//
// CÓMO EJECUTARLA:
// 1. Abre cualquier página en Chrome/Firefox/Edge.
// 2. Abre las herramientas de desarrollador (F12) y ve a la pestaña "Console".
// 3. Pega todo este archivo y presiona Enter.
// 4. El menú principal aparecerá como una ventana de "prompt".
//
// (Los mensajes de movimientos se ven en la consola con console.table,
// así que después de "Consultar movimientos" revisa la pestaña Console).
// ==========================================================================

const CLAVE_STORAGE = "miPlataUsuarios";
const MAX_INTENTOS = 3;
const HORAS_BLOQUEO = 24;

// Credenciales del usuario "master" (administrador). No es un usuario más
// dentro de la lista de clientes: es un acceso aparte, fijo, para tareas
// de administración (ver saldos de todos, desbloquear cuentas).
const ADMIN_USUARIO = "admin";
const ADMIN_CLAVE = "admin123";

// ======================== PERSISTENCIA (localStorage) ========================

// Lee la lista completa de usuarios guardada en localStorage.
// Si todavía no hay nada guardado, devuelve una lista vacía.
function cargarUsuarios() {
  const datos = localStorage.getItem(CLAVE_STORAGE);
  return datos ? JSON.parse(datos) : [];
}

// Guarda la lista completa de usuarios en localStorage.
function guardarUsuarios(usuarios) {
  localStorage.setItem(CLAVE_STORAGE, JSON.stringify(usuarios));
}

// Busca un usuario específico dentro de la lista de usuarios y guarda
// solo sus cambios (saldo, movimientos, intentos, bloqueo) en localStorage.
function guardarCambiosUsuario(usuarioObj) {
  const usuarios = cargarUsuarios();
  for (let i = 0; i < usuarios.length; i++) {
    if (usuarios[i].usuario === usuarioObj.usuario) {
      usuarios[i] = usuarioObj;
      break;
    }
  }
  guardarUsuarios(usuarios);
}

// ============================== UTILIDADES ==============================

// Recorre la lista de usuarios buscando uno con ese nombre de usuario.
function buscarUsuario(usuarios, nombreUsuario) {
  for (let i = 0; i < usuarios.length; i++) {
    if (usuarios[i].usuario === nombreUsuario) {
      return usuarios[i];
    }
  }
  return null;
}

// Da formato de dinero colombiano a un número, ej: 60000 -> "$60.000"
function formatearDinero(valor) {
  return "$" + valor.toLocaleString("es-CO");
}

// ============================ MÓDULO DE REGISTRO ============================

function registrarUsuario() {
  const usuarios = cargarUsuarios();

  const nombreUsuario = (prompt("Elija un nombre de usuario:") || "").trim();
  if (!nombreUsuario) {
    alert("El nombre de usuario es obligatorio.");
    return;
  }

  if (buscarUsuario(usuarios, nombreUsuario)) {
    alert("Ese usuario ya existe. Intente con otro nombre.");
    return;
  }

  const clave = (prompt("Elija una clave:") || "").trim();
  if (!clave) {
    alert("La clave es obligatoria.");
    return;
  }

  const saldoInicial = Number(prompt("Ingrese el saldo inicial:"));
  if (isNaN(saldoInicial) || saldoInicial < 0) {
    alert("El saldo inicial debe ser un número válido y no negativo.");
    return;
  }

  // Cada usuario nuevo arranca sin movimientos, sin intentos fallidos
  // y sin bloqueo.
  usuarios.push({
    usuario: nombreUsuario,
    clave: clave,
    saldo: saldoInicial,
    movimientos: [],
    intentosFallidos: 0,
    bloqueadoHasta: null // fecha (timestamp) hasta la que la cuenta está bloqueada
  });

  guardarUsuarios(usuarios);
  alert("Usuario registrado con éxito. Ya puede iniciar sesión.");
}

// ======================= MÓDULO DE INICIO DE SESIÓN =======================

function iniciarSesion() {
  const usuarios = cargarUsuarios();

  const nombreUsuario = (prompt("Usuario:") || "").trim();
  const usuarioObj = buscarUsuario(usuarios, nombreUsuario);

  if (!usuarioObj) {
    alert("Usuario o clave incorrectos.");
    return;
  }

  // Si la cuenta está bloqueada y todavía no pasan las 24 horas, no la
  // dejamos ni siquiera intentar.
  if (usuarioObj.bloqueadoHasta && Date.now() < usuarioObj.bloqueadoHasta) {
    const minutosRestantes = Math.ceil((usuarioObj.bloqueadoHasta - Date.now()) / 60000);
    alert("Cuenta bloqueada por 24 horas, comunícate con tu banco\n(Tiempo restante aprox: " + minutosRestantes + " minutos)");
    return;
  }

  // Si ya pasaron las 24 horas del bloqueo, reiniciamos el contador de
  // intentos y quitamos el bloqueo.
  if (usuarioObj.bloqueadoHasta && Date.now() >= usuarioObj.bloqueadoHasta) {
    usuarioObj.bloqueadoHasta = null;
    usuarioObj.intentosFallidos = 0;
  }

  let intentos = 0;
  let sesionIniciada = false;

  // Ciclo de intentos: máximo 3, mostrando el contador cada vez.
  while (intentos < MAX_INTENTOS && !sesionIniciada) {
    const clave = prompt("Clave (intento " + (intentos + 1) + " de " + MAX_INTENTOS + "):");

    if (clave === usuarioObj.clave) {
      sesionIniciada = true;
      usuarioObj.intentosFallidos = 0;
      guardarCambiosUsuario(usuarioObj);
    } else {
      intentos++;
      usuarioObj.intentosFallidos++;
      if (intentos < MAX_INTENTOS) {
        alert("Clave incorrecta. Intento " + intentos + " de " + MAX_INTENTOS + ".");
      }
    }
  }

  if (!sesionIniciada) {
    // Se agotaron los 3 intentos: bloqueamos la cuenta por 24 horas.
    usuarioObj.bloqueadoHasta = Date.now() + HORAS_BLOQUEO * 60 * 60 * 1000;
    guardarCambiosUsuario(usuarioObj);
    alert("Cuenta bloqueada por 24 horas, comunícate con tu banco");
    return;
  }

  alert("Bienvenido, " + usuarioObj.usuario + ".");
  menuTransacciones(usuarioObj);
}

// =========================== MÓDULO DE TRANSACCIONES ===========================

// Agrega un "recibo" al historial del usuario: fecha, concepto, valor del
// movimiento y el saldo que quedó después de esa operación.
function registrarMovimiento(usuarioObj, concepto, valor) {
  usuarioObj.movimientos.push({
    "Fecha y Hora": new Date().toLocaleString("es-CO"),
    "Concepto": concepto,
    "Valor": valor,
    "Saldo": usuarioObj.saldo
  });
}

function retirarDinero(usuarioObj) {
  const monto = Number(prompt("¿Cuánto desea retirar?"));

  if (isNaN(monto) || monto <= 0) {
    alert("Ingrese un monto válido.");
    return;
  }

  // Validación clave: no se puede retirar más de lo que hay disponible.
  if (monto > usuarioObj.saldo) {
    alert("Saldo insuficiente. Su saldo actual es " + formatearDinero(usuarioObj.saldo));
    return;
  }

  usuarioObj.saldo -= monto;
  registrarMovimiento(usuarioObj, "Retiro", monto);
  guardarCambiosUsuario(usuarioObj);
  alert("Retiro exitoso. Nuevo saldo: " + formatearDinero(usuarioObj.saldo));
}

function consignarDinero(usuarioObj) {
  const monto = Number(prompt("¿Cuánto desea consignar?"));

  // Validación clave: el monto debe ser un número positivo.
  if (isNaN(monto) || monto <= 0) {
    alert("Ingrese un monto válido (mayor que cero).");
    return;
  }

  usuarioObj.saldo += monto;
  registrarMovimiento(usuarioObj, "Consignación", monto);
  guardarCambiosUsuario(usuarioObj);
  alert("Consignación exitosa. Nuevo saldo: " + formatearDinero(usuarioObj.saldo));
}

function consultarSaldo(usuarioObj) {
  alert("Su saldo actual es: " + formatearDinero(usuarioObj.saldo));
}

function consultarMovimientos(usuarioObj) {
  if (usuarioObj.movimientos.length === 0) {
    alert("No hay movimientos registrados.");
    return;
  }

  // Mostramos el historial en la consola como una tabla legible
  // (Fecha y Hora | Concepto | Valor | Saldo), tal como pide el taller.
  console.log("--- Movimientos de " + usuarioObj.usuario + " ---");
  console.table(usuarioObj.movimientos);
  alert("Historial mostrado en la consola (revisa la pestaña 'Console').");
}

// ----- Reto opcional: transferencias entre usuarios -----
function transferirDinero(usuarioObj) {
  const usuarios = cargarUsuarios();
  const destinoNombre = (prompt("Usuario destino:") || "").trim();
  const destino = buscarUsuario(usuarios, destinoNombre);

  if (!destino || destino.usuario === usuarioObj.usuario) {
    alert("Usuario destino no válido.");
    return;
  }

  const monto = Number(prompt("¿Cuánto desea transferir?"));
  if (isNaN(monto) || monto <= 0) {
    alert("Ingrese un monto válido.");
    return;
  }

  if (monto > usuarioObj.saldo) {
    alert("Saldo insuficiente para la transferencia.");
    return;
  }

  usuarioObj.saldo -= monto;
  destino.saldo += monto;

  registrarMovimiento(usuarioObj, "Transferencia enviada a " + destino.usuario, monto);
  registrarMovimiento(destino, "Transferencia recibida de " + usuarioObj.usuario, monto);

  // Guardamos los dos usuarios (origen y destino) en la misma operación.
  for (let i = 0; i < usuarios.length; i++) {
    if (usuarios[i].usuario === usuarioObj.usuario) usuarios[i] = usuarioObj;
    if (usuarios[i].usuario === destino.usuario) usuarios[i] = destino;
  }
  guardarUsuarios(usuarios);

  alert("Transferencia exitosa. Nuevo saldo: " + formatearDinero(usuarioObj.saldo));
}

// ============================ MÓDULO DE ADMINISTRADOR ============================

// Pide usuario y clave de administrador. Si coinciden con las constantes
// ADMIN_USUARIO / ADMIN_CLAVE, entra al menú de administración.
// Nota: a propósito NO comparte lógica con iniciarSesion() (no cuenta
// intentos, no se bloquea, no se guarda en localStorage) porque es un
// acceso distinto al de los clientes del banco.
function iniciarSesionAdmin() {
  const usuario = (prompt("Usuario administrador:") || "").trim();
  const clave = prompt("Clave administrador:");

  if (usuario !== ADMIN_USUARIO || clave !== ADMIN_CLAVE) {
    alert("Credenciales de administrador incorrectas.");
    return;
  }

  menuAdmin();
}

// Muestra en la consola una tabla con usuario, saldo y estado de bloqueo
// de cada cliente registrado.
function verSaldosTodos() {
  const usuarios = cargarUsuarios();

  if (usuarios.length === 0) {
    alert("Todavía no hay usuarios registrados.");
    return;
  }

  const resumen = usuarios.map(function (u) {
    return {
      "Usuario": u.usuario,
      "Saldo": formatearDinero(u.saldo),
      "Bloqueada": u.bloqueadoHasta && Date.now() < u.bloqueadoHasta ? "Sí" : "No"
    };
  });

  console.log("--- Saldos de todos los usuarios ---");
  console.table(resumen);
  alert("Tabla de saldos mostrada en la consola (pestaña 'Console').");
}

// Pide el nombre de un usuario y le quita el bloqueo (reinicia intentos
// fallidos y borra la fecha de desbloqueo), sin importar cuánto tiempo
// le falte para desbloquearse sola.
function desbloquearCuenta() {
  const usuarios = cargarUsuarios();
  const nombreUsuario = (prompt("Usuario a desbloquear:") || "").trim();
  const usuarioObj = buscarUsuario(usuarios, nombreUsuario);

  if (!usuarioObj) {
    alert("No existe un usuario con ese nombre.");
    return;
  }

  if (!usuarioObj.bloqueadoHasta) {
    alert("Esa cuenta no está bloqueada.");
    return;
  }

  usuarioObj.intentosFallidos = 0;
  usuarioObj.bloqueadoHasta = null;
  guardarCambiosUsuario(usuarioObj);
  alert("Cuenta de " + usuarioObj.usuario + " desbloqueada con éxito.");
}

function menuAdmin() {
  let salir = false;

  while (!salir) {
    const opcion = prompt(
      "===== PANEL ADMINISTRADOR =====\n" +
      "1. Ver saldos de todos los usuarios\n" +
      "2. Desbloquear una cuenta\n" +
      "3. Salir\n" +
      "Elija una opción:"
    );

    switch (opcion) {
      case "1":
        verSaldosTodos();
        break;
      case "2":
        desbloquearCuenta();
        break;
      case "3":
        salir = true;
        alert("Saliendo del panel de administrador.");
        break;
      default:
        alert("Opción no válida.");
    }
  }
}

// ================================ MENÚS ================================

function menuTransacciones(usuarioObj) {
  let salir = false;

  while (!salir) {
    const opcion = prompt(
      "===== MI PLATA - " + usuarioObj.usuario + " =====\n" +
      "1. Retirar\n" +
      "2. Consignar\n" +
      "3. Consultar saldo\n" +
      "4. Consultar movimientos\n" +
      "5. Transferir a otro usuario\n" +
      "6. Salir\n" +
      "Elija una opción:"
    );

    switch (opcion) {
      case "1":
        retirarDinero(usuarioObj);
        break;
      case "2":
        consignarDinero(usuarioObj);
        break;
      case "3":
        consultarSaldo(usuarioObj);
        break;
      case "4":
        consultarMovimientos(usuarioObj);
        break;
      case "5":
        transferirDinero(usuarioObj);
        break;
      case "6":
        salir = true;
        alert("Sesión cerrada.");
        break;
      default:
        alert("Opción no válida.");
    }
  }
}

function menuPrincipal() {
  let salir = false;

  while (!salir) {
    const opcion = prompt(
      "========== BANCO MI PLATA ==========\n" +
      "1. Iniciar sesión\n" +
      "2. Registrarse\n" +
      "3. Acceso administrador\n" +
      "4. Salir\n" +
      "Elija una opción:"
    );

    switch (opcion) {
      case "1":
        iniciarSesion();
        break;
      case "2":
        registrarUsuario();
        break;
      case "3":
        iniciarSesionAdmin();
        break;
      case "4":
        salir = true;
        alert("Hasta luego.");
        break;
      default:
        alert("Opción no válida.");
    }
  }
}

// Arrancamos el programa apenas se pega el código en la consola.
menuPrincipal();
