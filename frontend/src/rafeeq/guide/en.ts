import type { Guide } from "./sites";

/**
 * The guide to each site, in English: the key the other five languages follow
 * item for item (guide.test.ts checks the counts match).
 *
 * History and practical help only, no rulings. DRAFT: to be read by a licensed
 * guide (mutawwif) and the operator's religious advisor before a real season.
 * Opening times change, so the tips say "check" rather than give hours.
 */
export const GUIDE_EN: Guide = {
  haram: {
    name: "Al-Masjid al-Haram",
    summary: "The Grand Mosque around the Kaaba, the heart of Makkah.",
    story:
      "The Kaaba stands at the center of the largest mosque in the world. Muslims everywhere face it in prayer. The mosque has been enlarged many times, most recently in the largest expansion in its history.",
    see: ["The Kaaba and the Black Stone", "Maqam Ibrahim", "The Mas'a between Safa and Marwah", "Zamzam water stations"],
    tips: ["Agree on a gate number to meet your group.", "Upper floors and the roof are often less crowded.", "Bring a bag for your shoes."],
  },
  hira: {
    name: "Jabal al-Nour and the Cave of Hira",
    summary: "The mountain where the first verses of the Quran came down.",
    story:
      "The Prophet Muhammad ﷺ often went to the small Cave of Hira, near the top of this mountain, to reflect. Here the angel Jibril brought him the first verses of the Quran, around 610 CE.",
    see: ["The view over Makkah from the top", "The small cave near the summit", "The Hira Cultural District at the foot"],
    tips: ["Steep climb: about an hour up for a fit adult.", "Go at dawn or after sunset, never in the midday heat.", "Wear good shoes and carry water."],
  },
  hira_district: {
    name: "Hira Cultural District",
    summary: "A new museum and park at the foot of Jabal al-Nour.",
    story:
      "Opened in 2023, the district tells the story of the revelation with exhibits and films. It has gardens, cafes and shade, so it is a good stop before or after seeing the mountain.",
    see: ["The Revelation Exhibition", "The Quran Museum", "Gardens with a view of the mountain"],
    tips: ["Indoor exhibits are a good choice in the hot hours.", "Tickets may be needed. Check before you go."],
  },
  thawr: {
    name: "Jabal Thawr",
    summary: "The mountain cave where the Prophet hid during the Hijrah.",
    story:
      "In 622 CE the Prophet ﷺ and Abu Bakr left Makkah for Madinah. They hid for three days in a cave near the top of this mountain while their enemies searched for them.",
    see: ["The mountain from the road below", "The Cave of Thawr near the summit"],
    tips: ["A long, hard climb: about two hours up.", "Only for the fit, and only in the cool morning.", "Most visitors see it from below."],
  },
  mina: {
    name: "Mina",
    summary: "The valley of white tents where pilgrims stay during Hajj.",
    story:
      "Mina lies between Makkah and Muzdalifah. During Hajj, pilgrims stay here in a city of fireproof tents. The rest of the year it is quiet and open to visitors passing through.",
    see: ["The sea of white tents", "Masjid al-Khayf", "The Jamarat bridge"],
    tips: ["During Hajj days, go only with your group.", "Tent areas look alike. Note your camp and street number."],
  },
  khayf: {
    name: "Masjid al-Khayf",
    summary: "The great mosque of Mina.",
    story:
      "The Prophet ﷺ prayed at this place in Mina during his Hajj. Today's large mosque, with its four minarets, fills during the days of Hajj.",
    see: ["The mosque and its minarets", "The tents of Mina around it"],
    tips: ["Very crowded during Hajj. Agree on a meeting place first."],
  },
  jamarat: {
    name: "Jamarat",
    summary: "The bridge of the three pillars in Mina.",
    story:
      "Pilgrims throw small pebbles at three pillars here during Hajj, following the example of Prophet Ibrahim. The large multi-level bridge was built to move huge crowds safely.",
    see: ["The three pillars", "The multi-level bridge and its ramps"],
    tips: ["Follow the one-way routes and the time your group is given.", "Never stop or pick things up in the crowd."],
  },
  muzdalifah: {
    name: "Muzdalifah",
    summary: "The open plain where pilgrims spend the night after Arafat.",
    story:
      "On the night after the Day of Arafah, pilgrims rest under the sky at Muzdalifah. Many collect their pebbles for the Jamarat here. Al-Mash'ar al-Haram Mosque stands on the plain.",
    see: ["Al-Mash'ar al-Haram Mosque", "The wide plain between Arafat and Mina"],
    tips: ["Outside Hajj, see it from the bus on a tour.", "At Hajj, stay with your group: it is easy to get lost at night."],
  },
  arafat: {
    name: "Arafat and Masjid Namirah",
    summary: "The plain of Arafat, the most important place of Hajj.",
    story:
      "On the 9th of Dhul Hijjah every pilgrim stands at Arafat. The Hajj sermon is given at Masjid Namirah, close to where the Prophet ﷺ gave his Farewell Sermon in 632 CE.",
    see: ["Masjid Namirah", "The plain and its rows of trees", "Jabal al-Rahmah"],
    tips: ["Part of Masjid Namirah lies outside Arafat. Signs show the boundary.", "Shade is limited. Bring an umbrella and water."],
  },
  rahmah: {
    name: "Jabal al-Rahmah",
    summary: "The Mount of Mercy, a granite hill on the plain of Arafat.",
    story:
      "The Prophet ﷺ stood at the foot of this hill on the Day of Arafah during his only Hajj. A white pillar marks the top.",
    see: ["The white pillar on the summit", "The view across the plain of Arafat"],
    tips: ["Climbing it is not a rite of Hajj.", "The rocks get very hot. Avoid midday."],
  },
  mualla: {
    name: "Jannat al-Mu'alla",
    summary: "The old cemetery of Makkah.",
    story:
      "Many of the Prophet's family are buried here, including his first wife Khadijah, his grandfather Abdul Muttalib and his uncle Abu Talib.",
    see: ["The cemetery from its gate", "The old quarter around it"],
    tips: ["Visiting is quiet and simple. Graves have no markers.", "Open hours are limited. Check before you go."],
  },
  jinn: {
    name: "Masjid al-Jinn",
    summary: "A small historic mosque near Jannat al-Mu'alla.",
    story:
      "By tradition, this is where a group of jinn listened to the Prophet ﷺ reciting the Quran, as told in Surah al-Jinn.",
    see: ["The mosque, a short walk from the cemetery"],
    tips: ["Combine it with Jannat al-Mu'alla on the same walk."],
  },
  aisha: {
    name: "Masjid Aisha (Tan'eem)",
    summary: "The mosque at the edge of the Haram, on the road to Madinah.",
    story:
      "Aisha, the Prophet's wife, put on ihram here for Umrah in 632 CE. Today pilgrims staying in Makkah come here to start another Umrah.",
    see: ["The large mosque and its washrooms"],
    tips: ["Buses and taxis run here from the Haram all day.", "Bring your ihram clothes ready to change."],
  },
  architecture: {
    name: "Two Holy Mosques Architecture Exhibition",
    summary: "A museum of old pieces of the two holy mosques.",
    story:
      "See old doors of the Kaaba, wooden columns from the Haram and models of both mosques through history. It sits next to the Kiswa factory.",
    see: ["An old door of the Kaaba", "Historic columns and lamps", "Models of the two mosques"],
    tips: ["Indoor and cool: good for the hot hours.", "Combine it with the Kiswa factory."],
  },
  kiswa: {
    name: "Kiswa Factory",
    summary: "Where the black silk cover of the Kaaba is made.",
    story:
      "Every year a new Kiswa, the black cover of the Kaaba, is made here from silk with verses embroidered in gold and silver thread. You can watch weavers and embroiderers at work.",
    see: ["Weaving and embroidery by hand", "Gold-thread calligraphy up close"],
    tips: ["Visits are by appointment. Ask your group leader.", "Indoor: good for the hot hours."],
  },
  nabawi: {
    name: "The Prophet's Mosque",
    summary: "The mosque built by the Prophet in Madinah, where he is buried.",
    story:
      "The Prophet ﷺ built the first mosque here in 622 CE, soon after arriving in Madinah. He is buried under the Green Dome. Today the mosque covers a huge area with giant umbrellas that open in the courtyards.",
    see: ["The Green Dome", "Al-Rawdah al-Sharifah", "The courtyard umbrellas opening at dawn"],
    tips: ["Al-Rawdah needs a permit booked in the Nusuk app.", "Agree on a gate number to meet your group."],
  },
  quba: {
    name: "Quba Mosque",
    summary: "The first mosque in Islam.",
    story:
      "The Prophet ﷺ laid the first stones of this mosque in 622 CE, when he arrived from Makkah. He often came here from Madinah, walking or riding.",
    see: ["The white mosque and its four minarets", "The Quba walk from the Prophet's Mosque"],
    tips: ["The shaded walk from the Prophet's Mosque is about 3 km.", "Walk it in the cool evening, not at noon."],
  },
  baqi: {
    name: "Jannat al-Baqi",
    summary: "The main cemetery of Madinah, beside the Prophet's Mosque.",
    story:
      "Many of the Prophet's family and companions are buried here, including Uthman ibn Affan, the third caliph.",
    see: ["The cemetery from its entrance near the mosque"],
    tips: ["Usually men only, at set times after dawn and afternoon prayers.", "Graves are simple and unmarked."],
  },
  uhud: {
    name: "Mount Uhud and the Martyrs' Site",
    summary: "The mountain where the Battle of Uhud took place.",
    story:
      "In 625 CE the Muslims of Madinah fought the army of Makkah here. Seventy were killed, among them Hamzah, the Prophet's uncle. They are buried at the foot of the mountain.",
    see: ["The Uhud martyrs' cemetery", "Archers' Hill (Jabal al-Rumah)", "Sayyid al-Shuhada Mosque"],
    tips: ["Mostly outdoors. Go early in the morning.", "Archers' Hill is a short, easy climb with a good view."],
  },
  qiblatayn: {
    name: "Masjid al-Qiblatayn",
    summary: "The Mosque of the Two Qiblas.",
    story:
      "In 624 CE, during a prayer here, the direction of prayer changed from Jerusalem to the Kaaba in Makkah. That is why it is called the mosque of two qiblas.",
    see: ["The mosque with its twin domes and minarets"],
    tips: ["A short drive from the Prophet's Mosque.", "Easy visit for older pilgrims."],
  },
  sabaa: {
    name: "The Seven Mosques (Khandaq)",
    summary: "Where the Battle of the Trench was fought.",
    story:
      "In 627 CE the people of Madinah dug a trench here to defend the city against a large army. Small mosques later marked the places linked to the battle.",
    see: ["Masjid al-Fath on the hill", "The large Khandaq Mosque", "Some of the small old mosques"],
    tips: ["Several small mosques are closed. You see them from outside.", "Combine it with Masjid al-Qiblatayn nearby."],
  },
  ghamamah: {
    name: "Masjid al-Ghamamah",
    summary: "A small historic mosque near the Prophet's Mosque.",
    story:
      "The Prophet ﷺ prayed the Eid prayers and a prayer for rain on this spot. Its name means \"the cloud\". The building dates from the Ottoman era.",
    see: ["The Ottoman domes and stone walls"],
    tips: ["A few minutes' walk from the Prophet's Mosque.", "Often open only near prayer times."],
  },
  jumuah: {
    name: "Masjid al-Jumu'ah",
    summary: "Where the first Friday prayer was led.",
    story:
      "On his way from Quba into Madinah in 622 CE, the Prophet ﷺ led the first Friday prayer at this place.",
    see: ["The mosque and its white dome"],
    tips: ["On the way between Quba and the Prophet's Mosque."],
  },
  dar_madinah: {
    name: "Dar Al Madinah Museum",
    summary: "A museum of the history of Madinah.",
    story:
      "Models, maps and old objects show how Madinah grew from the time of the Prophet ﷺ to today, including the early mosque and old houses.",
    see: ["A large model of old Madinah", "Models of the early mosque", "Old coins, tools and manuscripts"],
    tips: ["Indoor and cool: good for the hot hours.", "Tickets may be needed. Check before you go."],
  },
  hejaz_railway: {
    name: "Hejaz Railway Museum",
    summary: "The old railway station from Damascus to Madinah.",
    story:
      "The Hejaz Railway opened in 1908 to carry pilgrims from Damascus to Madinah. The Ottoman stone station is now a museum, with old engines outside.",
    see: ["The stone station building", "Old steam engines and carriages"],
    tips: ["Check opening times before you go.", "A good stop for families."],
  },
  seerah: {
    name: "Museum of the Prophet's Life",
    summary: "An exhibition on the life of the Prophet.",
    story:
      "Screens, models and short films tell the story of the Prophet's life and his character, in many languages. It is close to the Prophet's Mosque.",
    see: ["Interactive halls in many languages", "Models of places in his life"],
    tips: ["Indoor and cool: good for the hot hours.", "Plan about an hour."],
  },
  quran_complex: {
    name: "King Fahd Quran Printing Complex",
    summary: "Where millions of copies of the Quran are printed each year.",
    story:
      "Since the 1980s this complex has printed the Quran and its translations in many languages. Copies go free to mosques and pilgrims around the world.",
    see: ["The printing and binding halls", "Translations in many languages"],
    tips: ["Visits are by appointment. Ask your group leader.", "On the road to Tabuk, north of the city."],
  },
};
