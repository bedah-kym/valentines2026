// Valentine's 2026 - Minimal JS
// Most interactions handled by inline scripts or HTMX

document.addEventListener('DOMContentLoaded', function () {
    // Add floating hearts to landing page
    if (document.querySelector('.landing')) {
        createBackgroundHearts();
    }
});

function createBackgroundHearts() {
    const container = document.querySelector('.landing');
    const hearts = ['❤️', '💕', '💖', '💗', '💝'];

    for (let i = 0; i < 15; i++) {
        const heart = document.createElement('div');
        heart.textContent = hearts[Math.floor(Math.random() * hearts.length)];
        heart.style.cssText = `
      position: fixed;
      font-size: ${Math.random() * 1.5 + 0.5}rem;
      left: ${Math.random() * 100}vw;
      top: ${Math.random() * 100}vh;
      opacity: ${Math.random() * 0.3 + 0.1};
      pointer-events: none;
      animation: float ${Math.random() * 10 + 10}s ease-in-out infinite;
      animation-delay: ${Math.random() * 5}s;
      z-index: 0;
    `;
        container.appendChild(heart);
    }

    // Add CSS animation
    if (!document.querySelector('#heartAnimation')) {
        const style = document.createElement('style');
        style.id = 'heartAnimation';
        style.textContent = `
      @keyframes float {
        0%, 100% { transform: translateY(0) rotate(0deg); }
        25% { transform: translateY(-20px) rotate(5deg); }
        50% { transform: translateY(-10px) rotate(-5deg); }
        75% { transform: translateY(-30px) rotate(3deg); }
      }
    `;
        document.head.appendChild(style);
    }
}
