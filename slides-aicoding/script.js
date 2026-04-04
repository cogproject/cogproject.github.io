let currentSlide = 0;
const slides = document.querySelectorAll('.slide');
const progressBar = document.querySelector('.progress-bar');

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

function toggleFullScreen() {
    if (!document.fullscreenElement) {
        document.documentElement.requestFullscreen();
    } else {
        if (document.exitFullscreen) {
            document.exitFullscreen();
        }
    }
}

document.querySelector('.fullscreen').addEventListener('click', toggleFullScreen);

document.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowRight' || e.key === ' ') {
        if (currentSlide < slides.length - 1) showSlide(currentSlide + 1);
    } else if (e.key === 'ArrowLeft') {
        if (currentSlide > 0) showSlide(currentSlide - 1);
    } else if (e.key === 'f' || e.key === 'F') {
        toggleFullScreen();
    }
});

// Initialize first slide
showSlide(0);
