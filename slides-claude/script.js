let currentSlide = 0;
const slides = document.querySelectorAll('.slide');
const progressBar = document.querySelector('.progress-bar');
const fullscreenBtn = document.querySelector('.fullscreen');

function showSlide(index) {
    slides.forEach((slide, i) => {
        slide.classList.remove('active');
        if (i === index) {
            slide.classList.add('active');
        }
    });

    currentSlide = index;
    const progress = ((index + 1) / slides.length) * 100;
    progressBar.style.width = `${progress}%`;
}

document.querySelector('.next').addEventListener('click', () => {
    if (currentSlide < slides.length - 1) {
        showSlide(currentSlide + 1);
    }
});

document.querySelector('.prev').addEventListener('click', () => {
    if (currentSlide > 0) {
        showSlide(currentSlide - 1);
    }
});

// ─── 全画面：ネイティブAPI → CSS擬似全画面の2段構え ───
let isCssFull = false;

function enterNativeFullscreen() {
    const el = document.documentElement;
    const fn = el.requestFullscreen
        || el.webkitRequestFullscreen
        || el.mozRequestFullScreen
        || el.msRequestFullscreen;
    if (fn) {
        return fn.call(el).then(() => true).catch(() => false);
    }
    return Promise.resolve(false);
}

function exitNativeFullscreen() {
    const fn = document.exitFullscreen
        || document.webkitExitFullscreen
        || document.mozCancelFullScreen
        || document.msExitFullscreen;
    if (fn) fn.call(document);
}

function getFullscreenElement() {
    return document.fullscreenElement
        || document.webkitFullscreenElement
        || document.mozFullScreenElement
        || document.msFullscreenElement;
}

// CSSでウィンドウ全体を覆う擬似全画面
function enterCssFullscreen() {
    document.body.style.cssText = `
        position: fixed !important;
        inset: 0 !important;
        width: 100vw !important;
        height: 100vh !important;
        z-index: 99999 !important;
        margin: 0 !important;
        border-radius: 0 !important;
    `;
    isCssFull = true;
    fullscreenBtn.textContent = '縮小 (F)';
}

function exitCssFullscreen() {
    document.body.style.cssText = '';
    isCssFull = false;
    fullscreenBtn.textContent = '全画面 (F)';
}

async function toggleFullScreen() {
    if (isCssFull) {
        exitCssFullscreen();
        return;
    }
    if (getFullscreenElement()) {
        exitNativeFullscreen();
        return;
    }

    // ネイティブAPIを試みて失敗したらCSS擬似全画面へ
    const ok = await enterNativeFullscreen();
    if (!ok) {
        enterCssFullscreen();
    }
}

// ネイティブ全画面から Esc で抜けたとき
document.addEventListener('fullscreenchange', () => {
    if (!getFullscreenElement()) {
        fullscreenBtn.textContent = '全画面 (F)';
    } else {
        fullscreenBtn.textContent = '縮小 (F)';
    }
});
document.addEventListener('webkitfullscreenchange', () => {
    if (!getFullscreenElement()) {
        fullscreenBtn.textContent = '全画面 (F)';
    } else {
        fullscreenBtn.textContent = '縮小 (F)';
    }
});

fullscreenBtn.addEventListener('click', toggleFullScreen);

document.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowRight' || e.key === ' ') {
        if (currentSlide < slides.length - 1) showSlide(currentSlide + 1);
    } else if (e.key === 'ArrowLeft') {
        if (currentSlide > 0) showSlide(currentSlide - 1);
    } else if (e.key === 'f' || e.key === 'F') {
        toggleFullScreen();
    } else if (e.key === 'Escape' && isCssFull) {
        exitCssFullscreen();
    }
});

// ─── タッチスワイプ操作（スマホ対応） ───
let touchStartX = 0;
let touchStartY = 0;

document.addEventListener('touchstart', (e) => {
    touchStartX = e.touches[0].clientX;
    touchStartY = e.touches[0].clientY;
}, { passive: true });

document.addEventListener('touchend', (e) => {
    const deltaX = e.changedTouches[0].clientX - touchStartX;
    const deltaY = e.changedTouches[0].clientY - touchStartY;

    // 横スワイプが縦より大きく、かつ50px以上の場合のみ反応
    if (Math.abs(deltaX) > Math.abs(deltaY) && Math.abs(deltaX) > 50) {
        if (deltaX < 0 && currentSlide < slides.length - 1) {
            showSlide(currentSlide + 1);
        } else if (deltaX > 0 && currentSlide > 0) {
            showSlide(currentSlide - 1);
        }
    }
}, { passive: true });

// Initialize first slide
showSlide(0);
