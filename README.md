# 🎵 MichiNo- Music Platform

## CONFIGURATION

### 1. Créez votre fichier .env
Copiez `.env.example` et renommez-le `.env`, puis remplissez vos informations :

```
MONGODB_URI=mongodb+srv://admin:VOTRE_MOT_DE_PASSE@cluster0.xxxxx.mongodb.net/michino
CLOUDINARY_CLOUD_NAME=votre_cloud_name
CLOUDINARY_API_KEY=votre_api_key
CLOUDINARY_API_SECRET=votre_api_secret
JWT_SECRET=michino_super_secret_2024
ADMIN_USERNAME=admin
ADMIN_PASSWORD=votre_mot_de_passe_admin
PORT=3000
```

### 2. Installez les dépendances
```
npm install
```

### 3. Démarrez le serveur
```
npm start
```

### 4. Accédez au site
- Site public : http://localhost:3000
- Admin : http://localhost:3000/admin

## DÉPLOIEMENT SUR RENDER.COM
1. Uploadez ce dossier sur GitHub
2. Connectez Render à votre GitHub
3. Ajoutez les variables d'environnement dans Render
4. Déployez !
