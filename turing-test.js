// Configuration
const TOTAL_TRIALS = 20;
const POOL_SIZE = 20; // total available pairs on disk
let currentTrial = 0;
let answers = []; // each entry: { trial, leftValue, rightValue, realSide, pairId }

// Slider descriptions mapping
const sliderDescriptions = {
    0: "100% confident is synthetic",
    1: "75% confident is synthetic",
    2: "60% confident is synthetic",
    3: "I am not sure, could be either",
    4: "60% confident is real",
    5: "75% confident is real",
    6: "100% confident is real"
};

// Build a random sample of unique pair indices from 1..POOL_SIZE
function samplePairs(poolSize, k) {
    const arr = Array.from({length: poolSize}, (_, i) => i + 1);
    for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr.slice(0, k);
}

const chosenPairs = samplePairs(POOL_SIZE, TOTAL_TRIALS);

// Prepare trials array
let trials = chosenPairs.map((pairNum, idx) => {
    const realOnLeft = Math.random() < 0.5;
    const padded = pairNum.toString().padStart(3, '0');
    return {
        pairId: pairNum,
        realOnLeft,
        leftSrc: realOnLeft ? `images/real/real_${padded}.png` : `images/synth/synth_${padded}.png`,
        rightSrc: realOnLeft ? `images/synth/synth_${padded}.png` : `images/real/real_${padded}.png`
    };
});

// DOM elements
const leftImg = document.getElementById('left-img');
const rightImg = document.getElementById('right-img');
const leftSlider = document.getElementById('left-slider');
const rightSlider = document.getElementById('right-slider');
const leftValueSpan = document.getElementById('left-value');
const rightValueSpan = document.getElementById('right-value');
const leftDesc = document.getElementById('left-desc');
const rightDesc = document.getElementById('right-desc');
const trialSpan = document.getElementById('trial-num');
const totalTrialsSpan = document.getElementById('total-trials');
const nextBtn = document.getElementById('next-btn');
const resultDiv = document.getElementById('result-area');

totalTrialsSpan.innerText = TOTAL_TRIALS;

// Zoom modal elements
const zoomModal = document.getElementById('zoom-modal');
const zoomImg = document.getElementById('zoom-img');
const modalZoomIn = document.getElementById('modal-zoom-in');
const modalZoomOut = document.getElementById('modal-zoom-out');
const modalClose = document.getElementById('modal-close');

let zoomState = {
    left: 1,
    right: 1,
    modal: 1
};
const ZOOM_STEP = 0.25;
const ZOOM_MIN = 0.25;
const ZOOM_MAX = 4;

// Load a trial
function loadTrial(trialIndex) {
    if (trialIndex >= TOTAL_TRIALS) {
        endTest();
        return;
    }
    const t = trials[trialIndex];
    leftImg.src = t.leftSrc;
    rightImg.src = t.rightSrc;
    trialSpan.innerText = trialIndex + 1;

    // Reset sliders to neutral (3)
    leftSlider.value = 3;
    rightSlider.value = 3;
    leftValueSpan.innerText = '3';
    rightValueSpan.innerText = '3';
    leftDesc.innerText = sliderDescriptions[3];
    rightDesc.innerText = sliderDescriptions[3];

    // Reset zooms
    zoomState.left = 1;
    zoomState.right = 1;
    applyZoomToImage(leftImg, zoomState.left);
    applyZoomToImage(rightImg, zoomState.right);
}

// Apply CSS transform scale to an image element
function applyZoomToImage(imgEl, scale) {
    imgEl.style.transform = `scale(${scale})`;
}

// Record the current sliders as the answer and move on
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
    if (currentTrial < TOTAL_TRIALS) {
        loadTrial(currentTrial);
    } else {
        endTest();
    }
}

// End of test: show only download/email options (no accuracy)
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

// CSV download: builds CSV from answers and triggers a download
function downloadCSV() {
    if (answers.length === 0) {
        alert('No results to download.');
        return;
    }

    const header = ['Trial', 'PairId', 'LeftValue', 'RightValue', 'RealSide'];
    const rows = answers.map(a => [a.trial, a.pairId, a.leftValue, a.rightValue, a.realSide]);

    const csvContent = [header, ...rows].map(r => r.join(',')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = url;
    a.download = 'turing_test_results.csv';
    document.body.appendChild(a); // required for Firefox
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

// Email results: opens mail client with body (mailto)
function emailResults() {
    if (answers.length === 0) {
        alert('No results to email.');
        return;
    }
    const subject = 'Visual Turing Test Results';
    const bodyLines = answers.map(a => `Trial ${a.trial} (pair ${a.pairId}): left=${a.leftValue}, right=${a.rightValue}, real=${a.realSide}`);
    const body = bodyLines.join('\n');

    // mailto approach (opens user's email client)
    window.location.href = `mailto:your-email@example.com?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

// Event listeners for sliders and next button
leftSlider.addEventListener('input', () => {
    leftValueSpan.innerText = leftSlider.value;
    leftDesc.innerText = sliderDescriptions[leftSlider.value];
});
rightSlider.addEventListener('input', () => {
    rightValueSpan.innerText = rightSlider.value;
    rightDesc.innerText = sliderDescriptions[rightSlider.value];
});
nextBtn.addEventListener('click', recordAnswerAndNext);

// Inline zoom controls (per-image)
document.querySelectorAll('.zoom-plus').forEach(btn => {
    btn.addEventListener('click', (e) => {
        const side = e.currentTarget.dataset.side;
        zoomState[side] = Math.min(zoomState[side] + ZOOM_STEP, ZOOM_MAX);
        applyZoomToImage(side === 'left' ? leftImg : rightImg, zoomState[side]);
    });
});
document.querySelectorAll('.zoom-minus').forEach(btn => {
    btn.addEventListener('click', (e) => {
        const side = e.currentTarget.dataset.side;
        zoomState[side] = Math.max(zoomState[side] - ZOOM_STEP, ZOOM_MIN);
        applyZoomToImage(side === 'left' ? leftImg : rightImg, zoomState[side]);
    });
});
document.querySelectorAll('.zoom-reset').forEach(btn => {
    btn.addEventListener('click', (e) => {
        const side = e.currentTarget.dataset.side;
        zoomState[side] = 1;
        applyZoomToImage(side === 'left' ? leftImg : rightImg, zoomState[side]);
    });
});

// Clicking an image opens the modal with the same image and current zoom
[leftImg, rightImg].forEach(imgEl => {
    imgEl.addEventListener('click', (e) => {
        const src = e.currentTarget.src;
        const side = e.currentTarget.dataset.side;
        zoomImg.src = src;
        zoomState.modal = zoomState[side] || 1;
        zoomImg.style.transform = `scale(${zoomState.modal})`;
        zoomModal.style.display = 'flex';
    });
});

// Modal zoom controls
modalZoomIn.addEventListener('click', () => {
    zoomState.modal = Math.min(zoomState.modal + ZOOM_STEP, ZOOM_MAX);
    zoomImg.style.transform = `scale(${zoomState.modal})`;
});
modalZoomOut.addEventListener('click', () => {
    zoomState.modal = Math.max(zoomState.modal - ZOOM_STEP, ZOOM_MIN);
    zoomImg.style.transform = `scale(${zoomState.modal})`;
});
modalClose.addEventListener('click', () => {
    zoomModal.style.display = 'none';
});

// Close modal by clicking backdrop
zoomModal.addEventListener('click', (e) => {
    if (e.target === zoomModal) zoomModal.style.display = 'none';
});

// Start
loadTrial(0);

