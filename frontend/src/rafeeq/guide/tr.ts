import type { Guide } from "./sites";

/** The guide in Turkish, item for item with en.ts. Needs a native read before a real season. */
export const GUIDE_TR: Guide = {
  haram: {
    name: "Mescid-i Haram",
    summary: "Kâbe'yi çevreleyen büyük mescit, Mekke'nin kalbi.",
    story:
      "Kâbe, dünyanın en büyük mescidinin ortasında durur. Her yerdeki Müslümanlar namazda ona yönelir. Mescit birçok kez genişletildi. Son genişletme, tarihindeki en büyük genişletmedir.",
    see: ["Kâbe ve Hacerü'l-Esved", "Makam-ı İbrahim", "Safa ile Merve arasındaki Mesa", "Zemzem suyu noktaları"],
    tips: ["Grubunuzla buluşmak için bir kapı numarası belirleyin.", "Üst katlar ve çatı çoğu zaman daha az kalabalıktır.", "Ayakkabılarınız için bir torba getirin."],
  },
  hira: {
    name: "Nur Dağı ve Hira Mağarası",
    summary: "Kur'an'ın ilk ayetlerinin indiği dağ.",
    story:
      "Hz. Muhammed ﷺ, bu dağın tepesine yakın küçük Hira Mağarası'na sık sık gidip tefekkür ederdi. Cebrail ona Kur'an'ın ilk ayetlerini burada, yaklaşık 610 yılında getirdi.",
    see: ["Tepeden Mekke manzarası", "Zirveye yakın küçük mağara", "Dağın eteğindeki Hira Kültür Bölgesi"],
    tips: ["Dik bir tırmanış: sağlıklı bir yetişkin için yukarı yaklaşık bir saat.", "Sabah erkenden veya gün batımından sonra gidin, asla öğle sıcağında değil.", "İyi ayakkabı giyin ve yanınıza su alın."],
  },
  hira_district: {
    name: "Hira Kültür Bölgesi",
    summary: "Nur Dağı'nın eteğinde yeni bir müze ve park.",
    story:
      "2023'te açılan bölge, vahyin hikâyesini sergiler ve filmlerle anlatır. Bahçeleri, kafeleri ve gölgelikleri vardır. Dağı görmeden önce veya sonra uğramak için iyi bir yerdir.",
    see: ["Vahiy Sergisi", "Kur'an Müzesi", "Dağ manzaralı bahçeler"],
    tips: ["Kapalı sergiler sıcak saatler için iyi bir seçimdir.", "Bilet gerekebilir. Gitmeden önce kontrol edin."],
  },
  thawr: {
    name: "Sevr Dağı",
    summary: "Peygamber Efendimiz'in ﷺ Hicret sırasında saklandığı dağ mağarası.",
    story:
      "622 yılında Peygamber Efendimiz ﷺ ve Hz. Ebu Bekir, Mekke'den Medine'ye yola çıktı. Düşmanları onları ararken, bu dağın tepesine yakın bir mağarada üç gün saklandılar.",
    see: ["Aşağıdaki yoldan dağın görünüşü", "Zirveye yakın Sevr Mağarası"],
    tips: ["Uzun ve zor bir tırmanış: yukarı yaklaşık iki saat.", "Sadece sağlığı yerinde olanlar için, sadece serin sabah saatlerinde.", "Ziyaretçilerin çoğu dağı aşağıdan görür."],
  },
  mina: {
    name: "Mina",
    summary: "Hacıların hac sırasında kaldığı beyaz çadırlar vadisi.",
    story:
      "Mina, Mekke ile Müzdelife arasındadır. Hac günlerinde hacılar burada, yanmaz çadırlardan oluşan bir şehirde kalır. Yılın geri kalanında sessizdir ve yoldan geçen ziyaretçilere açıktır.",
    see: ["Beyaz çadırlardan bir deniz", "Hayf Mescidi", "Cemerat köprüsü"],
    tips: ["Hac günlerinde sadece grubunuzla gidin.", "Çadır alanları birbirine benzer. Kamp ve sokak numaranızı not edin."],
  },
  khayf: {
    name: "Hayf Mescidi",
    summary: "Mina'nın büyük mescidi.",
    story:
      "Peygamber Efendimiz ﷺ haccı sırasında Mina'da bu yerde namaz kıldı. Dört minareli bugünkü büyük mescit, hac günlerinde dolar.",
    see: ["Mescit ve minareleri", "Çevresindeki Mina çadırları"],
    tips: ["Hac sırasında çok kalabalıktır. Önce bir buluşma yeri belirleyin."],
  },
  jamarat: {
    name: "Cemerat",
    summary: "Mina'daki üç taş sütunun köprüsü.",
    story:
      "Hacılar hac sırasında, Hz. İbrahim'in örneğine uyarak burada üç sütuna küçük taşlar atar. Büyük kalabalıkları güvenle geçirmek için çok katlı büyük bir köprü yapıldı.",
    see: ["Üç sütun", "Çok katlı köprü ve rampaları"],
    tips: ["Tek yönlü yolları ve grubunuza verilen saati takip edin.", "Kalabalıkta asla durmayın ve yerden bir şey almayın."],
  },
  muzdalifah: {
    name: "Müzdelife",
    summary: "Hacıların Arafat'tan sonra geceyi geçirdiği açık düzlük.",
    story:
      "Arefe gününden sonraki gece hacılar Müzdelife'de gökyüzünün altında dinlenir. Birçoğu Cemerat için taşlarını burada toplar. Meş'ar-i Haram Mescidi bu düzlüktedir.",
    see: ["Meş'ar-i Haram Mescidi", "Arafat ile Mina arasındaki geniş düzlük"],
    tips: ["Hac dışında, bir gezide otobüsten görün.", "Hacda grubunuzla kalın: gece kaybolmak kolaydır."],
  },
  arafat: {
    name: "Arafat ve Nemire Mescidi",
    summary: "Haccın en önemli yeri olan Arafat düzlüğü.",
    story:
      "Zilhicce ayının 9'unda her hacı Arafat'ta vakfeye durur. Hac hutbesi, Peygamber Efendimiz'in ﷺ 632 yılında Veda Hutbesi'ni okuduğu yere yakın olan Nemire Mescidi'nde okunur.",
    see: ["Nemire Mescidi", "Düzlük ve ağaç sıraları", "Rahmet Tepesi"],
    tips: ["Nemire Mescidi'nin bir kısmı Arafat sınırının dışındadır. Tabelalar sınırı gösterir.", "Gölge azdır. Şemsiye ve su getirin."],
  },
  rahmah: {
    name: "Rahmet Tepesi",
    summary: "Arafat düzlüğünde granit bir tepe olan Cebel-i Rahme.",
    story:
      "Peygamber Efendimiz ﷺ tek haccında Arefe günü bu tepenin eteğinde durdu. Tepede beyaz bir sütun vardır.",
    see: ["Zirvedeki beyaz sütun", "Arafat düzlüğünün manzarası"],
    tips: ["Tepeye çıkmak haccın bir parçası değildir.", "Kayalar çok ısınır. Öğle saatlerinden kaçının."],
  },
  mualla: {
    name: "Cennetü'l-Mualla",
    summary: "Mekke'nin eski mezarlığı.",
    story:
      "Peygamber Efendimiz'in ﷺ ailesinden birçok kişi burada yatar. Bunlar arasında ilk eşi Hz. Hatice, dedesi Abdülmuttalib ve amcası Ebu Talib vardır.",
    see: ["Kapısından mezarlık", "Çevresindeki eski mahalle"],
    tips: ["Ziyaret sessiz ve sadedir. Mezarların üzerinde işaret yoktur.", "Açık olduğu saatler sınırlıdır. Gitmeden önce kontrol edin."],
  },
  jinn: {
    name: "Cin Mescidi",
    summary: "Cennetü'l-Mualla yakınında küçük, tarihî bir mescit.",
    story:
      "Rivayete göre, Cin Suresi'nde anlatıldığı gibi, bir grup cin Peygamber Efendimiz'i ﷺ Kur'an okurken burada dinledi.",
    see: ["Mezarlığa kısa bir yürüyüş mesafesindeki mescit"],
    tips: ["Aynı yürüyüşte Cennetü'l-Mualla ile birlikte ziyaret edin."],
  },
  aisha: {
    name: "Hz. Aişe Mescidi (Ten'im)",
    summary: "Harem sınırında, Medine yolundaki mescit.",
    story:
      "Peygamber Efendimiz'in ﷺ eşi Hz. Aişe, 632 yılında umre için burada ihrama girdi. Bugün Mekke'de kalan hacılar yeni bir umreye başlamak için buraya gelir.",
    see: ["Büyük mescit ve abdesthaneleri"],
    tips: ["Gün boyu Harem'den buraya otobüs ve taksi vardır.", "İhram kıyafetlerinizi giymeye hazır getirin."],
  },
  architecture: {
    name: "İki Kutsal Mescit Mimari Sergisi",
    summary: "İki kutsal mescidin eski parçalarının müzesi.",
    story:
      "Kâbe'nin eski kapılarını, Harem'in ahşap sütunlarını ve iki mescidin tarih boyunca maketlerini görün. Sergi, Kisve fabrikasının yanındadır.",
    see: ["Kâbe'nin eski bir kapısı", "Tarihî sütunlar ve kandiller", "İki mescidin maketleri"],
    tips: ["Kapalı ve serin: sıcak saatler için iyidir.", "Kisve fabrikasıyla birlikte ziyaret edin."],
  },
  kiswa: {
    name: "Kisve Fabrikası",
    summary: "Kâbe'nin siyah ipek örtüsünün yapıldığı yer.",
    story:
      "Her yıl Kâbe'nin siyah örtüsü olan yeni Kisve, burada ipekten yapılır. Üzerine altın ve gümüş iplikle ayetler işlenir. Dokumacıları ve nakışçıları çalışırken izleyebilirsiniz.",
    see: ["El ile dokuma ve nakış", "Yakından altın iplikli hat yazısı"],
    tips: ["Ziyaret randevu iledir. Grup başkanınıza sorun.", "Kapalı alan: sıcak saatler için iyidir."],
  },
  nabawi: {
    name: "Mescid-i Nebevi",
    summary: "Peygamber Efendimiz'in ﷺ Medine'de yaptığı ve kabrinin bulunduğu mescit.",
    story:
      "Peygamber Efendimiz ﷺ, Medine'ye gelişinden kısa süre sonra, 622 yılında ilk mescidi burada yaptı. Kabri Yeşil Kubbe'nin altındadır. Bugün mescit çok geniş bir alanı kaplar. Avlularda açılan dev şemsiyeler vardır.",
    see: ["Yeşil Kubbe", "Ravza-i Mutahhara", "Sabah açılan avlu şemsiyeleri"],
    tips: ["Ravza için Nusuk uygulamasından izin almak gerekir.", "Grubunuzla buluşmak için bir kapı numarası belirleyin."],
  },
  quba: {
    name: "Kuba Mescidi",
    summary: "İslam'daki ilk mescit.",
    story:
      "Peygamber Efendimiz ﷺ, 622 yılında Mekke'den geldiğinde bu mescidin ilk taşlarını koydu. Medine'den buraya sık sık yürüyerek veya binekle gelirdi.",
    see: ["Dört minareli beyaz mescit", "Mescid-i Nebevi'den Kuba yolu"],
    tips: ["Mescid-i Nebevi'den gölgeli yol yaklaşık 3 km'dir.", "Öğle vakti değil, serin akşam saatlerinde yürüyün."],
  },
  baqi: {
    name: "Cennetü'l-Baki",
    summary: "Mescid-i Nebevi'nin yanındaki, Medine'nin ana mezarlığı.",
    story:
      "Peygamber Efendimiz'in ﷺ ailesinden ve sahabesinden birçok kişi burada yatar. Bunlar arasında üçüncü halife Hz. Osman bin Affan da vardır.",
    see: ["Mescidin yanındaki girişten mezarlık"],
    tips: ["Genellikle sadece erkekler için, sabah ve ikindi namazlarından sonra belli saatlerde açıktır.", "Mezarlar sadedir, üzerlerinde isim yoktur."],
  },
  uhud: {
    name: "Uhud Dağı ve Şehitlik",
    summary: "Uhud Savaşı'nın yapıldığı dağ.",
    story:
      "625 yılında Medineli Müslümanlar burada Mekke ordusuyla savaştı. Aralarında Peygamber Efendimiz'in ﷺ amcası Hz. Hamza'nın da bulunduğu yetmiş kişi şehit oldu. Dağın eteğinde defnedildiler.",
    see: ["Uhud şehitleri mezarlığı", "Okçular Tepesi (Cebel-i Rumat)", "Seyyidü'ş-Şüheda Mescidi"],
    tips: ["Çoğu açık alandadır. Sabah erkenden gidin.", "Okçular Tepesi kısa ve kolay bir tırmanıştır, manzarası güzeldir."],
  },
  qiblatayn: {
    name: "Kıbleteyn Mescidi",
    summary: "İki Kıbleli Mescit.",
    story:
      "624 yılında burada kılınan bir namaz sırasında kıble Kudüs'ten Mekke'deki Kâbe'ye çevrildi. Bu yüzden iki kıbleli mescit diye anılır.",
    see: ["İkiz kubbeli ve ikiz minareli mescit"],
    tips: ["Mescid-i Nebevi'den arabayla kısa bir mesafe.", "Yaşlı hacılar için kolay bir ziyaret."],
  },
  sabaa: {
    name: "Yedi Mescitler (Hendek)",
    summary: "Hendek Savaşı'nın yapıldığı yer.",
    story:
      "627 yılında Medineliler, şehri büyük bir orduya karşı korumak için burada hendek kazdı. Daha sonra savaşla ilgili yerlere küçük mescitler yapıldı.",
    see: ["Tepedeki Fetih Mescidi", "Büyük Hendek Mescidi", "Küçük eski mescitlerden bazıları"],
    tips: ["Küçük mescitlerin birkaçı kapalıdır. Onları dışarıdan görürsünüz.", "Yakındaki Kıbleteyn Mescidi ile birlikte ziyaret edin."],
  },
  ghamamah: {
    name: "Gamame Mescidi",
    summary: "Mescid-i Nebevi yakınında küçük, tarihî bir mescit.",
    story:
      "Peygamber Efendimiz ﷺ bu yerde bayram namazlarını ve yağmur duası namazını kıldı. Adı \"bulut\" demektir. Bina Osmanlı döneminden kalmadır.",
    see: ["Osmanlı kubbeleri ve taş duvarlar"],
    tips: ["Mescid-i Nebevi'ye birkaç dakika yürüme mesafesinde.", "Çoğu zaman sadece namaz vakitlerine yakın açıktır."],
  },
  jumuah: {
    name: "Cuma Mescidi",
    summary: "İlk cuma namazının kılındığı yer.",
    story:
      "Peygamber Efendimiz ﷺ, 622 yılında Kuba'dan Medine'ye giderken ilk cuma namazını bu yerde kıldırdı.",
    see: ["Mescit ve beyaz kubbesi"],
    tips: ["Kuba ile Mescid-i Nebevi arasındaki yol üzerinde."],
  },
  dar_madinah: {
    name: "Darü'l-Medine Müzesi",
    summary: "Medine'nin tarihini anlatan bir müze.",
    story:
      "Maketler, haritalar ve eski eşyalar, Medine'nin Peygamber Efendimiz ﷺ zamanından bugüne nasıl büyüdüğünü gösterir. İlk mescit ve eski evler de bunlar arasındadır.",
    see: ["Eski Medine'nin büyük bir maketi", "İlk mescidin maketleri", "Eski paralar, aletler ve el yazmaları"],
    tips: ["Kapalı ve serin: sıcak saatler için iyidir.", "Bilet gerekebilir. Gitmeden önce kontrol edin."],
  },
  hejaz_railway: {
    name: "Hicaz Demiryolu Müzesi",
    summary: "Şam'dan Medine'ye giden eski demiryolunun istasyonu.",
    story:
      "Hicaz Demiryolu, hacıları Şam'dan Medine'ye taşımak için 1908'de açıldı. Osmanlı'dan kalma taş istasyon bugün bir müzedir. Dışarıda eski lokomotifler vardır.",
    see: ["Taş istasyon binası", "Eski buharlı lokomotifler ve vagonlar"],
    tips: ["Gitmeden önce açılış saatlerini kontrol edin.", "Aileler için güzel bir durak."],
  },
  seerah: {
    name: "Peygamber Efendimiz'in ﷺ Hayatı Müzesi",
    summary: "Peygamber Efendimiz'in ﷺ hayatını anlatan bir sergi.",
    story:
      "Ekranlar, maketler ve kısa filmler, Peygamber Efendimiz'in ﷺ hayatını ve ahlakını birçok dilde anlatır. Mescid-i Nebevi'ye yakındır.",
    see: ["Birçok dilde etkileşimli salonlar", "Hayatındaki yerlerin maketleri"],
    tips: ["Kapalı ve serin: sıcak saatler için iyidir.", "Yaklaşık bir saat ayırın."],
  },
  quran_complex: {
    name: "Kral Fahd Kur'an Basım Kompleksi",
    summary: "Her yıl milyonlarca Kur'an'ın basıldığı yer.",
    story:
      "1980'lerden beri bu kompleks Kur'an'ı ve birçok dildeki meallerini basar. Nüshalar dünyanın her yerindeki camilere ve hacılara ücretsiz verilir.",
    see: ["Basım ve cilt salonları", "Birçok dilde mealler"],
    tips: ["Ziyaret randevu iledir. Grup başkanınıza sorun.", "Şehrin kuzeyinde, Tebük yolu üzerinde."],
  },
};
