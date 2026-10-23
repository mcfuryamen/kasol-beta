/** Password recovery flow for the TPA portal. */
import {
  requestIdentityRecovery,
  approveIdentityRecovery,
  completeIdentityRecovery,
  GENERIC_RECOVERY_MESSAGE
} from '../../services/auth.js';

const POLL_INTERVAL = 3000; // ms between status checks
const POLL_TIMEOUT = 600000; // 10 min max polling

let pollHandle = null;
let recoveryState = {
  phone: null,
  challengeId: null,
  approvalToken: null,
  pollStart: null
};

function hideError() {
  const err = document.getElementById('recovery-err');
  err.classList.add('hidden');
  err.textContent = '';
}

function showError(message) {
  const err = document.getElementById('recovery-err');
  err.classList.remove('hidden');
  err.textContent = message;
  window.scrollTo(0, 0);
}

function showInfo(message) {
  const info = document.getElementById('recovery-info');
  info.classList.remove('hidden');
  info.textContent = message;
}

function hideInfo() {
  const info = document.getElementById('recovery-info');
  info.classList.add('hidden');
  info.textContent = '';
}

function setStep(stepId) {
  document.querySelectorAll('.step').forEach(s => s.classList.remove('active'));
  document.getElementById(stepId)?.classList.add('active');
}

async function onRequestSubmit(event) {
  event?.preventDefault();
  hideError();
  hideInfo();

  const phone = document.getElementById('recovery-phone')?.value?.trim() || '';
  if (!phone) {
    showError('Nomor WhatsApp wajib diisi.');
    return;
  }

  const btn = event.target.querySelector('.btn-sub');
  const originalText = btn.textContent;
  btn.disabled = true;
  btn.innerHTML = '<span class="spinner"></span>';

  try {
    const challenge = await requestIdentityRecovery(phone);
    recoveryState.phone = phone;
    recoveryState.challengeId = challenge.id;
    recoveryState.pollStart = Date.now();

    document.getElementById('challenge-id').textContent = challenge.id;
    showInfo(GENERIC_RECOVERY_MESSAGE);
    setStep('step-wait');

    // Start polling for approval
    pollForApproval();
  } catch (error) {
    const message = error?.message || 'Gagal mengirim permintaan pemulihan. Coba lagi.';
    showError(message);
  } finally {
    btn.disabled = false;
    btn.textContent = originalText;
  }
}

async function pollForApproval() {
  if (!recoveryState.challengeId) return;

  const pollBtn = document.getElementById('poll-status-btn');
  const elapsed = Date.now() - recoveryState.pollStart;

  if (elapsed > POLL_TIMEOUT) {
    showError('Waktu tunggu persetujuan habis. Silakan coba lagi.');
    setStep('step-request');
    return;
  }

  pollBtn.disabled = true;
  pollBtn.innerHTML = '<span class="spinner"></span> Cek...';

  try {
    // Approval status is delivered by the provider-owned recovery channel.
    // This page never accepts OTP/proof or mutates challenge state directly.
    showInfo('Permintaan masih menunggu persetujuan admin. Coba cek lagi sebentar.');
    pollHandle = setTimeout(pollForApproval, POLL_INTERVAL);
  } finally {
    pollBtn.disabled = false;
    pollBtn.textContent = 'Cek Status';
  }
}

async function onCompleteSubmit(event) {
  event?.preventDefault();
  hideError();
  hideInfo();

  const newCred = document.getElementById('recovery-new-credential')?.value || '';
  const confirmCred = document.getElementById('recovery-confirm-credential')?.value || '';

  if (!recoveryState.approvalToken) {
    showError('Persetujuan admin belum tersedia.');
    return;
  }
  if (!newCred) {
    showError('Password atau PIN baru wajib diisi.');
    return;
  }
  if (newCred !== confirmCred) {
    showError('Password atau PIN tidak cocok.');
    return;
  }

  const btn = event.target.querySelector('.btn-sub');
  const originalText = btn.textContent;
  btn.disabled = true;
  btn.innerHTML = '<span class="spinner"></span>';

  try {
    await completeIdentityRecovery(recoveryState.challengeId, recoveryState.approvalToken, newCred);
    setStep('step-success');
  } catch (error) {
    const message = error?.message || 'Gagal menyelesaikan pemulihan. Coba lagi.';
    showError(message);
  } finally {
    btn.disabled = false;
    btn.textContent = originalText;
  }
}

export function initRecovery() {
  // Setup form listeners
  document.getElementById('recovery-request-form')?.addEventListener('submit', onRequestSubmit);
  document.getElementById('recovery-complete-form')?.addEventListener('submit', onCompleteSubmit);
  document.getElementById('poll-status-btn')?.addEventListener('click', pollForApproval);

  // Cleanup polling on page unload
  window.addEventListener('beforeunload', () => {
    if (pollHandle) clearTimeout(pollHandle);
  });
}
