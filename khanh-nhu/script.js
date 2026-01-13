// ===== Configuration =====
const CORRECT_PASSWORD = '1304';
const PHOTOS = [
    'https://i.postimg.cc/RFbpF7Wq/IMG-7592.jpg',
    'https://i.postimg.cc/ht9YrQ58/IMG-7599.jpg',
    'https://i.postimg.cc/XJNtXNxz/IMG-7593.jpg',
    'https://i.ibb.co/C5dxqthd/image.png'
];

// Password Hints
const HINTS = [
    '💡 Gợi ý: Một ngày đặc biệt',
    '💡 Gợi ý: Ngày đặc biệt đối với Khánh Như'
];

// ===== State =====
let enteredPassword = '';
let isUnlocked = false;
let currentPhotoIndex = 0;
let wrongAttempts = 0;

// ===== DOM Elements =====
const introScreen = document.getElementById('introScreen');
const introContainer = document.getElementById('introContainer');
const introEnvelope = document.getElementById('introEnvelope');
const lockScreen = document.getElementById('lockScreen');
const unlockAnimation = document.getElementById('unlockAnimation');
const cardsScreen = document.getElementById('cardsScreen');
const contentScreen1 = document.getElementById('contentScreen1');
const contentScreen2 = document.getElementById('contentScreen2');
const contentScreen3 = document.getElementById('contentScreen3');
const passwordDisplay = document.getElementById('passwordDisplay');
const errorMessage = document.getElementById('errorMessage');
const errorText = document.getElementById('errorText');
const hintMessage = document.getElementById('hintMessage');
const hintText = document.getElementById('hintText');
const floatingHearts = document.getElementById('floatingHearts');
const confettiContainer = document.getElementById('confettiContainer');
const openGiftBtn = document.getElementById('openGiftBtn');

// Photo Album Elements
const mainPhoto = document.getElementById('mainPhoto');
const prevPhotoBtn = document.getElementById('prevPhoto');
const nextPhotoBtn = document.getElementById('nextPhoto');
const currentPhotoNum = document.getElementById('currentPhotoNum');
const totalPhotos = document.getElementById('totalPhotos');
const thumbnails = document.querySelectorAll('.thumbnail');

// ===== Initialize =====
document.addEventListener('DOMContentLoaded', () => {
    init();
});

function init() {
    // Create floating hearts
    createFloatingHearts();

    // Setup intro button - envelope opening animation
    openGiftBtn.addEventListener('click', () => {
        playSuccessSound();
        createConfetti();

        // Hide intro content
        introContainer.classList.add('opening');
        introEnvelope.classList.add('opening');

        // Show letter overlay with zoom animation
        const letterOverlay = document.getElementById('letterOverlay');
        setTimeout(() => {
            letterOverlay.classList.add('active');
        }, 300);

        // Wait for letter animation, then transition to lock screen
        setTimeout(() => {
            introScreen.classList.remove('active');
            letterOverlay.classList.remove('active');
            lockScreen.classList.add('active');
        }, 2000);
    });

    // Setup keypad listeners
    setupKeypad();

    // Setup gift cards listeners
    setupGiftCards();

    // Setup back buttons
    setupBackButtons();

    // Setup photo album
    setupPhotoAlbum();

    // Keyboard support
    document.addEventListener('keydown', handleKeyboardInput);
}

// ===== Floating Hearts =====
function createFloatingHearts() {
    const hearts = ['💕', '💗', '💖', '💝', '💓', '💞', '🩷', '♥️'];

    for (let i = 0; i < 20; i++) {
        createHeart(hearts);
    }

    // Continuously create new hearts
    setInterval(() => {
        if (document.querySelectorAll('.heart').length < 30) {
            createHeart(hearts);
        }
    }, 2000);
}

function createHeart(hearts) {
    const heart = document.createElement('div');
    heart.className = 'heart';
    heart.textContent = hearts[Math.floor(Math.random() * hearts.length)];
    heart.style.left = Math.random() * 100 + 'vw';
    heart.style.fontSize = (15 + Math.random() * 20) + 'px';
    heart.style.animationDuration = (5 + Math.random() * 5) + 's';
    heart.style.animationDelay = Math.random() * 5 + 's';

    floatingHearts.appendChild(heart);

    // Remove heart after animation
    setTimeout(() => {
        heart.remove();
    }, 13000);
}

// ===== Keypad Handling =====
function setupKeypad() {
    const keys = document.querySelectorAll('.key');

    keys.forEach(key => {
        key.addEventListener('click', () => {
            const value = key.dataset.value;
            handleKeyPress(value);

            // Add ripple effect
            createRipple(key);
        });
    });
}

function createRipple(element) {
    const ripple = document.createElement('span');
    ripple.style.cssText = `
        position: absolute;
        width: 100%;
        height: 100%;
        top: 0;
        left: 0;
        background: rgba(255,255,255,0.4);
        border-radius: inherit;
        transform: scale(0);
        animation: rippleEffect 0.4s ease-out;
    `;

    element.appendChild(ripple);

    setTimeout(() => ripple.remove(), 400);
}

// Add ripple animation
const style = document.createElement('style');
style.textContent = `
    @keyframes rippleEffect {
        to {
            transform: scale(2);
            opacity: 0;
        }
    }
`;
document.head.appendChild(style);

function handleKeyPress(value) {
    // Play sound effect
    playKeySound();

    if (value === 'clear') {
        clearPassword();
        return;
    }

    if (value === 'delete') {
        deleteLastDigit();
        return;
    }

    // Add digit
    if (enteredPassword.length < 4) {
        enteredPassword += value;
        updatePasswordDisplay();

        // Check password when 4 digits entered
        if (enteredPassword.length === 4) {
            setTimeout(checkPassword, 300);
        }
    }
}

function handleKeyboardInput(e) {
    // Only handle keyboard on lock screen
    if (!lockScreen.classList.contains('active')) return;

    if (e.key >= '0' && e.key <= '9') {
        handleKeyPress(e.key);
    } else if (e.key === 'Backspace') {
        handleKeyPress('delete');
    } else if (e.key === 'Escape') {
        handleKeyPress('clear');
    }
}

function updatePasswordDisplay() {
    const dots = passwordDisplay.querySelectorAll('.password-dot');

    dots.forEach((dot, index) => {
        if (index < enteredPassword.length) {
            dot.classList.add('filled');
        } else {
            dot.classList.remove('filled');
        }
    });
}

function clearPassword() {
    enteredPassword = '';
    updatePasswordDisplay();
    hideError();
}

function deleteLastDigit() {
    enteredPassword = enteredPassword.slice(0, -1);
    updatePasswordDisplay();
    hideError();
}

function checkPassword() {
    if (enteredPassword === CORRECT_PASSWORD) {
        unlockSuccess();
    } else {
        unlockFailed();
    }
}

function unlockSuccess() {
    isUnlocked = true;
    wrongAttempts = 0;

    // Add success animation to dots
    const dots = passwordDisplay.querySelectorAll('.password-dot');
    dots.forEach(dot => {
        dot.style.background = 'linear-gradient(135deg, #4ade80 0%, #22c55e 100%)';
        dot.style.borderColor = '#22c55e';
    });

    // Show unlock animation
    setTimeout(() => {
        lockScreen.classList.remove('active');
        unlockAnimation.classList.add('active');

        // Play success sound
        playSuccessSound();

        // Create confetti
        createConfetti();

        // Show cards screen after animation
        setTimeout(() => {
            unlockAnimation.classList.remove('active');
            cardsScreen.classList.add('active');
        }, 2500);
    }, 500);
}

function unlockFailed() {
    wrongAttempts++;

    // Show error animation
    const dots = passwordDisplay.querySelectorAll('.password-dot');
    dots.forEach(dot => dot.classList.add('error'));

    showError();
    showHint();
    playErrorSound();

    // Clear after shake animation
    setTimeout(() => {
        dots.forEach(dot => dot.classList.remove('error'));
        clearPassword();
    }, 600);
}

function showError() {
    errorMessage.classList.add('show');
}

function hideError() {
    errorMessage.classList.remove('show');
}

function showHint() {
    if (wrongAttempts >= 1 && wrongAttempts <= HINTS.length) {
        hintText.textContent = HINTS[wrongAttempts - 1];
        hintMessage.classList.add('show');
    } else if (wrongAttempts > HINTS.length) {
        // Keep showing the last hint
        hintText.textContent = HINTS[HINTS.length - 1];
        hintMessage.classList.add('show');
    }
}

// ===== Gift Cards =====
function setupGiftCards() {
    const cards = document.querySelectorAll('.gift-card');

    cards.forEach(card => {
        card.addEventListener('click', () => {
            const cardNum = card.dataset.card;
            openCard(cardNum);
        });
    });
}

function openCard(cardNum) {
    playOpenSound();
    createConfetti();

    // Hide cards screen
    cardsScreen.classList.remove('active');

    // Show corresponding content screen
    switch (cardNum) {
        case '1':
            contentScreen1.classList.add('active');
            // Auto-play YouTube video
            autoPlayYouTube();
            break;
        case '2':
            contentScreen2.classList.add('active');
            break;
        case '3':
            contentScreen3.classList.add('active');
            // Initialize photo album
            initPhotoAlbum();
            break;
    }
}

function autoPlayYouTube() {
    const youtubePlayer = document.getElementById('youtubePlayer');
    // Update iframe src to autoplay
    youtubePlayer.src = 'https://www.youtube.com/embed/fTc5tuEn6_U?autoplay=1&rel=0';
}

// ===== Back Buttons =====
function setupBackButtons() {
    const backBtns = document.querySelectorAll('.back-btn');

    backBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            playKeySound();

            // Stop YouTube if going back from music screen
            const youtubePlayer = document.getElementById('youtubePlayer');
            youtubePlayer.src = 'https://www.youtube.com/embed/fTc5tuEn6_U?rel=0';

            // Hide all content screens
            contentScreen1.classList.remove('active');
            contentScreen2.classList.remove('active');
            contentScreen3.classList.remove('active');

            // Show cards screen
            cardsScreen.classList.add('active');
        });
    });
}

// ===== Photo Album =====
function setupPhotoAlbum() {
    // Click on main photo to go to next
    const mainPhotoWrapper = document.querySelector('.main-photo-wrapper');
    mainPhotoWrapper.addEventListener('click', () => {
        currentPhotoIndex = (currentPhotoIndex + 1) % PHOTOS.length;
        updateMainPhoto();
        playKeySound();
    });

    // Previous button
    prevPhotoBtn.addEventListener('click', (e) => {
        e.stopPropagation(); // Prevent triggering main photo click
        currentPhotoIndex = (currentPhotoIndex - 1 + PHOTOS.length) % PHOTOS.length;
        updateMainPhoto();
        playKeySound();
    });

    // Next button
    nextPhotoBtn.addEventListener('click', (e) => {
        e.stopPropagation(); // Prevent triggering main photo click
        currentPhotoIndex = (currentPhotoIndex + 1) % PHOTOS.length;
        updateMainPhoto();
        playKeySound();
    });

    // Thumbnails
    thumbnails.forEach((thumb, index) => {
        thumb.addEventListener('click', () => {
            currentPhotoIndex = index;
            updateMainPhoto();
            playKeySound();
        });
    });
}

function initPhotoAlbum() {
    currentPhotoIndex = 0;
    updateMainPhoto();
    totalPhotos.textContent = PHOTOS.length;
}

function updateMainPhoto() {
    // Update main photo with fade effect
    mainPhoto.style.opacity = '0';

    setTimeout(() => {
        mainPhoto.src = PHOTOS[currentPhotoIndex];
        mainPhoto.style.opacity = '1';
    }, 200);

    // Update counter
    currentPhotoNum.textContent = currentPhotoIndex + 1;

    // Update thumbnails
    thumbnails.forEach((thumb, index) => {
        if (index === currentPhotoIndex) {
            thumb.classList.add('active');
        } else {
            thumb.classList.remove('active');
        }
    });
}

// Add transition for main photo
const photoStyle = document.createElement('style');
photoStyle.textContent = `
    .main-photo {
        transition: opacity 0.3s ease;
    }
`;
document.head.appendChild(photoStyle);

// ===== Confetti =====
function createConfetti() {
    const colors = ['#FF69B4', '#FF1493', '#FFB6C1', '#FF6B8A', '#FFC0CB', '#FFD700', '#FF4757'];
    const shapes = ['circle', 'square', 'triangle'];

    for (let i = 0; i < 50; i++) {
        const confetti = document.createElement('div');
        confetti.className = 'confetti';

        const color = colors[Math.floor(Math.random() * colors.length)];
        const shape = shapes[Math.floor(Math.random() * shapes.length)];

        let shapeStyle = '';
        if (shape === 'circle') {
            shapeStyle = 'border-radius: 50%;';
        } else if (shape === 'triangle') {
            shapeStyle = `
                width: 0;
                height: 0;
                border-left: 5px solid transparent;
                border-right: 5px solid transparent;
                border-bottom: 10px solid ${color};
                background: none;
            `;
        }

        confetti.style.cssText = `
            left: ${Math.random() * 100}vw;
            background: ${color};
            width: ${5 + Math.random() * 10}px;
            height: ${5 + Math.random() * 10}px;
            animation-duration: ${2 + Math.random() * 2}s;
            animation-delay: ${Math.random() * 0.5}s;
            ${shapeStyle}
        `;

        confettiContainer.appendChild(confetti);

        setTimeout(() => confetti.remove(), 4000);
    }
}

// ===== Sound Effects (using Web Audio API for simple sounds) =====
const AudioContext = window.AudioContext || window.webkitAudioContext;
let audioContext;

function initAudio() {
    if (!audioContext) {
        audioContext = new AudioContext();
    }
}

function playKeySound() {
    try {
        initAudio();
        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();

        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);

        oscillator.frequency.value = 800 + Math.random() * 200;
        oscillator.type = 'sine';

        gainNode.gain.setValueAtTime(0.1, audioContext.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.1);

        oscillator.start(audioContext.currentTime);
        oscillator.stop(audioContext.currentTime + 0.1);
    } catch (e) {
        // Audio not supported
    }
}

function playSuccessSound() {
    try {
        initAudio();
        const notes = [523.25, 659.25, 783.99, 1046.50]; // C5, E5, G5, C6

        notes.forEach((freq, index) => {
            const oscillator = audioContext.createOscillator();
            const gainNode = audioContext.createGain();

            oscillator.connect(gainNode);
            gainNode.connect(audioContext.destination);

            oscillator.frequency.value = freq;
            oscillator.type = 'sine';

            const startTime = audioContext.currentTime + index * 0.15;
            gainNode.gain.setValueAtTime(0.2, startTime);
            gainNode.gain.exponentialRampToValueAtTime(0.01, startTime + 0.3);

            oscillator.start(startTime);
            oscillator.stop(startTime + 0.3);
        });
    } catch (e) {
        // Audio not supported
    }
}

function playErrorSound() {
    try {
        initAudio();
        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();

        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);

        oscillator.frequency.value = 200;
        oscillator.type = 'sawtooth';

        gainNode.gain.setValueAtTime(0.1, audioContext.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.3);

        oscillator.start(audioContext.currentTime);
        oscillator.stop(audioContext.currentTime + 0.3);
    } catch (e) {
        // Audio not supported
    }
}

function playOpenSound() {
    try {
        initAudio();
        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();

        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);

        oscillator.frequency.setValueAtTime(300, audioContext.currentTime);
        oscillator.frequency.exponentialRampToValueAtTime(600, audioContext.currentTime + 0.2);
        oscillator.type = 'sine';

        gainNode.gain.setValueAtTime(0.15, audioContext.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.3);

        oscillator.start(audioContext.currentTime);
        oscillator.stop(audioContext.currentTime + 0.3);
    } catch (e) {
        // Audio not supported
    }
}

// ===== Swipe Support for Photo Album =====
let touchStartX = 0;
let touchEndX = 0;

document.getElementById('contentScreen3').addEventListener('touchstart', e => {
    touchStartX = e.changedTouches[0].screenX;
}, false);

document.getElementById('contentScreen3').addEventListener('touchend', e => {
    touchEndX = e.changedTouches[0].screenX;
    handleSwipe();
}, false);

function handleSwipe() {
    const swipeThreshold = 50;
    const diff = touchStartX - touchEndX;

    if (Math.abs(diff) > swipeThreshold) {
        if (diff > 0) {
            // Swipe left - next photo
            currentPhotoIndex = (currentPhotoIndex + 1) % PHOTOS.length;
        } else {
            // Swipe right - previous photo
            currentPhotoIndex = (currentPhotoIndex - 1 + PHOTOS.length) % PHOTOS.length;
        }
        updateMainPhoto();
        playKeySound();
    }
}

// ===== Easter Egg: Konami Code =====
let konamiCode = [];
const konamiSequence = ['ArrowUp', 'ArrowUp', 'ArrowDown', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'ArrowLeft', 'ArrowRight', 'b', 'a'];

document.addEventListener('keydown', (e) => {
    konamiCode.push(e.key);
    konamiCode = konamiCode.slice(-10);

    if (konamiCode.join(',') === konamiSequence.join(',')) {
        // Super confetti!
        for (let i = 0; i < 5; i++) {
            setTimeout(() => createConfetti(), i * 200);
        }
    }
});
