# 🔒 GUIDE DE SÉCURITÉ MICHINO-

## ✅ Protections en place (13 couches)

| # | Attaque | Protection |
|---|---------|------------|
| 1 | XSS, Clickjacking, MIME sniffing | Helmet (headers HTTP) |
| 2 | Brute-force login | Rate limit: 5 essais/heure |
| 3 | DDoS / flood | Rate limit global: 200 req/15min |
| 4 | NoSQL Injection MongoDB | express-mongo-sanitize |
| 5 | HTTP Parameter Pollution | hpp middleware |
| 6 | Injection XSS dans body | Sanitisation manuelle |
| 7 | Prototype Pollution | Détection __proto__ |
| 8 | Path Traversal (../../etc/passwd) | Filtrage URL |
| 9 | Bots malveillants (SQLMap, Nikto) | User-agent filter |
| 10 | Upload de fichiers malveillants | Validation MIME + taille |
| 11 | JWT forgé ou "none" algorithm | Validation stricte HS256 |
| 12 | Requêtes surchargées | Limite 10kb JSON/URLencoded |
| 13 | Informations serveur exposées | Erreurs génériques en prod |

## ⚙️ Variables .env obligatoires

```
JWT_SECRET=CHANGEZ_CECI_PAR_UNE_CHAINE_DE_64_CARACTERES_ALEATOIRES
ADMIN_USERNAME=votre_nom_admin_unique
ADMIN_PASSWORD=MotDePasseTresComplexe123!@#
NODE_ENV=production
MONGODB_URI=mongodb+srv://...
CLOUDINARY_CLOUD_NAME=...
CLOUDINARY_API_KEY=...
CLOUDINARY_API_SECRET=...
```

## 🚨 Checklist déploiement

- [ ] JWT_SECRET de 64+ caractères aléatoires
- [ ] ADMIN_PASSWORD complexe (12+ cars, majuscules, chiffres, symboles)
- [ ] NODE_ENV=production
- [ ] HTTPS activé (SSL/TLS via Render ou Cloudflare)
- [ ] MongoDB Atlas IP whitelist configuré

## 🌐 Recommandations supplémentaires

1. **Cloudflare** (gratuit) devant votre site = protection DDoS avancée
2. **MongoDB Atlas** = chiffrement des données au repos
3. **Render.com** = HTTPS automatique
4. Changez votre mot de passe admin **chaque mois**
