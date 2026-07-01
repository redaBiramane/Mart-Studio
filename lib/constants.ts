// ============================================================
// Mart Studio — Constants & Step Definitions
// ============================================================

import { StepDefinition } from './types';export const STEPS: StepDefinition[] = [
  {
    id: 1,
    key: 'context',
    title: 'Contexte du produit Data',
    titleShort: 'Contexte',
    icon: '🎯',
    description: 'Définir le nom, le problème métier, l\'objectif et le domaine du Data Product.',
    questions: [
      'Quel est le nom du Data Product ?',
      'Quel problème métier résout-il ?',
      'Quel est son objectif principal ?',
      'Qui sont les utilisateurs de ce produit ?',
      'Quel domaine métier est concerné ?',
      'Qui est le Product Owner ?',
      'Qui est le Data Steward ?',
    ],
  },
  {
    id: 2,
    key: 'concepts',
    title: 'Concepts métiers (Entités)',
    titleShort: 'Entités',
    icon: '🧩',
    description: 'Identifier les objets métiers (tables) manipulés.',
    questions: [
      'Quelles sont les principales entités / tables ?',
      'Quelle est la définition métier de chaque entité ?',
    ],
  },
  {
    id: 3,
    key: 'relations',
    title: 'Relations entre entités',
    titleShort: 'Relations',
    icon: '🔗',
    description: 'Définir les liens entre les entités, les cardinalités et les hiérarchies.',
    questions: [
      'Quels objets sont liés entre eux ?',
      'Quelles sont les cardinalités (1:1, 1:N, N:N) ?',
      'Une relation est-elle obligatoire ?',
    ],
  },
  {
    id: 4,
    key: 'attributes',
    title: 'Attributs et Clés',
    titleShort: 'Attributs',
    icon: '📋',
    description: 'Détailler les colonnes, types de données et clés primaires/étrangères.',
    questions: [
      'Quels attributs (colonnes) appartiennent à chaque entité ?',
      'Quel attribut identifie de manière unique chaque entité (clé primaire PK) ?',
      'Quelles sont les clés étrangères (FK) reliant les tables ?',
      'Quels sont les types des données (ex: INT, VARCHAR, DATE) ?',
    ],
  },
  {
    id: 5,
    key: 'kpis',
    title: 'Indicateurs (KPI) — optionnel',
    titleShort: 'KPI',
    icon: '📊',
    description: 'Saisir vos KPI réels (nom, formule, axes). Facultatif — améliore la qualité si vous avez de vraies données.',
    optional: true,
    questions: [
      'Quels KPI souhaitez-vous suivre ?',
      'Comment sont-ils calculés (formule) ?',
      'Quels sont leurs axes d\'analyse ?',
    ],
  },
  {
    id: 6,
    key: 'rules',
    title: 'Règles métier — optionnel',
    titleShort: 'Règles',
    icon: '⚖️',
    description: 'Saisir vos règles de gestion réelles. Facultatif — à remplir si vous en avez de concrètes.',
    optional: true,
    questions: [
      'Quelles règles de gestion ou de calcul s\'appliquent ?',
      'Existe-t-il des contraintes ou valeurs interdites ?',
    ],
  },
  {
    id: 7,
    key: 'validation',
    title: 'Validation & Rapport DAD',
    titleShort: 'Validation',
    icon: '🏁',
    description: 'Revue automatique, score de maturité et génération finale des livrables.',
    questions: [],
  },
];

export const MATURITY_DIMENSIONS = [
  { key: 'businessUnderstanding', label: 'Compréhension métier', color: '#00664F' },
  { key: 'modeling', label: 'Modélisation', color: '#10B981' },
  { key: 'documentation', label: 'Documentation', color: '#6366F1' },
  { key: 'governance', label: 'Gouvernance', color: '#F59E0B' },
  { key: 'dataQuality', label: 'Qualité des données', color: '#EF4444' },
  { key: 'architecture', label: 'Architecture', color: '#8B5CF6' },
  { key: 'dadReadiness', label: 'Préparation DAD', color: '#EC4899' },
] as const;

export const APP_CONFIG = {
  name: 'Mart Studio',
  tagline: 'Atelier IA de conception Data Product',
  description: 'Concevez votre Data Product avec l\'accompagnement d\'un Senior Data Architect IA',
  version: '1.0.0',
};
