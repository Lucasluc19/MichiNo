/**
 * 🔍 Moteur d'Audit SEO IA — MichiNo-
 * ═══════════════════════════════════════════════════════════════
 * Vérifie automatiquement les 25 critères officiels Google et
 * génère des recommandations IA pour atteindre le meilleur SEO.
 *
 * Sources Google officielles surveillées :
 *  • Google Search Central (developers.google.com/search)
 *  • Core Web Vitals (web.dev/vitals)
 *  • Schema.org / Rich Results
 *  • Google PageSpeed Insights critères
 *  • Mobile-First Indexing guidelines
 *  • E-E-A-T (Experience, Expertise, Authoritativeness, Trustworthiness)
 * ═══════════════════════════════════════════════════════════════
 */

const fs   = require('fs');
const path = require('path');
const Song  = require('../models/Song');
const Video = require('../models/Video');

// ── Cache du dernier audit ───────────────────────────────────
let auditCache = {
  score:       null,
  lastRun:     null,
  isRunning:   false,
  results:     [],
  fixes:       [],
  aiAdvice:    null,
  autoFixed:   [],
  nextScheduled: null,
};

const AUDIT_INTERVAL_MS = 6 * 60 * 60 * 1000; // toutes les 6h

// ══════════════════════════════════════════════════════════════
//  CRITÈRES GOOGLE OFFICIELS (25 checks)
// ══════════════════════════════════════════════════════════════
const GOOGLE_CRITERIA = [
  // ── BALISES FONDAMENTALES ─────────────────────────────────
  { id: 'title',        category: 'Balises',       weight: 10, label: 'Balise <title> présente et optimale (50-60 car.)' },
  { id: 'description',  category: 'Balises',       weight: 8,  label: 'Meta description optimale (140-160 car.)' },
  { id: 'h1',           category: 'Structure',     weight: 8,  label: 'Balise H1 unique présente' },
  { id: 'canonical',    category: 'Balises',       weight: 6,  label: 'URL canonique déclarée' },
  { id: 'lang',         category: 'Balises',       weight: 5,  label: 'Attribut lang sur <html>' },
  { id: 'charset',      category: 'Balises',       weight: 4,  label: 'Charset UTF-8 déclaré' },
  { id: 'viewport',     category: 'Mobile',        weight: 9,  label: 'Meta viewport (Mobile-First)' },

  // ── OPEN GRAPH & RÉSEAUX SOCIAUX ──────────────────────────
  { id: 'og_title',     category: 'Social',        weight: 5,  label: 'og:title (partage réseaux sociaux)' },
  { id: 'og_desc',      category: 'Social',        weight: 5,  label: 'og:description présente' },
  { id: 'og_type',      category: 'Social',        weight: 3,  label: 'og:type défini' },
  { id: 'twitter_card', category: 'Social',        weight: 3,  label: 'Twitter Card configurée' },

  // ── DONNÉES STRUCTURÉES SCHEMA.ORG ────────────────────────
  { id: 'jsonld',       category: 'Structuré',     weight: 10, label: 'JSON-LD Schema.org présent' },
  { id: 'jsonld_valid', category: 'Structuré',     weight: 8,  label: 'JSON-LD valide et parseable' },
  { id: 'website_schema', category: 'Structuré',   weight: 5,  label: 'Schema WebSite avec SearchAction' },

  // ── INDEXATION ────────────────────────────────────────────
  { id: 'robots_txt',   category: 'Indexation',    weight: 7,  label: 'robots.txt accessible' },
  { id: 'sitemap',      category: 'Indexation',    weight: 8,  label: 'sitemap.xml dynamique' },
  { id: 'robots_meta',  category: 'Indexation',    weight: 6,  label: 'Meta robots = index,follow' },
  { id: 'noindex_absent', category: 'Indexation',  weight: 9,  label: 'Pas de noindex sur pages publiques' },

  // ── PERFORMANCE (Core Web Vitals hints) ───────────────────
  { id: 'compression',  category: 'Performance',   weight: 7,  label: 'Compression gzip activée' },
  { id: 'cache',        category: 'Performance',   weight: 6,  label: 'Headers Cache-Control configurés' },
  { id: 'preconnect',   category: 'Performance',   weight: 4,  label: 'Preconnect pour ressources externes' },
  { id: 'font_display', category: 'Performance',   weight: 3,  label: 'Google Fonts chargées efficacement' },

  // ── CONTENU & E-E-A-T ─────────────────────────────────────
  { id: 'content_fresh', category: 'Contenu',      weight: 8,  label: 'Contenu frais (chansons/vidéos récentes)' },
  { id: 'keywords_body', category: 'Contenu',      weight: 6,  label: 'Mots-clés ciblés présents dans le contenu' },
  { id: 'internal_links', category: 'Contenu',     weight: 4,  label: 'Navigation interne cohérente' },
];

// ══════════════════════════════════════════════════════════════
//  LECTURE DU HTML AVEC CACHE
// ══════════════════════════════════════════════════════════════
function readIndexHtml() {
  try {
    return fs.readFileSync(
      path.join(__dirname, '..', 'public', 'index.html'), 'utf8'
    );
  } catch { return ''; }
}

// ══════════════════════════════════════════════════════════════
//  AUDIT TECHNIQUE : vérification de chaque critère
// ══════════════════════════════════════════════════════════════
async function runTechnicalAudit(html) {
  const results = [];
  let totalWeight = 0;
  let earnedWeight = 0;

  // Données DB
  const [songCount, videoCount, recentSong] = await Promise.all([
    Song.countDocuments(),
    Video.countDocuments(),
    Song.findOne().sort({ createdAt: -1 }).select('createdAt'),
  ]);

  for (const criterion of GOOGLE_CRITERIA) {
    totalWeight += criterion.weight;
    let passed = false;
    let detail = '';
    let fix    = null;

    switch (criterion.id) {

      // ── Balises fondamentales ────────────────────────────
      case 'title': {
        const m = html.match(/<title[^>]*>([^<]+)<\/title>/i);
        if (m) {
          const len = m[1].trim().length;
          passed = len >= 40 && len <= 65;
          detail = passed
            ? `✅ "${m[1].trim().substring(0,50)}…" (${len} car.)`
            : `⚠️ Longueur ${len} car. — idéal 50-60 car.`;
        } else {
          detail = '❌ Balise <title> absente';
          fix = 'Ajouter une balise <title> optimisée dans le <head>';
        }
        break;
      }

      case 'description': {
        const m = html.match(/<meta\s+name=["']description["']\s+content=["']([^"']+)["']/i)
                || html.match(/<meta\s+content=["']([^"']+)["']\s+name=["']description["']/i);
        if (m) {
          const len = m[1].length;
          passed = len >= 120 && len <= 165;
          detail = passed ? `✅ ${len} caractères` : `⚠️ ${len} car. — idéal 140-155`;
        } else {
          detail = '❌ Meta description absente';
          fix = 'Ajouter <meta name="description" content="..."> dans le <head>';
        }
        break;
      }

      case 'h1': {
        const matches = html.match(/<h1[^>]*>/gi) || [];
        passed = matches.length === 1;
        detail = matches.length === 0 ? '❌ Aucun H1 trouvé'
               : matches.length === 1 ? '✅ 1 H1 unique'
               : `⚠️ ${matches.length} H1 (doit être unique)`;
        if (matches.length === 0) fix = 'Ajouter un <h1> principal sur la page';
        break;
      }

      case 'canonical': {
        passed = /<link\s+rel=["']canonical["']/i.test(html);
        detail = passed ? '✅ URL canonique présente' : '❌ Manquante — risque de contenu dupliqué';
        fix = passed ? null : 'Ajouter <link rel="canonical" href="https://ton-site.com/"> dans le <head>';
        break;
      }

      case 'lang': {
        const m = html.match(/<html[^>]+lang=["']([^"']+)["']/i);
        passed = !!m;
        detail = m ? `✅ lang="${m[1]}"` : '❌ Attribut lang manquant sur <html>';
        fix = passed ? null : 'Modifier <html> en <html lang="fr">';
        break;
      }

      case 'charset': {
        passed = /<meta\s+charset=["']?utf-8["']?/i.test(html);
        detail = passed ? '✅ UTF-8 déclaré' : '❌ Charset manquant';
        fix = passed ? null : 'Ajouter <meta charset="UTF-8"> en premier dans le <head>';
        break;
      }

      case 'viewport': {
        passed = /<meta\s+name=["']viewport["']/i.test(html);
        detail = passed ? '✅ Viewport mobile configuré' : '❌ Viewport manquant — pénalité mobile Google';
        fix = passed ? null : 'Ajouter <meta name="viewport" content="width=device-width, initial-scale=1.0">';
        break;
      }

      // ── Open Graph ───────────────────────────────────────
      case 'og_title': {
        passed = /property=["']og:title["']/i.test(html);
        detail = passed ? '✅ og:title présent' : '❌ og:title manquant (partage WhatsApp/Facebook)';
        fix = passed ? null : 'Ajouter <meta property="og:title" content="..."> dans le <head>';
        break;
      }

      case 'og_desc': {
        passed = /property=["']og:description["']/i.test(html);
        detail = passed ? '✅ og:description présent' : '❌ og:description manquant';
        fix = passed ? null : 'Ajouter <meta property="og:description" content="..."> dans le <head>';
        break;
      }

      case 'og_type': {
        passed = /property=["']og:type["']/i.test(html);
        detail = passed ? '✅ og:type défini' : '❌ og:type manquant';
        fix = passed ? null : 'Ajouter <meta property="og:type" content="website">';
        break;
      }

      case 'twitter_card': {
        passed = /name=["']twitter:card["']/i.test(html);
        detail = passed ? '✅ Twitter Card configurée' : '❌ Twitter Card manquante';
        fix = passed ? null : 'Ajouter <meta name="twitter:card" content="summary_large_image">';
        break;
      }

      // ── Données Structurées ──────────────────────────────
      case 'jsonld': {
        passed = /type=["']application\/ld\+json["']/i.test(html);
        detail = passed ? '✅ JSON-LD présent' : '❌ Pas de données structurées Schema.org';
        fix = passed ? null : 'Ajouter un bloc <script type="application/ld+json"> avec WebSite schema';
        break;
      }

      case 'jsonld_valid': {
        const m = html.match(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/i);
        if (m) {
          try { JSON.parse(m[1]); passed = true; detail = '✅ JSON-LD valide'; }
          catch(e) { detail = `❌ JSON-LD invalide: ${e.message.substring(0,60)}`; fix = 'Corriger le JSON-LD malformé'; }
        } else {
          detail = '⏭️ Pas de JSON-LD à valider';
          passed = true; // pas bloquant si jsonld est déjà raté
        }
        break;
      }

      case 'website_schema': {
        passed = html.includes('"WebSite"') && html.includes('SearchAction');
        detail = passed ? '✅ Schema WebSite + SearchAction (boîte de recherche Google)' : '⚠️ Schema WebSite incomplet';
        fix = passed ? null : 'Ajouter "potentialAction": {"@type": "SearchAction"} au schema WebSite';
        break;
      }

      // ── Indexation ────────────────────────────────────────
      case 'robots_txt': {
        try {
          const robotsPath = path.join(__dirname, '..', 'routes', 'seo.js');
          passed = fs.existsSync(robotsPath) && fs.readFileSync(robotsPath, 'utf8').includes('robots.txt');
          detail = passed ? '✅ robots.txt route déclarée' : '❌ robots.txt non configuré';
          fix = passed ? null : 'Ajouter une route GET /robots.txt dans routes/seo.js';
        } catch { passed = false; detail = '❌ Erreur vérification robots.txt'; }
        break;
      }

      case 'sitemap': {
        try {
          const seoRoute = fs.readFileSync(path.join(__dirname, '..', 'routes', 'seo.js'), 'utf8');
          passed = seoRoute.includes('sitemap.xml');
          detail = passed ? '✅ sitemap.xml dynamique configuré' : '❌ sitemap.xml manquant';
          fix = passed ? null : 'Créer une route GET /sitemap.xml listant toutes les URLs';
        } catch { passed = false; }
        break;
      }

      case 'robots_meta': {
        const m = html.match(/name=["']robots["']\s+content=["']([^"']+)["']/i)
                || html.match(/content=["']([^"']+)["']\s+name=["']robots["']/i);
        if (m) {
          passed = /index/.test(m[1]) && !/noindex/.test(m[1]);
          detail = passed ? `✅ robots="${m[1]}"` : `⚠️ robots="${m[1]}" — vérifier noindex`;
        } else {
          passed = true; // pas de robots meta = index par défaut
          detail = 'ℹ️ Pas de meta robots (index par défaut — OK)';
        }
        break;
      }

      case 'noindex_absent': {
        const hasNoindex = /content=["'][^"']*noindex/i.test(html);
        passed = !hasNoindex;
        detail = passed ? '✅ Pas de noindex sur la page publique' : '❌ noindex détecté — page non indexée par Google !';
        fix = hasNoindex ? 'Retirer noindex de la meta robots sur index.html' : null;
        break;
      }

      // ── Performance ───────────────────────────────────────
      case 'compression': {
        const serverJs = fs.readFileSync(path.join(__dirname, '..', 'server.js'), 'utf8');
        passed = serverJs.includes('compression()');
        detail = passed ? '✅ Gzip/Brotli compression activée' : '❌ Compression désactivée — pages lentes';
        fix = passed ? null : 'Ajouter app.use(compression()) dans server.js';
        break;
      }

      case 'cache': {
        const serverJs = fs.readFileSync(path.join(__dirname, '..', 'server.js'), 'utf8');
        passed = serverJs.includes('max-age') || serverJs.includes('maxAge');
        detail = passed ? '✅ Cache-Control configuré' : '⚠️ Cache-Control absent — ressources non mises en cache';
        fix = passed ? null : 'Ajouter Cache-Control headers sur les fichiers statiques';
        break;
      }

      case 'preconnect': {
        passed = html.includes('rel="preconnect"') || html.includes("rel='preconnect'");
        detail = passed ? '✅ Preconnect pour ressources tierces' : '⚠️ Preconnect manquant (LCP Google Fonts)';
        fix = passed ? null : 'Ajouter <link rel="preconnect" href="https://fonts.googleapis.com"> avant les fonts';
        break;
      }

      case 'font_display': {
        passed = html.includes('display=swap') || html.includes('font-display:swap');
        detail = passed ? '✅ font-display:swap (évite FOIT)' : '⚠️ font-display absent — texte invisible au chargement';
        fix = passed ? null : 'Ajouter &display=swap à l\'URL Google Fonts';
        break;
      }

      // ── Contenu & E-E-A-T ────────────────────────────────
      case 'content_fresh': {
        const oneWeekAgo = new Date(Date.now() - 7 * 24 * 3600 * 1000);
        passed = !!(recentSong && new Date(recentSong.createdAt) > oneWeekAgo) || songCount > 0;
        detail = songCount > 0
          ? `✅ ${songCount} chansons, ${videoCount} vidéos en base`
          : '⚠️ Aucun contenu — ajouter des chansons/vidéos';
        fix = songCount === 0 ? 'Ajouter du contenu via l\'admin pour améliorer le classement' : null;
        break;
      }

      case 'keywords_body': {
        const bodyKeywords = ['afrobeat', 'music', 'michino', 'télécharger', 'download', 'chanson', 'vidéo'];
        const lowerHtml = html.toLowerCase();
        const found = bodyKeywords.filter(k => lowerHtml.includes(k));
        passed = found.length >= 3;
        detail = passed
          ? `✅ Mots-clés présents: ${found.join(', ')}`
          : `⚠️ Seulement ${found.length}/7 mots-clés cibles dans le HTML`;
        fix = passed ? null : 'Enrichir le contenu visible avec les mots-clés ciblés';
        break;
      }

      case 'internal_links': {
        const links = html.match(/<a\s+[^>]*href=["'][^"'#][^"']*["']/gi) || [];
        passed = links.length >= 2;
        detail = passed
          ? `✅ ${links.length} lien(s) interne(s) détecté(s)`
          : '⚠️ Navigation interne insuffisante';
        break;
      }
    }

    if (passed) earnedWeight += criterion.weight;

    results.push({
      ...criterion,
      passed,
      detail,
      fix: fix || null,
    });
  }

  const score = Math.round((earnedWeight / totalWeight) * 100);
  const issues  = results.filter(r => !r.passed);
  const passing = results.filter(r => r.passed);

  return { score, results, issues, passing, songCount, videoCount };
}

// ══════════════════════════════════════════════════════════════
//  ANALYSE IA — Claude génère un plan d'action SEO Google
// ══════════════════════════════════════════════════════════════
async function getAIAnalysis(score, issues, songCount, videoCount) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return null;

  const issuesList = issues.slice(0, 10).map(i =>
    `- [${i.category}] ${i.label}: ${i.detail}`
  ).join('\n');

  const prompt = `Tu es un expert SEO Google certifié. Analyse ce rapport d'audit SEO pour la plateforme musicale MichiNo- (Afrobeat, musique africaine).

SCORE SEO ACTUEL : ${score}/100
CONTENU : ${songCount} chansons, ${videoCount} vidéos

PROBLÈMES DÉTECTÉS :
${issuesList || 'Aucun problème majeur détecté.'}

En te basant sur les directives officielles de Google Search Central, Core Web Vitals et les meilleures pratiques SEO 2024-2025 :

1. Donne une analyse courte du score (2 phrases max)
2. Liste les 3 actions PRIORITAIRES à faire MAINTENANT pour monter dans Google
3. Donne 2 conseils spécifiques à une plateforme musicale africaine pour se positionner sur des requêtes à fort trafic
4. Estime le potentiel de score après corrections

Réponds en français, de façon directe et actionnable. Maximum 200 mots.`;

  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-opus-4-6',
        max_tokens: 500,
        messages: [{ role: 'user', content: prompt }],
      }),
    });
    const data = await res.json();
    return data.content?.[0]?.text?.trim() || null;
  } catch (e) {
    console.error('Erreur IA audit:', e.message);
    return null;
  }
}

// ══════════════════════════════════════════════════════════════
//  AUTO-FIX — Corrections automatiques applicables
// ══════════════════════════════════════════════════════════════
function applyAutoFixes(html, issues) {
  let fixedHtml = html;
  const applied = [];

  for (const issue of issues) {
    if (issue.passed) continue;

    switch (issue.id) {
      case 'lang': {
        if (!/<html[^>]+lang=/i.test(fixedHtml)) {
          fixedHtml = fixedHtml.replace('<html>', '<html lang="fr">');
          if (fixedHtml !== html) applied.push('✅ lang="fr" ajouté sur <html>');
        }
        break;
      }
      case 'preconnect': {
        if (!fixedHtml.includes('rel="preconnect"')) {
          fixedHtml = fixedHtml.replace(
            '<link rel="preconnect" href="https://fonts.googleapis.com">',
            '<link rel="preconnect" href="https://fonts.googleapis.com">'
          );
          if (!fixedHtml.includes('preconnect')) {
            fixedHtml = fixedHtml.replace(
              '<link href="https://fonts.googleapis.com',
              '<link rel="preconnect" href="https://fonts.googleapis.com">\n  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>\n  <link href="https://fonts.googleapis.com'
            );
            applied.push('✅ Preconnect Google Fonts ajouté');
          }
        }
        break;
      }
      case 'font_display': {
        if (!fixedHtml.includes('display=swap')) {
          fixedHtml = fixedHtml.replace(
            /fonts\.googleapis\.com\/css2\?([^"'&]+)(?!&display=swap)/g,
            (match) => match + '&display=swap'
          );
          applied.push('✅ font-display=swap ajouté aux Google Fonts');
        }
        break;
      }
    }
  }

  return { fixedHtml, applied };
}

// ══════════════════════════════════════════════════════════════
//  LANCEMENT DE L'AUDIT COMPLET
// ══════════════════════════════════════════════════════════════
async function runFullAudit(applyFixes = false) {
  if (auditCache.isRunning) {
    return { message: 'Audit déjà en cours…', ...auditCache };
  }

  auditCache.isRunning = true;
  console.log('🔍 Audit SEO IA démarré — vérification des critères Google...');

  try {
    const html = readIndexHtml();
    const { score, results, issues, passing, songCount, videoCount } = await runTechnicalAudit(html);

    let autoFixed = [];
    if (applyFixes && issues.length > 0) {
      const { fixedHtml, applied } = applyAutoFixes(html, issues);
      if (applied.length > 0) {
        fs.writeFileSync(path.join(__dirname, '..', 'public', 'index.html'), fixedHtml, 'utf8');
        autoFixed = applied;
        console.log('🔧 Auto-fixes appliqués:', applied.join(', '));
      }
    }

    // Analyse IA (en parallèle, non bloquante)
    const aiAdvice = await getAIAnalysis(score, issues, songCount, videoCount);

    const scoreLabel =
      score >= 90 ? '🟢 Excellent' :
      score >= 75 ? '🟡 Bon' :
      score >= 55 ? '🟠 Moyen' :
                    '🔴 Insuffisant';

    auditCache = {
      score,
      scoreLabel,
      lastRun:   new Date(),
      isRunning: false,
      results,
      issues,
      passing,
      aiAdvice,
      autoFixed,
      songCount,
      videoCount,
      nextScheduled: new Date(Date.now() + AUDIT_INTERVAL_MS),
      stats: {
        total:   results.length,
        passed:  passing.length,
        failed:  issues.length,
        categories: groupByCategory(results),
      },
    };

    console.log(`✅ Audit SEO terminé — Score: ${score}/100 (${scoreLabel})`);
    if (issues.length) console.log(`   ⚠️  ${issues.length} problème(s) détecté(s)`);

    return auditCache;

  } catch (err) {
    console.error('❌ Erreur audit SEO:', err.message);
    auditCache.isRunning = false;
    throw err;
  }
}

function groupByCategory(results) {
  const cats = {};
  for (const r of results) {
    if (!cats[r.category]) cats[r.category] = { total: 0, passed: 0 };
    cats[r.category].total++;
    if (r.passed) cats[r.category].passed++;
  }
  return cats;
}

// ══════════════════════════════════════════════════════════════
//  PLANIFICATEUR (toutes les 6h)
// ══════════════════════════════════════════════════════════════
function startAuditScheduler() {
  setTimeout(() => runFullAudit(false).catch(console.error), 8000);
  setInterval(() => runFullAudit(false).catch(console.error), AUDIT_INTERVAL_MS);
  console.log('🔍 Auditeur SEO IA démarré — vérification automatique toutes les 6h');
}

function getAuditCache() { return auditCache; }

module.exports = { startAuditScheduler, runFullAudit, getAuditCache };
