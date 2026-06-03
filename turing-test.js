// Configuration
const TOTAL_TRIALS = 50;
let currentTrial = 0;
let answers = [];  // each entry: { trial, correct: bool, userChoice: 'left'/'right', realSide: 'left'/'right' }

// Pre‑generate a randomised order of the 50 image pairs
// Each pair index i (0..49) corresponds to real_i + synth_i
let trials = [];
for (let i = 0; i < TOTAL_TRIALS; i++) {
    // Randomly decide whether real is on left (true) or right (false)
    const realOnLeft = Math.random() < 0.5;
    trials.push({
        pairId: i,
        realOnLeft: realOnLeft,
        leftSrc: realOnLeft ? `images/real/real_${(i+1).toString().padStart(3,'0')}.png` 
                            : `images/synth/synth_${(i+1).toString().padStart(3,'0')}.png`,
        rightSrc: realOnLeft ? `images/synth/synth_${(i+1).toString().padStart(3,'0')}.png`
                             : `images/real/real_${(i+1).toString().padStart(3,'0')}.png`
    });
}

// DOM elements
const leftImg = document.getElementById('left-img');
const rightImg = document.getElementById('right-img');
const leftBtn = document.getElementById('left-btn');
const rightBtn = document.getElementById('right-btn');
const trialSpan = document.getElementById('trial-num');
const resultDiv = document.getElementById('result-area');

function loadTrial(trialIndex) {
    if (trialIndex >= TOTAL_TRIALS) {
        endTest();
        return;
    }
    const t = trials[trialIndex];
    leftImg.src = t.leftSrc;
    rightImg.src = t.rightSrc;
    trialSpan.innerText = trialIndex + 1;
}

function recordAnswer(userChoice) {
    const t = trials[currentTrial];
    const realSide = t.realOnLeft ? 'left' : 'right';
    const isCorrect = (userChoice === realSide);
    answers.push({
        trial: currentTrial + 1,
        correct: isCorrect,
        userChoice: userChoice,
        realSide: realSide
    });
    currentTrial++;
    if (currentTrial < TOTAL_TRIALS) {
        loadTrial(currentTrial);
    } else {
        endTest();
    }
}

function endTest() {
    // Calculate score
    const correctCount = answers.filter(a => a.correct).length;
    const accuracy = (correctCount / TOTAL_TRIALS) * 100;
    resultDiv.innerHTML = `
        <h2>Test completed!</h2>
        <p>You identified the real mammogram correctly in ${correctCount} out of ${TOTAL_TRIALS} trials (${accuracy.toFixed(1)}%).</p>
        <div>
            <button id="download-csv">📥 Download results as CSV</button>
            <button id="email-results">📧 Send results via Email</button>
        </div>
    `;
    // Hide the image buttons
    leftBtn.style.display = 'none';
    rightBtn.style.display = 'none';
    
    document.getElementById('download-csv').addEventListener('click', downloadCSV);
    document.getElementById('email-results').addEventListener('click', emailResults);
}

function downloadCSV() {
    let csvRows = [["Trial", "User choice (left/right)", "Real side", "Correct"]];
    for (let a of answers) {
        csvRows.push([a.trial, a.userChoice, a.realSide, a.correct ? "Yes" : "No"]);
    }
    csvRows.push(["Total correct", correctCount, "", ""]);
    const csvContent = csvRows.map(row => row.join(",")).join("\n");
    const blob = new Blob([csvContent], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "turing_test_results.csv";
    a.click();
    URL.revokeObjectURL(url);
}

function emailResults() {
    // Option 1: Use mailto (limited, opens email client)
    const subject = "Visual Turing Test Results";
    const body = answers.map(a => `Trial ${a.trial}: chosen ${a.userChoice}, real was ${a.realSide} → ${a.correct ? "correct" : "wrong"}`).join("\n");
    window.location.href = `mailto:your-email@example.com?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    
    // Option 2 (recommended): Use EmailJS or Formspree – see next section
}

// Attach event listeners
leftBtn.addEventListener('click', () => recordAnswer('left'));
rightBtn.addEventListener('click', () => recordAnswer('right'));

// Start the test
loadTrial(0);