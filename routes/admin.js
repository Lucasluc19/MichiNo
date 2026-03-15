const router   = require('express').Router();
const jwt      = require('jsonwebtoken');
const cloudinary = require('cloudinary').v2;
const multer   = require('multer');
const { body, validationResult } = require('express-validator');
const auth     = require('../middleware/auth');
const { validateFile } = require('../middleware/security');
const Song     = require('../models/Song');
const Video    = require('../models/Video');
const AuditLog = require('../models/AuditLog');
const PushSub  = require('../models/PushSub');
const Subscriber = require('../models/Subscriber');
const Comment  = require('../models/Comment');
const { applyVocalTag } = require('../middleware/vocalTag');
const { generateWaveform } = require('../middleware/waveform');

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key:    process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 500 * 1024 * 1024, files: 2 },
});

function logAudit(action, target, targetId, req, details) {
  AuditLog.create({
    action, target, targetId,
    adminUser: req.admin?.username || 'admin',
    ip: req.ip || '',
    details: details || '',
  }).catch(() => {});
}

const { broadcastPush } = require('./notifications');

// ── LOGIN ──────────────────────────────────────────────────────
router.post('/login',
  body('username').isString().trim().isLength({ min:1, max:50 }).escape(),
  body('password').isString().isLength({ min:1, max:100 }),
  (req, res) => {
    if (!validationResult(req).isEmpty()) return res.status(400).json({ message: 'Données invalides' });
    const { username, password } = req.body;
    if (username === process.env.ADMIN_USERNAME && password === process.env.ADMIN_PASSWORD) {
      const token = jwt.sign({ username, role: 'admin' }, process.env.JWT_SECRET, { expiresIn: '7d', algorithm: 'HS256' });
      res.json({ token, message: '✅ Connexion réussie !' });
    } else {
      setTimeout(() => res.status(401).json({ message: '❌ Identifiants incorrects' }), 1000);
    }
  }
);

// ── ANALYTICS ────────────────────────────────────────────────
router.get('/analytics', auth, async (req, res) => {
  try {
    const [songs, videos, pushCount, subCount] = await Promise.all([
      Song.find().select('title artist plays downloads dailyStats createdAt genre'),
      Video.find().select('title artist views createdAt'),
      PushSub.countDocuments(),
      Subscriber.countDocuments({ active: true }),
    ]);
    const totalPlays     = songs.reduce((a,s)=>a+(s.plays||0),0);
    const totalDownloads = songs.reduce((a,s)=>a+(s.downloads||0),0);
    const totalViews     = videos.reduce((a,v)=>a+(v.views||0),0);
    const topSongs = [...songs].sort((a,b)=>(b.downloads||0)-(a.downloads||0)).slice(0,10)
      .map(s=>({ _id:s._id, title:s.title, artist:s.artist, downloads:s.downloads||0, plays:s.plays||0 }));
    const artistMap = {};
    songs.forEach(s => {
      if (!artistMap[s.artist]) artistMap[s.artist]={ name:s.artist, downloads:0, plays:0, songs:0 };
      artistMap[s.artist].downloads+= s.downloads||0;
      artistMap[s.artist].plays    += s.plays||0;
      artistMap[s.artist].songs    += 1;
    });
    const topArtists = Object.values(artistMap).sort((a,b)=>b.downloads-a.downloads).slice(0,5);
    const genreMap = {};
    songs.forEach(s=>{ const g=s.genre||'Afrobeat'; genreMap[g]=(genreMap[g]||0)+1; });
    const genreChart = Object.entries(genreMap).map(([genre,count])=>({ genre, count }));
    const days = 30;
    const dailyAgg = {};
    const now = new Date();
    for(let i=days-1;i>=0;i--){
      const d=new Date(now); d.setHours(0,0,0,0); d.setDate(d.getDate()-i);
      dailyAgg[d.toISOString().slice(0,10)]={ date:d.toISOString().slice(0,10), downloads:0, plays:0 };
    }
    songs.forEach(s=>{
      (s.dailyStats||[]).forEach(ds=>{
        const key=new Date(ds.date).toISOString().slice(0,10);
        if(dailyAgg[key]){ dailyAgg[key].downloads+=ds.downloads||0; dailyAgg[key].plays+=ds.plays||0; }
      });
    });
    const weeklyNew=[];
    for(let i=3;i>=0;i--){
      const from=new Date(now); from.setDate(from.getDate()-(i+1)*7); from.setHours(0,0,0,0);
      const to=new Date(now);   to.setDate(to.getDate()-i*7);         to.setHours(23,59,59,999);
      weeklyNew.push({ label:`S-${i+1}`, songs:songs.filter(s=>s.createdAt>=from&&s.createdAt<=to).length, videos:videos.filter(v=>v.createdAt>=from&&v.createdAt<=to).length });
    }
    const auditLogs = await AuditLog.find().sort({ createdAt:-1 }).limit(20).select('-__v');
    res.json({ totals:{ songs:songs.length, videos:videos.length, plays:totalPlays, downloads:totalDownloads, views:totalViews, pushSubs:pushCount, subscribers:subCount }, topSongs, topArtists, genreChart, dailyData:Object.values(dailyAgg), weeklyNew, auditLogs });
  } catch(err){ console.error(err); res.status(500).json({ message:'Erreur analytics' }); }
});

// ── REORDER ────────────────────────────────────────────────────
router.post('/reorder', auth, async (req, res) => {
  try {
    const { order } = req.body;
    if (!Array.isArray(order)) return res.status(400).json({ message:'Format invalide' });
    const ops = order.filter(item=>/^[a-fA-F0-9]{24}$/.test(item.id)).map(item=>({
      updateOne:{ filter:{ _id:item.id }, update:{ $set:{ order:item.order } } }
    }));
    if (ops.length) await Song.bulkWrite(ops);
    logAudit('songs.reorder','songs','',req,`${ops.length} chansons`);
    res.json({ message:'ok' });
  } catch { res.status(500).json({ message:'Erreur' }); }
});

// ── UPLOAD CHANSON ─────────────────────────────────────────────
router.post('/upload-song', auth,
  upload.fields([{ name:'audio', maxCount:1 }, { name:'cover', maxCount:1 }]),
  body('title').isString().trim().isLength({ min:1, max:200 }).escape(),
  body('artist').isString().trim().isLength({ min:1, max:200 }).escape(),
  body('genre').optional().isString().trim().isLength({ max:50 }).escape(),
  body('streamingLink').optional().isURL({ protocols:['http','https'], require_protocol:true }),
  body('lyrics').optional().isString().trim().isLength({ max:10000 }),
  body('publishAt').optional().isISO8601(),
  async (req, res) => {
    if (!validationResult(req).isEmpty()) return res.status(400).json({ message:'Données invalides' });
    try {
      const { title, artist, genre, streamingLink, lyrics, publishAt } = req.body;
      let audioUrl='', coverImage='', waveform=[];

      if (req.files?.audio) {
        const check = validateFile(req.files.audio[0],'audio');
        if (!check.valid) return res.status(400).json({ message:check.error });
        const taggedBuf = await applyVocalTag(req.files.audio[0].buffer, title);
        // Générer waveform en parallèle
        const [audioResult, wf] = await Promise.all([
          new Promise((res,rej) => {
            cloudinary.uploader.upload_stream(
              { resource_type:'video', folder:'michino/audio', allowed_formats:['mp3','wav','ogg','flac','aac','m4a'] },
              (err,result) => err?rej(err):res(result)
            ).end(taggedBuf);
          }),
          generateWaveform(req.files.audio[0].buffer, 60),
        ]);
        audioUrl = audioResult.secure_url;
        waveform = wf;
      }

      if (req.files?.cover) {
        const check = validateFile(req.files.cover[0],'image');
        if (!check.valid) return res.status(400).json({ message:check.error });
        const imgResult = await new Promise((res,rej)=>{
          cloudinary.uploader.upload_stream(
            { folder:'michino/covers', allowed_formats:['jpg','jpeg','png','webp','gif'], transformation:[{width:800,height:800,crop:'fill'}] },
            (err,result) => err?rej(err):res(result)
          ).end(req.files.cover[0].buffer);
        });
        coverImage = imgResult.secure_url;
      } else if (req.body.coverUrl) {
        try {
          if (/^https?:\/\/.+/.test(req.body.coverUrl)) {
            const r = await cloudinary.uploader.upload(req.body.coverUrl, { folder:'michino/covers', transformation:[{width:800,height:800,crop:'fill'}] });
            coverImage = r.secure_url;
          }
        } catch(e) { console.warn('Cover URL upload failed:', e.message); }
      }

      if (streamingLink && !audioUrl) audioUrl = streamingLink;
      if (!audioUrl) return res.status(400).json({ message:'Fichier audio ou lien obligatoire' });

      const songData = { title, artist, genre:genre||'Afrobeat', audioUrl, coverImage, streamingLink:streamingLink||'', lyrics:lyrics||'', waveform };
      if (publishAt) songData.publishAt = new Date(publishAt);

      const song = new Song(songData);
      await song.save();
      logAudit('song.upload', title, song._id.toString(), req);

      // Push notification si publication immédiate
      if (!publishAt) {
        broadcastPush(`🎵 Nouveau son : ${title}`, `${artist} vient de sortir un nouveau morceau sur MichiNo-`, '/');
      }

      res.json({ message:'🎵 Chanson publiée !', song });
    } catch(err){ console.error('Upload song error:', err.message); res.status(500).json({ message:"Erreur lors de l'upload" }); }
  }
);

// ── UPLOAD VIDÉO ───────────────────────────────────────────────
router.post('/upload-video', auth,
  upload.fields([{ name:'video', maxCount:1 }, { name:'thumbnail', maxCount:1 }]),
  body('title').isString().trim().isLength({ min:1, max:200 }).escape(),
  body('artist').isString().trim().isLength({ min:1, max:200 }).escape(),
  body('youtubeLink').optional().isURL({ protocols:['https'], require_protocol:true }),
  async (req, res) => {
    if (!validationResult(req).isEmpty()) return res.status(400).json({ message:'Données invalides' });
    try {
      const { title, artist, youtubeLink } = req.body;
      let videoUrl=youtubeLink||'', thumbnail='';

      // Auto-thumbnail YouTube
      if (youtubeLink && !req.files?.thumbnail) {
        const ytId = youtubeLink.match(/(?:v=|youtu\.be\/)([^&\s]+)/)?.[1];
        if (ytId) thumbnail = `https://img.youtube.com/vi/${ytId}/maxresdefault.jpg`;
      }

      if (req.files?.video) {
        const check = validateFile(req.files.video[0],'video');
        if (!check.valid) return res.status(400).json({ message:check.error });
        const r = await new Promise((res,rej)=>{
          cloudinary.uploader.upload_stream(
            { resource_type:'video', folder:'michino/videos', allowed_formats:['mp4','webm','ogg'] },
            (err,result) => err?rej(err):res(result)
          ).end(req.files.video[0].buffer);
        });
        videoUrl = r.secure_url;
      }
      if (req.files?.thumbnail) {
        const check = validateFile(req.files.thumbnail[0],'image');
        if (!check.valid) return res.status(400).json({ message:check.error });
        const r = await new Promise((res,rej)=>{
          cloudinary.uploader.upload_stream(
            { folder:'michino/thumbnails', allowed_formats:['jpg','jpeg','png','webp'] },
            (err,result) => err?rej(err):res(result)
          ).end(req.files.thumbnail[0].buffer);
        });
        thumbnail = r.secure_url;
      }

      if (!videoUrl) return res.status(400).json({ message:'Fichier vidéo ou lien obligatoire' });
      const video = new Video({ title, artist, videoUrl, thumbnail, youtubeLink:youtubeLink||'' });
      await video.save();
      logAudit('video.upload', title, video._id.toString(), req);
      broadcastPush(`🎬 Nouveau clip : ${title}`, `${artist} — regardez maintenant sur MichiNo-`, '/');
      res.json({ message:'🎬 Vidéo publiée !', video });
    } catch(err){ console.error('Upload video error:', err.message); res.status(500).json({ message:"Erreur lors de l'upload" }); }
  }
);

// ── PUSH NOTIFICATION MANUELLE ────────────────────────────────
router.post('/push-notify', auth,
  body('title').isString().trim().isLength({ min:1, max:100 }),
  body('body').isString().trim().isLength({ min:1, max:200 }),
  body('url').optional().isString(),
  async (req, res) => {
    if (!validationResult(req).isEmpty()) return res.status(400).json({ message:'Invalide' });
    await broadcastPush(req.body.title, req.body.body, req.body.url||'/');
    const count = await PushSub.countDocuments();
    logAudit('push.send', req.body.title, '', req, `${count} abonnés`);
    res.json({ message:'ok', subscribers: count });
  }
);

// ── SUBSCRIBERS ────────────────────────────────────────────────
router.get('/subscribers', auth, async (req, res) => {
  const subs = await Subscriber.find({ active:true }).sort({ createdAt:-1 }).select('-__v -token');
  res.json({ subscribers:subs, total:subs.length });
});

// ── COMMENTS ADMIN ─────────────────────────────────────────────
router.get('/comments', auth, async (req, res) => {
  try {
    const comments = await Comment.find().sort({ createdAt:-1 }).limit(100).populate('songId','title artist').select('-__v');
    res.json(comments);
  } catch { res.status(500).json({ message:'Erreur' }); }
});
router.delete('/comments/:id', auth, async (req, res) => {
  if (!/^[a-fA-F0-9]{24}$/.test(req.params.id)) return res.status(400).json({ message:'ID invalide' });
  await Comment.findByIdAndDelete(req.params.id);
  res.json({ message:'ok' });
});

// ── SUPPRIMER ──────────────────────────────────────────────────
router.delete('/song/:id', auth, async (req, res) => {
  if (!/^[a-fA-F0-9]{24}$/.test(req.params.id)) return res.status(400).json({ message:'ID invalide' });
  const song = await Song.findByIdAndDelete(req.params.id);
  logAudit('song.delete', song?.title||req.params.id, req.params.id, req);
  res.json({ message:'Chanson supprimée' });
});
router.delete('/video/:id', auth, async (req, res) => {
  if (!/^[a-fA-F0-9]{24}$/.test(req.params.id)) return res.status(400).json({ message:'ID invalide' });
  const video = await Video.findByIdAndDelete(req.params.id);
  logAudit('video.delete', video?.title||req.params.id, req.params.id, req);
  res.json({ message:'Vidéo supprimée' });
});

module.exports = router;
