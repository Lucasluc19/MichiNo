/**
 * 🤖 Routes Playlists IA — MichiNo- v16
 * Génération de playlists par prompt textuel
 * Standard 2026 : contextual listening, mood-based, NLP
 */
const router   = require('express').Router();
const { body, param, validationResult } = require('express-validator');
const Song     = require('../models/Song');
const Playlist = require('../models/Playlist');
const auth     = require('../middleware/auth');
const { logger } = require('../middleware/logger');

// ── Mots-clés de contexte pour matching IA ──────────────────
const MOOD_MAP = {
  // Énergie
  energetic: ['party','soirée','danse','dance','energy','fête','fiesta','club'],
  chill:     ['relaxer','relax','détente','calme','calm','quiet','tranquille','repos'],
  romantic:  ['amour','love','romance','romantique','tender','doux'],
  motivated: ['sport','workout','gym','training','motivation','run','courir'],
  // Moments
  morning:   ['matin','morning','réveil','wake up','breakfast','petit-déjeuner'],
  evening:   ['soir','evening','sunset','coucher','apéro','afterwork'],
  night:     ['nuit','night','minuit','midnight','late'],
  travel:    ['voyage','travel','route','road','trip','aventure'],
  // Genres Afro
  afrobeats: ['afrobeats','afrobeat','naija','nigeria','ghana'],
  amapiano:  ['amapiano','piano','south africa','afrique du sud','log drum'],
  afropop:   ['afropop','pop africa','pop africain'],
  highlife:  ['highlife','ghana','classic','classique'],
  bongo:     ['bongo flava','tanzania','tanzanie','east africa'],
};

/**
 * Analyse un prompt textuel et retourne un objet contexte
 */
function analyzePrompt(prompt) {
  const lower = prompt.toLowerCase();
  const detected = { moods: [], genres: [], activity: '', time: '' };

  for (const [mood, keywords] of Object.entries(MOOD_MAP)) {
    if (keywords.some(k => lower.includes(k)) || lower.includes(mood)) {
      detected.moods.push(mood);
    }
  }

  // Détection genre
  const genreKeywords = {
    'Afrobeat': ['afrobeat','afro beat'],
    'Amapiano': ['amapiano','piano'],
    'Afropop':  ['afropop','pop'],
    'Afro Trap':['trap','afro trap'],
    'Bongo Flava':['bongo'],
    'Highlife': ['highlife'],
    'Afro Soul': ['soul','afro soul'],
    'Kuduro':   ['kuduro','angola'],
    'Coupe Décalé':['coupe décalé','coupé décalé'],
    'Mapouka':  ['mapouka'],
    'Ndombolo': ['ndombolo','congo'],
  };
  for (const [genre, keys] of Object.entries(genreKeywords)) {
    if (keys.some(k => lower.includes(k))) detected.genres.push(genre);
  }

  return detected;
}

/**
 * Score un morceau selon le contexte détecté
 */
function scoreSong(song, context) {
  let score = 0;

  // Genre match
  if (context.genres.length > 0 && context.genres.includes(song.genre)) score += 40;

  // Artist mood tags (si disponibles)
  if (song.moodTags && context.moods.length > 0) {
    const overlap = context.moods.filter(m => song.moodTags.includes(m));
    score += overlap.length * 20;
  }

  // Popularité (plays + downloads) — légère pondération
  const popularity = Math.log1p((song.plays || 0) + (song.downloads || 0));
  score += Math.min(popularity, 30);

  // Fraîcheur (récence)
  const ageMs = Date.now() - new Date(song.createdAt).getTime();
  const ageDays = ageMs / 86400000;
  if (ageDays < 30) score += 15;
  else if (ageDays < 90) score += 8;

  // Aléatoire pour diversifier
  score += Math.random() * 10;

  return score;
}

// ════════════════════════════════════════════════════════════
// GET /api/playlists/session/:sessionId
// ════════════════════════════════════════════════════════════
router.get('/session/:sessionId', async (req, res) => {
  try {
    const playlists = await Playlist.find({ sessionId: req.params.sessionId })
      .sort({ createdAt: -1 })
      .limit(10)
      .populate('songs', 'title artist genre coverImage audioUrl plays downloads');
    res.json({ playlists });
  } catch { res.status(500).json({ message: 'Erreur serveur' }); }
});

// ════════════════════════════════════════════════════════════
// POST /api/playlists/generate — Génération par prompt IA
// ════════════════════════════════════════════════════════════
router.post('/generate',
  body('prompt').isString().trim().isLength({ min: 2, max: 300 }),
  body('sessionId').isString().trim().isLength({ min: 4, max: 100 }),
  body('lang').optional().isIn(['fr','en','pt','es']),
  async (req, res) => {
    if (!validationResult(req).isEmpty()) return res.status(400).json({ message: 'Données invalides' });

    try {
      const { prompt, sessionId, lang = 'fr' } = req.body;
      const now = new Date();

      // 1. Analyser le prompt
      const context = analyzePrompt(prompt);

      // 2. Récupérer tous les sons publiés
      const allSongs = await Song.find({
        $or: [{ publishAt: null }, { publishAt: { $lte: now } }],
      }).select('title artist genre coverImage audioUrl plays downloads createdAt moodTags');

      if (!allSongs.length) return res.status(404).json({ message: 'Aucune chanson disponible' });

      // 3. Scorer et trier
      const scored = allSongs
        .map(song => ({ song, score: scoreSong(song, context) }))
        .sort((a, b) => b.score - a.score);

      // 4. Prendre les 12 meilleurs
      const selected = scored.slice(0, 12).map(s => s.song._id);

      // 5. Générer un nom de playlist
      const playlistNames = {
        fr: { prefix: 'Mix', moods: { energetic:'Énergie', chill:'Détente', romantic:'Romantic', motivated:'Motivation', morning:'Matin', evening:'Soirée', night:'Nuit' } },
        en: { prefix: 'Mix', moods: { energetic:'Energy', chill:'Chill', romantic:'Romantic', motivated:'Motivation', morning:'Morning', evening:'Evening', night:'Night' } },
        pt: { prefix: 'Mix', moods: { energetic:'Energia', chill:'Relaxar', romantic:'Romântico', motivated:'Motivação', morning:'Manhã', evening:'Noite' } },
        es: { prefix: 'Mix', moods: { energetic:'Energía', chill:'Relajar', romantic:'Romántico', motivated:'Motivación', morning:'Mañana', evening:'Noche' } },
      };
      const langData  = playlistNames[lang] || playlistNames.fr;
      const firstMood = context.moods[0];
      const moodLabel = firstMood && langData.moods[firstMood] ? langData.moods[firstMood] : 'Afrobeat';
      const playlistName = `${moodLabel} Mix 🎵`;

      // 6. Sauvegarder
      const playlist = await Playlist.create({
        sessionId, name: playlistName, prompt,
        isAI: true,
        songs: selected,
        context: {
          mood:     context.moods[0] || '',
          activity: context.genres[0] || '',
          lang,
        },
        coverImage: scored[0]?.song?.coverImage || '',
      });

      // Populate pour la réponse
      await playlist.populate('songs', 'title artist genre coverImage audioUrl plays downloads');

      logger.info({ event: 'playlist_generated', prompt: prompt.slice(0, 50), songs: selected.length });
      res.json({ playlist });

    } catch (err) {
      logger.error({ event: 'playlist_error', err: err.message });
      res.status(500).json({ message: 'Erreur génération playlist' });
    }
  }
);

// ════════════════════════════════════════════════════════════
// DELETE /api/playlists/:id — Supprimer une playlist
// ════════════════════════════════════════════════════════════
router.delete('/:id',
  param('id').matches(/^[a-fA-F0-9]{24}$/),
  async (req, res) => {
    if (!validationResult(req).isEmpty()) return res.status(400).json({ message: 'ID invalide' });
    await Playlist.findByIdAndDelete(req.params.id).catch(() => {});
    res.json({ message: 'ok' });
  }
);

// ════════════════════════════════════════════════════════════
// POST /api/playlists/:id/play — Incrémenter les plays
// ════════════════════════════════════════════════════════════
router.post('/:id/play',
  param('id').matches(/^[a-fA-F0-9]{24}$/),
  async (req, res) => {
    if (!validationResult(req).isEmpty()) return res.status(400).json({ message: 'ID invalide' });
    await Playlist.findByIdAndUpdate(req.params.id, { $inc: { plays: 1 } }).catch(() => {});
    res.json({ message: 'ok' });
  }
);

// ════════════════════════════════════════════════════════════
// GET /api/playlists/presets — Playlists contextuelles prédéfinies
// ════════════════════════════════════════════════════════════
router.get('/presets', async (req, res) => {
  try {
    const now  = new Date();
    const hour = now.getHours();
    const lang = req.query.lang || 'fr';

    // Déterminer le moment de la journée
    let timeContext = 'evening';
    if (hour >= 5  && hour < 12) timeContext = 'morning';
    if (hour >= 12 && hour < 17) timeContext = 'afternoon';
    if (hour >= 17 && hour < 21) timeContext = 'evening';
    if (hour >= 21 || hour < 5 ) timeContext = 'night';

    const PRESETS = {
      fr: [
        { id:'top',       icon:'🔥', label:'Top Afrobeat',    prompt:'les meilleurs hits afrobeats' },
        { id:'morning',   icon:'🌅', label:'Réveil Positif',  prompt:'musique du matin énergique' },
        { id:'party',     icon:'🎉', label:'Mode Fête',       prompt:'soirée danse afro' },
        { id:'chill',     icon:'😌', label:'Détente',         prompt:'musique calme relaxation' },
        { id:'amapiano',  icon:'🎹', label:'Amapiano Vibes',  prompt:'amapiano south africa' },
        { id:'discover',  icon:'✨', label:'Découvertes',     prompt:'nouveaux artistes récents' },
      ],
      en: [
        { id:'top',       icon:'🔥', label:'Top Afrobeats',   prompt:'best afrobeats hits' },
        { id:'morning',   icon:'🌅', label:'Morning Vibes',   prompt:'morning energy music' },
        { id:'party',     icon:'🎉', label:'Party Mode',      prompt:'party dance afro night' },
        { id:'chill',     icon:'😌', label:'Chill Out',       prompt:'calm relax music' },
        { id:'amapiano',  icon:'🎹', label:'Amapiano Vibes',  prompt:'amapiano south africa' },
        { id:'discover',  icon:'✨', label:'New Releases',    prompt:'new recent artists' },
      ],
    };

    const presets = PRESETS[lang] || PRESETS.en;
    res.json({ presets, timeContext });
  } catch { res.status(500).json({ message: 'Erreur' }); }
});

module.exports = router;
