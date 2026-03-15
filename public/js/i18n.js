/**
 * MichiNo- i18n — Traduction automatique selon le pays / navigateur
 * Langues : fr · en · pt · es
 *
 * Utilisation dans le HTML :
 *   <span data-i18n="key"></span>
 *   <input data-i18n-placeholder="key">
 * Utilisation dans JS :
 *   i18n.t('key')            → string
 *   i18n.t('count_songs', 3) → "3 songs"
 *   i18n.lang                → 'fr' | 'en' | 'pt' | 'es'
 */
(function () {
  'use strict';

  // ── Dictionnaires ────────────────────────────────────────────────────────────
  var DICT = {
    fr: {
      nav_music:          '🎵 Musique',
      nav_videos:         '🎬 Vidéos',
      search_placeholder: 'Artiste, titre, genre\u2026',
      hero_sub:           '🔥 Derniers Hits  \u00b7  Téléchargements Gratuits  \u00b7  Top Vidéos',
      stat_songs:         'Sons',
      stat_videos:        'Vidéos',
      stat_downloads:     'Téléchargements',
      genre_all:          '🌍 Tout',
      section_music:      '🔥 Dernières Sorties',
      section_videos:     '🎬 Dernières Vidéos',
      btn_download:       'Télécharger',
      views:              'vues',
      count_songs:        function(n){ return n + ' titre' + (n > 1 ? 's' : ''); },
      count_videos:       function(n){ return n + ' vidéo' + (n > 1 ? 's' : ''); },
      empty_songs:        'Aucune chanson disponible',
      empty_videos:       'Aucune vidéo disponible',
      no_results:         'Aucun résultat',
      error_load:         'Erreur de chargement',
      toast_download:     '⬇ Téléchargement lancé !',
      chat_status:        '● En ligne',
      chat_greeting:      'Bonjour 👋 Comment puis-je vous aider ?',
      chat_name_ph:       'Votre prénom *',
      chat_email_ph:      'Email (optionnel)',
      chat_msg_ph:        'Votre message\u2026',
      chat_send:          'Envoyer 💬',
      chat_reply_ph:      'Répondre\u2026',
      chat_admin_label:   'MichiNo-',
    },
    en: {
      nav_music:          '🎵 Music',
      nav_videos:         '🎬 Videos',
      search_placeholder: 'Artist, title, genre\u2026',
      hero_sub:           '🔥 Latest Hits  \u00b7  Free Downloads  \u00b7  Top Videos',
      stat_songs:         'Songs',
      stat_videos:        'Videos',
      stat_downloads:     'Downloads',
      genre_all:          '🌍 All',
      section_music:      '🔥 Latest Music',
      section_videos:     '🎬 Latest Videos',
      btn_download:       'Download',
      views:              'views',
      count_songs:        function(n){ return n + ' song' + (n > 1 ? 's' : ''); },
      count_videos:       function(n){ return n + ' video' + (n > 1 ? 's' : ''); },
      empty_songs:        'No songs available',
      empty_videos:       'No videos available',
      no_results:         'No results found',
      error_load:         'Loading error',
      toast_download:     '⬇ Download started!',
      chat_status:        '● Online',
      chat_greeting:      'Hello 👋 How can I help you?',
      chat_name_ph:       'Your name *',
      chat_email_ph:      'Email (optional)',
      chat_msg_ph:        'Your message\u2026',
      chat_send:          'Send 💬',
      chat_reply_ph:      'Reply\u2026',
      chat_admin_label:   'MichiNo-',
    },
    pt: {
      nav_music:          '🎵 Música',
      nav_videos:         '🎬 Vídeos',
      search_placeholder: 'Artista, título, género\u2026',
      hero_sub:           '🔥 Últimos Hits  \u00b7  Downloads Gratuitos  \u00b7  Top Vídeos',
      stat_songs:         'Músicas',
      stat_videos:        'Vídeos',
      stat_downloads:     'Downloads',
      genre_all:          '🌍 Tudo',
      section_music:      '🔥 Últimas Músicas',
      section_videos:     '🎬 Últimos Vídeos',
      btn_download:       'Baixar',
      views:              'visualizações',
      count_songs:        function(n){ return n + ' música' + (n > 1 ? 's' : ''); },
      count_videos:       function(n){ return n + ' vídeo' + (n > 1 ? 's' : ''); },
      empty_songs:        'Nenhuma música disponível',
      empty_videos:       'Nenhum vídeo disponível',
      no_results:         'Nenhum resultado',
      error_load:         'Erro de carregamento',
      toast_download:     '⬇ Download iniciado!',
      chat_status:        '● Online',
      chat_greeting:      'Olá 👋 Como posso ajudá-lo?',
      chat_name_ph:       'Seu nome *',
      chat_email_ph:      'Email (opcional)',
      chat_msg_ph:        'Sua mensagem\u2026',
      chat_send:          'Enviar 💬',
      chat_reply_ph:      'Responder\u2026',
      chat_admin_label:   'MichiNo-',
    },
    es: {
      nav_music:          '🎵 Música',
      nav_videos:         '🎬 Vídeos',
      search_placeholder: 'Artista, título, género\u2026',
      hero_sub:           '🔥 Últimos Éxitos  \u00b7  Descargas Gratis  \u00b7  Top Vídeos',
      stat_songs:         'Canciones',
      stat_videos:        'Vídeos',
      stat_downloads:     'Descargas',
      genre_all:          '🌍 Todo',
      section_music:      '🔥 Últimas Canciones',
      section_videos:     '🎬 Últimos Vídeos',
      btn_download:       'Descargar',
      views:              'vistas',
      count_songs:        function(n){ return n + (n > 1 ? ' canciones' : ' canción'); },
      count_videos:       function(n){ return n + ' vídeo' + (n > 1 ? 's' : ''); },
      empty_songs:        'No hay canciones disponibles',
      empty_videos:       'No hay vídeos disponibles',
      no_results:         'Sin resultados',
      error_load:         'Error de carga',
      toast_download:     '⬇ ¡Descarga iniciada!',
      chat_status:        '● En línea',
      chat_greeting:      'Hola 👋 ¿Cómo puedo ayudarte?',
      chat_name_ph:       'Tu nombre *',
      chat_email_ph:      'Email (opcional)',
      chat_msg_ph:        'Tu mensaje\u2026',
      chat_send:          'Enviar 💬',
      chat_reply_ph:      'Responder\u2026',
      chat_admin_label:   'MichiNo-',
    },
  };

  // ── Pays → langue  (ISO 3166-1 alpha-2) ─────────────────────────────────────
  var COUNTRY_LANG = {
    // Français — Europe
    FR:'fr', BE:'fr', CH:'fr', LU:'fr', MC:'fr',
    // Français — Amérique
    CA:'fr', HT:'fr', PM:'fr', PF:'fr',
    // Français — Afrique
    SN:'fr', CI:'fr', CM:'fr', ML:'fr', BF:'fr', NE:'fr', TD:'fr',
    CF:'fr', CG:'fr', CD:'fr', GA:'fr', DJ:'fr', KM:'fr', MG:'fr',
    MU:'fr', RE:'fr', TG:'fr', BJ:'fr', GN:'fr', GW:'fr', MR:'fr',
    RW:'fr', BI:'fr', SC:'fr', NC:'fr', YT:'fr', MF:'fr',
    // Portugais
    PT:'pt', BR:'pt', AO:'pt', MZ:'pt', CV:'pt', ST:'pt', TL:'pt',
    // Espagnol
    ES:'es', MX:'es', CO:'es', AR:'es', CL:'es', PE:'es', VE:'es',
    EC:'es', BO:'es', PY:'es', UY:'es', GT:'es', HN:'es', SV:'es',
    NI:'es', CR:'es', PA:'es', DO:'es', CU:'es', PR:'es', GQ:'es',
    // Anglais = tout le reste (défaut)
  };

  // ── État ─────────────────────────────────────────────────────────────────────
  var _lang = 'fr';

  // ── Détection langue navigateur ───────────────────────────────────────────────
  function _fromBrowser() {
    var list = (navigator.languages && navigator.languages.length)
      ? Array.from(navigator.languages)
      : [navigator.language || ''];
    for (var i = 0; i < list.length; i++) {
      var code = list[i].split('-')[0].toLowerCase();
      if (DICT[code]) return code;
    }
    return null;
  }

  // ── Détection pays par IP (plusieurs APIs, timeout 3 s) ──────────────────────
  async function _fromIP() {
    var apis = [
      'https://ipwho.is/',
      'https://ipapi.co/json/',
      'https://ip-api.com/json/?fields=countryCode',
    ];
    for (var i = 0; i < apis.length; i++) {
      try {
        var ctrl = new AbortController();
        var tid  = setTimeout(function(){ ctrl.abort(); }, 3000);
        var res  = await fetch(apis[i], { signal: ctrl.signal });
        clearTimeout(tid);
        var d    = await res.json();
        var cc   = ((d.country_code || d.countryCode || d.country || '')).toUpperCase();
        if (cc) return COUNTRY_LANG[cc] || 'en';
      } catch(_) { /* essaie la suivante */ }
    }
    return 'en';
  }

  // ── Applique les traductions au DOM ───────────────────────────────────────────
  function _applyDOM(lang) {
    var d = DICT[lang];
    if (!d) return;

    // data-i18n="key"
    document.querySelectorAll('[data-i18n]').forEach(function(el) {
      var val = d[el.dataset.i18n];
      if (val !== undefined && typeof val !== 'function') el.textContent = val;
    });

    // data-i18n-placeholder="key"
    document.querySelectorAll('[data-i18n-placeholder]').forEach(function(el) {
      var val = d[el.dataset.i18nPlaceholder];
      if (val) el.setAttribute('placeholder', val);
    });

    document.documentElement.lang = lang;
  }

  // ── Injecte le CSS du sélecteur (une seule fois) ──────────────────────────────
  function _injectStyle() {
    if (document.getElementById('i18n-style')) return;
    var s = document.createElement('style');
    s.id  = 'i18n-style';
    s.textContent = [
      '#langSwitcher{',
        'display:flex;align-items:center;gap:2px;',
        'background:var(--surface2);border:1px solid var(--border);',
        'border-radius:20px;padding:3px 4px;flex-shrink:0;margin-left:6px;',
      '}',
      '#langSwitcher button{',
        'background:none;border:none;color:var(--muted);',
        'border-radius:14px;padding:4px 7px;font-size:.72rem;font-weight:700;',
        'cursor:pointer;display:flex;align-items:center;gap:3px;',
        'font-family:inherit;transition:background .15s,color .15s;white-space:nowrap;',
      '}',
      '#langSwitcher button:hover{color:var(--text);background:var(--surface3);}',
      '#langSwitcher button[data-active]{background:var(--accent);color:#fff;}',
      /* mobile : cacher le code texte */
      '@media(max-width:480px){',
        '#langSwitcher .lc{display:none;}',
        '#langSwitcher button{padding:4px 5px;font-size:.9rem;}',
      '}',
    ].join('');
    document.head.appendChild(s);
  }

  // ── Construit le sélecteur de langue dans le header ───────────────────────────
  var FLAGS = { fr:'🇫🇷', en:'🇬🇧', pt:'🇵🇹', es:'🇪🇸' };

  function _buildSwitcher() {
    if (document.getElementById('langSwitcher')) { _refreshSwitcher(); return; }
    _injectStyle();

    var wrap = document.createElement('div');
    wrap.id  = 'langSwitcher';
    wrap.setAttribute('role', 'group');
    wrap.setAttribute('aria-label', 'Langue / Language');

    Object.keys(DICT).forEach(function(lang) {
      var btn = document.createElement('button');
      btn.dataset.langBtn = lang;
      btn.title = lang.toUpperCase();
      btn.innerHTML = FLAGS[lang] + '<span class="lc">&nbsp;' + lang.toUpperCase() + '</span>';
      btn.addEventListener('click', function() { i18n.setLang(lang); });
      wrap.appendChild(btn);
    });

    var header = document.querySelector('header');
    if (header) header.appendChild(wrap);
    _refreshSwitcher();
  }

  function _refreshSwitcher() {
    document.querySelectorAll('[data-lang-btn]').forEach(function(btn) {
      if (btn.dataset.langBtn === _lang) {
        btn.setAttribute('data-active', '');
        btn.setAttribute('aria-pressed', 'true');
      } else {
        btn.removeAttribute('data-active');
        btn.setAttribute('aria-pressed', 'false');
      }
    });
  }

  // ── API publique ──────────────────────────────────────────────────────────────
  var i18n = {
    get lang() { return _lang; },

    t: function(key) {
      var args = Array.prototype.slice.call(arguments, 1);
      var d    = DICT[_lang] || DICT['fr'];
      var val  = d[key];
      if (val === undefined) return key;
      return typeof val === 'function' ? val.apply(null, args) : val;
    },

    setLang: function(lang) {
      if (!DICT[lang]) return;
      _lang = lang;
      localStorage.setItem('michino_lang', lang);
      _applyDOM(lang);
      _refreshSwitcher();
      // Ré-affiche les cartes dynamiques si elles sont prêtes
      if (typeof window.applyFilters === 'function') window.applyFilters();
    },

    init: async function() {
      var saved = localStorage.getItem('michino_lang');
      if (saved && DICT[saved]) {
        _lang = saved;
      } else {
        var browser = _fromBrowser();
        _lang = browser || (await _fromIP());
      }
      _applyDOM(_lang);
      _buildSwitcher();
    },
  };

  // ── Exposition globale ────────────────────────────────────────────────────────
  window.i18n = i18n;
  window.t    = function(key) {
    return i18n.t.apply(i18n, arguments);
  };

  // ── Démarrage automatique ─────────────────────────────────────────────────────
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function() { i18n.init(); });
  } else {
    i18n.init();
  }

})();
