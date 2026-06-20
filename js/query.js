/**
 * WOM Query Page — Lógica de consulta de facturas
 *
 * Maneja la validación del input y el envío del formulario.
 * El formulario se envía como POST a /consulta (server-side),
 * que consulta la API y redirige a /detalle si hay factura.
 */
'use strict';

(function () {
    // Elementos DOM
    const phoneInput = document.getElementById('phoneInput');
    const submitButton = document.getElementById('submitButton');
    const submitButtonContainer = document.getElementById('submitButtonContainer');
    const loadingButton = document.getElementById('loadingButton');
    const errorMessage = document.getElementById('errorMessage');
    const errorModal = document.getElementById('errorModal');
    const errorModalTitle = document.getElementById('errorModalTitle');
    const errorModalText = document.getElementById('errorModalText');
    const closeModal = document.getElementById('closeModal');
    const closeModalBtn = document.getElementById('closeModalBtn');
    const queryForm = document.getElementById('queryForm');
    const IDENTIFIER_ERROR =
        'Ingresa un número de línea o referencia válido: debe empezar por 3 y tener 10 dígitos.';

    function normalizeIdentifier(value) {
        if (WOM.normalizeNumericIdentifier) {
            return WOM.normalizeNumericIdentifier(value);
        }

        return String(value || '').replace(/\D/g, '').slice(0, 10);
    }

    function isValidIdentifier(value) {
        if (WOM.isValidNumericIdentifier) {
            return WOM.isValidNumericIdentifier(value);
        }

        return /^3\d{9}$/.test(normalizeIdentifier(value));
    }

    phoneInput.setAttribute('inputmode', 'numeric');
    phoneInput.setAttribute('pattern', '[0-9]*');
    phoneInput.setAttribute('autocomplete', 'off');
    phoneInput.setAttribute('enterkeyhint', 'go');
    phoneInput.setAttribute('autocapitalize', 'off');
    phoneInput.setAttribute('spellcheck', 'false');

    function getNoBalancesModalConfig() {
        return {
            title: 'En este momento no tienes saldos por pagar',
            text: 'Si quieres abonar a tu próxima factura, puedes hacerlo digitando tu referencia de pago.',
            buttonLabel: 'ABONAR',
        };
    }

    function getApprovedPaymentModalConfig() {
        return {
            title: 'Este número ya tiene un pago aprobado',
            text: 'Si quieres realizar otro abono, digita una referencia de pago diferente.',
            buttonLabel: 'ENTENDIDO',
        };
    }

    // Helpers
    function showLoading() {
        submitButtonContainer.classList.add('hidden');
        loadingButton.classList.remove('hidden');
    }

    function hideLoading() {
        loadingButton.classList.add('hidden');
        submitButtonContainer.classList.remove('hidden');
    }

    function showError(msg) {
        errorMessage.textContent = msg;
        errorMessage.classList.remove('hidden');
    }

    function hideError() {
        errorMessage.classList.add('hidden');
    }

    function applyErrorModalContent(config) {
        if (!config || !errorModalTitle || !errorModalText || !closeModalBtn) {
            return;
        }

        errorModalTitle.textContent = config.title;
        errorModalText.textContent = config.text;
        errorModalText.classList.toggle('hidden', !config.text);
        closeModalBtn.textContent = config.buttonLabel;
    }

    function clearQueryModalParams() {
        if (!window.history || typeof window.history.replaceState !== 'function') {
            return;
        }

        const url = new URL(window.location.href);
        let hadModalParams = false;

        ['modal', 'reference'].forEach(function (key) {
            if (url.searchParams.has(key)) {
                url.searchParams.delete(key);
                hadModalParams = true;
            }
        });

        if (!hadModalParams) {
            return;
        }

        const nextUrl = url.pathname + (url.search ? url.search : '') + url.hash;
        window.history.replaceState({}, document.title, nextUrl);
    }

    function showErrorModal(config) {
        if (config) {
            applyErrorModalContent(config);
        }

        hideError();
        errorModal.classList.add('visible');
    }

    function hideErrorModal() {
        errorModal.classList.remove('visible');
        clearQueryModalParams();
    }

    // Estado disabled/enabled del botón según input
    function updateButtonState() {
        const val = normalizeIdentifier(phoneInput.value);
        if (isValidIdentifier(val)) {
            submitButton.disabled = false;
            submitButton.classList.add('active');
        } else {
            submitButton.disabled = true;
            submitButton.classList.remove('active');
        }
    }

    // Validación de input en tiempo real
    phoneInput.addEventListener('input', function (e) {
        e.target.value = normalizeIdentifier(e.target.value);
        if (e.target.value.length === window.WOM.NUMERIC_IDENTIFIER_LENGTH && !isValidIdentifier(e.target.value)) {
            showError(IDENTIFIER_ERROR);
        } else {
            hideError();
        }
        updateButtonState();
    });

    // Submit del formulario
    queryForm.addEventListener('submit', function (e) {
        e.preventDefault();
        hideError();

        const phone = normalizeIdentifier(phoneInput.value);
        phoneInput.value = phone;

        if (!isValidIdentifier(phone)) {
            showError(IDENTIFIER_ERROR);
            return;
        }

        showLoading();

        // POST a /consulta vía fetch (para manejar errores sin redirect)
        fetch('/api/wom/consulta/facturas', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ phoneNumber: phone }),
        })
            .then(function (response) {
                return response.json().then(function (data) {
                    return { ok: response.ok, data: data };
                });
            })
            .then(function (result) {
                if (!result.ok || !result.data.success) {
                    throw new Error(
                        result.data.data?.text_response ||
                            result.data.error ||
                            'Error consultando factura'
                    );
                }

                const apiData = result.data.data?.data || result.data.data;
                const facturas = apiData?.facturas || [];

                // Check existing approved payment
                if (
                    result.data.existing_payment &&
                    result.data.existing_payment.status === 'approved'
                ) {
                    hideLoading();
                    showErrorModal(getApprovedPaymentModalConfig());
                    return;
                }

                if (facturas.length === 0) {
                    hideLoading();
                    showErrorModal(getNoBalancesModalConfig());
                    return;
                }

                // Redirect a /pago (ruta original) con data en POST (form submit)
                const factura = facturas[0];
                const form = document.createElement('form');
                form.method = 'POST';
                form.action = '/pago';

                const fields = {
                    phone: phone,
                    total: factura.total || 0,
                    date: factura.extra8 || '',
                    ref: factura.extra11 || factura.extra12 || factura.consulta?.[0]?.value || '',
                    invoice_id: factura.id || '',
                    currency: factura.moneda || 'COP',
                    consultation_id: result.data.consultation_id || '',
                };

                for (const key in fields) {
                    const input = document.createElement('input');
                    input.type = 'hidden';
                    input.name = key;
                    input.value = fields[key];
                    form.appendChild(input);
                }

                document.body.appendChild(form);
                form.submit();
            })
            .catch(function (error) {
                hideLoading();
                if (error.message.includes('pendientes') || error.message.includes('saldos')) {
                    showErrorModal(getNoBalancesModalConfig());
                } else {
                    showError(error.message || 'Error consultando factura');
                }
            });
    });

    if (errorModal && errorModal.dataset.shouldOpen === 'true') {
        showErrorModal();
    }

    // Modal close events
    if (closeModal) closeModal.addEventListener('click', hideErrorModal);
    if (closeModalBtn) closeModalBtn.addEventListener('click', hideErrorModal);
})();
