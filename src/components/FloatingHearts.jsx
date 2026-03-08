import { useEffect } from "react";

function FloatingHearts() {
  useEffect(() => {
    const container = document.getElementById("hearts");
    if (!container) return;

    function spawnHeart() {
      const heart = document.createElement("div");
      heart.className = "heart";

      const symbols = ["❤️", "💖", "💕", "✨", "🌸"];
      heart.innerHTML = symbols[Math.floor(Math.random() * symbols.length)];
      heart.style.left = `${Math.random() * 100}vw`;
      heart.style.animationDuration = `${Math.random() * 3 + 5}s`;

      container.appendChild(heart);
      setTimeout(() => heart.remove(), 8000);
    }

    const interval = setInterval(spawnHeart, 800);
    return () => clearInterval(interval);
  }, []);

  return <div className="hearts" id="hearts"></div>;
}

export default FloatingHearts;