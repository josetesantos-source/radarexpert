#!/usr/bin/env node
/**
 * Radar Expert — Gerador Automático de Edições
 * Lê /tmp/radar-edition-data.json e publica no site + Brevo
 */

const fs   = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// ── Carregar env ─────────────────────────────────────────────
const envPath = path.join(__dirname, '..', '.env');
if (fs.existsSync(envPath)) {
  fs.readFileSync(envPath, 'utf8').split('\n').forEach(line => {
    const [k, ...v] = line.split('=');
    if (k && v.length) process.env[k.trim()] = v.join('=').trim();
  });
}

const BREVO_KEY   = process.env.BREVO_API_KEY;
const BREVO_LIST  = parseInt(process.env.BREVO_LIST_ID || '5');
const SITE_PATH   = process.env.SITE_PATH || path.join(__dirname, '..');

// ── Ler dados da edição ──────────────────────────────────────
const dataFile = '/tmp/radar-edition-data.json';
if (!fs.existsSync(dataFile)) {
  console.error('❌ Arquivo não encontrado: ' + dataFile);
  process.exit(1);
}
const ed = JSON.parse(fs.readFileSync(dataFile, 'utf8'));
console.log(`\n📡 Gerando Edição ${ed.numero} — ${ed.semana} de ${ed.ano}`);

// ── Determinar número da edição ──────────────────────────────
const editionsJsonPath = path.join(SITE_PATH, 'editions.json');
const editions = JSON.parse(fs.readFileSync(editionsJsonPath, 'utf8'));
const padded   = String(ed.numero).padStart(2, '0');

// ── Helpers HTML ─────────────────────────────────────────────
const esc = s => (s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');

// Gerar bloco de stats com base no tipo de sinal
function statRow(sinal, dark = false) {
  if (!sinal.stats || !sinal.stats.length) return '';
  const cls = dark ? 'nl-stat-row nl-stat-row--dark' : 'nl-stat-row';
  const stats = sinal.stats.map(s => `
    <div class="nl-stat">
      <span class="nl-stat-num">${esc(s.valor)}</span>
      <span class="nl-stat-label">${esc(s.label)}</span>
    </div>`).join('');
  return `<div class="${cls} js-stagger">${stats}</div>`;
}

function signalHtml(sinal, index) {
  const num = String(index + 1).padStart(2, '0');
  const dark = index === 1;
  return `
<article class="nl-signal js-reveal" id="signal-${index + 1}" data-signal-index="${index + 1}">
  <div class="nl-signal-hd">
    <div class="nl-signal-bg-num" aria-hidden="true">${num}</div>
    <div class="nl-signal-num">Sinal ${num}</div>
    <h2 class="nl-signal-title">${esc(sinal.titulo)}</h2>
  </div>
  ${statRow(sinal, dark)}
  <div class="nl-signal-bd">
    <div class="nl-sec">
      <div class="nl-sec-label">Resumo</div>
      <p class="nl-sec-text">${esc(sinal.resumo)}</p>
    </div>
    <div class="nl-sec">
      <div class="nl-sec-label">Por que isso importa para você, consultora</div>
      <div class="nl-importa-box">${esc(sinal.por_que_importa)}</div>
    </div>
    <div class="nl-sec">
      <div class="nl-sec-label">Como explicar isso ao seu cliente</div>
      <div class="nl-quote">
        <div class="nl-quote-mark" aria-hidden="true">"</div>
        <div class="nl-quote-hint">Script para usar</div>
        <p class="nl-quote-text">"${esc(sinal.script_cliente)}"</p>
      </div>
    </div>
    <div class="nl-sec">
      <div class="nl-sec-label">Sugestão de conteúdo</div>
      <div class="nl-sugestao">
        <div class="nl-sugestao-format">${esc(sinal.sugestao_formato)}</div>
        <div class="nl-sugestao-gancho-label">Gancho</div>
        <p class="nl-sugestao-gancho">"${esc(sinal.sugestao_gancho)}"</p>
      </div>
    </div>
    <div class="nl-sec">
      <div class="nl-sec-label">Fonte</div>
      <p class="nl-source-link">${esc(sinal.fonte_nome)} — <a href="${sinal.fonte_url}" target="_blank" rel="noopener">${esc(sinal.fonte_nome.toLowerCase().replace(/\s/g,'') + '.com.br')}</a></p>
    </div>
  </div>
</article>`;
}

function signalEmailHtml(sinal, index) {
  const num = String(index + 1).padStart(2, '0');
  const dark = index === 1;
  const statCls  = dark ? 'stat-row-dark' : 'stat-row';
  const statNum  = dark ? 'color:#EEB811;' : 'color:#A07000;';
  const statLbl  = dark ? 'color:#B7B4AC;' : 'color:#7A7872;';
  const statBdr  = dark ? 'border-right-color:rgba(255,255,255,.07);' : 'border-right:1px solid #E9E3D4;';
  const statBg   = dark ? 'background:#2A2A2A;' : '';

  const statsHtml = (sinal.stats || []).map((s, i, arr) => `
    <div style="flex:1; padding:16px 18px; ${statBdr}${i === arr.length-1 ? 'border-right:none;' : ''}">
      <span style="display:block; font-family:\'Gilda Display\',Georgia,serif; font-size:26px; line-height:1; margin-bottom:5px; ${statNum}">${esc(s.valor)}</span>
      <span style="display:block; font-size:10px; font-weight:600; letter-spacing:.10em; text-transform:uppercase; line-height:1.35; ${statLbl}">${esc(s.label)}</span>
    </div>`).join('');

  return `
  <div class="signal">
    <div class="signal-hd">
      <div class="signal-num">Sinal ${num}</div>
      <h2 class="signal-title">${esc(sinal.titulo)}</h2>
    </div>
    ${sinal.stats && sinal.stats.length ? `<div style="display:flex; ${statBg} border-bottom:1px solid #E9E3D4;">${statsHtml}</div>` : ''}
    <div class="signal-bd">
      <div class="sec">
        <div class="sec-label">Resumo</div>
        <p class="sec-text">${esc(sinal.resumo)}</p>
      </div>
      <div class="sec">
        <div class="sec-label">Por que isso importa para você, consultora</div>
        <div class="importa-box">${esc(sinal.por_que_importa)}</div>
      </div>
      <div class="sec">
        <div class="sec-label">Como explicar isso ao seu cliente</div>
        <div class="quote">
          <div class="quote-hint">Script para usar</div>
          <p class="quote-text">"${esc(sinal.script_cliente)}"</p>
        </div>
      </div>
      <div class="sec">
        <div class="sec-label">Sugestão de conteúdo</div>
        <div class="sugestao">
          <div class="sugestao-format">${esc(sinal.sugestao_formato)}</div>
          <div class="sugestao-gancho-label">Gancho</div>
          <p class="sugestao-gancho">"${esc(sinal.sugestao_gancho)}"</p>
        </div>
      </div>
      <div class="sec">
        <div class="sec-label">Fonte</div>
        <p class="source-link">${esc(sinal.fonte_nome)} — <a href="${sinal.fonte_url}" style="color:#7A7872;">${esc(sinal.fonte_nome)}</a></p>
      </div>
    </div>
  </div>`;
}

// ── Gerar HTML do site ────────────────────────────────────────
console.log('📝 Gerando HTML do site...');
const edicaoNum = `#${padded}`;
const signaisHtml = ed.sinais.map((s, i) => signalHtml(s, i)).join('\n');
const navDots = ed.sinais.map((s, i) => `
  <div class="sn-dot js-sn-dot" data-signal="${i+1}" title="Sinal ${String(i+1).padStart(2,'0')} — ${s.titulo.split(',')[0]}"></div>`).join('');

const siteHtml = `<!-- ══ HEADER ══ -->
<header class="nl-header js-reveal">
  <div class="nl-logo-row">
    <svg class="nl-radar-svg" viewBox="0 0 52 52" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <circle cx="26" cy="26" r="25" stroke="#D8D0BC" stroke-width=".75"/>
      <circle cx="26" cy="26" r="17" stroke="#D8D0BC" stroke-width=".75"/>
      <circle cx="26" cy="26" r="9"  stroke="#D8D0BC" stroke-width=".75"/>
      <g style="transform-origin:26px 26px; animation:radarSpin 4.5s linear infinite;">
        <line x1="26" y1="26" x2="26" y2="1" stroke="#A07000" stroke-width="1.6" stroke-linecap="round" opacity=".85"/>
        <path d="M26 26 L26 1 A25 25 0 0 1 37.8 5.5 Z" fill="#EEB811" opacity=".20"/>
      </g>
      <circle cx="36" cy="12" r="2.5" fill="#EEB811" style="animation:blip1 2.4s ease-in-out infinite;"/>
      <circle cx="13" cy="34" r="1.8" fill="#A07000" style="animation:blip2 3.4s ease-in-out infinite;"/>
      <circle cx="26" cy="26" r="2.2" fill="#A07000"/>
    </svg>
    <div>
      <div class="nl-wordmark-main">RADAR</div>
      <div class="nl-wordmark-sub">Expert</div>
    </div>
  </div>
  <div class="nl-meta">
    EDIÇÃO <strong style="color:var(--text-gold); font-weight:700;">${edicaoNum}</strong>
    <span class="nl-meta-dot">·</span>
    SEMANA DE ${ed.semana.toUpperCase()}
    <span class="nl-meta-dot">·</span>
    ${ed.ano}
  </div>
  <h1 class="nl-hero-title">O que merece a sua atenção esta semana.</h1>
</header>

<div class="nl-selecao js-reveal">
  <span class="nl-selecao-text">Selecionamos o que merece a sua atenção nesta semana</span>
  <div class="nl-selecao-rule"></div>
</div>

<p class="nl-intro js-reveal" style="padding-bottom:6px;">
  Nesta edição, cobrimos <strong>${ed.sinais.length} sinais</strong> que movimentaram o cenário das micro e pequenas empresas. Cada sinal vem com análise prática, um script para usar com o cliente e uma sugestão de conteúdo para as redes.
</p>

<div class="nl-section-div js-reveal">
  <span class="nl-section-div-label">No Radar</span>
  <div class="nl-section-div-rule"></div>
</div>

${signaisHtml}

<div class="nl-cta js-reveal">
  <svg class="nl-cta-rings" width="480" height="480" viewBox="0 0 480 480" fill="none" aria-hidden="true">
    <circle cx="240" cy="240" r="235" stroke="#EEB811" stroke-width=".7"/>
    <circle cx="240" cy="240" r="170" stroke="#EEB811" stroke-width=".7"/>
    <circle cx="240" cy="240" r="105" stroke="#EEB811" stroke-width=".7"/>
    <circle cx="240" cy="240" r="42"  stroke="#EEB811" stroke-width=".7"/>
  </svg>
  <div class="nl-cta-eyebrow">Compartilhe com outras consultoras</div>
  <div class="nl-cta-title">Sinais que importam,<br>toda semana.</div>
  <a href="../assinar.html" class="nl-cta-btn">Assinar gratuitamente</a>
</div>

<footer class="nl-footer js-reveal">
  <div class="nl-footer-wordmark">RADAR</div>
  <div class="nl-footer-sub">Expert</div>
  <p class="nl-footer-text">
    EDIÇÃO ${edicaoNum} · ${(ed.semana.split(' de ')[1] || ed.semana).toUpperCase()} · ${ed.ano}<br>
    Curadoria estratégica para consultoras financeiras que atendem micro e pequenas empresas.
  </p>
  <div class="nl-footer-rule"></div>
</footer>`;

fs.writeFileSync(path.join(SITE_PATH, 'editions', `${padded}.html`), siteHtml, 'utf8');
console.log(`✅ Site: editions/${padded}.html`);

// ── Gerar HTML do e-mail ──────────────────────────────────────
console.log('📧 Gerando HTML do e-mail...');
const sinaisEmailHtml = ed.sinais.map((s, i) => signalEmailHtml(s, i)).join('\n');

const emailHtml = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Radar Expert — Edição ${edicaoNum}</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Gilda+Display&family=DM+Sans:wght@400;500;600;700&display=swap" rel="stylesheet">
<style>
  *,*::before,*::after{box-sizing:border-box;}
  body{margin:0;padding:0;background:#F2EFE7;font-family:'DM Sans',-apple-system,BlinkMacSystemFont,Arial,sans-serif;color:#34332F;-webkit-font-smoothing:antialiased;}
  p,h1,h2,h3{margin:0;}h1,h2,h3{font-weight:400;}a{color:#A07000;}
  .wrapper{max-width:600px;margin:0 auto;padding:24px 16px 60px;}
  .header{padding:48px 0 36px;border-bottom:1px solid #E9E3D4;}
  .logo-row{display:flex;align-items:center;gap:16px;margin-bottom:24px;}
  .wordmark-main{font-family:'Gilda Display',Georgia,serif;font-size:30px;letter-spacing:.14em;color:#2A2A2A;line-height:1;}
  .wordmark-sub{font-size:9px;font-weight:700;letter-spacing:.32em;text-transform:uppercase;color:#A07000;margin-top:3px;}
  .meta{font-size:11px;font-weight:600;letter-spacing:.20em;text-transform:uppercase;color:#7A7872;margin-bottom:16px;}
  .meta-dot{color:#EEB811;margin:0 8px;}
  .hero-title{font-family:'Gilda Display',Georgia,serif;font-size:36px;color:#2A2A2A;line-height:1.13;letter-spacing:-.01em;}
  .selecao{padding:24px 0 18px;display:flex;align-items:center;gap:16px;}
  .selecao-text{font-size:10px;font-weight:700;letter-spacing:.26em;text-transform:uppercase;color:#A07000;white-space:nowrap;}
  .selecao-rule{flex:1;height:1px;background:#E9E3D4;}
  .intro{font-size:16px;line-height:1.74;color:#34332F;padding-bottom:6px;}
  .section-div{display:flex;align-items:center;gap:14px;margin:48px 0 26px;}
  .section-div-label{font-size:11px;font-weight:700;letter-spacing:.22em;text-transform:uppercase;color:#A07000;white-space:nowrap;}
  .section-div-rule{flex:1;height:1px;background:#E9E3D4;}
  .signal{background:#FBF9F3;border:1px solid #D8D0BC;border-radius:12px;overflow:hidden;margin-bottom:22px;}
  .signal-hd{padding:24px 26px 20px;border-bottom:1px solid #E9E3D4;}
  .signal-num{font-size:10px;font-weight:700;letter-spacing:.22em;text-transform:uppercase;color:#A07000;margin-bottom:8px;}
  .signal-title{font-family:'Gilda Display',Georgia,serif;font-size:22px;color:#2A2A2A;line-height:1.22;}
  .signal-bd{padding:0 26px 26px;}
  .sec{padding-top:20px;}.sec+.sec{margin-top:16px;padding-top:18px;border-top:1px solid #E9E3D4;}
  .sec-label{font-size:10px;font-weight:700;letter-spacing:.20em;text-transform:uppercase;color:#A07000;margin-bottom:8px;}
  .sec-text{font-size:14px;line-height:1.74;color:#34332F;}
  .importa-box{background:#F6F2E9;border-left:3px solid #C99412;border-radius:0 8px 8px 0;padding:12px 16px;font-size:14px;line-height:1.72;color:#34332F;}
  .quote{background:#2A2A2A;border-radius:10px;padding:20px 22px;}
  .quote-hint{font-size:10px;font-weight:700;letter-spacing:.16em;text-transform:uppercase;color:#EEB811;margin-bottom:9px;}
  .quote-text{font-size:14px;font-style:italic;line-height:1.72;color:#F2EFE7;}
  .sugestao{background:#FBF1C9;border:1px solid rgba(160,112,0,.18);border-radius:10px;padding:16px 18px;}
  .sugestao-format{display:inline-block;font-size:10px;font-weight:700;letter-spacing:.16em;text-transform:uppercase;color:#7E5800;background:rgba(160,112,0,.13);border-radius:100px;padding:4px 12px;margin-bottom:10px;}
  .sugestao-gancho-label{font-size:10px;font-weight:700;letter-spacing:.14em;text-transform:uppercase;color:#A07000;margin-bottom:6px;}
  .sugestao-gancho{font-size:13px;line-height:1.66;color:#2A2A2A;font-style:italic;}
  .source-link{font-size:12px;color:#7A7872;}
  .cta{background:#2A2A2A;border-radius:14px;padding:44px 32px;text-align:center;margin-top:48px;}
  .cta-eyebrow{font-size:11px;font-weight:700;letter-spacing:.24em;text-transform:uppercase;color:#EEB811;margin-bottom:12px;}
  .cta-title{font-family:'Gilda Display',Georgia,serif;font-size:30px;color:#F2EFE7;line-height:1.16;margin-bottom:28px;}
  .cta-btn{display:inline-block;background:#EEB811;color:#2A2A2A;font-family:'DM Sans',Arial,sans-serif;font-size:14px;font-weight:700;letter-spacing:.06em;text-decoration:none;padding:13px 34px;border-radius:8px;}
  .footer{margin-top:56px;padding-top:32px;border-top:1px solid #E9E3D4;text-align:center;}
  .footer-wordmark{font-family:'Gilda Display',Georgia,serif;font-size:20px;letter-spacing:.14em;color:#2A2A2A;}
  .footer-sub{font-size:9px;font-weight:700;letter-spacing:.32em;text-transform:uppercase;color:#A07000;margin-top:3px;}
  .footer-text{font-size:12px;color:#7A7872;margin-top:14px;line-height:1.72;}
</style>
</head>
<body>
<div class="wrapper">
  <div style="text-align:center;padding:16px 0 28px;">
    <a href="https://radarexpert.netlify.app" style="display:inline-flex;align-items:center;gap:8px;background:#FBF9F3;border:1px solid #D8D0BC;border-radius:100px;padding:9px 20px;font-family:'DM Sans',Arial,sans-serif;font-size:12px;font-weight:600;color:#7A7872;text-decoration:none;">
      ↗ Leia esta edição com animação no site
    </a>
  </div>
  <div class="header">
    <div class="logo-row">
      <svg width="46" height="46" viewBox="0 0 52 52" fill="none">
        <circle cx="26" cy="26" r="25" stroke="#D8D0BC" stroke-width=".75"/>
        <circle cx="26" cy="26" r="17" stroke="#D8D0BC" stroke-width=".75"/>
        <circle cx="26" cy="26" r="9"  stroke="#D8D0BC" stroke-width=".75"/>
        <path d="M26 26 L26 1 A25 25 0 0 1 37.8 5.5 Z" fill="#EEB811" opacity=".30"/>
        <line x1="26" y1="26" x2="26" y2="1" stroke="#A07000" stroke-width="1.6" stroke-linecap="round" opacity=".85"/>
        <circle cx="36" cy="12" r="2.8" fill="#EEB811"/>
        <circle cx="13" cy="34" r="2" fill="#A07000" opacity=".7"/>
        <circle cx="26" cy="26" r="2.5" fill="#A07000"/>
      </svg>
      <div>
        <div class="wordmark-main">RADAR</div>
        <div class="wordmark-sub">Expert</div>
      </div>
    </div>
    <div class="meta">
      EDIÇÃO <strong style="color:#A07000;font-weight:700;">${edicaoNum}</strong>
      <span class="meta-dot">·</span>
      SEMANA DE ${ed.semana.toUpperCase()}
      <span class="meta-dot">·</span>
      ${ed.ano}
    </div>
    <h1 class="hero-title">O que merece a sua atenção esta semana.</h1>
  </div>
  <div class="selecao">
    <span class="selecao-text">Selecionamos o que merece a sua atenção nesta semana</span>
    <div class="selecao-rule"></div>
  </div>
  <p class="intro">Nesta edição, cobrimos <strong style="color:#2A2A2A;font-weight:600;">${ed.sinais.length} sinais</strong> que movimentaram o cenário das micro e pequenas empresas. Cada sinal vem com análise prática, um script para usar com o cliente e uma sugestão de conteúdo para as redes.</p>
  <div class="section-div">
    <span class="section-div-label">No Radar</span>
    <div class="section-div-rule"></div>
  </div>
  ${sinaisEmailHtml}
  <div class="cta">
    <div class="cta-eyebrow">Compartilhe com outras consultoras</div>
    <div class="cta-title">Sinais que importam,<br>toda semana.</div>
    <a href="https://radarexpert.netlify.app/assinar.html" class="cta-btn">Assinar gratuitamente</a>
  </div>
  <div class="footer">
    <div class="footer-wordmark">RADAR</div>
    <div class="footer-sub">Expert</div>
    <p class="footer-text">
      EDIÇÃO ${edicaoNum} · ${ed.ano}<br>
      Curadoria estratégica para consultoras financeiras.<br><br>
      <a href="{{ unsubscribe }}" style="color:#7A7872;">Cancelar inscrição</a>
    </p>
  </div>
</div>
</body>
</html>`;

fs.writeFileSync(path.join(SITE_PATH, `email-edicao-${padded}.html`), emailHtml, 'utf8');
console.log(`✅ E-mail: email-edicao-${padded}.html`);

// ── Atualizar editions.json ───────────────────────────────────
console.log('📋 Atualizando editions.json...');
const novaEdicao = {
  id: padded,
  numero: edicaoNum,
  titulo: "O que merece a sua atenção esta semana",
  semana: ed.semana,
  ano: ed.ano,
  data_iso: ed.data_iso,
  arquivo: `editions/reader.html?id=${padded}`,
  sinais: ed.sinais.map(s => s.titulo)
};
editions.unshift(novaEdicao);
fs.writeFileSync(editionsJsonPath, JSON.stringify(editions, null, 2), 'utf8');
console.log('✅ editions.json atualizado');

// ── Git push ──────────────────────────────────────────────────
console.log('🚀 Fazendo push para o GitHub...');
execSync(`cd "${SITE_PATH}" && git add editions/${padded}.html email-edicao-${padded}.html editions.json && git commit -m "Publicar Edição ${edicaoNum} — Semana de ${ed.semana}" && git push`, { stdio: 'inherit' });
console.log('✅ GitHub atualizado — Netlify publicando...');

// ── Criar campanha no Brevo ───────────────────────────────────
console.log('📬 Criando campanha no Brevo...');

// Segunda-feira 6h BRT = 9h UTC
const proximaSegunda = new Date();
const diasAteSeg = (1 - proximaSegunda.getDay() + 7) % 7 || 7;
proximaSegunda.setDate(proximaSegunda.getDate() + diasAteSeg);
proximaSegunda.setHours(9, 0, 0, 0); // 9h UTC = 6h BRT
const scheduledAt = proximaSegunda.toISOString();

const htmlEmailContent = fs.readFileSync(path.join(SITE_PATH, `email-edicao-${padded}.html`), 'utf8');

async function criarCampanha() {
  // 1. Criar campanha
  const criar = await fetch('https://api.brevo.com/v3/emailCampaigns', {
    method: 'POST',
    headers: { 'api-key': BREVO_KEY, 'Content-Type': 'application/json', 'accept': 'application/json' },
    body: JSON.stringify({
      name: `Radar Expert — Edição ${edicaoNum} — ${ed.semana} de ${ed.ano}`,
      subject: `📡 Radar Expert ${edicaoNum} — O que merece sua atenção esta semana`,
      sender: { name: 'Radar Expert', email: 'josetesantos@gmail.com' },
      type: 'classic',
      htmlContent: htmlEmailContent,
      recipients: { listIds: [BREVO_LIST] },
      scheduledAt,
    }),
  });

  if (!criar.ok) {
    const err = await criar.json();
    throw new Error('Brevo criar campanha: ' + JSON.stringify(err));
  }

  const { id } = await criar.json();
  console.log(`✅ Campanha criada — ID: ${id}`);
  console.log(`⏰ Agendada para: ${scheduledAt} (segunda às 6h BRT)`);
}

criarCampanha().catch(e => {
  console.error('❌ Erro no Brevo:', e.message);
  process.exit(1);
});
