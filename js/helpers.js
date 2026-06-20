/**
 * WOM Helpers — Utilidades compartidas entre vistas
 */
'use strict';

window.WOM = window.WOM || {};

window.WOM.NUMERIC_IDENTIFIER_LENGTH = 10;

/**
 * Normalizar identificadores WOM numericos sin convertirlos a number.
 * Son numeros de linea o referencias; conservarlos como string.
 * @param {string} value
 * @returns {string}
 */
window.WOM.normalizeNumericIdentifier = function (value) {
    return String(value || '')
        .replace(/\D/g, '')
        .slice(0, window.WOM.NUMERIC_IDENTIFIER_LENGTH);
};

/**
 * Validar numero de linea o referencia numerica WOM.
 * @param {string} value
 * @returns {boolean}
 */
window.WOM.isValidNumericIdentifier = function (value) {
    const digits = String(value || '').replace(/\D/g, '');
    return /^3\d{9}$/.test(digits);
};

/**
 * Validar número de celular colombiano
 * @param {string} phone
 * @returns {boolean}
 */
window.WOM.isValidPhone = function (phone) {
    return window.WOM.isValidNumericIdentifier(phone);
};
