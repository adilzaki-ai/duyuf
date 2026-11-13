import type { RafeeqLang } from "./help";

/**
 * Every line Rafeeq shows a pilgrim, in its six languages. English is the key,
 * as in the staff app; help.test.ts fails when a line on the page is missing
 * a language.
 *
 * Safety words only. Nothing here is religious guidance: that waits for
 * content approved by scholars. The Indonesian, Urdu, Turkish and French
 * still need a native speaker's read before a real pilot.
 */
type Others = Record<Exclude<RafeeqLang, "en">, string>;

export const WORDS: Record<string, Others> = {
  Rafeeq: { ar: "رفيق", id: "Rafeeq", ur: "رفیق", tr: "Rafeeq", fr: "Rafeeq" },
  "Assalamu alaikum, {name}": {
    ar: "السلام عليكم يا {name}",
    id: "Assalamu'alaikum, {name}",
    ur: "السلام علیکم، {name}",
    tr: "Selamün aleyküm, {name}",
    fr: "Assalamou alaykoum, {name}",
  },
  "Press a button if you need help.": {
    ar: "اضغط زرًا إن احتجت إلى مساعدة.",
    id: "Tekan tombol jika Anda butuh bantuan.",
    ur: "مدد چاہیے تو بٹن دبائیں۔",
    tr: "Yardıma ihtiyacınız varsa bir düğmeye basın.",
    fr: "Appuyez sur un bouton si vous avez besoin d'aide.",
  },
  Language: { ar: "اللغة", id: "Bahasa", ur: "زبان", tr: "Dil", fr: "Langue" },

  SOS: { ar: "نجدة", id: "SOS", ur: "SOS", tr: "SOS", fr: "SOS" },
  "Emergency: I need help now": {
    ar: "طوارئ: أحتاج مساعدة الآن",
    id: "Darurat: saya butuh bantuan sekarang",
    ur: "ایمرجنسی: مجھے ابھی مدد چاہیے",
    tr: "Acil durum: hemen yardım lazım",
    fr: "Urgence : j'ai besoin d'aide maintenant",
  },
  "I am lost": {
    ar: "ضللتُ الطريق",
    id: "Saya tersesat",
    ur: "مجھے راستہ نہیں مل رہا",
    tr: "Kayboldum",
    fr: "Je suis perdu(e)",
  },
  "Heat safety": {
    ar: "السلامة من الحر",
    id: "Aman dari panas",
    ur: "گرمی سے بچاؤ",
    tr: "Sıcaktan korunma",
    fr: "Se protéger de la chaleur",
  },
  "Drink water often, even if you are not thirsty.": {
    ar: "اشرب الماء كثيرًا حتى لو لم تشعر بالعطش.",
    id: "Minumlah air sesering mungkin, walau tidak haus.",
    ur: "پیاس نہ بھی لگے تو بار بار پانی پئیں۔",
    tr: "Susamasanız bile sık sık su için.",
    fr: "Buvez de l'eau souvent, même sans soif.",
  },
  "Stay in the shade and use an umbrella.": {
    ar: "ابقَ في الظل واستخدم مظلة.",
    id: "Tetaplah di tempat teduh dan pakai payung.",
    ur: "سائے میں رہیں اور چھتری استعمال کریں۔",
    tr: "Gölgede kalın ve şemsiye kullanın.",
    fr: "Restez à l'ombre et utilisez un parapluie.",
  },
  "Avoid the midday sun when you can.": {
    ar: "تجنّب شمس الظهيرة قدر الإمكان.",
    id: "Hindari terik matahari siang bila bisa.",
    ur: "جہاں تک ہو سکے دوپہر کی دھوپ سے بچیں۔",
    tr: "Mümkünse öğle güneşinden kaçının.",
    fr: "Évitez le soleil de midi quand vous le pouvez.",
  },
  "Headache, dizziness, sickness or very hot skin? Stop, find shade, drink water, and press the button below.": {
    ar: "صداع أو دوار أو غثيان أو جلد شديد الحرارة؟ توقّف، وابحث عن ظل، واشرب الماء، واضغط الزر أدناه.",
    id: "Sakit kepala, pusing, mual, atau kulit sangat panas? Berhenti, cari tempat teduh, minum air, lalu tekan tombol di bawah.",
    ur: "سر درد، چکر، متلی یا جلد بہت گرم؟ رک جائیں، سائے میں جائیں، پانی پئیں اور نیچے والا بٹن دبائیں۔",
    tr: "Baş ağrısı, baş dönmesi, mide bulantısı ya da çok sıcak cilt mi? Durun, gölgeye geçin, su için ve aşağıdaki düğmeye basın.",
    fr: "Maux de tête, vertiges, nausées ou peau très chaude ? Arrêtez-vous, mettez-vous à l'ombre, buvez de l'eau et appuyez sur le bouton ci-dessous.",
  },
  "I feel unwell in the heat": {
    ar: "أشعر بتعب من الحر",
    id: "Saya tidak enak badan karena panas",
    ur: "گرمی سے میری طبیعت خراب ہے",
    tr: "Sıcaktan kendimi kötü hissediyorum",
    fr: "Je me sens mal à cause de la chaleur",
  },
  "Unwell in the heat": {
    ar: "تعب من الحر",
    id: "Tidak enak badan karena panas",
    ur: "گرمی سے طبیعت خراب",
    tr: "Sıcaktan rahatsızlık",
    fr: "Malaise dû à la chaleur",
  },
  Back: { ar: "رجوع", id: "Kembali", ur: "واپس", tr: "Geri", fr: "Retour" },

  "Send a call for help now?": {
    ar: "هل ترسل طلب مساعدة الآن؟",
    id: "Kirim permintaan bantuan sekarang?",
    ur: "کیا ابھی مدد کی درخواست بھیجیں؟",
    tr: "Şimdi yardım çağrısı gönderilsin mi?",
    fr: "Envoyer un appel à l'aide maintenant ?",
  },
  "Your phone may ask to share where you are. Say yes so the team can find you.": {
    ar: "قد يطلب هاتفك مشاركة موقعك. وافق ليجدك الفريق.",
    id: "Ponsel mungkin meminta izin berbagi lokasi. Izinkan agar tim dapat menemukan Anda.",
    ur: "آپ کا فون مقام بتانے کی اجازت مانگ سکتا ہے۔ اجازت دیں تاکہ ٹیم آپ کو ڈھونڈ سکے۔",
    tr: "Telefonunuz konumunuzu paylaşmak için izin isteyebilir. Ekibin sizi bulabilmesi için izin verin.",
    fr: "Votre téléphone peut demander à partager votre position. Acceptez pour que l'équipe vous trouve.",
  },
  "Yes, send": { ar: "نعم، أرسل", id: "Ya, kirim", ur: "ہاں، بھیجیں", tr: "Evet, gönder", fr: "Oui, envoyer" },
  No: { ar: "لا", id: "Tidak", ur: "نہیں", tr: "Hayır", fr: "Non" },
  "Sending…": { ar: "جارٍ الإرسال…", id: "Mengirim…", ur: "بھیجا جا رہا ہے…", tr: "Gönderiliyor…", fr: "Envoi…" },

  "Your call for help was received.": {
    ar: "وصل طلب مساعدتك.",
    id: "Permintaan bantuan Anda sudah diterima.",
    ur: "آپ کی مدد کی درخواست موصول ہو گئی ہے۔",
    tr: "Yardım çağrınız alındı.",
    fr: "Votre appel à l'aide a été reçu.",
  },
  "A team is working on it.": {
    ar: "يتابعه فريق الآن.",
    id: "Sebuah tim sedang menanganinya.",
    ur: "ایک ٹیم اس پر کام کر رہی ہے۔",
    tr: "Bir ekip ilgileniyor.",
    fr: "Une équipe s'en occupe.",
  },
  "This call is closed.": {
    ar: "أُغلق هذا الطلب.",
    id: "Permintaan ini sudah ditutup.",
    ur: "یہ درخواست بند ہو گئی ہے۔",
    tr: "Bu çağrı kapandı.",
    fr: "Cet appel est clos.",
  },
  "Stay where you are if it is safe.": {
    ar: "ابقَ في مكانك إن كان آمنًا.",
    id: "Tetap di tempat Anda jika aman.",
    ur: "اگر محفوظ ہو تو اپنی جگہ پر رہیں۔",
    tr: "Güvenliyse olduğunuz yerde kalın.",
    fr: "Restez où vous êtes si c'est sans danger.",
  },
  "Number {ref}": { ar: "رقم {ref}", id: "Nomor {ref}", ur: "نمبر {ref}", tr: "Numara {ref}", fr: "Numéro {ref}" },
  "I am fine now": {
    ar: "أنا بخير الآن",
    id: "Saya sudah baik-baik saja",
    ur: "اب میں ٹھیک ہوں",
    tr: "Artık iyiyim",
    fr: "Je vais bien maintenant",
  },
  "You said you are fine.": {
    ar: "أخبرتنا أنك بخير.",
    id: "Anda bilang sudah baik-baik saja.",
    ur: "آپ نے بتایا کہ آپ ٹھیک ہیں۔",
    tr: "İyi olduğunuzu bildirdiniz.",
    fr: "Vous avez dit que vous allez bien.",
  },

  "Your call was NOT sent. Call now:": {
    ar: "لم يُرسَل طلبك. اتصل الآن:",
    id: "Permintaan Anda TIDAK terkirim. Telepon sekarang:",
    ur: "آپ کی درخواست نہیں بھیجی جا سکی۔ ابھی فون کریں:",
    tr: "Çağrınız GÖNDERİLEMEDİ. Hemen arayın:",
    fr: "Votre appel n'a PAS été envoyé. Appelez maintenant :",
  },
  "Try again": { ar: "حاول مرة أخرى", id: "Coba lagi", ur: "دوبارہ کوشش کریں", tr: "Tekrar dene", fr: "Réessayer" },
  "Cannot connect. If you need help, call:": {
    ar: "تعذّر الاتصال. إن احتجت مساعدة فاتصل بـ:",
    id: "Tidak bisa terhubung. Jika butuh bantuan, telepon:",
    ur: "رابطہ نہیں ہو سکا۔ مدد چاہیے تو فون کریں:",
    tr: "Bağlanılamıyor. Yardıma ihtiyacınız varsa arayın:",
    fr: "Connexion impossible. Si vous avez besoin d'aide, appelez :",
  },

  "Your group leader": {
    ar: "قائد مجموعتك",
    id: "Ketua rombongan Anda",
    ur: "آپ کے گروپ لیڈر",
    tr: "Grup lideriniz",
    fr: "Votre chef de groupe",
  },
  Call: { ar: "اتصال", id: "Telepon", ur: "کال کریں", tr: "Ara", fr: "Appeler" },
  "Emergency services": {
    ar: "الطوارئ",
    id: "Layanan darurat",
    ur: "ایمرجنسی سروس",
    tr: "Acil servis",
    fr: "Services d'urgence",
  },
  Ambulance: { ar: "الإسعاف", id: "Ambulans", ur: "ایمبولینس", tr: "Ambulans", fr: "Ambulance" },
  Listen: { ar: "استمع", id: "Dengarkan", ur: "سنیں", tr: "Dinle", fr: "Écouter" },

  "Rafeeq gives safety help only, not religious rulings.": {
    ar: "يقدّم رفيق مساعدة السلامة فقط، ولا يقدّم فتاوى.",
    id: "Rafeeq hanya memberi bantuan keselamatan, bukan fatwa.",
    ur: "رفیق صرف حفاظت میں مدد دیتا ہے، فتویٰ نہیں۔",
    tr: "Rafeeq yalnızca güvenlik yardımı verir, dini hüküm vermez.",
    fr: "Rafeeq aide pour la sécurité uniquement, sans avis religieux.",
  },
  "Scan the QR code on your Rafeeq card to open this page.": {
    ar: "امسح رمز QR على بطاقة رفيق لفتح هذه الصفحة.",
    id: "Pindai kode QR pada kartu Rafeeq Anda untuk membuka halaman ini.",
    ur: "یہ صفحہ کھولنے کے لیے اپنے رفیق کارڈ کا QR کوڈ اسکین کریں۔",
    tr: "Bu sayfayı açmak için Rafeeq kartınızdaki QR kodu okutun.",
    fr: "Scannez le code QR de votre carte Rafeeq pour ouvrir cette page.",
  },
  "This card no longer works. Ask your group leader for a new one.": {
    ar: "هذه البطاقة لم تعد تعمل. اطلب بطاقة جديدة من قائد مجموعتك.",
    id: "Kartu ini sudah tidak berlaku. Minta kartu baru kepada ketua rombongan.",
    ur: "یہ کارڈ اب کام نہیں کرتا۔ اپنے گروپ لیڈر سے نیا کارڈ لیں۔",
    tr: "Bu kart artık çalışmıyor. Grup liderinizden yenisini isteyin.",
    fr: "Cette carte ne fonctionne plus. Demandez-en une nouvelle à votre chef de groupe.",
  },
  "No connection. This is what was saved on your phone.": {
    ar: "لا يوجد اتصال. هذا ما حُفظ على هاتفك.",
    id: "Tidak ada koneksi. Ini yang tersimpan di ponsel Anda.",
    ur: "انٹرنیٹ نہیں ہے۔ یہ وہ ہے جو آپ کے فون میں محفوظ ہے۔",
    tr: "Bağlantı yok. Telefonunuzda kayıtlı olan bu.",
    fr: "Pas de connexion. Voici ce qui est enregistré sur votre téléphone.",
  },
  "Demonstration: calls go to a practice operations room, not to real help. In an emergency call 911.": {
    ar: "عرض توضيحي: تصل الطلبات إلى غرفة عمليات تجريبية لا إلى مساعدة حقيقية. في الطوارئ اتصل بـ 911.",
    id: "Demonstrasi: permintaan masuk ke ruang operasi latihan, bukan bantuan nyata. Dalam keadaan darurat, telepon 911.",
    ur: "ڈیمو: درخواستیں مشق کے آپریشن روم میں جاتی ہیں، حقیقی مدد تک نہیں۔ ایمرجنسی میں 911 پر کال کریں۔",
    tr: "Tanıtım: çağrılar gerçek yardıma değil, deneme operasyon odasına gider. Acil durumda 911'i arayın.",
    fr: "Démonstration : les appels vont à une salle d'opérations d'essai, pas à de vrais secours. En cas d'urgence, appelez le 911.",
  },
  "Sample: nothing is sent to anyone. In an emergency call 911.": {
    ar: "نسخة تجريبية: لا يُرسَل شيء إلى أحد. في الطوارئ اتصل بـ 911.",
    id: "Contoh: tidak ada yang dikirim ke siapa pun. Dalam keadaan darurat, telepon 911.",
    ur: "نمونہ: کسی کو کچھ نہیں بھیجا جاتا۔ ایمرجنسی میں 911 پر کال کریں۔",
    tr: "Örnek: hiçbir şey kimseye gönderilmez. Acil durumda 911'i arayın.",
    fr: "Exemple : rien n'est envoyé à personne. En cas d'urgence, appelez le 911.",
  },

  /* printed on the card itself */
  "Scan this code for help": {
    ar: "امسح هذا الرمز لطلب المساعدة",
    id: "Pindai kode ini untuk bantuan",
    ur: "مدد کے لیے یہ کوڈ اسکین کریں",
    tr: "Yardım için bu kodu okutun",
    fr: "Scannez ce code pour obtenir de l'aide",
  },
  "Keep this card with you.": {
    ar: "احتفظ بهذه البطاقة معك.",
    id: "Simpan kartu ini bersama Anda.",
    ur: "یہ کارڈ اپنے پاس رکھیں۔",
    tr: "Bu kartı yanınızda taşıyın.",
    fr: "Gardez cette carte sur vous.",
  },
};

/** A Latin name inside Arabic or Urdu text keeps its own order (FSI … PDI). */
export const iso = (s: string) => `⁨${s}⁩`;

/** The line in `lang`; the English if a line is somehow missing. */
export function say(en: string, lang: RafeeqLang, vars?: Record<string, string | number>): string {
  const s = lang === "en" ? en : (WORDS[en]?.[lang] ?? en);
  return vars ? s.replace(/\{(\w+)\}/g, (m, k: string) => (k in vars ? String(vars[k]) : m)) : s;
}
