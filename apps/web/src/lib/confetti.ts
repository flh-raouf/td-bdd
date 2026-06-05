export async function fireConfetti() {
  const confetti = (await import("canvas-confetti")).default;

  confetti({
    particleCount: 30,
    spread: 60,
    origin: { y: 0.5 },
    colors: ["#58a6ff", "#3fb950", "#f0883e"],
  });
}

export async function fireCannonConfetti() {
  const confetti = (await import("canvas-confetti")).default;
  const duration = 3000;
  const end = Date.now() + duration;

  const frame = () => {
    confetti({
      particleCount: 3,
      angle: 60,
      spread: 55,
      origin: { x: 0, y: 0.7 },
      colors: ["#58a6ff", "#3fb950", "#f0883e", "#a371f7"],
    });
    confetti({
      particleCount: 3,
      angle: 120,
      spread: 55,
      origin: { x: 1, y: 0.7 },
      colors: ["#58a6ff", "#3fb950", "#f0883e", "#a371f7"],
    });

    if (Date.now() < end) {
      requestAnimationFrame(frame);
    }
  };

  frame();

  setTimeout(() => {
    confetti({
      particleCount: 100,
      spread: 100,
      origin: { y: 0.6 },
      colors: ["#58a6ff", "#3fb950", "#f0883e", "#a371f7"],
    });
  }, 500);
}
