#!/bin/bash
set -e

# ============================================================================
# Script de déploiement du correctif de licence Q-Process
# À exécuter sur le serveur hors Lovable
# ============================================================================

# Configuration : modifier si nécessaire
PROJECT_DIR="${PROJECT_DIR:-$(pwd)}"
SUPABASE_REF="${SUPABASE_REF:-}"  # Laisser vide si déjà lié via supabase link

echo "============================================"
echo "  Déploiement correctif licence Q-Process"
echo "============================================"

# --- 1. Aller dans le projet ---
if [ ! -d "$PROJECT_DIR/.git" ]; then
  echo "❌ ERREUR : Répertoire Git non trouvé dans $PROJECT_DIR"
  echo "   Définissez PROJECT_DIR avant d'exécuter :"
  echo "   export PROJECT_DIR=/chemin/vers/q-process"
  exit 1
fi

cd "$PROJECT_DIR"
echo "→ Répertoire projet : $PROJECT_DIR"

# --- 2. Mise à jour du code ---
echo "→ Git pull..."
git pull origin main || git pull origin master || {
  echo "⚠️  Git pull a échoué. Continue avec le code local..."
}

# --- 3. Installer les dépendances ---
echo "→ npm install..."
npm install

# --- 4. Vérifier supabase CLI ---
if ! command -v supabase &> /dev/null; then
  echo "❌ ERREUR : Supabase CLI non installé."
  echo "   Installez-le : npm install -g supabase"
  exit 1
fi

# --- 5. Lier le projet si nécessaire ---
if [ -n "$SUPABASE_REF" ]; then
  echo "→ Lien avec le projet Supabase ($SUPABASE_REF)..."
  supabase link --project-ref "$SUPABASE_REF" || true
fi

# --- 6. Déployer l'edge function activate-license ---
echo "→ Déploiement de l'edge function activate-license..."
supabase functions deploy activate-license --no-verify-jwt

# --- 7. Build du frontend ---
echo "→ Build du frontend..."
npm run build

# --- 8. Vérification ---
echo ""
echo "============================================"
echo "  ✅ Déploiement terminé avec succès !"
echo "============================================"
echo ""
echo "Prochaines étapes :"
echo "  1. Videz le cache de votre navigateur (Ctrl+Shift+R)"
echo "  2. Déconnectez-vous / reconnectez-vous"
echo "  3. Allez dans Super Admin → Licence"
echo "  4. Entrez votre code de licence et activez"
echo ""
echo "Si le problème persiste, vérifiez les logs :"
echo "  supabase functions logs activate-license --tail"
echo ""
