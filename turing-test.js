// Configuration
const TOTAL_TRIALS = 20;
const POOL_SIZE = 20;
let currentTrial = 0;
let answers = [];

// Slider descriptions mapping (permanent)
const sliderDescriptions = {
    0: "100% confident is synthetic",
    1: "75% confident is synthetic",
    2: "60% confident is synthetic",
    3: "I am not sure, could be either",
    4: "60% confident is real",
    5: "75% confident is real",
    6: "100% confident is real"
};

// Utility: sample unique pairs
function samplePairs(poolSize, k) {
    const arr = Array.from({length: poolSize}, (_, i) => i + 1);
    for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr.slice(0, k);
}

const chosenPairs = samplePairs(POOL_SIZE, TOTAL_TRIALS);

let trials = chosenPairs.map(pairNum => {
    const realOnLeft = Math.random() < 0.5;
    const padded = pairNum.toString().padStart(3, '0');
    return {
        pairId: pairNum,
        realOnLeft,
        leftSrc: realOnLeft ? `images/real/real_${padded}.png` : `images/synth/synth_${padded}.png`,
        rightSrc: realOnLeft ? `images/synth/synth_${padded}.png` : `images/real/real_${padded}.png`
    };
});

// DOM
const leftImg = document.getElementById('left-img');
const rightImg = document.getElementById('right-img');
const leftWrap = document.getElementById('left-wrap');
const rightWrap = document.getElementById('right-wrap');

const leftSlider = document.getElementById('left-slider');
const rightSlider = document.getElementById('right-slider');
const leftValueSpan = document.getElementById('left-value');
const rightValueSpan = document.getElementById('right-value');

const leftScale = document.getElementById('left-scale');
const rightScale = document.getElementById('right-scale');

const trialSpan = document.getElementById('trial-num');
const totalTrialsSpan = document.getElementById('total-trials');
const nextBtn = document.getElementById('next-btn');
const resultDiv = document.getElementById('result-area');

totalTrialsSpan && (totalTrialsSpan.innerText = TOTAL_TRIALS);

// Build permanent scale UI for a container
function buildScale(container, sliderEl, valueSpan, side) {
    container.innerHTML = '';
    for (let i = 0; i <= 6; i++) {
        const tick = document.createElement('div');
        tick.className = 'tick';
        tick.dataset.value = i;
        tick.innerHTML = `<span class="num">${i}</span><div class="desc">${sliderDescriptions[i]}</div>`;
        tick.addEventListener('click', () => {
            sliderEl.value = i;
            valueSpan.innerText = i;
            updateActiveTick(container, i);
        });
        container.appendChild(tick);
    }
    updateActiveTick(container, parseInt(sliderEl.value, 10));
}

function updateActiveTick(container, value) {
    container.querySelectorAll('.tick').forEach(t => {
        t.classList.toggle('active', parseInt(t.dataset.value, 10) === parseInt(value, 10));
    });
}

// Zoom and pan state per side
const ZOOM_STEP = 0.25;
const ZOOM_MIN = 0.25;
const ZOOM_MAX = 4;
let state = {
    left: { scale: 1, tx: 0, ty: 0, dragging: false, startX:0, startY:0, lastX:0, lastY:0 },
    right: { scale: 1, tx: 0, ty: 0, dragging: false, startX:0, startY:0, lastX:0, lastY:0 },
    modal: { scale: 1, tx:0, ty:0, dragging:false, startX:0, startY:0, lastX:0, lastY:0 }
};

// Apply transform to image inside wrap
function applyTransform(side) {
    const s = state[side];
    const img = side === 'left' ? leftImg : rightImg;
    img.style.transform = `translate(${s.tx}px, ${s.ty}px) scale(${s.scale})`;
}

// Reset transform
function resetTransform(side) {
    state[side].scale = 1;
    state[side].tx = 0;
    state[side].ty = 0;
    applyTransform(side);
}

// Zoom functions
function zoomBy(side, delta) {
    const s = state[side];
    s.scale = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, +(s.scale + delta).toFixed(3)));
    // clamp translation to keep image roughly centered (optional)
    applyTransform(side);
}

// Pointer drag handlers for pan
function attachPanHandlers(side, wrapEl, imgEl) {
    wrapEl.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        wrapEl.setPointerCapture(e.pointerId);
        const s = state[side];
        s.dragging = true;
        s.startX = e.clientX;
        s.startY = e.clientY;
        s.lastX = s.tx;
        s.lastY = s.ty;
        imgEl.style.cursor = 'grabbing';
    });
    wrapEl.addEventListener('pointermove', (e) => {
        const s = state[side];
        if (!s.dragging) return;
        const dx = e.clientX - s.startX;
        const dy = e.clientY - s.startY;
        s.tx = s.lastX + dx;
        s.ty = s.lastY + dy;
        applyTransform(side);
    });
    wrapEl.addEventListener('pointerup', (e) => {
        const s = state[side];
        s.dragging = false;
        try { wrapEl.releasePointerCapture(e.pointerId); } catch {}
        imgEl.style.cursor = 'grab';
    });
    wrapEl.addEventListener('pointercancel', () => {
        const s = state[side];
        s.dragging = false;
        imgEl.style.cursor = 'grab';
    });

    // Wheel to zoom (centered on cursor)
    wrapEl.addEventListener('wheel', (e) => {
        e.preventDefault();
        const delta = e.deltaY > 0 ? -ZOOM_STEP : ZOOM_STEP;
        const prevScale = state[side].scale;
        zoomBy(side, delta);
        // optional: adjust tx/ty to zoom toward cursor (simple approximation)
        const rect = wrapEl.getBoundingClientRect();
        const cx = e.clientX - rect.left - rect.width/2;
        const cy = e.clientY - rect.top - rect.height/2;
        const s = state[side];
        s.tx -= cx * (s.scale - prevScale) / s.scale;
        s.ty -= cy * (s.scale - prevScale) / s.scale;
        applyTransform(side);
    }, { passive:false });
}

// Modal behavior
const zoomModal = document.getElementById('zoom-modal');
const zoomImg = document.getElementById('zoom-img');
const modalZoomIn = document.getElementById('modal-zoom-in');
const modalZoomOut = document.getElementById('modal-zoom-out');
const modalClose = document.getElementById('modal-close');

function openModalFromSide(side) {
    const img = side === 'left' ? leftImg : rightImg;
    zoomImg.src = img.src;
    state.modal.scale = state[side].scale || 1;
    state.modal.tx = state[side].tx || 0;
    state.modal.ty = state[side].ty || 0;
    zoomImg.style.transform = `translate(${state.modal.tx}px, ${state.modal.ty}px) scale(${state.modal.scale})`;
    zoomModal.style.display = 'flex';
}

// Modal pan handlers
(function attachModalPan() {
    const wrap = zoomModal;
    zoomImg.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        zoomImg.setPointerCapture(e.pointerId);
        const s = state.modal;
        s.dragging = true;
        s.startX = e.clientX;
        s.startY = e.clientY;
        s.lastX = s.tx;
        s.lastY = s.ty;
        zoomImg.style.cursor = 'grabbing';
    });
    zoomImg.addEventListener('pointermove', (e) => {
        const s = state.modal;
        if (!s.dragging) return;
        const dx = e.clientX - s.startX;
        const dy = e.clientY - s.startY;
        s.tx = s.lastX + dx;
        s.ty = s.lastY + dy;
        zoomImg.style.transform = `translate(${s.tx}px, ${s.ty}px) scale(${s.scale})`;
    });
    zoomImg.addEventListener('pointerup', (e) => {
        const s = state.modal;
        s.dragging = false;
        try { zoomImg.releasePointerCapture(e.pointerId); } catch {}
        zoomImg.style.cursor = 'grab';
    });
    zoomImg.addEventListener('pointercancel', () => {
        const s = state.modal;
        s.dragging = false;
        zoomImg.style.cursor = 'grab';
    });

    // wheel zoom in modal
    zoomModal.addEventListener('wheel', (e) => {
        if (zoomModal.style.display !== 'flex') return;
        e.preventDefault();
        const delta = e.deltaY > 0 ? -ZOOM_STEP : ZOOM_STEP;
        const prev = state.modal.scale;
        state.modal.scale = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, +(state.modal.scale + delta).toFixed(3)));
        // adjust tx/ty to zoom toward cursor
        const rect = zoomImg.getBoundingClientRect();
        const cx = e.clientX - rect.left - rect.width/2;
        const cy = e.clientY - rect.top - rect.height/2;
        state.modal.tx -= cx * (state.modal.scale - prev) / state.modal.scale;
        state.modal.ty -= cy * (state.modal.scale - prev) / state.modal.scale;
        zoomImg.style.transform = `translate(${state.modal.tx}px, ${state.modal.ty}px) scale(${state.modal.scale})`;
    }, { passive:false });
})();

modalZoomIn.addEventListener('click', () => {
    const prev = state.modal.scale;
    state.modal.scale = Math.min(ZOOM_MAX, +(state.modal.scale + ZOOM_STEP).toFixed(3));
    zoomImg.style.transform = `translate(${state.modal.tx}px, ${state.modal.ty}px) scale(${state.modal.scale})`;
});
modalZoomOut.addEventListener('click', () => {
    state.modal.scale = Math.max(ZOOM_MIN, +(state.modal.scale - ZOOM_STEP).toFixed(3));
    zoomImg.style.transform = `translate(${state.modal.tx}px, ${state.modal.ty}px) scale(${state.modal.scale})`;
});
modalClose.addEventListener('click', () => {
    zoomModal.style.display = 'none';
});

// Clicking image opens modal
[leftImg, rightImg].forEach(imgEl => {
    imgEl.addEventListener('click', (e) => {
        const side = e.currentTarget.dataset.side;
        openModalFromSide(side);
    });
});

// Attach pan handlers to both images
attachPanHandlers('left', leftWrap, leftImg);
attachPanHandlers('right', rightWrap, rightImg);

// Inline zoom buttons
document.querySelectorAll('.zoom-plus').forEach(btn => {
    btn.addEventListener('click', (e) => {
        const side = e.currentTarget.dataset.side;
        zoomBy(side, ZOOM_STEP);
        applyTransform(side);
    });
});
document.querySelectorAll('.zoom-minus').forEach(btn => {
    btn.addEventListener('click', (e) => {
        const side = e.currentTarget.dataset.side;
        zoomBy(side, -ZOOM_STEP);
        applyTransform(side);
    });
});
document.querySelectorAll('.zoom-reset').forEach(btn => {
    btn.addEventListener('click', (e) => {
        const side = e.currentTarget.dataset.side;
        resetTransform(side);
    });
});

// CSV and email logic unchanged
function downloadCSV() {
    if (answers.length === 0) { alert('No results to download.'); return; }
    const header = ['Trial', 'PairId', 'LeftValue', 'RightValue', 'RealSide'];
    const rows = answers.map(a => [a.trial, a.pairId, a.leftValue, a.rightValue, a.realSide]);
    const csvContent = [header, ...rows].map(r => r.join(',')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'turing_test_results.csv';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}
function emailResults() {
    if (answers.length === 0) { alert('No results to email.'); return; }
    const subject = 'Visual Turing Test Results';
    const bodyLines = answers.map(a => `Trial ${a.trial} (pair ${a.pairId}): left=${a.leftValue}, right=${a.rightValue}, real=${a.realSide}`);
    const body = bodyLines.join('\n');
    window.location.href = `mailto:your-email@example.com?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

// Trial logic
function loadTrial(trialIndex) {
    if (trialIndex >= TOTAL_TRIALS) { endTest(); return; }
    const t = trials[trialIndex];
    leftImg.src = t.leftSrc;
    rightImg.src = t.rightSrc;
    trialSpan.innerText = trialIndex + 1;

    leftSlider.value = 3;
    rightSlider.value = 3;
    leftValueSpan.innerText = '3';
    rightValueSpan.innerText = '3';

    buildScale(leftScale, leftSlider, leftValueSpan, 'left');
    buildScale(rightScale, rightSlider, rightValueSpan, 'right');

    resetTransform('left');
    resetTransform('right');
}

function recordAnswerAndNext() {
    const t = trials[currentTrial];
    const leftVal = parseInt(leftSlider.value, 10);
    const rightVal = parseInt(rightSlider.value, 10);
    const realSide = t.realOnLeft ? 'left' : 'right';
    answers.push({
        trial: currentTrial + 1,
        pairId: t.pairId,
        leftValue: leftVal,
        rightValue: rightVal,
        realSide: realSide
    });
    currentTrial++;
    if (currentTrial < TOTAL_TRIALS) loadTrial(currentTrial);
    else endTest();
}

function endTest() {
    resultDiv.innerHTML = `
        <h2>Test completed!</h2>
        <p>Your responses have been recorded.</p>
        <div>
            <button id="download-csv">📥 Download results as CSV</button>
            <button id="email-results">📧 Send results via Email</button>
        </div>
    `;
    nextBtn.disabled = true;
    document.getElementById('download-csv').addEventListener('click', downloadCSV);
    document.getElementById('email-results').addEventListener('click', emailResults);
}

// Slider events update value and active tick
leftSlider.addEventListener('input', () => {
    leftValueSpan.innerText = leftSlider.value;
    updateActiveTick(leftScale, leftSlider.value);
});
rightSlider.addEventListener('input', () => {
    rightValueSpan.innerText = rightSlider.value;
    updateActiveTick(rightScale, rightSlider.value);
});
nextBtn.addEventListener('click', recordAnswerAndNext);

// Start
loadTrial(0);


