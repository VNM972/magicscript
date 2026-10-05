# Magic Script — modèles d’emails commerciaux

Version de travail — brouillons uniquement.

Ces modèles servent de cadre à l’Agent 3. Ils ne déclenchent aucun envoi et ne remplacent ni la validation humaine, ni le fact-check, ni la liste de suppression.

Pour le premier contact EMAIL / MOBILE, appliquer le [contrat canonique A3-CP01](../docs/agent3-commercial-contract.md) et ses politiques exécutables. Ces textes sont des illustrations éditoriales, pas des fixtures validées ni un mécanisme de génération. Les modèles de devis et de relance concernent des étapes distinctes, qui ne sont pas activées par CP01. Un brouillon MOBILE doit être conçu selon sa propre politique ; aucun de ces emails ne doit simplement être raccourci pour ce canal.

## Règles communes

- Utiliser uniquement des faits vérifiés dans le dossier du prospect.
- Ne jamais inventer de logo, client, résultat, tarif, délai, certification ou demande préalable.
- Présenter le prototype comme une démonstration préparée à partir d’informations publiques, jamais comme le site officiel ou une commande déjà passée.
- Conserver un ton court, humain et professionnel, sans critique du site existant.
- Identifier clairement Magic Script et conserver un moyen simple de s’opposer à toute nouvelle sollicitation.
- Ne jamais utiliser une URL `file://`, une URL locale ou une URL Preview temporaire dans un message commercial.
- `{{prototype_url}}` doit être l’URL HTTPS exacte du prototype déployé et vérifié.
- `{{personalized_magic_script_url}}` ne peut être utilisé que si la base publique est vérifiée et si l’identifiant opaque du prospect est résolu.
- Une variable obligatoire absente reste `UNKNOWN` et bloque le brouillon concerné ; elle n’est jamais devinée. Si le nom de contact facultatif est inconnu, utiliser « Bonjour, » sans titre ni nom inventé.

## Variables attendues

| Variable | Exigence |
| --- | --- |
| `{{company_name}}` | Nom vérifié de l’entreprise |
| `{{contact_name}}` | Facultatif ; uniquement s’il est vérifié |
| `{{verified_observation}}` | Un actif précis et sourcé |
| `{{digital_opportunity}}` | Une opportunité étayée par les claims autorisés ; jamais assimilée automatiquement à une observation |
| `{{prototype_url}}` | Lien HTTPS exact vers la démo vérifiée |
| `{{personalized_magic_script_url}}` | Lien public HTTPS avec identifiant opaque, facultatif au premier stade |
| `{{scope_summary}}` | Périmètre réel de la proposition |
| `{{price}}` | Tarif du devis validé humainement et cohérent avec l’autorité catalogue ; jamais généré par le modèle |
| `{{valid_until}}` | Date de validité fournie et validée, si nécessaire |
| `{{source_information}}` | Origine réellement utilisée pour contacter l’adresse |
| `{{sender_signature}}` | Signature ajoutée par le transport Magic Script |

## Modèle 1 — premier contact / prospection

### Conditions de préparation

Le prototype doit être déployé et vérifié. Le contact doit être validé, non supprimé et cohérent avec l’activité professionnelle ciblée.

Le premier contact exige aussi un historique autorisant ce premier contact, des claims sourcés et une valeur soutenue. La présence d’un dossier ne suffit pas. Un motif d’abstention bloque ce modèle ; ne pas combler les lacunes par des compliments ou des affirmations génériques.

Si `{{prototype_url}}` est absent ou non vérifié, le brouillon reste `readyToSend = false`.

### Objet

`Une démonstration pour {{company_name}}`

### Corps

Bonjour {{contact_name}},

En regardant {{verified_observation}}, j’ai identifié une manière de rendre {{digital_opportunity}} plus immédiat dans une présentation web.

J’ai préparé une démonstration sur mesure à partir d’informations publiques vérifiées :

Voir votre proposition : {{prototype_url}}

Il s’agit d’un aperçu préparé par Magic Script, et non de votre site officiel ni d’un projet commandé. Si cette piste vous paraît intéressante, vous pouvez simplement me répondre à ce message.

Si vous ne souhaitez plus recevoir de sollicitation de ma part, répondez simplement « STOP » et je le noterai immédiatement.

{{sender_signature}}

### Garde-fous

- Un seul lien : la démo vérifiée.
- Une seule action demandée : regarder la démo puis répondre si elle mérite un échange.
- Aucune mention de prix, de délai ou de résultat non validé.
- `{{source_information}}` doit être conservé dans le dossier, même s’il n’est pas affiché dans le corps du message.

## Modèle 2 — proposition / devis après intérêt

### Conditions de préparation

Ce message ne doit être préparé qu’après un intérêt réel ou une demande de proposition. Le périmètre et le tarif doivent être fournis et validés humainement.

Le second lien est optionnel : si `{{personalized_magic_script_url}}` n’est pas vérifié, le bloc correspondant doit être retiré, jamais remplacé par une URL inventée ou une Preview temporaire.

### Objet

`Votre proposition Magic Script — {{company_name}}`

### Corps

Bonjour {{contact_name}},

Comme suite à notre échange, voici la proposition préparée pour {{company_name}}.

Voir votre proposition : {{prototype_url}}

Découvrir Magic Script : {{personalized_magic_script_url}}

Le périmètre proposé comprend :

{{scope_summary}}

Montant indiqué dans le devis : {{price}}
Validité de la proposition : {{valid_until}}

Cette proposition reste soumise à votre validation. Si vous souhaitez modifier le périmètre ou préciser un besoin, répondez directement à ce message.

Si vous ne souhaitez plus recevoir de sollicitation de ma part, répondez simplement « STOP » et je le noterai immédiatement.

{{sender_signature}}

### Garde-fous

- Les deux liens ne sont présents que s’ils sont vérifiés et correspondent aux bons objets.
- Le tarif, le périmètre et la date sont des entrées humaines, pas une production du modèle.
- Le devis complet et ses conditions contractuelles restent la référence ; ce mail ne doit pas les remplacer.

## Variante de relance courte — uniquement si autorisée

Cette variante n’est pas un troisième modèle de campagne autonome. Elle sert seulement à relancer un premier message réellement envoyé, sans réponse et sans opposition.

**Objet :** `Re: Une démonstration pour {{company_name}}`

Bonjour {{contact_name}},

Je reviens une seule fois vers vous au sujet de la démonstration préparée pour {{company_name}} : {{prototype_url}}

Si le sujet n’est pas d’actualité, aucun problème. Répondez simplement « STOP » si vous ne souhaitez plus recevoir de message de ma part.

{{sender_signature}}

## Contrôle avant toute activation future

Le brouillon ne peut passer à la validation humaine que si :

1. le prospect, l’activité et l’observation affichée sont vérifiés ;
2. le contact est professionnel, validé et non supprimé ;
3. le prototype est réellement déployé sur une URL HTTPS approuvée ;
4. les liens correspondent exactement au prospect ;
5. le fact-check passe ;
6. l’identité de Magic Script et l’opposition simple sont présentes ;
7. `readyToSend` reste faux tant que la validation humaine n’est pas donnée.

La base publique personnalisée reste facultative pour le premier modèle. Elle ne doit pas être remplacée par `magicscript.fr` ou une URL Preview tant qu’elle n’est pas vérifiée et configurée.
