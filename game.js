// The Lost Explorer - Core Game Script

// --- GAME STATE ---
let gameState = {
    score: 100,
    timeLeft: 300, // 5 minutes in seconds
    currentLevel: 1,
    wires: [], // elements: { from: { compId, term }, to: { compId, term }, pathEl }
    slots: {
        'slot-1': null, // type of component dropped, e.g., 'resistor'
        'slot-2': null
    },
    lanternState: 'OFF', // 'OFF', 'LIT', 'BURNT', 'FLASHING', 'SLOW_GLOW'
    isCircuitActive: false,
    activeDragSource: null, // { compId, term, x, y }
    tempWireEl: null,
    timerInterval: null,
    levelPassed: false,
    gameEnded: false
};

// --- LEVEL CONFIGURATION ---
const LEVELS = {
    1: {
        title: "Closed Circuit Basics",
        objective: "Form a closed loop from the Battery (+) to the Lantern, and back to Battery (-).",
        allowedComponents: [], // No extra slots needed, just wire battery directly to lantern
        slotsActive: 0
    },
    2: {
        title: "Resistor Protection",
        objective: "Light the bulb safely. Hint: A high direct current will burn the filament. Protect it!",
        allowedComponents: ['resistor', 'stone', 'stick'],
        slotsActive: 1
    },
    3: {
        title: "Capacitor Energy Storage",
        objective: "Charge the capacitor! Connect it in the circuit to see how it stores and blocks energy.",
        allowedComponents: ['resistor', 'capacitor', 'leaf'],
        slotsActive: 1
    },
    4: {
        title: "Inductor Slow Rise",
        objective: "Test the inductor. Connect the battery through the inductor to the bulb.",
        allowedComponents: ['resistor', 'inductor', 'bottle', 'compass'],
        slotsActive: 1
    },
    5: {
        title: "The Treasure Hunt",
        objective: "Use arrow keys or screen D-pad to navigate the forest, find the cave, and open the treasure chest!",
        allowedComponents: [],
        slotsActive: 0
    }
};

// --- AUDIO SYNTHESIZER ENGINE ---
let audioCtx = null;

function initAudio() {
    if (!audioCtx) {
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (audioCtx.state === 'suspended') {
        audioCtx.resume();
    }
}

function playSound(type) {
    try {
        initAudio();
        if (!audioCtx) return;
        const now = audioCtx.currentTime;

        switch (type) {
            case 'click': {
                const osc = audioCtx.createOscillator();
                const gain = audioCtx.createGain();
                osc.type = 'triangle';
                osc.frequency.setValueAtTime(350, now);
                osc.frequency.exponentialRampToValueAtTime(100, now + 0.08);
                gain.gain.setValueAtTime(0.12, now);
                gain.gain.exponentialRampToValueAtTime(0.01, now + 0.08);
                osc.connect(gain);
                gain.connect(audioCtx.destination);
                osc.start(now);
                osc.stop(now + 0.08);
                break;
            }
            case 'connect': {
                const osc = audioCtx.createOscillator();
                const gain = audioCtx.createGain();
                osc.type = 'sine';
                osc.frequency.setValueAtTime(261.63, now); // C4
                osc.frequency.setValueAtTime(392.00, now + 0.06); // G4
                gain.gain.setValueAtTime(0.15, now);
                gain.gain.exponentialRampToValueAtTime(0.01, now + 0.2);
                osc.connect(gain);
                gain.connect(audioCtx.destination);
                osc.start(now);
                osc.stop(now + 0.2);
                break;
            }
            case 'disconnect': {
                const osc = audioCtx.createOscillator();
                const gain = audioCtx.createGain();
                osc.type = 'sine';
                osc.frequency.setValueAtTime(392.00, now);
                osc.frequency.setValueAtTime(261.63, now + 0.06);
                gain.gain.setValueAtTime(0.1, now);
                gain.gain.exponentialRampToValueAtTime(0.01, now + 0.15);
                osc.connect(gain);
                gain.connect(audioCtx.destination);
                osc.start(now);
                osc.stop(now + 0.15);
                break;
            }
            case 'pop': {
                // Noise buffer generation for explosion sound
                const bufferSize = audioCtx.sampleRate * 0.25;
                const buffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
                const data = buffer.getChannelData(0);
                for (let i = 0; i < bufferSize; i++) {
                    data[i] = Math.random() * 2 - 1;
                }
                const noise = audioCtx.createBufferSource();
                noise.buffer = buffer;

                const filter = audioCtx.createBiquadFilter();
                filter.type = 'lowpass';
                filter.frequency.setValueAtTime(600, now);

                const gain = audioCtx.createGain();
                gain.gain.setValueAtTime(0.35, now);
                gain.gain.exponentialRampToValueAtTime(0.01, now + 0.2);

                noise.connect(filter);
                filter.connect(gain);
                gain.connect(audioCtx.destination);
                noise.start(now);
                noise.stop(now + 0.2);

                // Add a sad detuned drop note
                const osc = audioCtx.createOscillator();
                const oscGain = audioCtx.createGain();
                osc.type = 'sawtooth';
                osc.frequency.setValueAtTime(180, now + 0.05);
                osc.frequency.linearRampToValueAtTime(70, now + 0.5);
                oscGain.gain.setValueAtTime(0.2, now + 0.05);
                oscGain.gain.exponentialRampToValueAtTime(0.001, now + 0.5);
                osc.connect(oscGain);
                oscGain.connect(audioCtx.destination);
                osc.start(now + 0.05);
                osc.stop(now + 0.5);
                break;
            }
            case 'glow': {
                // Low power hum
                const osc1 = audioCtx.createOscillator();
                const osc2 = audioCtx.createOscillator();
                const gain = audioCtx.createGain();
                osc1.type = 'sine';
                osc1.frequency.setValueAtTime(120, now); // low mains hum
                osc2.type = 'triangle';
                osc2.frequency.setValueAtTime(122, now); // slightly detuned
                
                gain.gain.setValueAtTime(0.08, now);
                gain.gain.exponentialRampToValueAtTime(0.001, now + 0.8);
                
                osc1.connect(gain);
                osc2.connect(gain);
                gain.connect(audioCtx.destination);
                
                osc1.start(now);
                osc2.start(now);
                osc1.stop(now + 0.8);
                osc2.stop(now + 0.8);
                break;
            }
            case 'cap_discharge': {
                // High slide down
                const osc = audioCtx.createOscillator();
                const gain = audioCtx.createGain();
                osc.type = 'sine';
                osc.frequency.setValueAtTime(800, now);
                osc.frequency.exponentialRampToValueAtTime(200, now + 0.7);
                gain.gain.setValueAtTime(0.15, now);
                gain.gain.exponentialRampToValueAtTime(0.001, now + 0.7);
                osc.connect(gain);
                gain.connect(audioCtx.destination);
                osc.start(now);
                osc.stop(now + 0.7);
                break;
            }
            case 'success': {
                const notes = [261.63, 329.63, 392.00, 523.25]; // C4, E4, G4, C5
                notes.forEach((freq, idx) => {
                    const osc = audioCtx.createOscillator();
                    const gain = audioCtx.createGain();
                    osc.type = 'sine';
                    osc.frequency.setValueAtTime(freq, now + idx * 0.1);
                    gain.gain.setValueAtTime(0.12, now + idx * 0.1);
                    gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.1 + 0.4);
                    osc.connect(gain);
                    gain.connect(audioCtx.destination);
                    osc.start(now + idx * 0.1);
                    osc.stop(now + idx * 0.1 + 0.4);
                });
                break;
            }
            case 'victory': {
                const melody = [
                    { f: 261.63, d: 0.15 },
                    { f: 329.63, d: 0.15 },
                    { f: 392.00, d: 0.15 },
                    { f: 523.25, d: 0.3 },
                    { f: 392.00, d: 0.15 },
                    { f: 523.25, d: 0.6 }
                ];
                let timeAccum = 0;
                melody.forEach(note => {
                    const osc = audioCtx.createOscillator();
                    const gain = audioCtx.createGain();
                    osc.type = 'triangle';
                    osc.frequency.setValueAtTime(note.f, now + timeAccum);
                    gain.gain.setValueAtTime(0.15, now + timeAccum);
                    gain.gain.exponentialRampToValueAtTime(0.001, now + timeAccum + note.d);
                    osc.connect(gain);
                    gain.connect(audioCtx.destination);
                    osc.start(now + timeAccum);
                    osc.stop(now + timeAccum + note.d);
                    timeAccum += note.d * 0.8;
                });
                break;
            }
            case 'walk': {
                const osc = audioCtx.createOscillator();
                const gain = audioCtx.createGain();
                osc.type = 'triangle';
                osc.frequency.setValueAtTime(80, now);
                osc.frequency.exponentialRampToValueAtTime(30, now + 0.1);
                gain.gain.setValueAtTime(0.1, now);
                gain.gain.exponentialRampToValueAtTime(0.01, now + 0.1);
                osc.connect(gain);
                gain.connect(audioCtx.destination);
                osc.start(now);
                osc.stop(now + 0.1);
                break;
            }
            case 'gameover': {
                const osc = audioCtx.createOscillator();
                const gain = audioCtx.createGain();
                osc.type = 'sawtooth';
                osc.frequency.setValueAtTime(150, now);
                osc.frequency.linearRampToValueAtTime(50, now + 0.8);
                gain.gain.setValueAtTime(0.25, now);
                gain.gain.exponentialRampToValueAtTime(0.001, now + 0.8);
                osc.connect(gain);
                gain.connect(audioCtx.destination);
                osc.start(now);
                osc.stop(now + 0.8);
                break;
            }
        }
    } catch (e) {
        console.error("Audio Synthesis error: ", e);
    }
}

// --- DOM ELEMENTS ---
const svgOverlay = document.getElementById('wire-svg-overlay');
const timerValEl = document.getElementById('timer-val');
const scoreValEl = document.getElementById('score-val');
const levelNumEl = document.getElementById('current-level-num');
const objectiveTextEl = document.getElementById('objective-text');
const lanternStatusEl = document.getElementById('lantern-status');
const lanternGlowEl = document.getElementById('comp-lantern');
const bulbGlassEl = document.querySelector('.bulb-glass');
const bulbFilamentEl = document.getElementById('bulb-filament');
const burnMarkEl = document.getElementById('burn-mark');

// Modals
const introModal = document.getElementById('intro-modal');
const levelCompleteModal = document.getElementById('level-complete-modal');
const gameOverModal = document.getElementById('game-over-modal');
const treasureModal = document.getElementById('treasure-modal');
const alertBox = document.getElementById('circuit-status-alert');

// Buttons
const btnStartGame = document.getElementById('btn-start-game');
const btnClearCircuit = document.getElementById('btn-clear-circuit');
const btnResetLevel = document.getElementById('btn-reset-level');
const btnNextLevel = document.getElementById('btn-next-level');
const btnRestartGame = document.getElementById('btn-restart-game');
const btnReplay = document.getElementById('btn-replay');

// Slots
const slots = {
    'slot-1': document.getElementById('slot-1'),
    'slot-2': document.getElementById('slot-2')
};

// --- INITIALIZATION ---
window.addEventListener('DOMContentLoaded', () => {
    setupDraggableItems();
    setupDropSlots();
    setupWireDrawingListeners();
    setupButtons();
    createFireflies();
});

// Resize redraw utility
window.addEventListener('resize', () => {
    redrawWires();
});

function createFireflies() {
    const container = document.getElementById('fireflies-container');
    container.innerHTML = '';
    const screenWidth = window.innerWidth;
    const screenHeight = window.innerHeight;
    
    for (let i = 0; i < 20; i++) {
        const firefly = document.createElement('div');
        firefly.classList.add('firefly');
        firefly.style.left = Math.random() * screenWidth + 'px';
        firefly.style.top = Math.random() * (screenHeight * 0.8) + 'px';
        firefly.style.animationDelay = Math.random() * 5 + 's';
        firefly.style.animationDuration = (Math.random() * 4 + 4) + 's';
        container.appendChild(firefly);
    }
}

// --- SCORE AND TIMER ---
function startTimer() {
    if (gameState.timerInterval) clearInterval(gameState.timerInterval);
    gameState.timerInterval = setInterval(() => {
        if (gameState.timeLeft <= 0) {
            clearInterval(gameState.timerInterval);
            triggerGameOver();
        } else {
            gameState.timeLeft--;
            updateTimerDisplay();
        }
    }, 1000);
}

function updateTimerDisplay() {
    const mins = Math.floor(gameState.timeLeft / 60);
    const secs = gameState.timeLeft % 60;
    timerValEl.textContent = `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    
    // Add pulsing warning under 1 minute
    if (gameState.timeLeft <= 60) {
        document.getElementById('timer-display').classList.add('timer-warning');
    } else {
        document.getElementById('timer-display').classList.remove('timer-warning');
    }
}

function addScore(amount) {
    gameState.score = Math.max(0, gameState.score + amount);
    scoreValEl.textContent = gameState.score;
}

// --- BUTTONS SETUP ---
function setupButtons() {
    btnStartGame.addEventListener('click', () => {
        playSound('click');
        introModal.classList.add('hidden-element');
        startTimer();
        loadLevel(1);
    });

    btnClearCircuit.addEventListener('click', () => {
        playSound('click');
        clearWires();
    });

    btnResetLevel.addEventListener('click', () => {
        playSound('click');
        resetLevel();
    });

    btnNextLevel.addEventListener('click', () => {
        playSound('click');
        levelCompleteModal.classList.add('hidden-element');
        loadLevel(gameState.currentLevel + 1);
    });

    btnRestartGame.addEventListener('click', () => {
        playSound('click');
        gameOverModal.classList.add('hidden-element');
        restartGame();
    });

    btnReplay.addEventListener('click', () => {
        playSound('click');
        treasureModal.classList.add('hidden-element');
        restartGame();
    });
}

function restartGame() {
    gameState.score = 100;
    gameState.timeLeft = 300;
    gameState.gameEnded = false;
    document.getElementById('board-container').classList.remove('hidden-element');
    document.getElementById('treasure-maze-overlay').classList.add('hidden-element');
    document.getElementById('forest-background').className = 'dark-forest';
    
    scoreValEl.textContent = gameState.score;
    updateTimerDisplay();
    startTimer();
    loadLevel(1);
}

// --- LEVEL LOADER ---
function loadLevel(lvl) {
    gameState.currentLevel = lvl;
    gameState.levelPassed = false;
    levelNumEl.textContent = lvl;
    
    const config = LEVELS[lvl];
    document.getElementById('success-level-name').textContent = config.title;
    objectiveTextEl.textContent = config.objective;
    
    // Clear old breadboard configurations
    clearWires();
    resetSlots();
    
    // Update inventory lock states based on level configs
    const invItems = document.querySelectorAll('.inv-item');
    invItems.forEach(item => {
        const type = item.getAttribute('data-type');
        if (config.allowedComponents.includes(type)) {
            item.classList.remove('locked');
            item.setAttribute('draggable', 'true');
        } else {
            item.classList.add('locked');
            item.setAttribute('draggable', 'false');
        }
    });

    // Handle board overlays
    if (lvl === 5) {
        clearInterval(gameState.timerInterval); // Stop timer for final hunt!
        startTreasureHunt();
    } else {
        // Render slots depending on level requirements
        const slot1El = document.getElementById('slot-1');
        const slot2El = document.getElementById('slot-2');
        
        if (config.slotsActive >= 1) {
            slot1El.style.display = 'flex';
        } else {
            slot1El.style.display = 'none';
        }

        if (config.slotsActive >= 2) {
            slot2El.style.display = 'flex';
        } else {
            slot2El.style.display = 'none';
        }

        // Restore Lantern status
        setLanternState('OFF');
    }
}

function resetLevel() {
    loadLevel(gameState.currentLevel);
}

// --- DRAG AND DROP HANDLERS ---
function setupDraggableItems() {
    const draggables = document.querySelectorAll('.inv-item');
    draggables.forEach(drag => {
        drag.addEventListener('dragstart', (e) => {
            if (drag.classList.contains('locked')) {
                e.preventDefault();
                return;
            }
            drag.classList.add('dragging');
            e.dataTransfer.setData('text/plain', drag.getAttribute('data-type'));
        });

        drag.addEventListener('dragend', () => {
            drag.classList.remove('dragging');
        });
    });
}

function setupDropSlots() {
    const slotsList = document.querySelectorAll('.component-slot');
    slotsList.forEach(slot => {
        slot.addEventListener('dragover', (e) => {
            e.preventDefault();
            slot.classList.add('drag-over');
        });

        slot.addEventListener('dragleave', () => {
            slot.classList.remove('drag-over');
        });

        slot.addEventListener('drop', (e) => {
            e.preventDefault();
            slot.classList.remove('drag-over');
            
            const type = e.dataTransfer.getData('text/plain');
            const slotIndex = slot.getAttribute('data-slot-index');
            
            dropComponentInSlot(`slot-${slotIndex}`, type);
        });
    });
}

function dropComponentInSlot(slotId, type) {
    const slotEl = document.getElementById(slotId);
    
    // Clear any wires attached to the current slot's terminals before replacement
    removeSlotWires(slotId);

    // Save slot configuration
    gameState.slots[slotId] = type;
    playSound('connect');
    
    // Render slot layout
    let innerContent = '';
    const readableName = type.toUpperCase();

    if (type === 'resistor') {
        innerContent = `
            <div class="component" data-component-type="resistor" id="comp-${slotId}">
                <div class="component-icon">
                    <svg viewBox="0 0 100 40" width="80" height="32">
                        <line x1="10" y1="20" x2="30" y2="20" stroke="#334155" stroke-width="3"/>
                        <path d="M30,20 L34,10 L40,30 L46,10 L52,30 L58,10 L64,30 L70,20" fill="none" stroke="var(--neon-yellow)" stroke-width="3"/>
                        <line x1="70" y1="20" x2="90" y2="20" stroke="#334155" stroke-width="3"/>
                    </svg>
                </div>
                <div class="component-label">${readableName}</div>
                <div class="terminals-row">
                    <div class="terminal-node" id="term-${slotId}-a" data-comp-id="${slotId}" data-terminal="a" title="Resistor Term A"></div>
                    <div class="terminal-node" id="term-${slotId}-b" data-comp-id="${slotId}" data-terminal="b" title="Resistor Term B"></div>
                </div>
            </div>
        `;
    } else if (type === 'capacitor') {
        innerContent = `
            <div class="component" data-component-type="capacitor" id="comp-${slotId}">
                <div class="component-icon">
                    <svg viewBox="0 0 100 40" width="80" height="32">
                        <line x1="10" y1="20" x2="45" y2="20" stroke="#334155" stroke-width="3"/>
                        <line x1="45" y1="5" x2="45" y2="35" stroke="var(--neon-orange)" stroke-width="4"/>
                        <line x1="55" y1="5" x2="55" y2="35" stroke="var(--neon-orange)" stroke-width="4"/>
                        <line x1="55" y1="20" x2="90" y2="20" stroke="#334155" stroke-width="3"/>
                    </svg>
                </div>
                <div class="component-label">${readableName}</div>
                <div class="terminals-row">
                    <div class="terminal-node" id="term-${slotId}-a" data-comp-id="${slotId}" data-terminal="a" title="Capacitor Term A"></div>
                    <div class="terminal-node" id="term-${slotId}-b" data-comp-id="${slotId}" data-terminal="b" title="Capacitor Term B"></div>
                </div>
            </div>
        `;
    } else if (type === 'inductor') {
        innerContent = `
            <div class="component" data-component-type="inductor" id="comp-${slotId}">
                <div class="component-icon">
                    <svg viewBox="0 0 100 40" width="80" height="32">
                        <line x1="10" y1="20" x2="25" y2="20" stroke="#334155" stroke-width="3"/>
                        <path d="M25,20 Q31,5 37,20 Q43,5 49,20 Q55,5 61,20 Q67,5 73,20" fill="none" stroke="var(--neon-purple)" stroke-width="3"/>
                        <line x1="73" y1="20" x2="90" y2="20" stroke="#334155" stroke-width="3"/>
                    </svg>
                </div>
                <div class="component-label">${readableName}</div>
                <div class="terminals-row">
                    <div class="terminal-node" id="term-${slotId}-a" data-comp-id="${slotId}" data-terminal="a" title="Inductor Term A"></div>
                    <div class="terminal-node" id="term-${slotId}-b" data-comp-id="${slotId}" data-terminal="b" title="Inductor Term B"></div>
                </div>
            </div>
        `;
    } else {
        // Insulator / Useless item
        let emoji = '❌';
        let customClass = '';
        if (type === 'stone') emoji = '🪨';
        if (type === 'leaf') emoji = '🍃';
        if (type === 'stick') emoji = '🪵';
        if (type === 'bottle') emoji = '🧃';
        if (type === 'compass') emoji = '🧭';

        innerContent = `
            <div class="component" data-component-type="${type}" id="comp-${slotId}">
                <div class="component-icon" style="font-size: 26px;">${emoji}</div>
                <div class="component-label">${readableName} (INSULATOR)</div>
                <div class="terminals-row">
                    <div class="terminal-node" id="term-${slotId}-a" data-comp-id="${slotId}" data-terminal="a" title="Non-conductive terminal" style="background:#475569; border-color:#1e293b;"></div>
                    <div class="terminal-node" id="term-${slotId}-b" data-comp-id="${slotId}" data-terminal="b" title="Non-conductive terminal" style="background:#475569; border-color:#1e293b;"></div>
                </div>
            </div>
        `;
    }

    slotEl.innerHTML = innerContent;
    
    // Bind click/drag wiring listeners to the new terminal nodes
    bindTerminalEvents(document.getElementById(`term-${slotId}-a`));
    bindTerminalEvents(document.getElementById(`term-${slotId}-b`));

    checkCircuit();
}

function resetSlots() {
    gameState.slots = { 'slot-1': null, 'slot-2': null };
    document.getElementById('slot-1').innerHTML = '<div class="slot-placeholder-text">DROP COMPONENT HERE</div>';
    document.getElementById('slot-2').innerHTML = '<div class="slot-placeholder-text">DROP COMPONENT HERE</div>';
}

// --- WIRING AND SVG RENDER ENGINE ---
function setupWireDrawingListeners() {
    // Bind core lantern and battery elements
    bindTerminalEvents(document.getElementById('term-bulb-a'));
    bindTerminalEvents(document.getElementById('term-bulb-b'));
    bindTerminalEvents(document.getElementById('term-battery-pos'));
    bindTerminalEvents(document.getElementById('term-battery-neg'));

    // Global drag tracking over the arena
    const mainArena = document.getElementById('breadboard');
    
    mainArena.addEventListener('mousemove', handleWireDragging);
    mainArena.addEventListener('touchmove', handleWireDragging, { passive: false });
    
    window.addEventListener('mouseup', endWireDrag);
    window.addEventListener('touchend', endWireDrag);
}

function bindTerminalEvents(terminalEl) {
    if (!terminalEl) return;
    
    const triggerStart = (e) => {
        // Prevent bubble pops/warnings from active modals blocking interaction
        if (gameState.levelPassed || gameState.gameEnded) return;

        e.stopPropagation();
        e.preventDefault();
        
        playSound('click');
        const touch = e.touches ? e.touches[0] : e;
        const compId = terminalEl.getAttribute('data-comp-id');
        const term = terminalEl.getAttribute('data-terminal');
        
        const coords = getNodeCoords(terminalEl);
        
        gameState.activeDragSource = {
            compId: compId,
            term: term,
            element: terminalEl,
            x: coords.x,
            y: coords.y
        };

        // Create temporary drawing path in SVG
        gameState.tempWireEl = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        gameState.tempWireEl.setAttribute('id', 'temp-wire');
        gameState.tempWireEl.setAttribute('fill', 'none');
        gameState.tempWireEl.setAttribute('stroke', 'rgba(255, 255, 255, 0.45)');
        gameState.tempWireEl.setAttribute('stroke-width', '3');
        gameState.tempWireEl.setAttribute('stroke-dasharray', '4, 4');
        svgOverlay.appendChild(gameState.tempWireEl);
        svgOverlay.classList.add('dragging-wire');
    };

    terminalEl.addEventListener('mousedown', triggerStart);
    terminalEl.addEventListener('touchstart', triggerStart, { passive: false });
}

function handleWireDragging(e) {
    if (!gameState.activeDragSource || !gameState.tempWireEl) return;
    e.preventDefault(); // prevent scroll on touch

    const touch = e.touches ? e.touches[0] : e;
    const svgRect = svgOverlay.getBoundingClientRect();
    const mouseX = touch.clientX - svgRect.left;
    const mouseY = touch.clientY - svgRect.top;
    
    const startX = gameState.activeDragSource.x;
    const startY = gameState.activeDragSource.y;
    
    // Draw beautiful cubic Bezier curve
    const cpY1 = startY + (mouseY - startY) / 2;
    const cpY2 = mouseY - (mouseY - startY) / 2;
    const pathString = `M ${startX} ${startY} C ${startX} ${cpY1}, ${mouseX} ${cpY2}, ${mouseX} ${mouseY}`;
    
    gameState.tempWireEl.setAttribute('d', pathString);
}

function endWireDrag(e) {
    if (!gameState.activeDragSource) return;

    // Clean up temporary path
    if (gameState.tempWireEl) {
        gameState.tempWireEl.remove();
        gameState.tempWireEl = null;
    }
    svgOverlay.classList.remove('dragging-wire');

    const touch = e.changedTouches ? e.changedTouches[0] : e;
    
    // Find terminal node under cursor
    const element = document.elementFromPoint(touch.clientX, touch.clientY);
    
    if (element && element.classList.contains('terminal-node')) {
        const destCompId = element.getAttribute('data-comp-id');
        const destTerm = element.getAttribute('data-terminal');
        
        const src = gameState.activeDragSource;
        
        // Validation: Cannot wire to itself
        if (src.compId === destCompId && src.term === destTerm) {
            gameState.activeDragSource = null;
            return;
        }

        // Validation: Wire connection shouldn't already exist
        const isDuplicate = gameState.wires.some(w => 
            (w.from.compId === src.compId && w.from.term === src.term && w.to.compId === destCompId && w.to.term === destTerm) ||
            (w.from.compId === destCompId && w.from.term === destTerm && w.to.compId === src.compId && w.to.term === src.term)
        );

        if (!isDuplicate) {
            // Register wire
            const newWire = {
                from: { compId: src.compId, term: src.term },
                to: { compId: destCompId, term: destTerm }
            };
            gameState.wires.push(newWire);
            playSound('connect');
            redrawWires();
            checkCircuit();
        }
    }
    
    gameState.activeDragSource = null;
}

function getTerminalElement(compId, term) {
    if (compId === 'lantern') {
        return document.getElementById(term === 'a' ? 'term-bulb-a' : 'term-bulb-b');
    }
    if (compId === 'battery') {
        return document.getElementById(term === 'pos' ? 'term-battery-pos' : 'term-battery-neg');
    }
    return document.getElementById(`term-${compId}-${term}`);
}

function getNodeCoords(nodeEl) {
    if (!nodeEl) return { x: 0, y: 0 };
    const nodeRect = nodeEl.getBoundingClientRect();
    const svgRect = svgOverlay.getBoundingClientRect();
    return {
        x: nodeRect.left - svgRect.left + nodeRect.width / 2,
        y: nodeRect.top - svgRect.top + nodeRect.height / 2
    };
}

function redrawWires() {
    // Clear overlay
    svgOverlay.innerHTML = '';
    
    // Tag terminal nodes as unconnected by default
    document.querySelectorAll('.terminal-node').forEach(node => {
        node.classList.remove('connected');
    });

    gameState.wires.forEach((wire, index) => {
        const fromEl = getTerminalElement(wire.from.compId, wire.from.term);
        const toEl = getTerminalElement(wire.to.compId, wire.to.term);
        
        if (!fromEl || !toEl) return; // slot component might have been removed

        // Mark nodes as connected
        fromEl.classList.add('connected');
        toEl.classList.add('connected');

        const p1 = getNodeCoords(fromEl);
        const p2 = getNodeCoords(toEl);

        const cpY1 = p1.y + (p2.y - p1.y) / 2;
        const cpY2 = p2.y - (p2.y - p1.y) / 2;
        const d = `M ${p1.x} ${p1.y} C ${p1.x} ${cpY1}, ${p2.x} ${cpY2}, ${p2.x} ${p2.y}`;

        // Create main wire element
        const wirePath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        wirePath.setAttribute('d', d);
        wirePath.setAttribute('class', 'drawn-wire');
        
        // Color different components wire groups
        if (wire.from.compId === 'battery' || wire.to.compId === 'battery') {
            wirePath.style.stroke = 'rgba(239, 68, 68, 0.85)'; // Power Red wire
        } else {
            wirePath.style.stroke = 'rgba(56, 189, 248, 0.85)'; // Neon Blue wire
        }
        
        // Double-click to remove wire listener
        wirePath.addEventListener('dblclick', () => {
            removeWire(index);
        });

        // Touch double tap simulator
        let lastTap = 0;
        wirePath.addEventListener('touchstart', (e) => {
            const now = new Date().getTime();
            const timespan = now - lastTap;
            if (timespan < 300 && timespan > 0) {
                e.preventDefault();
                removeWire(index);
            }
            lastTap = now;
        });

        svgOverlay.appendChild(wirePath);
        wire.pathEl = wirePath;

        // If circuit is conductive, append flowing electrons dashed overlay
        if (gameState.isCircuitActive && gameState.lanternState !== 'OFF' && gameState.lanternState !== 'BURNT') {
            const electronsPath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
            electronsPath.setAttribute('d', d);
            electronsPath.setAttribute('class', 'wire-electrons');
            
            // Adjust electron speed based on component behaviors
            if (gameState.lanternState === 'SLOW_GLOW') {
                electronsPath.style.animationDuration = '2.5s'; // slows down through inductor
            } else {
                electronsPath.style.animationDuration = '1.2s';
            }

            svgOverlay.appendChild(electronsPath);
            wire.electronEl = electronsPath;
        }
    });
}

function removeWire(idx) {
    if (gameState.levelPassed || gameState.gameEnded) return;
    gameState.wires.splice(idx, 1);
    playSound('disconnect');
    redrawWires();
    checkCircuit();
}

function removeSlotWires(slotId) {
    gameState.wires = gameState.wires.filter(w => 
        w.from.compId !== slotId && w.to.compId !== slotId
    );
    redrawWires();
}

function clearWires() {
    if (gameState.levelPassed || gameState.gameEnded) return;
    gameState.wires = [];
    playSound('disconnect');
    redrawWires();
    checkCircuit();
}

// --- CIRCUIT RESOLVER AND SIMULATOR ---
function checkCircuit() {
    if (gameState.lanternState === 'BURNT') return; // Cannot evaluate once popped

    // Build the graph adjacency list
    const adj = {};
    const registerEdge = (u, v) => {
        if (!adj[u]) adj[u] = [];
        if (!adj[v]) adj[v] = [];
        adj[u].push(v);
        adj[v].push(u);
    };

    // Add wires (user connections)
    gameState.wires.forEach(w => {
        const u = `${w.from.compId}-${w.from.term}`;
        const v = `${w.to.compId}-${w.to.term}`;
        registerEdge(u, v);
    });

    // Add internal component links (if conductive)
    // Lantern always connects internal A and B
    registerEdge('lantern-a', 'lantern-b');

    // Slot 1 internal connections
    if (gameState.slots['slot-1']) {
        const t = gameState.slots['slot-1'];
        // Conductors allow internal paths
        if (t === 'resistor' || t === 'capacitor' || t === 'inductor') {
            registerEdge('slot-1-a', 'slot-1-b');
        }
        // Insulators (stone, leaf, stick, etc.) don't add internal edges
    }

    // Slot 2 internal connections
    if (gameState.slots['slot-2']) {
        const t = gameState.slots['slot-2'];
        if (t === 'resistor' || t === 'capacitor' || t === 'inductor') {
            registerEdge('slot-2-a', 'slot-2-b');
        }
    }

    // Check path between battery positive and negative
    const path = findCircuitPath('battery-pos', 'battery-neg', adj);
    
    if (path) {
        gameState.isCircuitActive = true;
        evaluatePathComponents(path);
    } else {
        gameState.isCircuitActive = false;
        setLanternState('OFF');
        redrawWires(); // remove any moving electrons
    }
}

function findCircuitPath(start, end, graph) {
    const visited = new Set();
    const parent = {};
    const queue = [start];
    visited.add(start);
    let found = false;

    while (queue.length > 0) {
        const curr = queue.shift();
        if (curr === end) {
            found = true;
            break;
        }
        const neighbors = graph[curr] || [];
        for (const next of neighbors) {
            if (!visited.has(next)) {
                visited.add(next);
                parent[next] = curr;
                queue.push(next);
            }
        }
    }

    if (!found) return null;

    // Build path array
    const path = [];
    let curr = end;
    while (curr !== start) {
        path.push(curr);
        curr = parent[curr];
    }
    path.push(start);
    return path.reverse();
}

function evaluatePathComponents(path) {
    // Check what is in the path
    const nodes = new Set(path);
    
    // Check if the lantern is in the loop
    const hasLantern = nodes.has('lantern-a') && nodes.has('lantern-b');
    
    if (!hasLantern) {
        // Short circuit (battery connected directly without bulb)
        triggerAlert("SHORT CIRCUIT WARNING", "Direct path between battery terminals detected! Circuit draws max current. Lantern remains OFF.", "⚡");
        setLanternState('OFF');
        redrawWires();
        return;
    }

    // Identify active slots traversed
    let hasResistor = false;
    let hasCapacitor = false;
    let hasInductor = false;

    if (nodes.has('slot-1-a') && nodes.has('slot-1-b')) {
        const t = gameState.slots['slot-1'];
        if (t === 'resistor') hasResistor = true;
        if (t === 'capacitor') hasCapacitor = true;
        if (t === 'inductor') hasInductor = true;
    }

    if (nodes.has('slot-2-a') && nodes.has('slot-2-b')) {
        const t = gameState.slots['slot-2'];
        if (t === 'resistor') hasResistor = true;
        if (t === 'capacitor') hasCapacitor = true;
        if (t === 'inductor') hasInductor = true;
    }

    // Evaluate based on level
    if (gameState.currentLevel === 1) {
        // Level 1: closed loop battery -> bulb. No resistor required yet.
        setLanternState('LIT');
        redrawWires();
        triggerSuccess("Closed Circuit Mastered", "Great job! You made a complete loop. Electric current flows from the positive terminal, lights the lantern, and returns to the negative terminal.");
    } 
    else if (gameState.currentLevel === 2) {
        // Level 2: Resistor protection
        if (!hasResistor) {
            // BULB BURNT!
            setLanternState('BURNT');
            redrawWires();
            triggerExplosion();
        } else {
            setLanternState('LIT');
            redrawWires();
            triggerSuccess("Resistor Safety Mastered", "Excellent! The resistor acts as a current controller. By adding resistance, it reduces the total flow, preventing the fragile bulb filament from overheating and burning out.");
        }
    } 
    else if (gameState.currentLevel === 3) {
        // Level 3: Capacitor
        if (hasCapacitor) {
            setLanternState('FLASHING');
            redrawWires();
        } else {
            setLanternState('LIT');
            redrawWires();
            triggerAlert("LIGHTED BUT NOT SOLVED", "The lantern is glowing, but we need to demonstrate how a CAPACITOR operates. Try incorporating the capacitor in the circuit loop.", "💡");
        }
    } 
    else if (gameState.currentLevel === 4) {
        // Level 4: Inductor
        if (hasInductor) {
            setLanternState('SLOW_GLOW');
            redrawWires();
        } else {
            setLanternState('LIT');
            redrawWires();
            triggerAlert("LIGHTED BUT NOT SOLVED", "The lantern is glowing, but we need to demonstrate how an INDUCTOR operates. Try incorporating the inductor in the circuit loop.", "💡");
        }
    }
}

// --- LANTERN STATES RENDERING ---
function setLanternState(state) {
    gameState.lanternState = state;
    lanternStatusEl.textContent = state;
    
    // Reset visual classes
    lanternGlowEl.classList.remove('glow-active', 'glow-active-slow');
    bulbGlassEl.classList.remove('bulb-glass-glow', 'bulb-burnt');
    bulbFilamentEl.classList.remove('filament-glow', 'filament-glow-slow');
    burnMarkEl.classList.add('hidden-element');

    if (state === 'LIT') {
        playSound('glow');
        lanternGlowEl.classList.add('glow-active');
        bulbGlassEl.classList.add('bulb-glass-glow');
        bulbFilamentEl.classList.add('filament-glow');
        lanternStatusEl.style.background = 'var(--neon-green)';
    } 
    else if (state === 'SLOW_GLOW') {
        // Slowly ramp up filament glow
        playSound('glow');
        playSound('slow_glow');
        lanternGlowEl.classList.add('glow-active-slow');
        bulbGlassEl.classList.add('bulb-glass-glow');
        bulbFilamentEl.classList.add('filament-glow-slow');
        lanternStatusEl.style.background = 'var(--neon-purple)';
        
        setTimeout(() => {
            if (gameState.lanternState === 'SLOW_GLOW') {
                triggerSuccess("Inductance Behavior Mastered", "Superb! You observed that the bulb lights up gradually. An inductor stores energy in a magnetic field, opposing sudden changes in current, letting it ramp up slowly to its peak.");
            }
        }, 2200);
    }
    else if (state === 'FLASHING') {
        // Flash bulb then go dark
        playSound('cap_discharge');
        lanternGlowEl.classList.add('glow-active');
        bulbGlassEl.classList.add('bulb-glass-glow');
        bulbFilamentEl.classList.add('filament-glow');
        lanternStatusEl.style.background = 'var(--neon-orange)';
        
        setTimeout(() => {
            if (gameState.lanternState === 'FLASHING') {
                // Dim down
                lanternGlowEl.classList.remove('glow-active');
                bulbGlassEl.classList.remove('bulb-glass-glow');
                bulbFilamentEl.classList.remove('filament-glow');
                lanternStatusEl.textContent = 'CHARGED (OFF)';
                lanternStatusEl.style.background = '#475569';
                
                // Halt moving electrons in the wire overlay
                gameState.isCircuitActive = false;
                redrawWires();

                triggerSuccess("Capacitor Storage Mastered", "Amazing! The capacitor stores charges on its plates. As it charges, it blocks DC current, behaving like an open switch once fully charged. Thus the flash, then darkness!");
            }
        }, 1000);
    }
    else if (state === 'BURNT') {
        lanternStatusEl.style.background = 'var(--neon-red)';
    }
    else {
        // OFF
        lanternStatusEl.style.background = '#475569';
    }
}

// --- POP/EXPLOSION PARTICLE ANIMATOR ---
function triggerExplosion() {
    playSound('pop');
    
    // Add soot-burn marks to bulb SVG
    bulbGlassEl.classList.add('bulb-burnt');
    burnMarkEl.classList.remove('hidden-element');

    const lanternEl = document.getElementById('comp-lantern');
    const rect = lanternEl.getBoundingClientRect();
    const boardRect = document.getElementById('breadboard').getBoundingClientRect();
    const posX = rect.left - boardRect.left + rect.width / 2;
    const posY = rect.top - boardRect.top + rect.height / 2;

    // Create smoke and sparks
    const breadboard = document.getElementById('breadboard');
    for (let i = 0; i < 15; i++) {
        const particle = document.createElement('div');
        particle.classList.add(Math.random() > 0.4 ? 'smoke-particle' : 'fire-spark');
        
        const angle = Math.random() * Math.PI * 2;
        const dist = Math.random() * 50 + 20;
        const dx = Math.cos(angle) * dist;
        const dy = Math.sin(angle) * dist;
        
        particle.style.left = posX + 'px';
        particle.style.top = posY + 'px';
        particle.style.setProperty('--dx', dx + 'px');
        particle.style.setProperty('--dy', dy + 'px');
        
        breadboard.appendChild(particle);
        
        setTimeout(() => particle.remove(), 1000);
    }

    addScore(-10);
    triggerAlert("BULB BURNT", "Current spike cracked the filament! Resistor is missing. Press Reset Level to restore.", "💥");
}

// --- UI ALERTS & OVERLAYS ---
let alertTimeout = null;
function triggerAlert(title, message, icon) {
    if (alertTimeout) clearTimeout(alertTimeout);
    
    document.getElementById('alert-title').textContent = title;
    document.getElementById('alert-message').textContent = message;
    document.getElementById('alert-icon-svg').textContent = icon;
    
    alertBox.classList.remove('hidden-element');
    
    alertTimeout = setTimeout(() => {
        alertBox.classList.add('hidden-element');
    }, 4500);
}

function triggerSuccess(title, explanation) {
    if (gameState.levelPassed) return;
    gameState.levelPassed = true;
    
    // Increment points
    addScore(50);
    playSound('success');

    // Load next level button index
    document.getElementById('next-level-num').textContent = gameState.currentLevel + 1;
    document.getElementById('level-explanation-text').innerHTML = `
        <p>${explanation}</p>
        <p class="font-sm" style="color:var(--neon-green); margin-top:10px;">🏆 +50 Explorer Points Added!</p>
    `;

    // Inject corresponding component animation SVG
    const animContainer = document.getElementById('level-complete-animation-container');
    let svgHtml = '';
    
    if (gameState.currentLevel === 1) {
        svgHtml = `
            <svg viewBox="0 0 120 60" width="120" height="60">
                <line x1="15" y1="22" x2="15" y2="38" stroke="var(--neon-red)" stroke-width="3"/>
                <line x1="23" y1="26" x2="23" y2="34" stroke="var(--neon-blue)" stroke-width="1.5"/>
                <path d="M15,30 L5,30 L5,10 L115,10 L115,30" fill="none" stroke="rgba(56, 189, 248, 0.5)" stroke-width="2.5"/>
                <path d="M23,30 L115,30" fill="none" stroke="rgba(56, 189, 248, 0.5)" stroke-width="2.5"/>
                <circle cx="115" cy="30" r="8" fill="rgba(251, 191, 36, 0.2)" stroke="var(--neon-yellow)" stroke-width="2"/>
                <path d="M110,25 L120,35 M120,25 L110,35" stroke="var(--neon-yellow)" stroke-width="1.5"/>
                <circle class="electron" r="3" cx="0" cy="0" fill="var(--neon-yellow)">
                    <animateMotion dur="2.0s" repeatCount="indefinite" path="M15,30 L5,30 L5,10 L115,10 L115,30 M115,30 L23,30"/>
                </circle>
            </svg>
        `;
    } else if (gameState.currentLevel === 2) {
        svgHtml = `
            <svg viewBox="0 0 120 60" width="120" height="60">
                <path d="M5,30 L25,30 L33,15 L41,45 L49,15 L57,45 L65,15 L73,30 L115,30" fill="none" stroke="var(--neon-blue)" stroke-width="3"/>
                <circle class="electron" r="3" cx="0" cy="0" fill="var(--neon-yellow)">
                    <animateMotion dur="2.6s" repeatCount="indefinite" calcMode="linear"
                        keyPoints="0;0.22;1" keyTimes="0;0.14;1"
                        path="M5,30 L25,30 L33,15 L41,45 L49,15 L57,45 L65,15 L73,30 L115,30"/>
                </circle>
                <circle class="electron" r="3" cx="0" cy="0" fill="var(--neon-yellow)" opacity="0.6">
                    <animateMotion dur="2.6s" repeatCount="indefinite" begin="-0.9s" calcMode="linear"
                        keyPoints="0;0.22;1" keyTimes="0;0.14;1"
                        path="M5,30 L25,30 L33,15 L41,45 L49,15 L57,45 L65,15 L73,30 L115,30"/>
                </circle>
                <circle class="electron" r="3" cx="0" cy="0" fill="var(--neon-yellow)" opacity="0.6">
                    <animateMotion dur="2.6s" repeatCount="indefinite" begin="-1.8s" calcMode="linear"
                        keyPoints="0;0.22;1" keyTimes="0;0.14;1"
                        path="M5,30 L25,30 L33,15 L41,45 L49,15 L57,45 L65,15 L73,30 L115,30"/>
                </circle>
            </svg>
        `;
    } else if (gameState.currentLevel === 3) {
        svgHtml = `
            <svg viewBox="0 0 120 60" width="120" height="60">
                <path d="M5,30 L50,30" fill="none" stroke="var(--neon-blue)" stroke-width="3"/>
                <path d="M70,30 L115,30" fill="none" stroke="var(--neon-blue)" stroke-width="3"/>
                <path d="M50,10 L50,50" fill="none" stroke="var(--neon-orange)" stroke-width="3"/>
                <path d="M70,10 L70,50" fill="none" stroke="var(--neon-orange)" stroke-width="3"/>
                <rect x="53" width="14" y="50" height="0" fill="var(--neon-blue)" opacity="0.55">
                    <animate attributeName="height" values="0;40;40;0" keyTimes="0;0.8;0.92;1" dur="2.8s" repeatCount="indefinite"/>
                    <animate attributeName="y" values="50;10;10;50" keyTimes="0;0.8;0.92;1" dur="2.8s" repeatCount="indefinite"/>
                </rect>
                <circle cx="60" cy="30" r="26" fill="var(--neon-yellow)" opacity="0">
                    <animate attributeName="opacity" values="0;0;0.9;0" keyTimes="0;0.8;0.88;1" dur="2.8s" repeatCount="indefinite"/>
                </circle>
                <circle class="electron" r="3" cx="0" cy="0" fill="var(--neon-yellow)">
                    <animateMotion dur="2.8s" repeatCount="indefinite" path="M5,30 L48,30"/>
                    <animate attributeName="opacity" values="1;1;0" keyTimes="0;0.75;0.8" dur="2.8s" repeatCount="indefinite"/>
                </circle>
                <circle class="electron" r="3" cx="0" cy="0" fill="var(--neon-yellow)">
                    <animateMotion dur="2.8s" repeatCount="indefinite" begin="-1.4s" path="M5,30 L48,30"/>
                    <animate attributeName="opacity" values="1;1;0" keyTimes="0;0.75;0.8" dur="2.8s" repeatCount="indefinite"/>
                </circle>
                <circle class="electron" r="3.4" cx="0" cy="0" fill="var(--neon-yellow)" opacity="0">
                    <animateMotion dur="2.8s" repeatCount="indefinite" calcMode="linear" keyPoints="0;0;1;1" keyTimes="0;0.8;0.9;1" path="M72,30 L115,30"/>
                    <animate attributeName="opacity" values="0;0;1;1;0" keyTimes="0;0.79;0.82;0.95;1" dur="2.8s" repeatCount="indefinite"/>
                </circle>
                <circle class="electron" r="3.4" cx="0" cy="0" fill="var(--neon-yellow)" opacity="0">
                    <animateMotion dur="2.8s" repeatCount="indefinite" calcMode="linear" keyPoints="0;0;1;1" keyTimes="0;0.82;0.92;1" path="M72,30 L115,30"/>
                    <animate attributeName="opacity" values="0;0;1;1;0" keyTimes="0;0.81;0.84;0.97;1" dur="2.8s" repeatCount="indefinite"/>
                </circle>
            </svg>
        `;
    } else if (gameState.currentLevel === 4) {
        svgHtml = `
            <svg viewBox="0 0 120 60" width="120" height="60">
                <path d="M5,30 Q20,10 35,30 Q50,10 65,30 Q80,10 95,30 L115,30" fill="none" stroke="var(--neon-purple)" stroke-width="3"/>
                <circle cx="50" cy="20" r="6" fill="none" stroke="var(--neon-blue)" stroke-width="1.5" opacity="0">
                    <animate attributeName="r" values="4;22" dur="2.4s" repeatCount="indefinite"/>
                    <animate attributeName="opacity" values="0.6;0" dur="2.4s" repeatCount="indefinite"/>
                </circle>
                <circle cx="50" cy="20" r="6" fill="none" stroke="var(--neon-blue)" stroke-width="1.5" opacity="0">
                    <animate attributeName="r" values="4;22" dur="2.4s" repeatCount="indefinite" begin="-1.2s"/>
                    <animate attributeName="opacity" values="0.6;0" dur="2.4s" repeatCount="indefinite" begin="-1.2s"/>
                </circle>
                <circle class="electron" r="3" cx="0" cy="0" fill="var(--neon-yellow)">
                    <animateMotion dur="2.4s" repeatCount="indefinite" path="M5,30 Q20,10 35,30 Q50,10 65,30 Q80,10 95,30 L115,30"/>
                </circle>
                <circle class="electron" r="3" cx="0" cy="0" fill="var(--neon-yellow)">
                    <animateMotion dur="2.4s" repeatCount="indefinite" begin="-1.2s" path="M5,30 Q20,10 35,30 Q50,10 65,30 Q80,10 95,30 L115,30"/>
                </circle>
            </svg>
        `;
    }
    
    if (animContainer) {
        animContainer.innerHTML = svgHtml;
    }

    setTimeout(() => {
        levelCompleteModal.classList.remove('hidden-element');
    }, 1500);
}

function triggerGameOver() {
    gameState.gameEnded = true;
    playSound('gameover');
    gameOverModal.classList.remove('hidden-element');
}

// --- LEVEL 5: TREASURE HUNT GAME ---
let mazeState = {
    x: 1, // Start positions
    y: 1,
    canvas: null,
    ctx: null,
    gridSizeX: 15,
    gridSizeY: 10,
    tileSizeX: 40,
    tileSizeY: 35,
    chestFound: false
};

// 0: path, 1: tree, 2: river water, 3: bridge, 4: hidden cave path (walkable), 5: chest
const MAZE_MAP = [
    [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
    [1, 0, 0, 0, 1, 0, 0, 0, 0, 0, 1, 1, 1, 1, 1],
    [1, 1, 1, 0, 1, 0, 1, 1, 1, 0, 1, 0, 0, 0, 1],
    [1, 0, 0, 0, 0, 0, 1, 1, 1, 0, 0, 0, 1, 0, 1],
    [1, 0, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0, 1],
    [1, 0, 0, 0, 0, 2, 2, 2, 2, 2, 0, 0, 0, 0, 1], // River crossing
    [1, 1, 1, 1, 0, 2, 2, 3, 2, 2, 0, 1, 1, 1, 1], // Bridge at X:7, Y:6
    [1, 0, 0, 0, 0, 2, 2, 2, 2, 2, 0, 0, 0, 0, 1],
    [1, 0, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 5, 1], // Chest at X:13, Y:8
    [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1]
];

function startTreasureHunt() {
    // Sweep away foggy forest
    document.getElementById('forest-background').className = 'glow-forest';
    document.getElementById('board-container').classList.add('hidden-element');
    document.getElementById('treasure-maze-overlay').classList.remove('hidden-element');
    
    // Fireflies boost
    createFireflies();
    
    // Canvas setup
    mazeState.canvas = document.getElementById('maze-canvas');
    mazeState.ctx = mazeState.canvas.getContext('2d');
    mazeState.x = 1;
    mazeState.y = 1;
    mazeState.chestFound = false;

    // Draw frame
    drawMaze();

    // Bind controls
    window.addEventListener('keydown', handleMazeKeys);
    setupDPadControls();
}

function drawMaze() {
    const ctx = mazeState.ctx;
    const cw = mazeState.canvas.width;
    const ch = mazeState.canvas.height;
    ctx.clearRect(0, 0, cw, ch);

    const tsX = mazeState.tileSizeX;
    const tsY = mazeState.tileSizeY;

    for (let r = 0; r < mazeState.gridSizeY; r++) {
        for (let c = 0; c < mazeState.gridSizeX; c++) {
            const tile = MAZE_MAP[r][c];
            const px = c * tsX;
            const py = r * tsY;

            // Draw Base floor (Soil)
            ctx.fillStyle = '#061610';
            ctx.fillRect(px, py, tsX, tsY);
            
            // Draw path detail
            if (tile === 0 || tile === 3 || tile === 5) {
                ctx.fillStyle = '#0b261a';
                ctx.fillRect(px + 2, py + 2, tsX - 4, tsY - 4);
            }

            if (tile === 1) { // Tree Wall
                // Background dark grass
                ctx.fillStyle = '#03100b';
                ctx.fillRect(px, py, tsX, tsY);
                
                // Draw pine triangle
                ctx.fillStyle = '#064e3b';
                ctx.beginPath();
                ctx.moveTo(px + tsX / 2, py + 4);
                ctx.lineTo(px + 4, py + tsY - 6);
                ctx.lineTo(px + tsX - 4, py + tsY - 6);
                ctx.closePath();
                ctx.fill();
                
                // Tree tip highlight
                ctx.fillStyle = '#059669';
                ctx.beginPath();
                ctx.moveTo(px + tsX / 2, py + 4);
                ctx.lineTo(px + tsX / 2 - 6, py + 16);
                ctx.lineTo(px + tsX / 2 + 6, py + 16);
                ctx.closePath();
                ctx.fill();

                // Trunk
                ctx.fillStyle = '#1e293b';
                ctx.fillRect(px + tsX / 2 - 3, py + tsY - 6, 6, 6);
            } 
            else if (tile === 2) { // River/Water
                ctx.fillStyle = '#0b132b';
                ctx.fillRect(px, py, tsX, tsY);
                // Water ripples
                ctx.strokeStyle = '#1d4ed8';
                ctx.lineWidth = 2;
                ctx.beginPath();
                ctx.moveTo(px, py + tsY / 2);
                ctx.lineTo(px + tsX, py + tsY / 2);
                ctx.stroke();
            } 
            else if (tile === 3) { // Wooden Bridge
                ctx.fillStyle = '#78350f';
                ctx.fillRect(px + 4, py, tsX - 8, tsY);
                // Planks details
                ctx.strokeStyle = '#451a03';
                ctx.lineWidth = 2;
                for (let pyOffset = 5; pyOffset < tsY; pyOffset += 8) {
                    ctx.beginPath();
                    ctx.moveTo(px + 4, py + pyOffset);
                    ctx.lineTo(px + tsX - 4, py + pyOffset);
                    ctx.stroke();
                }
            } 
            else if (tile === 5) { // Chest
                // Cave portal backdrop
                ctx.fillStyle = '#1e293b';
                ctx.fillRect(px, py, tsX, tsY);
                
                // Drawing Neon chest box
                ctx.fillStyle = '#b45309';
                ctx.fillRect(px + 6, py + 10, tsX - 12, tsY - 18);
                // Gold borders
                ctx.strokeStyle = '#fbbf24';
                ctx.lineWidth = 2;
                ctx.strokeRect(px + 6, py + 10, tsX - 12, tsY - 18);
                // Lock
                ctx.fillStyle = '#fbbf24';
                ctx.fillRect(px + tsX / 2 - 3, py + tsY / 2 - 2, 6, 6);
            }
        }
    }

    // Draw Explorer sprite
    const exX = mazeState.x * tsX + tsX / 2;
    const exY = mazeState.y * tsY + tsY / 2;
    
    // Explorer glow
    ctx.shadowBlur = 10;
    ctx.shadowColor = '#06b6d4';
    
    // Head/Hat
    ctx.fillStyle = '#d97706'; // orange explorer hat
    ctx.beginPath();
    ctx.arc(exX, exY - 4, 8, 0, Math.PI, true);
    ctx.fill();
    ctx.fillRect(exX - 12, exY - 5, 24, 2); // hat brim
    
    // Face
    ctx.shadowBlur = 0;
    ctx.fillStyle = '#ffedd5';
    ctx.beginPath();
    ctx.arc(exX, exY, 5, 0, Math.PI * 2);
    ctx.fill();

    // Eyes
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(exX - 3, exY - 2, 2, 2);
    ctx.fillRect(exX + 1, exY - 2, 2, 2);

    // Body/Backpack
    ctx.fillStyle = '#047857'; // green jacket
    ctx.fillRect(exX - 6, exY + 4, 12, 10);
    
    ctx.fillStyle = '#451a03'; // brown backpack
    ctx.fillRect(exX - 10, exY + 5, 4, 8);
}

function handleMazeKeys(e) {
    if (gameState.gameEnded || mazeState.chestFound) return;
    
    let dx = 0;
    let dy = 0;
    
    if (e.key === 'ArrowUp' || e.key === 'w') dy = -1;
    if (e.key === 'ArrowDown' || e.key === 's') dy = 1;
    if (e.key === 'ArrowLeft' || e.key === 'a') dx = -1;
    if (e.key === 'ArrowRight' || e.key === 'd') dx = 1;

    if (dx !== 0 || dy !== 0) {
        e.preventDefault(); // Prevent page scroll
        moveExplorer(dx, dy);
    }
}

function setupDPadControls() {
    document.getElementById('dpad-up').onclick = () => moveExplorer(0, -1);
    document.getElementById('dpad-down').onclick = () => moveExplorer(0, 1);
    document.getElementById('dpad-left').onclick = () => moveExplorer(-1, 0);
    document.getElementById('dpad-right').onclick = () => moveExplorer(1, 0);
}

function moveExplorer(dx, dy) {
    if (mazeState.chestFound) return;
    
    const targetX = mazeState.x + dx;
    const targetY = mazeState.y + dy;

    // Check grid bounds
    if (targetX < 0 || targetX >= mazeState.gridSizeX || targetY < 0 || targetY >= mazeState.gridSizeY) return;

    // Obstacle check
    const nextTile = MAZE_MAP[targetY][targetX];
    
    if (nextTile === 1 || nextTile === 2) {
        // Can't walk through tree wall (1) or water (2)
        return;
    }

    // Update coordinates
    mazeState.x = targetX;
    mazeState.y = targetY;
    playSound('walk');
    drawMaze();

    // Chest Collision check
    if (nextTile === 5) {
        triggerTreasureReveal();
    }
}

function triggerTreasureReveal() {
    mazeState.chestFound = true;
    window.removeEventListener('keydown', handleMazeKeys);
    playSound('victory');
    
    document.getElementById('final-score-val').textContent = gameState.score;
    
    setTimeout(() => {
        treasureModal.classList.remove('hidden-element');
    }, 800);
}
