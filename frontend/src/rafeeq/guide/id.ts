import type { Guide } from "./sites";

/** The guide in Indonesian, item for item with en.ts. Needs a native read before a real season. */
export const GUIDE_ID: Guide = {
  haram: {
    name: "Masjidil Haram",
    summary: "Masjid besar di sekeliling Ka'bah, jantung kota Makkah.",
    story:
      "Ka'bah berada di tengah masjid terbesar di dunia. Umat Islam di mana pun menghadap ke sana saat salat. Masjid ini sudah diperluas berkali-kali, terakhir dengan perluasan terbesar dalam sejarahnya.",
    see: ["Ka'bah dan Hajar Aswad", "Maqam Ibrahim", "Tempat sa'i antara Shafa dan Marwah", "Tempat air Zamzam"],
    tips: ["Sepakati nomor pintu untuk bertemu rombongan Anda.", "Lantai atas dan atap biasanya lebih sepi.", "Bawa kantong untuk sandal atau sepatu Anda."],
  },
  hira: {
    name: "Jabal Nur dan Gua Hira",
    summary: "Gunung tempat ayat-ayat pertama Al-Qur'an turun.",
    story:
      "Nabi Muhammad ﷺ sering datang ke Gua Hira yang kecil, dekat puncak gunung ini, untuk merenung. Di sini Malaikat Jibril membawa ayat-ayat pertama Al-Qur'an kepada beliau, sekitar tahun 610 M.",
    see: ["Pemandangan kota Makkah dari puncak", "Gua kecil di dekat puncak", "Kawasan Budaya Hira di kaki gunung"],
    tips: ["Tanjakan curam: sekitar satu jam naik bagi orang dewasa yang bugar.", "Pergilah saat subuh atau setelah magrib, jangan di siang yang panas.", "Pakai sepatu yang baik dan bawa air minum."],
  },
  hira_district: {
    name: "Kawasan Budaya Hira",
    summary: "Museum dan taman baru di kaki Jabal Nur.",
    story:
      "Dibuka pada tahun 2023, kawasan ini menceritakan kisah turunnya wahyu lewat pameran dan film. Ada taman, kafe dan tempat teduh, jadi cocok untuk singgah sebelum atau sesudah melihat gunung.",
    see: ["Pameran Wahyu", "Museum Al-Qur'an", "Taman dengan pemandangan gunung"],
    tips: ["Pameran di dalam ruangan cocok saat jam-jam panas.", "Mungkin perlu tiket. Periksa dulu sebelum pergi."],
  },
  thawr: {
    name: "Jabal Tsur",
    summary: "Gua di gunung tempat Nabi bersembunyi saat hijrah.",
    story:
      "Pada tahun 622 M, Nabi ﷺ dan Abu Bakar meninggalkan Makkah menuju Madinah. Mereka bersembunyi selama tiga hari di sebuah gua dekat puncak gunung ini, sementara musuh mencari mereka.",
    see: ["Gunung dilihat dari jalan di bawah", "Gua Tsur di dekat puncak"],
    tips: ["Pendakian panjang dan berat: sekitar dua jam naik.", "Hanya untuk yang bugar, dan hanya di pagi yang sejuk.", "Kebanyakan pengunjung melihatnya dari bawah."],
  },
  mina: {
    name: "Mina",
    summary: "Lembah tenda putih tempat jamaah tinggal saat haji.",
    story:
      "Mina terletak di antara Makkah dan Muzdalifah. Saat haji, jamaah tinggal di sini, di kota tenda tahan api. Di luar musim haji, tempat ini sepi dan terbuka bagi pengunjung yang lewat.",
    see: ["Lautan tenda putih", "Masjid Khaif", "Jembatan Jamarat"],
    tips: ["Pada hari-hari haji, pergilah hanya bersama rombongan Anda.", "Area tenda terlihat mirip. Catat nomor maktab dan nomor jalan Anda."],
  },
  khayf: {
    name: "Masjid Khaif",
    summary: "Masjid besar di Mina.",
    story:
      "Nabi ﷺ salat di tempat ini di Mina saat beliau berhaji. Masjid besar yang sekarang, dengan empat menaranya, penuh pada hari-hari haji.",
    see: ["Masjid dan menara-menaranya", "Tenda-tenda Mina di sekitarnya"],
    tips: ["Sangat padat saat haji. Sepakati dulu tempat bertemu."],
  },
  jamarat: {
    name: "Jamarat",
    summary: "Jembatan tiga tiang (jumrah) di Mina.",
    story:
      "Saat haji, jamaah melempar batu kerikil kecil ke tiga tiang di sini, mengikuti teladan Nabi Ibrahim. Jembatan besar bertingkat ini dibangun agar kerumunan besar bisa bergerak dengan aman.",
    see: ["Tiga tiang jumrah", "Jembatan bertingkat dan jalur landainya"],
    tips: ["Ikuti jalur satu arah dan jadwal yang diberikan kepada rombongan Anda.", "Jangan berhenti atau memungut barang di tengah kerumunan."],
  },
  muzdalifah: {
    name: "Muzdalifah",
    summary: "Padang terbuka tempat jamaah bermalam setelah Arafah.",
    story:
      "Pada malam setelah Hari Arafah, jamaah beristirahat di bawah langit di Muzdalifah. Banyak yang mengumpulkan batu kerikil untuk Jamarat di sini. Masjid Al-Masy'aril Haram berdiri di padang ini.",
    see: ["Masjid Al-Masy'aril Haram", "Padang luas antara Arafah dan Mina"],
    tips: ["Di luar musim haji, lihatlah dari bus saat tur.", "Saat haji, tetap bersama rombongan: mudah tersesat di malam hari."],
  },
  arafat: {
    name: "Arafah dan Masjid Namirah",
    summary: "Padang Arafah, tempat terpenting dalam haji.",
    story:
      "Pada tanggal 9 Dzulhijjah, setiap jamaah haji wukuf di Arafah. Khutbah haji disampaikan di Masjid Namirah, dekat tempat Nabi ﷺ menyampaikan Khutbah Wada' pada tahun 632 M.",
    see: ["Masjid Namirah", "Padang dan barisan pohonnya", "Jabal Rahmah"],
    tips: ["Sebagian Masjid Namirah berada di luar Arafah. Ada papan yang menunjukkan batasnya.", "Tempat teduh terbatas. Bawa payung dan air minum."],
  },
  rahmah: {
    name: "Jabal Rahmah",
    summary: "Bukit Kasih Sayang, bukit granit di padang Arafah.",
    story:
      "Nabi ﷺ berdiri di kaki bukit ini pada Hari Arafah, saat satu-satunya haji beliau. Sebuah tugu putih menandai puncaknya.",
    see: ["Tugu putih di puncak", "Pemandangan padang Arafah"],
    tips: ["Mendaki bukit ini bukan bagian dari ibadah haji.", "Batu-batunya menjadi sangat panas. Hindari siang hari."],
  },
  mualla: {
    name: "Pemakaman Ma'la (Jannatul Ma'la)",
    summary: "Pemakaman tua di Makkah.",
    story:
      "Banyak keluarga Nabi dimakamkan di sini, termasuk istri pertama beliau Khadijah, kakek beliau Abdul Muththalib dan paman beliau Abu Thalib.",
    see: ["Pemakaman dilihat dari gerbangnya", "Kawasan lama di sekitarnya"],
    tips: ["Ziarah di sini tenang dan sederhana. Makam tidak diberi tanda.", "Jam buka terbatas. Periksa dulu sebelum pergi."],
  },
  jinn: {
    name: "Masjid Jin",
    summary: "Masjid bersejarah kecil di dekat Pemakaman Ma'la.",
    story:
      "Menurut riwayat, di sinilah sekelompok jin mendengarkan Nabi ﷺ membaca Al-Qur'an, seperti dikisahkan dalam Surah Al-Jinn.",
    see: ["Masjid ini, cukup jalan kaki sebentar dari pemakaman"],
    tips: ["Kunjungi bersama Pemakaman Ma'la dalam satu kali jalan kaki."],
  },
  aisha: {
    name: "Masjid Aisyah (Tan'im)",
    summary: "Masjid di batas Tanah Haram, di jalan menuju Madinah.",
    story:
      "Aisyah, istri Nabi, berihram di sini untuk umrah pada tahun 632 M. Kini jamaah yang tinggal di Makkah datang ke sini untuk memulai umrah lagi.",
    see: ["Masjid besar dan tempat wudunya"],
    tips: ["Bus dan taksi ke sini dari Masjidil Haram ada sepanjang hari.", "Bawa pakaian ihram Anda, siap untuk berganti."],
  },
  architecture: {
    name: "Pameran Arsitektur Dua Masjid Suci",
    summary: "Museum benda-benda lama dari dua masjid suci.",
    story:
      "Lihat pintu-pintu lama Ka'bah, tiang-tiang kayu dari Masjidil Haram dan maket kedua masjid dari masa ke masa. Letaknya di samping pabrik Kiswah.",
    see: ["Pintu lama Ka'bah", "Tiang dan lampu bersejarah", "Maket kedua masjid"],
    tips: ["Di dalam ruangan dan sejuk: cocok saat jam-jam panas.", "Kunjungi bersama pabrik Kiswah."],
  },
  kiswa: {
    name: "Pabrik Kiswah",
    summary: "Tempat kain sutra hitam penutup Ka'bah dibuat.",
    story:
      "Setiap tahun Kiswah baru, kain hitam penutup Ka'bah, dibuat di sini dari sutra dengan ayat-ayat yang disulam benang emas dan perak. Anda bisa melihat para penenun dan penyulam bekerja.",
    see: ["Tenun dan sulaman tangan", "Kaligrafi benang emas dari dekat"],
    tips: ["Kunjungan harus dengan janji. Tanyakan kepada ketua rombongan Anda.", "Di dalam ruangan: cocok saat jam-jam panas."],
  },
  nabawi: {
    name: "Masjid Nabawi",
    summary: "Masjid yang dibangun Nabi di Madinah, tempat beliau dimakamkan.",
    story:
      "Nabi ﷺ membangun masjid pertama di sini pada tahun 622 M, tak lama setelah tiba di Madinah. Beliau dimakamkan di bawah Kubah Hijau. Kini masjid ini sangat luas, dengan payung-payung raksasa yang terbuka di halamannya.",
    see: ["Kubah Hijau", "Raudhah", "Payung-payung halaman yang terbuka saat subuh"],
    tips: ["Masuk Raudhah perlu izin yang dipesan di aplikasi Nusuk.", "Sepakati nomor pintu untuk bertemu rombongan Anda."],
  },
  quba: {
    name: "Masjid Quba",
    summary: "Masjid pertama dalam Islam.",
    story:
      "Nabi ﷺ meletakkan batu-batu pertama masjid ini pada tahun 622 M, saat beliau tiba dari Makkah. Beliau sering datang ke sini dari Madinah, berjalan kaki atau berkendara.",
    see: ["Masjid putih dengan empat menaranya", "Jalan kaki Quba dari Masjid Nabawi"],
    tips: ["Jalan kaki yang teduh dari Masjid Nabawi sekitar 3 km.", "Berjalanlah di sore atau malam yang sejuk, bukan siang hari."],
  },
  baqi: {
    name: "Pemakaman Baqi (Jannatul Baqi)",
    summary: "Pemakaman utama Madinah, di samping Masjid Nabawi.",
    story:
      "Banyak keluarga dan sahabat Nabi dimakamkan di sini, termasuk Utsman bin Affan, khalifah ketiga.",
    see: ["Pemakaman dilihat dari pintu masuknya dekat masjid"],
    tips: ["Biasanya hanya untuk laki-laki, pada jam tertentu setelah salat Subuh dan Asar.", "Makam-makamnya sederhana dan tidak diberi tanda."],
  },
  uhud: {
    name: "Gunung Uhud dan Makam Syuhada",
    summary: "Gunung tempat terjadinya Perang Uhud.",
    story:
      "Pada tahun 625 M, kaum Muslim Madinah berperang melawan pasukan Makkah di sini. Tujuh puluh orang gugur, di antaranya Hamzah, paman Nabi. Mereka dimakamkan di kaki gunung.",
    see: ["Makam syuhada Uhud", "Bukit Pemanah (Jabal Rumah)", "Masjid Sayyidus Syuhada"],
    tips: ["Sebagian besar di luar ruangan. Pergilah pagi-pagi.", "Bukit Pemanah mudah dan cepat didaki, dengan pemandangan yang bagus."],
  },
  qiblatayn: {
    name: "Masjid Qiblatain",
    summary: "Masjid Dua Kiblat.",
    story:
      "Pada tahun 624 M, saat salat di sini, arah kiblat berubah dari Yerusalem (Baitul Maqdis) ke Ka'bah di Makkah. Karena itu masjid ini disebut masjid dua kiblat.",
    see: ["Masjid dengan kubah dan menara kembarnya"],
    tips: ["Hanya sebentar naik mobil dari Masjid Nabawi.", "Kunjungan mudah bagi jamaah lansia."],
  },
  sabaa: {
    name: "Masjid Tujuh (Khandaq)",
    summary: "Tempat terjadinya Perang Khandaq (Parit).",
    story:
      "Pada tahun 627 M, penduduk Madinah menggali parit di sini untuk mempertahankan kota dari pasukan besar. Kemudian masjid-masjid kecil dibangun untuk menandai tempat-tempat yang berkaitan dengan perang itu.",
    see: ["Masjid Al-Fath di atas bukit", "Masjid Khandaq yang besar", "Beberapa masjid kecil yang lama"],
    tips: ["Beberapa masjid kecil ditutup. Anda melihatnya dari luar.", "Kunjungi bersama Masjid Qiblatain yang dekat."],
  },
  ghamamah: {
    name: "Masjid Ghamamah",
    summary: "Masjid bersejarah kecil di dekat Masjid Nabawi.",
    story:
      "Nabi ﷺ salat Id dan salat minta hujan di tempat ini. Namanya berarti \"awan\". Bangunannya berasal dari masa Utsmaniyah.",
    see: ["Kubah-kubah Utsmaniyah dan dinding batunya"],
    tips: ["Beberapa menit jalan kaki dari Masjid Nabawi.", "Sering hanya buka menjelang waktu salat."],
  },
  jumuah: {
    name: "Masjid Jum'ah",
    summary: "Tempat salat Jumat pertama dipimpin.",
    story:
      "Dalam perjalanan dari Quba ke Madinah pada tahun 622 M, Nabi ﷺ memimpin salat Jumat pertama di tempat ini.",
    see: ["Masjid dan kubah putihnya"],
    tips: ["Di jalan antara Quba dan Masjid Nabawi."],
  },
  dar_madinah: {
    name: "Museum Dar Al Madinah",
    summary: "Museum sejarah kota Madinah.",
    story:
      "Maket, peta dan benda-benda lama menunjukkan bagaimana Madinah tumbuh dari zaman Nabi ﷺ sampai sekarang, termasuk masjid awal dan rumah-rumah lama.",
    see: ["Maket besar Madinah tempo dulu", "Maket masjid awal", "Koin, perkakas dan naskah lama"],
    tips: ["Di dalam ruangan dan sejuk: cocok saat jam-jam panas.", "Mungkin perlu tiket. Periksa dulu sebelum pergi."],
  },
  hejaz_railway: {
    name: "Museum Kereta Api Hijaz",
    summary: "Stasiun kereta api lama dari Damaskus ke Madinah.",
    story:
      "Kereta Api Hijaz dibuka pada tahun 1908 untuk membawa jamaah dari Damaskus ke Madinah. Stasiun batu peninggalan Utsmaniyah ini kini menjadi museum, dengan lokomotif tua di luarnya.",
    see: ["Gedung stasiun dari batu", "Lokomotif uap dan gerbong tua"],
    tips: ["Periksa jam buka sebelum pergi.", "Tempat singgah yang bagus untuk keluarga."],
  },
  seerah: {
    name: "Museum Sirah Nabawiyah",
    summary: "Pameran tentang kehidupan Nabi.",
    story:
      "Layar, maket dan film pendek menceritakan kisah hidup Nabi dan akhlak beliau, dalam banyak bahasa. Letaknya dekat Masjid Nabawi.",
    see: ["Ruang interaktif dalam banyak bahasa", "Maket tempat-tempat dalam kehidupan beliau"],
    tips: ["Di dalam ruangan dan sejuk: cocok saat jam-jam panas.", "Sediakan waktu sekitar satu jam."],
  },
  quran_complex: {
    name: "Kompleks Percetakan Al-Qur'an Raja Fahd",
    summary: "Tempat jutaan mushaf Al-Qur'an dicetak setiap tahun.",
    story:
      "Sejak tahun 1980-an, kompleks ini mencetak Al-Qur'an dan terjemahannya dalam banyak bahasa. Mushafnya dibagikan gratis ke masjid-masjid dan jamaah di seluruh dunia.",
    see: ["Ruang cetak dan penjilidan", "Terjemahan dalam banyak bahasa"],
    tips: ["Kunjungan harus dengan janji. Tanyakan kepada ketua rombongan Anda.", "Di jalan menuju Tabuk, di utara kota."],
  },
};
