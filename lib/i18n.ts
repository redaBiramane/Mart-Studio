'use client';

// ============================================================
// Mart Studio — Internationalisation (FR / EN)
// Léger : store zustand + dictionnaire. t(key) renvoie la
// chaîne de la langue courante, sinon la clé.
// ============================================================

import { create } from 'zustand';

export type Lang = 'fr' | 'en';

type Dict = Record<string, { fr: string; en: string }>;

const DICT: Dict = {
  // --- Navigation ---
  'nav.navigation': { fr: 'Navigation', en: 'Navigation' },
  'nav.dashboard': { fr: 'Accueil', en: 'Home' },
  'nav.products': { fr: 'Data Products', en: 'Data Products' },
  'nav.workshop': { fr: 'DataForge', en: 'DataForge' },
  'nav.deliverables': { fr: 'Livrables', en: 'Deliverables' },
  'nav.docs': { fr: 'Documentation', en: 'Documentation' },
  'nav.recentSessions': { fr: 'Sessions récentes', en: 'Recent sessions' },
  'nav.administration': { fr: 'Administration', en: 'Administration' },
  'nav.newProduct': { fr: 'Nouveau produit', en: 'New product' },
  'nav.seeAll': { fr: 'Tous les Data Products', en: 'All Data Products' },

  // --- Header titres ---
  'header.dashboard': { fr: 'Tableau de bord', en: 'Dashboard' },
  'header.products': { fr: 'Data Products', en: 'Data Products' },
  'header.workshop': { fr: 'DataForge — Conception assistée par IA', en: 'DataForge — AI-assisted design' },
  'header.deliverables': { fr: 'Livrables', en: 'Deliverables' },
  'header.admin': { fr: 'Configuration LLM', en: 'LLM Settings' },
  'header.docs': { fr: 'Documentation', en: 'Documentation' },
  'header.supervision': { fr: 'Supervision', en: 'Supervision' },

  // --- Actions header ---
  'action.newWorkshop': { fr: 'Nouvel Atelier', en: 'New Workshop' },
  'tooltip.idea': { fr: 'Proposer une amélioration', en: 'Suggest an improvement' },
  'tooltip.themeDark': { fr: 'Passer en mode jour', en: 'Switch to light mode' },
  'tooltip.themeLight': { fr: 'Passer en mode nuit', en: 'Switch to dark mode' },
  'tooltip.notifications': { fr: 'Notifications', en: 'Notifications' },

  // --- Menu utilisateur ---
  'menu.supervision': { fr: 'Supervision', en: 'Supervision' },
  'menu.users': { fr: 'Utilisateurs', en: 'Users' },
  'menu.llm': { fr: 'Configuration LLM', en: 'LLM Settings' },
  'menu.help': { fr: 'Aide', en: 'Help' },
  'menu.logout': { fr: 'Se déconnecter', en: 'Sign out' },
  'nav.questions': { fr: 'Étapes & questions', en: 'Steps & questions' },
  'role.admin': { fr: 'Administrateur', en: 'Administrator' },
  'role.user': { fr: 'Utilisateur', en: 'User' },
  'role.guest': { fr: 'Invité (mode local)', en: 'Guest (local mode)' },
  'role.notConnected': { fr: 'Non connecté', en: 'Not connected' },

  // --- Notifications ---
  'notif.title': { fr: 'Notifications', en: 'Notifications' },
  'notif.empty': { fr: 'Aucune notification pour le moment.', en: 'No notifications yet.' },
  'notif.markRead': { fr: 'Tout marquer comme lu', en: 'Mark all as read' },
  'notif.welcome': { fr: 'Bienvenue sur Mart Studio 👋', en: 'Welcome to Mart Studio 👋' },
  'notif.welcomeDesc': { fr: 'Démarrez un atelier pour concevoir votre premier Data Product.', en: 'Start a workshop to design your first Data Product.' },
  'notif.updated': { fr: 'a été mis à jour', en: 'was updated' },
  'notif.completed': { fr: 'est terminé', en: 'is completed' },
  'notif.newUser': { fr: 'Nouvel utilisateur', en: 'New user' },
  'notif.activity': { fr: 'Activité', en: 'Activity' },

  // --- Modale idée ---
  'idea.title': { fr: 'Une idée pour améliorer la plateforme ?', en: 'An idea to improve the platform?' },
  'idea.desc': { fr: 'Partagez une suggestion, un bug ou une fonctionnalité manquante. L’équipe la reçoit directement.', en: 'Share a suggestion, a bug or a missing feature. The team receives it directly.' },
  'idea.placeholder': { fr: 'Votre idée…', en: 'Your idea…' },
  'idea.submit': { fr: 'Envoyer', en: 'Send' },
  'idea.cancel': { fr: 'Annuler', en: 'Cancel' },
  'idea.thanks': { fr: 'Merci ! Votre idée a bien été envoyée.', en: 'Thanks! Your idea has been sent.' },

  // --- Modale mode ---
  'mode.title': { fr: 'Comment souhaitez-vous être accompagné ?', en: 'How would you like to be guided?' },
  'mode.subtitle': { fr: 'Choisissez le rythme de l’atelier. Vous pourrez répondre librement dans les deux cas.', en: 'Choose the workshop pace. You can answer freely either way.' },
  'mode.batchTitle': { fr: 'Par étape (rapide)', en: 'By step (fast)' },
  'mode.batchDesc': { fr: 'Marty affiche toutes les questions d’une étape d’un coup. Idéal pour aller vite.', en: 'Marty shows all questions of a step at once. Best to move fast.' },
  'mode.guidedTitle': { fr: 'Guidé (pas à pas)', en: 'Guided (step by step)' },
  'mode.guidedDesc': { fr: 'Marty pose une seule question à la fois et attend votre réponse.', en: 'Marty asks one question at a time and waits for your answer.' },
  'mode.cancel': { fr: 'Annuler', en: 'Cancel' },

  // --- Dashboard ---
  'dash.badgeSessions': { fr: 'session(s) dans l’atelier', en: 'session(s) in the studio' },
  'dash.title1': { fr: 'Plateforme de conception', en: 'Design platform for' },
  'dash.title2': { fr: 'des Data Products', en: 'Data Products' },
  'dash.subtitle': { fr: 'Concevez automatiquement vos Data Products avec l’accompagnement d’un Senior Data Architect IA. Modélisez, documentez et exportez en quelques clics.', en: 'Automatically design your Data Products with the guidance of a Senior AI Data Architect. Model, document and export in a few clicks.' },
  'dash.start': { fr: 'Démarrer un atelier', en: 'Start a workshop' },
  'dash.deliverables': { fr: 'Livrables', en: 'Deliverables' },
  'dash.howItWorks': { fr: 'Comment ça marche', en: 'How it works' },
  'dash.step1Title': { fr: '1. Décrivez', en: '1. Describe' },
  'dash.step1Text': { fr: 'Expliquez votre besoin métier en langage simple à Marty, votre Data Architect IA.', en: 'Explain your business need in plain language to Marty, your AI Data Architect.' },
  'dash.step2Title': { fr: '2. Marty modélise', en: '2. Marty models' },
  'dash.step2Text': { fr: 'En étapes guidées, il conçoit entités, relations, attributs, clés, règles et sources.', en: 'In guided steps, it designs entities, relations, attributes, keys, rules and sources.' },
  'dash.step3Title': { fr: '3. Exportez', en: '3. Export' },
  'dash.step3Text': { fr: 'Récupérez le MCD, le SQL, le DBML, le schéma dbt, le dictionnaire et le rapport DAD.', en: 'Get the ERD, SQL, DBML, dbt schema, dictionary and DAD report.' },
  'dash.youWrite': { fr: 'Vous écrivez (langage métier)', en: 'You write (business language)' },
  'dash.example': { fr: '« Je veux piloter les réclamations clients : volume, statut, délai de résolution, motifs et actions correctives. »', en: '“I want to monitor customer complaints: volume, status, resolution time, reasons and corrective actions.”' },
  'dash.martyGenerates': { fr: 'Marty génère un modèle complet', en: 'Marty generates a full model' },
  'dash.readDocs': { fr: 'Lire la documentation complète', en: 'Read the full documentation' },
  'dash.statTotal': { fr: 'Sessions totales', en: 'Total sessions' },
  'dash.statActive': { fr: 'En cours', en: 'In progress' },
  'dash.statCompleted': { fr: 'Terminées', en: 'Completed' },
  'dash.recentSessions': { fr: 'Sessions récentes', en: 'Recent sessions' },
  'dash.completed': { fr: 'Terminé', en: 'Completed' },
  'dash.step': { fr: 'Étape', en: 'Step' },
  'dash.newProduct': { fr: 'Nouveau Data Product', en: 'New Data Product' },
  'dash.entities': { fr: 'entités', en: 'entities' },
  'dash.createdOn': { fr: 'Créé le', en: 'Created on' },
  'dash.workshop': { fr: 'Atelier', en: 'Workshop' },
  'dash.emptyText': { fr: 'Aucune session pour le moment. Démarrez votre premier atelier de conception pour créer un Data Product accompagné par l’IA.', en: 'No session yet. Start your first design workshop to create a Data Product guided by AI.' },

  // --- Data Products ---
  'dp.title': { fr: 'Data Products', en: 'Data Products' },
  'dp.subtitle': { fr: 'Gérez, filtrez et ouvrez vos produits data.', en: 'Manage, filter and open your data products.' },
  'dp.new': { fr: 'Nouveau Data Product', en: 'New Data Product' },
  'dp.total': { fr: 'Total', en: 'Total' },
  'dp.active': { fr: 'En cours', en: 'In progress' },
  'dp.completed': { fr: 'Terminés', en: 'Completed' },
  'dp.domains': { fr: 'Domaines', en: 'Domains' },
  'dp.search': { fr: 'Rechercher (nom, domaine, PO)…', en: 'Search (name, domain, owner)…' },
  'dp.allStatuses': { fr: 'Tous les statuts', en: 'All statuses' },
  'dp.statusActive': { fr: 'En cours', en: 'In progress' },
  'dp.statusCompleted': { fr: 'Terminés', en: 'Completed' },
  'dp.allDomains': { fr: 'Tous les domaines', en: 'All domains' },
  'dp.sortRecent': { fr: 'Tri : récent', en: 'Sort: recent' },
  'dp.sortOldest': { fr: 'Tri : ancien', en: 'Sort: oldest' },
  'dp.sortName': { fr: 'Tri : nom (A→Z)', en: 'Sort: name (A→Z)' },
  'dp.sortEntities': { fr: 'Tri : nb entités', en: 'Sort: # entities' },
  'dp.sortProgress': { fr: 'Tri : avancement', en: 'Sort: progress' },
  'dp.emptyNone': { fr: 'Aucun Data Product. Créez le premier.', en: 'No Data Product. Create the first one.' },
  'dp.emptyFilter': { fr: 'Aucun résultat pour ces filtres.', en: 'No result for these filters.' },
  'dp.colProduct': { fr: 'Produit', en: 'Product' },
  'dp.colDomain': { fr: 'Domaine', en: 'Domain' },
  'dp.colStatus': { fr: 'Statut', en: 'Status' },
  'dp.colProgress': { fr: 'Avancement', en: 'Progress' },
  'dp.colEntities': { fr: 'Entités', en: 'Entities' },
  'dp.colUpdated': { fr: 'Mis à jour', en: 'Updated' },
  'dp.colActions': { fr: 'Actions', en: 'Actions' },
  'dp.rowDone': { fr: 'Terminé', en: 'Completed' },
  'dp.rowActive': { fr: 'En cours', en: 'In progress' },
  'dp.noName': { fr: 'Sans nom', en: 'Untitled' },
  'dp.open': { fr: 'Ouvrir', en: 'Open' },
  'dp.deliverables': { fr: 'Livrables', en: 'Deliverables' },
  'dp.duplicateTitle': { fr: 'Dupliquer', en: 'Duplicate' },
  'dp.cancel': { fr: 'Annuler', en: 'Cancel' },
  'dp.save': { fr: 'Enregistrer', en: 'Save' },
  'dp.renameTitle': { fr: 'Renommer', en: 'Rename' },
  'dp.deleteTitle': { fr: 'Supprimer', en: 'Delete' },
  'dp.renamePrompt': { fr: 'Nouveau nom du Data Product :', en: 'New Data Product name:' },
  'dp.deleteConfirm': { fr: 'Supprimer définitivement « {name} » ? Cette action est irréversible.', en: 'Permanently delete “{name}”? This cannot be undone.' },
  'dp.thisProduct': { fr: 'ce produit', en: 'this product' },
};

interface I18nState {
  lang: Lang;
  setLang: (l: Lang) => void;
  toggle: () => void;
  t: (key: string, vars?: Record<string, string>) => string;
}

export const useI18n = create<I18nState>((set, get) => ({
  lang: 'fr',
  setLang: (l) => {
    try { localStorage.setItem('mart-lang', l); } catch { /* ignore */ }
    if (typeof document !== 'undefined') document.documentElement.setAttribute('lang', l);
    set({ lang: l });
  },
  toggle: () => get().setLang(get().lang === 'fr' ? 'en' : 'fr'),
  t: (key, vars) => {
    const entry = DICT[key];
    let str = entry ? entry[get().lang] : key;
    if (vars) for (const [k, v] of Object.entries(vars)) str = str.replace(`{${k}}`, v);
    return str;
  },
}));

export function localeCode(lang: Lang) {
  return lang === 'fr' ? 'fr-FR' : 'en-US';
}
