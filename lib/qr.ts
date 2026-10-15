/**
 * Generador de códigos QR propio (ISO/IEC 18004), sin dependencias.
 *
 * Por qué propio: el QR imprimible del local (dossier pág. 14) solo necesita
 * codificar una URL, y meter un paquete nuevo obliga a `npm install` en el
 * servidor y a fiarse de un tercero para algo que cabe en un fichero. Esto
 * cubre exactamente lo que hace falta:
 *
 * - Modo byte (UTF-8): vale para cualquier URL, con tildes o sin ellas.
 * - Corrección de errores nivel M (~15 %): aguanta una pegatina algo gastada
 *   o una mancha de cerveza sin hacer el código enorme. Se pueden pedir los
 *   otros niveles, pero el QR del local usa M.
 * - Versiones 1 a 40 (la tabla está completa); una URL con UTM típica cae en
 *   la 4–7.
 * - Máscara elegida por la penalización del estándar, como hacen los
 *   generadores "de verdad": un patrón mal elegido puede parecer un buscador
 *   y que el móvil tarde en leerlo.
 *
 * El orden de los pasos sigue el estándar tal como lo explica Project Nayuki
 * ("QR Code generator library"), escrito aquí desde cero y comentado.
 */

export type NivelCorreccion = "L" | "M" | "Q" | "H";

export type CodigoQR = {
  /** Versión del QR (1–40). Lado = 4·versión + 17 módulos. */
  version: number;
  /** Lado en módulos, sin la zona de silencio. */
  tamano: number;
  /** Máscara aplicada (0–7). */
  mascara: number;
  /** `modulos[y][x]` = true si el módulo es oscuro. */
  modulos: boolean[][];
};

// ---------------------------------------------------------------------------
// Tablas del estándar (índice = versión; el 0 no se usa).
// ---------------------------------------------------------------------------

/** Bytes de corrección por bloque, por nivel. */
const ECC_POR_BLOQUE: Record<NivelCorreccion, number[]> = {
  L: [-1, 7, 10, 15, 20, 26, 18, 20, 24, 30, 18, 20, 24, 26, 30, 22, 24, 28, 30, 28, 28, 28, 28, 30, 30, 26, 28, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30],
  M: [-1, 10, 16, 26, 18, 24, 16, 18, 22, 22, 26, 30, 22, 22, 24, 24, 28, 28, 26, 26, 26, 26, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28],
  Q: [-1, 13, 22, 18, 26, 18, 24, 18, 22, 20, 24, 28, 26, 24, 20, 30, 24, 28, 28, 26, 30, 28, 30, 30, 30, 30, 28, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30],
  H: [-1, 17, 28, 22, 16, 22, 28, 26, 26, 24, 28, 24, 28, 22, 24, 24, 30, 28, 28, 26, 28, 30, 24, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30],
};

/** Número de bloques de corrección, por nivel. */
const BLOQUES: Record<NivelCorreccion, number[]> = {
  L: [-1, 1, 1, 1, 1, 1, 2, 2, 2, 2, 4, 4, 4, 4, 4, 6, 6, 6, 6, 7, 8, 8, 9, 9, 10, 12, 12, 12, 13, 14, 15, 16, 17, 18, 19, 19, 20, 21, 22, 24, 25],
  M: [-1, 1, 1, 1, 2, 2, 4, 4, 4, 5, 5, 5, 8, 9, 9, 10, 10, 11, 13, 14, 16, 17, 17, 18, 20, 21, 23, 25, 26, 28, 29, 31, 33, 35, 37, 38, 40, 43, 45, 47, 49],
  Q: [-1, 1, 1, 2, 2, 4, 4, 6, 6, 8, 8, 8, 10, 12, 16, 12, 17, 16, 18, 21, 20, 23, 23, 25, 27, 29, 34, 34, 35, 38, 40, 43, 45, 48, 51, 53, 56, 59, 62, 65, 68],
  H: [-1, 1, 1, 2, 4, 4, 4, 5, 6, 8, 8, 11, 11, 16, 16, 18, 16, 19, 21, 25, 25, 25, 34, 30, 32, 35, 37, 40, 42, 45, 48, 51, 54, 57, 60, 63, 66, 70, 74, 77, 81],
};

/** Bits que identifican el nivel en la información de formato (no es L=0…). */
const BITS_NIVEL: Record<NivelCorreccion, number> = { L: 1, M: 0, Q: 3, H: 2 };

// ---------------------------------------------------------------------------
// Aritmética en GF(256) con el polinomio del estándar x^8+x^4+x^3+x^2+1.
// ---------------------------------------------------------------------------

function gfMul(x: number, y: number): number {
  // Multiplicación "a mano" (Russian peasant) reduciendo por 0x11D: sin tablas
  // de logaritmos porque el QR se genera una vez y la velocidad sobra.
  let z = 0;
  for (let i = 7; i >= 0; i--) {
    z = (z << 1) ^ ((z >>> 7) * 0x11d);
    z ^= ((y >>> i) & 1) * x;
  }
  return z & 0xff;
}

/** Polinomio generador de grado `grado` (sin el coeficiente principal, que es 1). */
function divisorRS(grado: number): number[] {
  const res = new Array<number>(grado).fill(0);
  res[grado - 1] = 1;
  let raiz = 1;
  for (let i = 0; i < grado; i++) {
    for (let j = 0; j < res.length; j++) {
      res[j] = gfMul(res[j], raiz);
      if (j + 1 < res.length) res[j] ^= res[j + 1];
    }
    raiz = gfMul(raiz, 0x02);
  }
  return res;
}

/** Resto de dividir los datos por el generador = bytes de corrección. */
function restoRS(datos: number[], divisor: number[]): number[] {
  const res = divisor.map(() => 0);
  for (const b of datos) {
    const factor = b ^ (res.shift() as number);
    res.push(0);
    divisor.forEach((coef, i) => { res[i] ^= gfMul(coef, factor); });
  }
  return res;
}

// ---------------------------------------------------------------------------
// Capacidades
// ---------------------------------------------------------------------------

/** Módulos libres para datos + corrección (todo menos patrones fijos). */
function modulosDeDatos(ver: number): number {
  let r = (16 * ver + 128) * ver + 64;
  if (ver >= 2) {
    const nAlin = Math.floor(ver / 7) + 2;
    r -= (25 * nAlin - 10) * nAlin - 55;
    if (ver >= 7) r -= 36; // los dos bloques de información de versión
  }
  return r;
}

function bytesDeDatos(ver: number, nivel: NivelCorreccion): number {
  return Math.floor(modulosDeDatos(ver) / 8) - ECC_POR_BLOQUE[nivel][ver] * BLOQUES[nivel][ver];
}

/** Centros de los patrones de alineación de una versión. */
function posicionesAlineacion(ver: number): number[] {
  if (ver === 1) return [];
  const n = Math.floor(ver / 7) + 2;
  const paso = ver === 32 ? 26 : Math.ceil((ver * 4 + 4) / (n * 2 - 2)) * 2;
  const res = [6];
  for (let pos = ver * 4 + 17 - 7; res.length < n; pos -= paso) res.splice(1, 0, pos);
  return res;
}

const bit = (x: number, i: number) => ((x >>> i) & 1) !== 0;

// ---------------------------------------------------------------------------
// Codificación
// ---------------------------------------------------------------------------

/**
 * Codifica un texto (normalmente una URL) en un QR.
 * Lanza un error si no cabe ni en la versión 40.
 *
 * `mascaraFija` (0–7) solo sirve para pruebas: obliga a usar esa máscara en
 * vez de la de menor penalización, y así se comprueba que las ocho se leen.
 */
export function generarQR(texto: string, nivel: NivelCorreccion = "M", mascaraFija?: number): CodigoQR {
  const bytes = Array.from(new TextEncoder().encode(texto));

  // 1. La versión más pequeña donde cabe. El contador de longitud del modo
  //    byte mide 8 bits hasta la versión 9 y 16 a partir de la 10.
  let version = 0;
  for (let v = 1; v <= 40; v++) {
    const bitsContador = v <= 9 ? 8 : 16;
    if (bytes.length >= 1 << bitsContador) continue;
    if (4 + bitsContador + bytes.length * 8 <= bytesDeDatos(v, nivel) * 8) { version = v; break; }
  }
  if (!version) throw new Error("El texto es demasiado largo para un código QR");

  // 2. Cadena de bits: modo (0100 = byte), longitud, datos, terminador y relleno.
  const bits: number[] = [];
  const poner = (valor: number, n: number) => { for (let i = n - 1; i >= 0; i--) bits.push((valor >>> i) & 1); };
  poner(0b0100, 4);
  poner(bytes.length, version <= 9 ? 8 : 16);
  for (const b of bytes) poner(b, 8);
  const capacidad = bytesDeDatos(version, nivel) * 8;
  poner(0, Math.min(4, capacidad - bits.length));
  poner(0, (8 - (bits.length % 8)) % 8);
  // Relleno alterno 0xEC 0x11 que pide el estándar (no ceros: evita que la
  // zona vacía quede toda de un color).
  for (let pad = 0xec; bits.length < capacidad; pad ^= 0xec ^ 0x11) poner(pad, 8);

  const datos: number[] = [];
  for (let i = 0; i < bits.length; i += 8) {
    let b = 0;
    for (let j = 0; j < 8; j++) b = (b << 1) | bits[i + j];
    datos.push(b);
  }

  // 3. Partir en bloques, añadir Reed‑Solomon a cada uno y entrelazar.
  const codewords = entrelazar(datos, version, nivel);

  // 4. Matriz: patrones fijos, datos, y probar las 8 máscaras.
  const tamano = version * 4 + 17;
  const base = crearMatriz(version, tamano);
  colocarDatos(base, codewords);

  let mejor: { mascara: number; modulos: boolean[][]; pen: number } | null = null;
  for (let m = 0; m < 8; m++) {
    if (mascaraFija !== undefined && m !== mascaraFija) continue;
    const modulos = base.modulos.map((fila) => fila.slice());
    aplicarMascara(modulos, base.funcion, m);
    dibujarFormato(modulos, tamano, nivel, m);
    const pen = penalizacion(modulos);
    if (!mejor || pen < mejor.pen) mejor = { mascara: m, modulos, pen };
  }
  return { version, tamano, mascara: mejor!.mascara, modulos: mejor!.modulos };
}

function entrelazar(datos: number[], ver: number, nivel: NivelCorreccion): number[] {
  const nBloques = BLOQUES[nivel][ver];
  const eccLen = ECC_POR_BLOQUE[nivel][ver];
  const total = Math.floor(modulosDeDatos(ver) / 8);
  // Unos bloques llevan un byte de datos más que otros ("largos" al final).
  const nCortos = nBloques - (total % nBloques);
  const largoCorto = Math.floor(total / nBloques);
  const divisor = divisorRS(eccLen);

  const bloques: number[][] = [];
  for (let i = 0, k = 0; i < nBloques; i++) {
    const n = largoCorto - eccLen + (i < nCortos ? 0 : 1);
    const dat = datos.slice(k, k + n);
    k += n;
    const ecc = restoRS(dat, divisor);
    // Hueco ficticio en los cortos para que todos midan lo mismo al entrelazar.
    if (i < nCortos) dat.push(-1);
    bloques.push(dat.concat(ecc));
  }

  const res: number[] = [];
  for (let i = 0; i < bloques[0].length; i++) {
    bloques.forEach((b) => { if (b[i] !== -1) res.push(b[i]); });
  }
  return res;
}

type Matriz = { modulos: boolean[][]; funcion: boolean[][]; tamano: number };

function crearMatriz(ver: number, tamano: number): Matriz {
  const modulos = Array.from({ length: tamano }, () => new Array<boolean>(tamano).fill(false));
  const funcion = Array.from({ length: tamano }, () => new Array<boolean>(tamano).fill(false));
  const fijar = (x: number, y: number, oscuro: boolean) => { modulos[y][x] = oscuro; funcion[y][x] = true; };

  // Líneas de sincronización (fila y columna 6, alternas).
  for (let i = 0; i < tamano; i++) { fijar(6, i, i % 2 === 0); fijar(i, 6, i % 2 === 0); }

  // Tres buscadores (cuadrados de las esquinas) con su separador blanco.
  for (const [cx, cy] of [[3, 3], [tamano - 4, 3], [3, tamano - 4]]) {
    for (let dy = -4; dy <= 4; dy++) {
      for (let dx = -4; dx <= 4; dx++) {
        const x = cx + dx, y = cy + dy;
        if (x < 0 || y < 0 || x >= tamano || y >= tamano) continue;
        const d = Math.max(Math.abs(dx), Math.abs(dy));
        fijar(x, y, d !== 2 && d !== 4);
      }
    }
  }

  // Patrones de alineación (menos donde chocan con los buscadores).
  const pos = posicionesAlineacion(ver);
  const n = pos.length;
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      if ((i === 0 && j === 0) || (i === 0 && j === n - 1) || (i === n - 1 && j === 0)) continue;
      for (let dy = -2; dy <= 2; dy++) {
        for (let dx = -2; dx <= 2; dx++) fijar(pos[i] + dx, pos[j] + dy, Math.max(Math.abs(dx), Math.abs(dy)) !== 1);
      }
    }
  }

  // Reservar las zonas de formato (se pintan de verdad tras elegir máscara)
  // y el módulo oscuro fijo.
  dibujarFormato(modulos, tamano, "M", 0, funcion);

  // Información de versión (v7+): 6 bits + BCH(18,6), dos copias.
  if (ver >= 7) {
    let rem = ver;
    for (let i = 0; i < 12; i++) rem = (rem << 1) ^ ((rem >>> 11) * 0x1f25);
    const b = (ver << 12) | rem;
    for (let i = 0; i < 18; i++) {
      const o = bit(b, i);
      const a = tamano - 11 + (i % 3), c = Math.floor(i / 3);
      fijar(a, c, o);
      fijar(c, a, o);
    }
  }
  return { modulos, funcion, tamano };
}

/**
 * Información de formato: nivel + máscara con BCH(15,5) y la máscara fija
 * 0x5412, en sus dos copias. Si se pasa `funcion`, además marca esas casillas
 * como reservadas (se usa al crear la matriz, antes de colocar datos).
 */
function dibujarFormato(modulos: boolean[][], tamano: number, nivel: NivelCorreccion, mascara: number, funcion?: boolean[][]) {
  const dato = (BITS_NIVEL[nivel] << 3) | mascara;
  let rem = dato;
  for (let i = 0; i < 10; i++) rem = (rem << 1) ^ ((rem >>> 9) * 0x537);
  const b = ((dato << 10) | rem) ^ 0x5412;
  const fijar = (x: number, y: number, o: boolean) => { modulos[y][x] = o; if (funcion) funcion[y][x] = true; };

  // Copia junto al buscador de arriba a la izquierda.
  for (let i = 0; i <= 5; i++) fijar(8, i, bit(b, i));
  fijar(8, 7, bit(b, 6));
  fijar(8, 8, bit(b, 7));
  fijar(7, 8, bit(b, 8));
  for (let i = 9; i < 15; i++) fijar(14 - i, 8, bit(b, i));
  // Copia repartida entre los otros dos buscadores.
  for (let i = 0; i < 8; i++) fijar(tamano - 1 - i, 8, bit(b, i));
  for (let i = 8; i < 15; i++) fijar(8, tamano - 15 + i, bit(b, i));
  fijar(8, tamano - 8, true); // módulo oscuro, siempre
}

/** Coloca los bytes en zigzag de dos columnas, de abajo arriba y vuelta. */
function colocarDatos(m: Matriz, codewords: number[]) {
  const { modulos, funcion, tamano } = m;
  let i = 0;
  for (let derecha = tamano - 1; derecha >= 1; derecha -= 2) {
    if (derecha === 6) derecha = 5; // la columna 6 es la de sincronización
    for (let vert = 0; vert < tamano; vert++) {
      for (let j = 0; j < 2; j++) {
        const x = derecha - j;
        const subiendo = ((derecha + 1) & 2) === 0;
        const y = subiendo ? tamano - 1 - vert : vert;
        if (!funcion[y][x] && i < codewords.length * 8) {
          modulos[y][x] = bit(codewords[i >>> 3], 7 - (i & 7));
          i++;
        }
        // Los módulos sobrantes (resto) se quedan en claro, como dice el estándar.
      }
    }
  }
}

function aplicarMascara(modulos: boolean[][], funcion: boolean[][], m: number) {
  const n = modulos.length;
  for (let y = 0; y < n; y++) {
    for (let x = 0; x < n; x++) {
      if (funcion[y][x]) continue;
      let invertir: boolean;
      switch (m) {
        case 0: invertir = (x + y) % 2 === 0; break;
        case 1: invertir = y % 2 === 0; break;
        case 2: invertir = x % 3 === 0; break;
        case 3: invertir = (x + y) % 3 === 0; break;
        case 4: invertir = (Math.floor(x / 3) + Math.floor(y / 2)) % 2 === 0; break;
        case 5: invertir = ((x * y) % 2) + ((x * y) % 3) === 0; break;
        case 6: invertir = (((x * y) % 2) + ((x * y) % 3)) % 2 === 0; break;
        default: invertir = (((x + y) % 2) + ((x * y) % 3)) % 2 === 0; break;
      }
      if (invertir) modulos[y][x] = !modulos[y][x];
    }
  }
}

/**
 * Las cuatro reglas de penalización del estándar. Gana la máscara con menos
 * puntos: menos rachas largas, menos bloques 2×2, menos cosas que se parezcan
 * a un buscador y un reparto de oscuros cercano al 50 %.
 */
function penalizacion(mod: boolean[][]): number {
  const n = mod.length;
  let p = 0;
  const lineas: boolean[][] = [];
  for (let i = 0; i < n; i++) {
    lineas.push(mod[i]);
    lineas.push(mod.map((fila) => fila[i]));
  }
  // Patrón tipo buscador 1:1:3:1:1 con cuatro claros a un lado.
  const P1 = [true, false, true, true, true, false, true, false, false, false, false];
  const P2 = [false, false, false, false, true, false, true, true, true, false, true];

  for (const l of lineas) {
    // Regla 1: rachas de 5 o más del mismo color.
    let racha = 1;
    for (let i = 1; i <= n; i++) {
      if (i < n && l[i] === l[i - 1]) { racha++; continue; }
      if (racha >= 5) p += 3 + (racha - 5);
      racha = 1;
    }
    // Regla 3.
    for (let i = 0; i + 11 <= n; i++) {
      let a = true, b = true;
      for (let k = 0; k < 11; k++) {
        if (l[i + k] !== P1[k]) a = false;
        if (l[i + k] !== P2[k]) b = false;
        if (!a && !b) break;
      }
      if (a) p += 40;
      if (b) p += 40;
    }
  }

  // Regla 2: bloques 2×2 de un solo color.
  for (let y = 0; y < n - 1; y++) {
    for (let x = 0; x < n - 1; x++) {
      const c = mod[y][x];
      if (c === mod[y][x + 1] && c === mod[y + 1][x] && c === mod[y + 1][x + 1]) p += 3;
    }
  }

  // Regla 4: 10 puntos por cada 5 % de desvío respecto al 50 % de oscuros.
  let oscuros = 0;
  for (const fila of mod) for (const c of fila) if (c) oscuros++;
  const total = n * n;
  p += Math.floor(Math.abs(oscuros * 100 / total - 50) / 5) * 10;
  return p;
}

// ---------------------------------------------------------------------------
// Pintar
// ---------------------------------------------------------------------------

/**
 * El QR como SVG en texto (para pintarlo con dangerouslySetInnerHTML o
 * descargarlo). Un solo <path>: con un <rect> por módulo, un QR de versión 7
 * son ~1.000 nodos y el PDF impreso pesa y se ve con rayitas entre módulos.
 *
 * Negro sobre blanco por defecto a propósito: los lectores de QR esperan
 * contraste alto y oscuro sobre claro; con el magenta de la marca muchos
 * móviles viejos fallan. Por eso aquí no van tokens de color.
 */
export function qrASvg(
  qr: CodigoQR,
  { margen = 4, oscuro = "#000000", claro = "#ffffff", titulo }: { margen?: number; oscuro?: string; claro?: string; titulo?: string } = {},
): string {
  const lado = qr.tamano + margen * 2;
  let d = "";
  qr.modulos.forEach((fila, y) => {
    // Las rachas horizontales van en un solo rectángulo: el path queda ~3 veces más corto.
    let x = 0;
    while (x < qr.tamano) {
      if (!fila[x]) { x++; continue; }
      let fin = x;
      while (fin < qr.tamano && fila[fin]) fin++;
      d += `M${x + margen} ${y + margen}h${fin - x}v1h${x - fin}z`;
      x = fin;
    }
  });
  const escapar = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${lado} ${lado}" shape-rendering="crispEdges" role="img"` +
    `${titulo ? ` aria-label="${escapar(titulo)}"` : ""}>` +
    (titulo ? `<title>${escapar(titulo)}</title>` : "") +
    `<rect width="${lado}" height="${lado}" fill="${claro}"/>` +
    `<path d="${d}" fill="${oscuro}"/></svg>`
  );
}
