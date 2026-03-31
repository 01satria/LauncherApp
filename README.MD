<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Minimal Launcher</title>
  <link href="https://fonts.googleapis.com/css2?family=Space+Mono:wght@400;700&family=DM+Sans:wght@300;400;500&display=swap" rel="stylesheet" />
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

    :root {
      --black: #000000;
      --white: #ffffff;
      --gray-1: #f5f5f5;
      --gray-2: #e0e0e0;
      --gray-3: #999999;
      --gray-4: #444444;
      --mono: 'Space Mono', monospace;
      --sans: 'DM Sans', sans-serif;
    }

    html { scroll-behavior: smooth; }

    body {
      background: var(--black);
      color: var(--white);
      font-family: var(--sans);
      font-weight: 400;
      min-height: 100vh;
      overflow-x: hidden;
    }

    /* ── FADE IN ── */
    @keyframes fadeUp {
      from { opacity: 0; transform: translateY(24px); }
      to   { opacity: 1; transform: translateY(0); }
    }
    .fade { opacity: 0; animation: fadeUp 0.7s ease forwards; }
    .d1 { animation-delay: 0.1s; }
    .d2 { animation-delay: 0.25s; }
    .d3 { animation-delay: 0.4s; }
    .d4 { animation-delay: 0.55s; }
    .d5 { animation-delay: 0.7s; }
    .d6 { animation-delay: 0.85s; }
    .d7 { animation-delay: 1s; }

    /* ── LAYOUT ── */
    .page {
      max-width: 680px;
      margin: 0 auto;
      padding: 80px 24px 120px;
      text-align: center;
    }

    /* ── HERO ── */
    .dot-label {
      font-family: var(--mono);
      font-size: 11px;
      letter-spacing: 0.2em;
      color: var(--gray-3);
      text-transform: uppercase;
      margin-bottom: 28px;
    }

    .logo {
      width: 56px;
      height: 56px;
      background: var(--white);
      border-radius: 50%;
      margin: 0 auto 32px;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .logo svg { width: 28px; height: 28px; }

    h1 {
      font-family: var(--mono);
      font-size: clamp(32px, 6vw, 48px);
      font-weight: 700;
      letter-spacing: -0.02em;
      line-height: 1.1;
      margin-bottom: 20px;
    }

    .tagline {
      font-size: 16px;
      font-weight: 300;
      color: var(--gray-3);
      line-height: 1.6;
      max-width: 400px;
      margin: 0 auto 40px;
    }

    /* ── BADGES ── */
    .badges {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      justify-content: center;
      margin-bottom: 80px;
    }
    .badge {
      font-family: var(--mono);
      font-size: 10px;
      letter-spacing: 0.12em;
      padding: 6px 14px;
      border: 1px solid var(--gray-4);
      border-radius: 100px;
      color: var(--gray-3);
      text-transform: uppercase;
    }
    .badge.lit {
      border-color: var(--white);
      color: var(--white);
    }

    /* ── DIVIDER ── */
    .divider {
      width: 1px;
      height: 60px;
      background: linear-gradient(to bottom, transparent, var(--gray-4), transparent);
      margin: 0 auto 80px;
    }

    /* ── SECTION ── */
    .section-label {
      font-family: var(--mono);
      font-size: 10px;
      letter-spacing: 0.25em;
      color: var(--gray-3);
      text-transform: uppercase;
      margin-bottom: 48px;
    }

    /* ── FEATURE CARDS ── */
    .features {
      display: grid;
      gap: 2px;
      margin-bottom: 80px;
      text-align: left;
    }
    .feature {
      border: 1px solid #1a1a1a;
      border-radius: 16px;
      padding: 28px 28px 24px;
      background: #080808;
      transition: border-color 0.2s, background 0.2s;
    }
    .feature:hover {
      border-color: #333;
      background: #0f0f0f;
    }
    .feature-num {
      font-family: var(--mono);
      font-size: 10px;
      color: var(--gray-4);
      letter-spacing: 0.1em;
      margin-bottom: 12px;
    }
    .feature-title {
      font-size: 17px;
      font-weight: 500;
      margin-bottom: 10px;
      letter-spacing: -0.01em;
    }
    .feature-desc {
      font-size: 14px;
      font-weight: 300;
      color: var(--gray-3);
      line-height: 1.65;
    }

    /* ── DESIGN PILLS ── */
    .design-pills {
      display: flex;
      flex-wrap: wrap;
      gap: 10px;
      justify-content: center;
      margin-bottom: 80px;
    }
    .pill {
      font-size: 13px;
      font-weight: 400;
      color: var(--white);
      background: #111;
      border: 1px solid #222;
      border-radius: 100px;
      padding: 10px 20px;
      transition: border-color 0.2s;
    }
    .pill:hover { border-color: #555; }
    .pill span {
      font-family: var(--mono);
      font-size: 10px;
      color: var(--gray-4);
      margin-right: 8px;
    }

    /* ── CONTRIBUTE ── */
    .steps {
      display: grid;
      gap: 2px;
      margin-bottom: 80px;
      text-align: left;
    }
    .step {
      display: flex;
      align-items: flex-start;
      gap: 20px;
      padding: 20px 24px;
      border: 1px solid #1a1a1a;
      border-radius: 12px;
      background: #050505;
    }
    .step-n {
      font-family: var(--mono);
      font-size: 11px;
      color: var(--gray-4);
      min-width: 20px;
      padding-top: 2px;
    }
    .step-text {
      font-size: 14px;
      font-weight: 400;
      color: var(--gray-2);
      line-height: 1.5;
    }
    .step-text code {
      font-family: var(--mono);
      font-size: 12px;
      color: var(--gray-3);
      background: #111;
      padding: 2px 7px;
      border-radius: 4px;
    }

    /* ── FOOTER QUOTE ── */
    .quote-wrap {
      padding: 48px 0 0;
    }
    blockquote {
      font-family: var(--mono);
      font-size: 13px;
      line-height: 1.8;
      color: var(--gray-4);
      letter-spacing: 0.03em;
      border: none;
    }
    blockquote cite {
      display: block;
      margin-top: 12px;
      font-size: 11px;
      letter-spacing: 0.15em;
      color: #333;
    }

    .footer-name {
      margin-top: 48px;
      font-family: var(--mono);
      font-size: 11px;
      letter-spacing: 0.15em;
      color: var(--gray-4);
    }
    .footer-name a {
      color: var(--gray-3);
      text-decoration: none;
      border-bottom: 1px solid var(--gray-4);
      padding-bottom: 1px;
      transition: color 0.2s;
    }
    .footer-name a:hover { color: var(--white); }

    .moon {
      display: inline-block;
      margin-top: 32px;
      font-size: 20px;
      opacity: 0.4;
    }

    @media (max-width: 480px) {
      .page { padding: 60px 20px 80px; }
      .feature, .step { padding: 20px 18px; }
    }
  </style>
</head>
<body>
  <main class="page">

    <!-- HERO -->
    <div class="dot-label fade d1">Android Launcher</div>

    <div class="logo fade d1">
      <svg viewBox="0 0 28 28" fill="none" xmlns="http://www.w3.org/2000/svg">
        <circle cx="14" cy="14" r="10" fill="black"/>
        <circle cx="14" cy="14" r="3" fill="black" stroke="black" stroke-width="1"/>
        <circle cx="14" cy="14" r="9" stroke="black" stroke-width="1.5"/>
        <!-- Dot matrix moon -->
        <path d="M14 5C14 5 8 8 8 14C8 20 14 23 14 23C14 23 20 20 20 14C20 8 14 5 14 5Z" fill="black"/>
        <circle cx="14" cy="14" r="5" fill="black"/>
      </svg>
      <!-- Simple crescent -->
      <svg viewBox="0 0 28 28" fill="none" xmlns="http://www.w3.org/2000/svg" style="position:absolute;">
        <path d="M18 7C15.5 7.8 13.5 10.2 13.5 13C13.5 16.5 16.2 19.4 20 19.8C18.5 22 16 23 14 23C9 23 5 19 5 14C5 9 9 5 14 5C15.5 5 17 5.8 18 7Z" fill="black"/>
      </svg>
    </div>

    <h1 class="fade d2">Minimal<br/>Launcher</h1>

    <p class="tagline fade d3">
      A home screen built around clarity.<br/>
      Inspired by the quiet elegance of Nothing OS.
    </p>

    <div class="badges fade d4">
      <span class="badge lit">Android 8.0+</span>
      <span class="badge">MIT License</span>
      <span class="badge">Nothing OS Inspired</span>
      <span class="badge">Open Source</span>
    </div>

    <div class="divider fade d4"></div>

    <!-- FEATURES -->
    <div class="section-label fade d4">Features</div>

    <div class="features">
      <div class="feature fade d4">
        <div class="feature-num">01</div>
        <div class="feature-title">Intelligence+ Pill Bar</div>
        <div class="feature-desc">A single adaptive bar that surfaces what matters — weather in the morning, your calendar at noon, focus timers during work, and wind-down prompts at night.</div>
      </div>
      <div class="feature fade d5">
        <div class="feature-num">02</div>
        <div class="feature-title">Habit Heatmap</div>
        <div class="feature-desc">Track your streaks with a contribution heatmap right on the home screen. Mark habits done directly from the Pill Bar — no app-switching.</div>
      </div>
      <div class="feature fade d5">
        <div class="feature-num">03</div>
        <div class="feature-title">Money Manager</div>
        <div class="feature-desc">Income and expense widgets that appear only when relevant. Financial clarity without leaving your home screen.</div>
      </div>
      <div class="feature fade d6">
        <div class="feature-num">04</div>
        <div class="feature-title">Adaptive App Drawer</div>
        <div class="feature-desc">List mode for speed. Grid mode for beauty. Dynamic search finds any app instantly — exactly as your mind expects.</div>
      </div>
    </div>

    <div class="divider fade d6"></div>

    <!-- DESIGN -->
    <div class="section-label fade d6">Design</div>

    <div class="design-pills fade d6">
      <div class="pill"><span>01</span>Dot-Matrix Typography</div>
      <div class="pill"><span>02</span>True OLED Black</div>
      <div class="pill"><span>03</span>Essential Iconography</div>
    </div>

    <div class="divider fade d6"></div>

    <!-- CONTRIBUTE -->
    <div class="section-label fade d6">Contribute</div>

    <div class="steps fade d6">
      <div class="step">
        <span class="step-n">01</span>
        <span class="step-text">Fork the repository</span>
      </div>
      <div class="step">
        <span class="step-n">02</span>
        <span class="step-text">Create a branch — <code>git checkout -b feature/your-idea</code></span>
      </div>
      <div class="step">
        <span class="step-n">03</span>
        <span class="step-text">Commit — <code>git commit -m 'Add something beautiful'</code></span>
      </div>
      <div class="step">
        <span class="step-n">04</span>
        <span class="step-text">Push and open a Pull Request</span>
      </div>
    </div>

    <!-- FOOTER -->
    <div class="quote-wrap fade d7">
      <blockquote>
        "Simplicity is the ultimate sophistication."
        <cite>— Leonardo da Vinci</cite>
      </blockquote>

      <div class="footer-name" style="margin-top:40px;">
        Crafted with quiet passion by <a href="https://github.com/01satria">01satria</a>
      </div>

      <div class="moon">🌑</div>
    </div>

  </main>
</body>
</html>
