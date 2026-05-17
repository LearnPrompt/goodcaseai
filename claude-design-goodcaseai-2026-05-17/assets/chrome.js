/* ---------- Shared chrome: nav + ticker + final CTA + footer ---------- */
/* Render into [data-chrome="top"] (nav + ticker), [data-chrome="final"] (final CTA),
   [data-chrome="footer"] (footer). Safe to call multiple times. */
(function(){
  function h(html){ const t = document.createElement('template'); t.innerHTML = html.trim(); return t.content; }

  const NAV_HTML = `
<nav class="top">
  <div class="wrap">
    <a class="brand" href="index.html">
      <span class="brand-mark"></span>
      <span>GoodCase<strong style="font-weight:700">AI</strong></span>
    </a>
    <div class="links">
      <a href="discover.html" data-i18n="nav.discover">Discover</a>
      <a href="love-ranking.html" data-i18n="nav.love">Love Ranking</a>
      <a href="stability-ranking.html" data-i18n="nav.lab">Stability Lab</a>
      <a href="creators.html" data-i18n="nav.creators">Creators</a>
      <a href="skills.html" data-i18n="nav.skills">Skills</a>
      <a href="index.html#methodology" data-i18n="nav.method">Methodology</a>
      <a href="index.html#changelog" data-i18n="nav.changelog">Changelog</a>
    </div>
    <div class="meta">
      <span class="lang" id="lang-switch" role="group" aria-label="Locale">
        <span class="on" data-set-locale="en">EN</span><span data-set-locale="zh">中文</span>
      </span>
      <a class="btn btn-ghost" href="#" data-i18n="nav.signin">Sign in</a>
      <a class="btn btn-primary" href="#"><span data-i18n="nav.submit">Submit a Case</span> <span class="arrow">→</span></a>
    </div>
  </div>
</nav>

<div class="ticker">
  <div class="wrap">
    <span class="live" data-i18n="rail.live_discover">LIVE · DISCOVER</span>
    <span class="sep"></span>
    <span data-i18n="rail.sources">SOURCES X · GITHUB · BILI · XHS · DISCORD</span>
    <span class="sep"></span>
    <span data-i18n="rail.cases">CASES INDEXED 4,218</span>
    <span class="sep"></span>
    <span data-i18n="rail.creators">CREATORS TRACKED 612</span>
    <span class="sep"></span>
    <span class="live" data-i18n="rail.live_lab">LIVE · STABILITY LAB</span>
    <span class="sep"></span>
    <span data-i18n="rail.run">RUN #0412 · veo-3 / sora-2 / kling-2 / hailuo-02</span>
    <span class="sep"></span>
    <span data-i18n="rail.metrics">REPRO 74.2% · COST $0.43/CLIP · N=128</span>
    <span class="sep"></span>
    <span data-i18n="rail.skills">SKILLS PROMOTED 37</span>
    <span class="sep"></span>
    <span style="color:var(--ink)" data-i18n="rail.version">v0.14.3 · 2026.04.18</span>
  </div>
</div>`;

  const FINAL_HTML = `
<section class="final">
  <div class="crosshair ch-tl"></div>
  <div class="crosshair ch-tr"></div>
  <div class="crosshair ch-bl"></div>
  <div class="crosshair ch-br"></div>
  <div class="wrap">
    <span class="eyebrow mono" data-i18n="fn.eyebrow">§ 10 · JOIN THE INDEX</span>
    <h2><span data-i18n="fn.title_a">Not just cases.</span><br/><span data-i18n="fn.title_b">Follow the creators</span> <em data-i18n="fn.title_c">behind them.</em></h2>
    <p data-i18n="fn.body">GoodCaseAI is open to read and open to contribute. Sign in to influence the rankings, submit a case for a Lab run, or claim your creator profile to connect your work to the index.</p>
    <div class="row">
      <a class="btn btn-primary" href="love-ranking.html"><span data-i18n="fn.btn.rankings">Explore Rankings</span> <span class="arrow">→</span></a>
      <a class="btn" href="#" data-i18n="fn.btn.submit">Submit a Case</a>
      <a class="btn" href="#" data-i18n="fn.btn.claim">Claim Creator Profile</a>
      <a class="btn btn-ghost" href="#" data-i18n="fn.btn.community">Join the Community</a>
    </div>
    <div style="margin-top:56px;display:flex;justify-content:center;gap:32px;font-family:'JetBrains Mono',monospace;font-size:10.5px;color:var(--mute);letter-spacing:.08em;flex-wrap:wrap;">
      <span data-i18n="fn.micro.read">Free to read</span><span>·</span><span data-i18n="fn.micro.signed">Signed-in signals</span><span>·</span><span data-i18n="fn.micro.skills">Creator-attributed Skills</span><span>·</span><span data-i18n="fn.micro.pricing">No pricing yet</span>
    </div>
  </div>
</section>`;

  const FOOTER_HTML = `
<footer>
  <div class="wrap">
    <div class="grid">
      <div>
        <a class="brand" href="index.html" style="display:inline-flex;align-items:center;gap:10px;color:var(--paper);text-decoration:none;font-size:20px;font-weight:600;letter-spacing:-.02em;">
          <span class="brand-mark" style="background:var(--paper);"></span>
          <span>GoodCase<strong style="font-weight:700">AI</strong></span>
        </a>
        <p class="brand-note" data-i18n="ft.desc">A global index for AI creators and AI methods. Built in Shanghai. Shipped in public.</p>
      </div>
      <div>
        <h6 data-i18n="ft.c1">PLATFORM</h6>
        <ul>
          <li><a href="discover.html" data-i18n="ft.c1.1">Discover</a></li>
          <li><a href="love-ranking.html" data-i18n="ft.c1.2">Love Ranking</a></li>
          <li><a href="stability-ranking.html" data-i18n="ft.c1.3">Stability Lab</a></li>
          <li><a href="index.html#cases" data-i18n="ft.c1.4">Cases</a></li>
          <li><a href="skills.html" data-i18n="ft.c1.5">Skills</a></li>
        </ul>
      </div>
      <div>
        <h6 data-i18n="ft.c2">CREATORS</h6>
        <ul>
          <li><a href="creators.html" data-i18n="ft.c2.1">Claim Creator Profile</a></li>
          <li><a href="#" data-i18n="ft.c2.2">Submit a Case</a></li>
          <li><a href="#" data-i18n="ft.c2.3">Attribution Policy</a></li>
          <li><a href="#" data-i18n="ft.c2.4">Creator Grants</a></li>
        </ul>
      </div>
      <div>
        <h6 data-i18n="ft.c3">OPEN</h6>
        <ul>
          <li><a href="index.html#methodology" data-i18n="ft.c3.1">Methodology</a></li>
          <li><a href="index.html#changelog" data-i18n="ft.c3.2">Changelog</a></li>
          <li><a href="#" data-i18n="ft.c3.3">Prompt Hash Log</a></li>
          <li><a href="#" data-i18n="ft.c3.4">Lab Budget</a></li>
        </ul>
      </div>
      <div>
        <h6 data-i18n="ft.c4">ELSEWHERE</h6>
        <ul>
          <li><a href="#" data-i18n="ft.c4.1">X ↗</a></li>
          <li><a href="#" data-i18n="ft.c4.2">GitHub ↗</a></li>
          <li><a href="#" data-i18n="ft.c4.3">Xiaohongshu ↗</a></li>
          <li><a href="#" data-i18n="ft.c4.4">Weibo ↗</a></li>
          <li><a href="#" data-i18n="ft.c4.5">Discord ↗</a></li>
        </ul>
      </div>
    </div>
    <div class="bottom">
      <span data-i18n="ft.copy">© 2026 GOODCASEAI · SHANGHAI + GLOBAL</span>
      <span data-i18n="ft.ver">v0.14.3 · UPDATED 2026.04.18 04:12 CST</span>
      <span><span data-i18n="ft.live">BUILT IN PUBLIC ·</span> <span style="color:var(--orange)">● LIVE</span></span>
    </div>
  </div>
</footer>`;

  function mount(){
    const top = document.querySelector('[data-chrome="top"]');
    if(top) top.replaceWith(h(NAV_HTML));
    const fin = document.querySelector('[data-chrome="final"]');
    if(fin) fin.replaceWith(h(FINAL_HTML));
    const foot = document.querySelector('[data-chrome="footer"]');
    if(foot) foot.replaceWith(h(FOOTER_HTML));
    // Re-apply locale after injection
    if (typeof window.setLocale === 'function') {
      let saved='en';
      try{ saved = localStorage.getItem('gc_locale') || 'en'; }catch(e){}
      window.setLocale(saved);
    }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mount);
  else mount();
})();
