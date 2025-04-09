/**
 * Based on the phrase list introduced in:
 * Zhang, M. R., & Wobbrock, J. O. (2019).
 * Beyond the Input Stream: Making Text Entry Evaluations More Flexible with Transcription Sequences.
 * Proceedings of the 32nd Annual ACM Symposium on User Interface Software and Technology (UIST '19), 831–842.
 * https://doi.org/10.1145/3332165.3347922
 */
import { phrases } from './phrases.js';

const inputBox = document.getElementById('inputBox');
const suggestionsDiv = document.getElementById('suggestions');
const phraseDisplay = document.getElementById('phraseDisplay');
const startScreen = document.getElementById('startScreen');
const experimentUI = document.getElementById('experimentUI');
const participantNameInput = document.getElementById('participantName');
let participantName = "";
let consentTimestamp = "";
let allPhrases = [...phrases];
let trialPhrases = [];
let currentTrial = 0;
let currentBlock = 0;
let logData = [];
let currentWord = "";
let predictionDict = {};
let order = [];
let activeMode = "";
let trialStartTime = 0;
function tryStartStudy(first) {
    const name = participantNameInput.value.trim();
    if (!name) {
        alert("Please sign the consent form with your name before continuing.");
        return;
    }

    participantName = name;
    consentTimestamp = new Date().toISOString();
    saveConsentFile();
    startStudy(first);
}

function startStudy(first) {
    order = first === 'qwerty' ? ['qwerty', 'predictive'] : ['predictive', 'qwerty'];
    startScreen.style.display = 'none';
    experimentUI.style.display = 'block';
    startBlock();
}

// Start a block (QWERTY or Predictive)
function startBlock() {
    activeMode = order[currentBlock];
    trialPhrases = getRandomSample(allPhrases, 20);
    predictionDict = buildPredictionDict(trialPhrases);
    currentTrial = 0;

    phraseDisplay.innerText = `Starting ${activeMode.toUpperCase()} block...`;
    setTimeout(nextTrial, 1000);
}

// Advance to next phrase or next block
function nextTrial() {
    if (currentTrial >= trialPhrases.length) {
        logData.push({ type: "block_complete", block: activeMode, timestamp: Date.now() });

        currentBlock++;
        if (currentBlock >= order.length) {
            phraseDisplay.innerText = "All blocks complete. Thank you!";
            inputBox.disabled = true;

            saveLogDataCSV();
            return;
        } else {
            phraseDisplay.innerText = `Now begin the second block: ${order[currentBlock].toUpperCase()}`;
            inputBox.value = "";
            suggestionsDiv.innerHTML = "";
            setTimeout(startBlock, 2000);
        }
        return;
    }

    phraseDisplay.innerText = `[${currentTrial < 5 ? "Practice" : "Test"} ${currentTrial + 1}/20] → ${trialPhrases[currentTrial]}`;
    inputBox.value = "";
    inputBox.focus();
    currentWord = "";
    trialStartTime = Date.now();
}

// Build dictionary for predictive suggestions
function buildPredictionDict(phrases) {
    const dict = {};
    phrases.forEach(phrase => {
        const words = phrase.split(/\s+/);
        words.forEach(word => {
            const clean = word.toLowerCase().replace(/[^a-z]/g, '');
            for (let i = 1; i <= clean.length; i++) {
                const prefix = clean.slice(0, i);
                if (!dict[prefix]) dict[prefix] = new Set();
                dict[prefix].add(clean);
            }
        });
    });

    for (let key in dict) {
        dict[key] = Array.from(dict[key]);
    }
    return dict;
}

// Utility: Randomly sample array
function getRandomSample(arr, n) {
    const shuffled = arr.slice().sort(() => 0.5 - Math.random());
    return shuffled.slice(0, n);
}

// Update suggestions below input
function updateSuggestions(prefix) {
    suggestionsDiv.innerHTML = "";
    if (activeMode !== 'predictive') return;

    const suggestions = predictionDict[prefix.toLowerCase()] || [];
    suggestions.slice(0, 9).forEach((s, index) => {
        const span = document.createElement("span");
        span.className = "suggestion";
        span.innerText = `(${index + 1}) ${s}`;
        suggestionsDiv.appendChild(span);
    });
}

// Handle typing in the input
inputBox.addEventListener("input", () => {
    const cursorPos = inputBox.selectionStart;
    const textBeforeCursor = inputBox.value.substring(0, cursorPos);
    const words = textBeforeCursor.split(/\s+/);
    currentWord = words[words.length - 1];
    updateSuggestions(currentWord);
});

// Handle key events
document.addEventListener("keydown", (e) => {
    // Prediction selection (only in predictive mode)
    if (activeMode === 'predictive' && e.key >= "1" && e.key <= "9") {
        const index = parseInt(e.key) - 1;
        const suggestions = predictionDict[currentWord.toLowerCase()] || [];
        if (suggestions[index]) {
            e.preventDefault();

            const cursorPos = inputBox.selectionStart;
            let text = inputBox.value;
            let textBeforeCursor = text.substring(0, cursorPos);
            let textAfterCursor = text.substring(cursorPos);

            const lastWordStart = textBeforeCursor.lastIndexOf(currentWord);
            const newText = textBeforeCursor.substring(0, lastWordStart) +
                suggestions[index] + " " +
                textAfterCursor;

            inputBox.value = newText;
            inputBox.focus();

            const newCursorPos = lastWordStart + suggestions[index].length + 1;
            inputBox.setSelectionRange(newCursorPos, newCursorPos);

            logData.push({
                type: "prediction",
                method: activeMode,
                input: currentWord,
                selected: suggestions[index],
                phrase: trialPhrases[currentTrial],
                trial: currentTrial + 1,
                timestamp: Date.now()
            });

            currentWord = "";
            suggestionsDiv.innerHTML = "";
        }
    }

    // Submit phrase with Enter
    if (e.key === "Enter") {
        e.preventDefault();
        const userInput = inputBox.value.trim();
        const target = trialPhrases[currentTrial];

        logData.push({
            type: "submission",
            method: activeMode,
            entered: userInput,
            target: target,
            trial: currentTrial + 1,
            timeTakenMs: Date.now() - trialStartTime
        });

        currentTrial++;
        nextTrial();
    }
});

function saveConsentFile() {
    const content = `Participant Name: ${participantName}
Timestamp: ${consentTimestamp}

Consent Form:
You are invited to take part in a study on text entry techniques.
Your participation is voluntary, and you may withdraw at any time.
The study involves typing phrases using different methods and logging performance data.
No personally identifiable information will be shared.
This study will take around 15-20 minutes, and you will be required to type in total 40 short phrases using different methods.
You do not need to commute or spend any money for this study.
The study may not lead to any direct benefit.
By typing your name below, you consent to participate in the study.`;

    const blob = new Blob([content], { type: 'text/plain' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `consent_form_${participantName.replace(/\s+/g, '_')}.txt`;
    link.click();
}

function saveLogDataCSV() {
    if (!logData.length) return;

    const keys = Object.keys(logData[0]);
    const csv = [
        keys.join(","),
        ...logData.map(row => keys.map(k => JSON.stringify(row[k] ?? "")).join(","))
    ].join("\n");

    const blob = new Blob([csv], { type: 'text/csv' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `log_data_${participantName.replace(/\s+/g, '_')}.csv`;
    link.click();
}

// Make startStudy globally accessible from HTML buttons
window.startStudy = startStudy;
window.tryStartStudy = tryStartStudy;