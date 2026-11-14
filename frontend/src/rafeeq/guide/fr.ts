import type { Guide } from "./sites";

/** The guide in French, item for item with en.ts. Needs a native read before a real season. */
export const GUIDE_FR: Guide = {
  haram: {
    name: "Mosquée al-Haram",
    summary: "La Grande Mosquée autour de la Kaaba, le cœur de La Mecque.",
    story:
      "La Kaaba se trouve au centre de la plus grande mosquée du monde. Partout, les musulmans se tournent vers elle pour prier. La mosquée a été agrandie de nombreuses fois, la dernière fois lors du plus grand agrandissement de son histoire.",
    see: ["La Kaaba et la Pierre noire", "Le Maqam Ibrahim", "Le Mas’a entre Safa et Marwa", "Les points d’eau de Zamzam"],
    tips: ["Choisissez un numéro de porte pour retrouver votre groupe.", "Les étages et le toit sont souvent moins remplis.", "Prenez un sac pour vos chaussures."],
  },
  hira: {
    name: "Jabal al-Nour et la grotte de Hira",
    summary: "La montagne où les premiers versets du Coran sont descendus.",
    story:
      "Le Prophète Muhammad ﷺ allait souvent dans la petite grotte de Hira, près du sommet de cette montagne, pour méditer. C’est ici que l’ange Jibril lui a apporté les premiers versets du Coran, vers l’an 610.",
    see: ["La vue sur La Mecque depuis le sommet", "La petite grotte près du sommet", "Le quartier culturel de Hira, au pied de la montagne"],
    tips: ["Montée raide : environ une heure pour un adulte en forme.", "Allez-y à l’aube ou après le coucher du soleil, jamais sous la chaleur de midi.", "Portez de bonnes chaussures et prenez de l’eau."],
  },
  hira_district: {
    name: "Quartier culturel de Hira",
    summary: "Un nouveau musée et un parc au pied du Jabal al-Nour.",
    story:
      "Ouvert en 2023, le quartier raconte l’histoire de la Révélation avec des expositions et des films. Il y a des jardins, des cafés et de l’ombre : c’est une bonne halte avant ou après la visite de la montagne.",
    see: ["L’exposition de la Révélation", "Le musée du Coran", "Des jardins avec vue sur la montagne"],
    tips: ["Les expositions sont à l’intérieur : un bon choix aux heures chaudes.", "Un billet peut être nécessaire. Vérifiez avant d’y aller."],
  },
  thawr: {
    name: "Jabal Thawr",
    summary: "La grotte de montagne où le Prophète s’est caché pendant l’Hégire.",
    story:
      "En l’an 622, le Prophète ﷺ et Abou Bakr ont quitté La Mecque pour Médine. Ils se sont cachés trois jours dans une grotte près du sommet de cette montagne, pendant que leurs ennemis les cherchaient.",
    see: ["La montagne vue depuis la route", "La grotte de Thawr près du sommet"],
    tips: ["Montée longue et difficile : environ deux heures.", "Seulement pour les personnes en forme, et seulement à la fraîcheur du matin.", "La plupart des visiteurs la regardent d’en bas."],
  },
  mina: {
    name: "Mina",
    summary: "La vallée des tentes blanches où les pèlerins restent pendant le Hajj.",
    story:
      "Mina se trouve entre La Mecque et Muzdalifa. Pendant le Hajj, les pèlerins logent ici dans une ville de tentes qui résistent au feu. Le reste de l’année, l’endroit est calme et ouvert aux visiteurs de passage.",
    see: ["La mer de tentes blanches", "La mosquée al-Khayf", "Le pont des Jamarat"],
    tips: ["Pendant les jours du Hajj, allez-y seulement avec votre groupe.", "Les zones de tentes se ressemblent. Notez le numéro de votre camp et de votre rue."],
  },
  khayf: {
    name: "Mosquée al-Khayf",
    summary: "La grande mosquée de Mina.",
    story:
      "Le Prophète ﷺ a prié à cet endroit de Mina pendant son Hajj. La grande mosquée d’aujourd’hui, avec ses quatre minarets, se remplit pendant les jours du Hajj.",
    see: ["La mosquée et ses minarets", "Les tentes de Mina tout autour"],
    tips: ["Très grande foule pendant le Hajj. Choisissez d’abord un lieu de rendez-vous."],
  },
  jamarat: {
    name: "Jamarat",
    summary: "Le pont des trois stèles, à Mina.",
    story:
      "Pendant le Hajj, les pèlerins jettent ici de petits cailloux sur trois stèles, en suivant l’exemple du Prophète Ibrahim. Le grand pont à plusieurs étages a été construit pour faire passer de très grandes foules en sécurité.",
    see: ["Les trois stèles", "Le pont à plusieurs étages et ses rampes"],
    tips: ["Suivez les chemins à sens unique et l’heure donnée à votre groupe.", "Ne vous arrêtez jamais et ne ramassez rien dans la foule."],
  },
  muzdalifah: {
    name: "Muzdalifa",
    summary: "La grande plaine où les pèlerins passent la nuit après Arafat.",
    story:
      "La nuit après le jour d’Arafat, les pèlerins se reposent à la belle étoile à Muzdalifa. Beaucoup y ramassent leurs cailloux pour les Jamarat. La mosquée al-Mash’ar al-Haram se trouve dans la plaine.",
    see: ["La mosquée al-Mash’ar al-Haram", "La grande plaine entre Arafat et Mina"],
    tips: ["En dehors du Hajj, regardez-la depuis le bus pendant une visite.", "Pendant le Hajj, restez avec votre groupe : on se perd facilement la nuit."],
  },
  arafat: {
    name: "Arafat et la mosquée Namira",
    summary: "La plaine d’Arafat, le lieu le plus important du Hajj.",
    story:
      "Le 9 de Dhoul Hijja, chaque pèlerin se tient à Arafat. Le sermon du Hajj est donné à la mosquée Namira, près de l’endroit où le Prophète ﷺ a fait son Sermon d’adieu en l’an 632.",
    see: ["La mosquée Namira", "La plaine et ses rangées d’arbres", "Le Jabal al-Rahma"],
    tips: ["Une partie de la mosquée Namira est en dehors d’Arafat. Des panneaux montrent la limite.", "Il y a peu d’ombre. Prenez un parapluie et de l’eau."],
  },
  rahmah: {
    name: "Jabal al-Rahma",
    summary: "Le mont de la Miséricorde, une colline de granit dans la plaine d’Arafat.",
    story:
      "Le Prophète ﷺ s’est tenu au pied de cette colline le jour d’Arafat, pendant son unique Hajj. Un pilier blanc marque le sommet.",
    see: ["Le pilier blanc au sommet", "La vue sur la plaine d’Arafat"],
    tips: ["Monter sur la colline n’est pas un rite du Hajj.", "Les rochers deviennent très chauds. Évitez midi."],
  },
  mualla: {
    name: "Jannat al-Mu’alla",
    summary: "L’ancien cimetière de La Mecque.",
    story:
      "Beaucoup de membres de la famille du Prophète sont enterrés ici, dont sa première épouse Khadija, son grand-père Abd al-Muttalib et son oncle Abou Talib.",
    see: ["Le cimetière depuis sa porte", "Le vieux quartier autour"],
    tips: ["La visite est calme et simple. Les tombes n’ont pas de nom.", "Les heures d’ouverture sont limitées. Vérifiez avant d’y aller."],
  },
  jinn: {
    name: "Mosquée al-Jinn",
    summary: "Une petite mosquée historique près de Jannat al-Mu’alla.",
    story:
      "Selon la tradition, c’est ici qu’un groupe de djinns a écouté le Prophète ﷺ réciter le Coran, comme le raconte la sourate al-Jinn.",
    see: ["La mosquée, à quelques pas du cimetière"],
    tips: ["Visitez-la avec Jannat al-Mu’alla pendant la même marche."],
  },
  aisha: {
    name: "Mosquée Aïcha (Tan’im)",
    summary: "La mosquée à la limite du Haram, sur la route de Médine.",
    story:
      "Aïcha, l’épouse du Prophète, a pris l’ihram ici pour la Omra en l’an 632. Aujourd’hui, les pèlerins qui restent à La Mecque viennent ici pour commencer une autre Omra.",
    see: ["La grande mosquée et ses salles d’ablutions"],
    tips: ["Des bus et des taxis viennent ici depuis le Haram toute la journée.", "Préparez vos vêtements d’ihram pour vous changer."],
  },
  architecture: {
    name: "Exposition de l’architecture des deux Saintes Mosquées",
    summary: "Un musée d’anciennes pièces des deux Saintes Mosquées.",
    story:
      "Vous y verrez d’anciennes portes de la Kaaba, des colonnes en bois du Haram et des maquettes des deux mosquées à travers l’histoire. Il se trouve à côté de la fabrique de la Kiswa.",
    see: ["Une ancienne porte de la Kaaba", "Des colonnes et des lampes anciennes", "Des maquettes des deux mosquées"],
    tips: ["À l’intérieur et au frais : bien pour les heures chaudes.", "Visitez-le avec la fabrique de la Kiswa."],
  },
  kiswa: {
    name: "Fabrique de la Kiswa",
    summary: "Le lieu où l’on fabrique l’étoffe de soie noire qui couvre la Kaaba.",
    story:
      "Chaque année, une nouvelle Kiswa, l’étoffe noire qui couvre la Kaaba, est fabriquée ici en soie, avec des versets brodés en fil d’or et d’argent. Vous pouvez regarder les tisserands et les brodeurs au travail.",
    see: ["Le tissage et la broderie à la main", "La calligraphie en fil d’or, de près"],
    tips: ["Les visites se font sur rendez-vous. Demandez à votre chef de groupe.", "À l’intérieur : bien pour les heures chaudes."],
  },
  nabawi: {
    name: "Mosquée du Prophète",
    summary: "La mosquée construite par le Prophète à Médine, où il est enterré.",
    story:
      "Le Prophète ﷺ a construit ici la première mosquée en l’an 622, peu après son arrivée à Médine. Il est enterré sous le Dôme vert. Aujourd’hui, la mosquée couvre une très grande surface, avec des parasols géants qui s’ouvrent dans les cours.",
    see: ["Le Dôme vert", "La Rawda al-Sharifa", "Les parasols des cours qui s’ouvrent à l’aube"],
    tips: ["Pour la Rawda, il faut un permis réservé dans l’application Nusuk.", "Choisissez un numéro de porte pour retrouver votre groupe."],
  },
  quba: {
    name: "Mosquée de Quba",
    summary: "La première mosquée de l’islam.",
    story:
      "Le Prophète ﷺ a posé les premières pierres de cette mosquée en l’an 622, à son arrivée de La Mecque. Il venait souvent ici depuis Médine, à pied ou sur sa monture.",
    see: ["La mosquée blanche et ses quatre minarets", "La promenade de Quba depuis la mosquée du Prophète"],
    tips: ["La promenade ombragée depuis la mosquée du Prophète fait environ 3 km.", "Faites-la à la fraîcheur du soir, pas à midi."],
  },
  baqi: {
    name: "Jannat al-Baqi",
    summary: "Le grand cimetière de Médine, à côté de la mosquée du Prophète.",
    story:
      "Beaucoup de membres de la famille et de compagnons du Prophète sont enterrés ici, dont Othman ibn Affan, le troisième calife.",
    see: ["Le cimetière depuis son entrée près de la mosquée"],
    tips: ["En général pour les hommes seulement, à des heures fixes après les prières de l’aube et de l’après-midi.", "Les tombes sont simples et sans nom."],
  },
  uhud: {
    name: "Mont Ouhoud et le site des martyrs",
    summary: "La montagne où a eu lieu la bataille d’Ouhoud.",
    story:
      "En l’an 625, les musulmans de Médine ont combattu ici l’armée de La Mecque. Soixante-dix d’entre eux ont été tués, parmi eux Hamza, l’oncle du Prophète. Ils sont enterrés au pied de la montagne.",
    see: ["Le cimetière des martyrs d’Ouhoud", "La colline des archers (Jabal al-Rumah)", "La mosquée Sayyid al-Shuhada"],
    tips: ["Surtout en plein air. Allez-y tôt le matin.", "La colline des archers se monte vite et facilement, avec une belle vue."],
  },
  qiblatayn: {
    name: "Mosquée al-Qiblatayn",
    summary: "La mosquée des deux qiblas.",
    story:
      "En l’an 624, pendant une prière ici, la direction de la prière a changé : de Jérusalem vers la Kaaba à La Mecque. C’est pour cela qu’on l’appelle la mosquée des deux qiblas.",
    see: ["La mosquée avec ses deux dômes et ses deux minarets"],
    tips: ["À quelques minutes en voiture de la mosquée du Prophète.", "Visite facile pour les pèlerins âgés."],
  },
  sabaa: {
    name: "Les Sept Mosquées (Khandaq)",
    summary: "Le lieu de la bataille du Fossé.",
    story:
      "En l’an 627, les habitants de Médine ont creusé ici un fossé pour défendre la ville contre une grande armée. Plus tard, de petites mosquées ont marqué les lieux liés à la bataille.",
    see: ["La mosquée al-Fath sur la colline", "La grande mosquée du Khandaq", "Quelques-unes des petites mosquées anciennes"],
    tips: ["Plusieurs petites mosquées sont fermées. On les voit de l’extérieur.", "Visitez-les avec la mosquée al-Qiblatayn, tout près."],
  },
  ghamamah: {
    name: "Mosquée al-Ghamama",
    summary: "Une petite mosquée historique près de la mosquée du Prophète.",
    story:
      "Le Prophète ﷺ a fait à cet endroit la prière de l’Aïd et une prière pour la pluie. Son nom veut dire « le nuage ». Le bâtiment date de l’époque ottomane.",
    see: ["Les dômes ottomans et les murs de pierre"],
    tips: ["À quelques minutes à pied de la mosquée du Prophète.", "Souvent ouverte seulement autour des heures de prière."],
  },
  jumuah: {
    name: "Mosquée al-Jumu’a",
    summary: "Le lieu de la première prière du vendredi.",
    story:
      "En l’an 622, sur la route de Quba vers Médine, le Prophète ﷺ a dirigé à cet endroit la première prière du vendredi.",
    see: ["La mosquée et son dôme blanc"],
    tips: ["Sur la route entre Quba et la mosquée du Prophète."],
  },
  dar_madinah: {
    name: "Musée Dar Al Madinah",
    summary: "Un musée sur l’histoire de Médine.",
    story:
      "Des maquettes, des cartes et des objets anciens montrent comment Médine a grandi depuis l’époque du Prophète ﷺ jusqu’à aujourd’hui, avec la première mosquée et les vieilles maisons.",
    see: ["Une grande maquette de l’ancienne Médine", "Des maquettes de la première mosquée", "Des pièces de monnaie, des outils et des manuscrits anciens"],
    tips: ["À l’intérieur et au frais : bien pour les heures chaudes.", "Un billet peut être nécessaire. Vérifiez avant d’y aller."],
  },
  hejaz_railway: {
    name: "Musée du chemin de fer du Hedjaz",
    summary: "L’ancienne gare de la ligne de Damas à Médine.",
    story:
      "Le chemin de fer du Hedjaz a ouvert en 1908 pour transporter les pèlerins de Damas à Médine. La gare ottomane en pierre est aujourd’hui un musée, avec de vieilles locomotives dehors.",
    see: ["Le bâtiment de la gare en pierre", "De vieilles locomotives à vapeur et des wagons"],
    tips: ["Vérifiez les heures d’ouverture avant d’y aller.", "Une bonne visite pour les familles."],
  },
  seerah: {
    name: "Musée de la vie du Prophète",
    summary: "Une exposition sur la vie du Prophète.",
    story:
      "Des écrans, des maquettes et de courts films racontent la vie du Prophète et son caractère, en plusieurs langues. Le musée est proche de la mosquée du Prophète.",
    see: ["Des salles interactives en plusieurs langues", "Des maquettes des lieux de sa vie"],
    tips: ["À l’intérieur et au frais : bien pour les heures chaudes.", "Prévoyez environ une heure."],
  },
  quran_complex: {
    name: "Complexe du Roi Fahd pour l’impression du Coran",
    summary: "Le lieu où des millions d’exemplaires du Coran sont imprimés chaque année.",
    story:
      "Depuis les années 1980, ce complexe imprime le Coran et ses traductions en plusieurs langues. Les exemplaires sont donnés gratuitement aux mosquées et aux pèlerins du monde entier.",
    see: ["Les salles d’impression et de reliure", "Des traductions en plusieurs langues"],
    tips: ["Les visites se font sur rendez-vous. Demandez à votre chef de groupe.", "Sur la route de Tabouk, au nord de la ville."],
  },
};
