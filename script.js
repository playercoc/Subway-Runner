document.getElementById("flipBtn").addEventListener("click", () => {
    const coin = document.getElementById("coin");
    const resultText = document.getElementById("result");

    // Reset animation
    coin.classList.remove("flip-animation");
    void coin.offsetWidth; // trick to restart animation
    coin.classList.add("flip-animation");

    // Random result
    const result = Math.random() < 0.5 ? "HEADS" : "TAILS";

    setTimeout(() => {
        resultText.textContent = "Result: " + result;
    }, 1000); // show result after flip animation
});
