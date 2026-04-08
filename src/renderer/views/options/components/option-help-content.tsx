import type { TFunction } from 'i18next';
import type { InlineHelpContent } from './inline-help-popover';

export function getSubjectPageHelp(t: TFunction): InlineHelpContent {
    return {
        title: t('À quoi servent les sujets ?'),
        summary: t(
            "Les sujets rassemblent des versets, passages de prédications et extraits de documents autour d'un même thème.",
        ),
        sections: [
            {
                title: t('Ce que cette fonction vous apporte'),
                items: [
                    t(
                        'Elle évite de refaire les mêmes recherches chaque fois que vous préparez un thème.',
                    ),
                    t(
                        'Elle garde ensemble vos meilleures références bibliques et vos passages de prédications.',
                    ),
                    t(
                        "Elle aide à organiser vos références dans un ordre utile pour l'étude, la prédication ou l'export PDF.",
                    ),
                ],
            },
            {
                title: t('Pour commencer'),
                items: [
                    t('Créez un sujet pour chaque thème important que vous préparez.'),
                    t('Ajoutez des références depuis la lecture ou depuis la Bible.'),
                ],
            },
        ],
        footer: t(
            'Utilisez plutôt les notes pour écrire vos idées longues, vos plans et vos commentaires personnels.',
        ),
    };
}

export function getNotesPageHelp(t: TFunction): InlineHelpContent {
    return {
        title: t('À quoi servent les notes ?'),
        summary: t(
            'Les notes gardent vos idées, plans et repères de préparation dans un seul endroit.',
        ),
        sections: [
            {
                title: t('Ce que cette fonction vous apporte'),
                items: [
                    t(
                        'Elle sert à développer vos idées, vos plans et vos commentaires personnels.',
                    ),
                    t(
                        'Elle vous offre un espace de préparation plus libre et plus personnel que les sujets.',
                    ),
                    t(
                        'Elle peut garder des références vers la Bible ou les prédications pour retrouver vos sources rapidement.',
                    ),
                ],
            },
        ],
    };
}

export function getBiblePageHelp(t: TFunction): InlineHelpContent {
    return {
        title: t('Que fait cette page Bible ?'),
        summary: t(
            'La Bible vous aide à ouvrir rapidement un chapitre dans la lecture, comparer les versions et retrouver un passage sans quitter votre préparation.',
        ),
        sections: [
            {
                title: t('Ce que cette fonction vous apporte'),
                items: [
                    t("Elle sert de point d'entrée vers la lecture biblique dans l'application."),
                    t(
                        'Une fois le chapitre ouvert, vous profitez des outils de lecture du document.',
                    ),
                    t(
                        'Elle vous aide aussi à parcourir les livres, comparer les versions et lancer une recherche biblique dédiée.',
                    ),
                ],
            },
            {
                title: t('Bible dans la barre latérale'),
                description: t(
                    "C'est le chemin le plus direct pour ouvrir un livre ou un chapitre dans la vue de lecture.",
                ),
            },
            {
                title: t('Page Bible'),
                items: [
                    t('Utilisez cette page pour parcourir la Bible plus calmement.'),
                    t('Changez ou téléchargez des versions bibliques.'),
                    t('Recherchez un mot ou une expression dans la Bible.'),
                ],
            },
        ],
    };
}

export function getTtsSettingsHelp(t: TFunction): InlineHelpContent {
    return {
        title: t('À quoi servent les réglages de Lecture audio ?'),
        summary: t(
            'Cet onglet configure la voix qui lira vos prédications, chapitres bibliques et documents personnels.',
        ),
        sections: [
            {
                title: t('Ce que cette fonction vous apporte'),
                items: [
                    t("Elle permet d'écouter vos contenus au lieu de seulement les lire."),
                    t(
                        'Elle est utile pour suivre un texte, relire pendant un déplacement ou continuer votre étude en audio.',
                    ),
                    t(
                        "Elle contrôle aussi l'expérience de lecture: voix, vitesse, surlignage et comportement audio.",
                    ),
                ],
            },
            {
                title: t('Pour commencer'),
                items: [
                    t('Choisissez un fournisseur et une voix.'),
                    t('Testez la lecture et ajustez la vitesse.'),
                ],
            },
        ],
    };
}

export function getAiSettingsHelp(t: TFunction): InlineHelpContent {
    return {
        title: t("À quoi servent les réglages de l'assistant ?"),
        summary: t(
            "Cet onglet active l'assistant IA et choisit comment il répond dans l'application.",
        ),
        sections: [
            {
                title: t('Ce que cette fonction vous apporte'),
                items: [
                    t(
                        "L'assistant peut aider à explorer un thème, retrouver des références et comparer plus vite plusieurs contenus.",
                    ),
                    t(
                        "Cet onglet détermine s'il est disponible, quel service il utilise et dans quelle langue il travaille.",
                    ),
                    t(
                        'Vous pouvez choisir une solution locale, cloud ou personnalisée selon vos besoins.',
                    ),
                ],
            },
            {
                title: t('Pour commencer'),
                items: [
                    t("Activez l'assistant pour le rendre disponible dans la barre latérale."),
                    t('Sélectionnez un fournisseur local, cloud ou personnalisé.'),
                ],
            },
        ],
    };
}

export function getSearchPageHelp(t: TFunction): InlineHelpContent {
    return {
        title: t('Comment fonctionne la recherche ?'),
        summary: t(
            'Cette page recherche dans les prédications de votre bibliothèque et vous ramène directement au bon passage.',
        ),
        sections: [
            {
                title: t('Ce que cette fonction vous apporte'),
                items: [
                    t(
                        'Elle sert à retrouver rapidement un mot, un thème, un lieu ou une expression dans les prédications.',
                    ),
                    t(
                        'Elle évite de parcourir manuellement plusieurs documents quand vous savez déjà ce que vous cherchez.',
                    ),
                    t(
                        'Elle vous ramène directement au paragraphe utile quand vous ouvrez un résultat.',
                    ),
                ],
            },
            {
                title: t('Pour commencer'),
                items: [
                    t('Entrez au moins trois caractères pour lancer une recherche.'),
                    t(
                        'Choisissez le mode selon que vous cherchez un mot, plusieurs mots ou une phrase exacte.',
                    ),
                ],
            },
        ],
    };
}

export function getHighlightsPageHelp(t: TFunction): InlineHelpContent {
    return {
        title: t('À quoi servent les soulignages ?'),
        summary: t('Cette page rassemble tous les passages marqués pendant vos lectures.'),
        sections: [
            {
                title: t('Ce que cette fonction vous apporte'),
                items: [
                    t(
                        'Elle vous donne une vue unique de tous les passages importants que vous avez repérés.',
                    ),
                    t(
                        'Elle aide à revoir vos découvertes sans devoir rouvrir chaque document un par un.',
                    ),
                    t(
                        'Elle permet aussi de filtrer, rouvrir la source exacte ou exporter la liste en PDF.',
                    ),
                ],
            },
        ],
        footer: t('Les soulignages se créent dans la vue de lecture, pas sur cette page.'),
    };
}
