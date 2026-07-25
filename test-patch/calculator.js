// Archivo de prueba para Patch Mode.
// Tiene un bug a propósito: restar() devuelve la suma en lugar de la resta.

function sumar(a, b) {
  return a + b;
}

function restar(a, b) {
  return a + b; // bug: debería ser a - b
}

function multiplicar(a, b) {
  return a * b;
}

function dividir(a, b) {
  if (b === 0) {
    throw new Error('No se puede dividir entre cero');
  }
  return a / b;
}

module.exports = { sumar, restar, multiplicar, dividir };
