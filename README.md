<div align="center">

<br/>

```
███╗   ███╗███████╗███╗   ███╗ ██████╗ ██████╗ ██╗   ██╗
████╗ ████║██╔════╝████╗ ████║██╔═══██╗██╔══██╗╚██╗ ██╔╝
██╔████╔██║█████╗  ██╔████╔██║██║   ██║██████╔╝ ╚████╔╝ 
██║╚██╔╝██║██╔══╝  ██║╚██╔╝██║██║   ██║██╔══██╗  ╚██╔╝  
██║ ╚═╝ ██║███████╗██║ ╚═╝ ██║╚██████╔╝██║  ██║   ██║   
╚═╝     ╚═╝╚══════╝╚═╝     ╚═╝ ╚═════╝ ╚═╝  ╚═╝   ╚═╝   
                                                          
            ✦  V E R S E  ✦
```

<br/>

**Anıların, sonsuz uzayda parlayan küreler olduğu yer.**

<br/>

![React](https://img.shields.io/badge/React-20232A?style=for-the-badge&logo=react&logoColor=61DAFB)
![Vite](https://img.shields.io/badge/Vite-646CFF?style=for-the-badge&logo=vite&logoColor=white)
![Three.js](https://img.shields.io/badge/Three.js-000000?style=for-the-badge&logo=three.js&logoColor=white)
![License](https://img.shields.io/badge/License-Apache_2.0-ff758c?style=for-the-badge)
![Privacy](https://img.shields.io/badge/Privacy-Local_First-6ee7b7?style=for-the-badge&logo=lock&logoColor=white)

<br/>

</div>

---

<br/>

## ✦ Nedir Bu?

**Memory Verse**, anılarını zaman çizelgesinde yaşatan ve onları **etkileşimli bir 3B uzay sahnesinde** küre olarak sunan, tamamen **yerel çalışan** bir kişisel anı uygulamasıdır.

Her anı, uzayda kendi renginde parlayan bir orb olur. Fotoğraflı anılar ise renkli cam kürelerin içinde — sanki uzayın derinliklerine hapsedilmiş bir an gibi — dönerek yüzer.

> *Seninle geçen her saniye bir sanat eseri.*

<br/>

---

<br/>

## 🌌 Özellikler

<br/>

### 📖 Timeline — Zaman Çizelgesi
Anılarını kronolojik sırayla, romantik bir tasarımla görüntüle.

- ✦ Anı ekleme, düzenleme ve silme
- ✦ Tarih · Başlık · Açıklama · Fotoğraf desteği
- ✦ Fotoğrafa tıklayınca tam ekran zoom
- ✦ Özel tasarımlı silme onay modalı
- ✦ Yüzen kalpler animasyonu

<br/>

### 🔮 Anı Evreni — 3B Uzay Sahnesi
Anıların Three.js ile oluşturulmuş etkileşimli bir evrende yaşar.

- ✦ Her anı kendine özgü renkte parlayan bir **orb**
- ✦ Fotoğraflı anılar **renkli cam kürenin içinde** — dönen, canlı
- ✦ Orb renginin fotoğrafa hafif **cam tinti** yansıması
- ✦ Animasyonlu **Fresnel cam efekti** + dönen ışık bantları
- ✦ İç yüzeyde **dönen renkli halka** yansımaları
- ✦ Fare ile **sürükleme** — sahneyi her yöne döndür
- ✦ Scroll ile **zoom** — evrene yaklaş, uzaklaş
- ✦ Orb'a **tıklayınca** detay paneli açılır
- ✦ **Nebula** bulutları — her açılışta farklı renk
- ✦ 9000+ **yıldız** — titreşen, renkli
- ✦ Zaman zaman **kayan yıldızlar**

<br/>

### 🔒 Gizlilik — Local First
Veriler hiçbir zaman cihazını terk etmez.

- ✦ Sunucu yok · İnternet bağlantısı gerekmez
- ✦ Bulut yok · Kullanıcı sistemi yok
- ✦ Tüm veriler **IndexedDB**'de yerel olarak saklanır
- ✦ Fotoğraflar kaydedilmeden önce **otomatik sıkıştırılır**
- ✦ Eski `localStorage` verileri **otomatik taşınır**

<br/>

---

<br/>

## 🛠 Teknolojiler

<br/>

| Katman | Teknoloji |
|--------|-----------|
| **Arayüz** | React 18 + Vite |
| **3B Evren** | Three.js (WebGL) |
| **Shader'lar** | GLSL — özel Fresnel, dalga, halka efektleri |
| **Veri** | IndexedDB (local-first) |
| **Stil** | Saf CSS — glassmorphism, gradient, animasyon |
| **Fotoğraf** | Canvas API — sıkıştırma + oval maske |

<br/>

---

<br/>

## 🚀 Kurulum

```bash
# Repoyu klonla
git clone https://github.com/AhmetSOGUT/Memory-Verse.git
cd Memory-Verse

# Bağımlılıkları yükle
npm install

# Geliştirme sunucusunu başlat
npm run dev
```

Tarayıcında `http://localhost:5173` adresini aç — evren seni bekliyor.

```bash
# Production build
npm run build
```

<br/>

---

<br/>

## 📁 Proje Yapısı

```
memory-verse/
├── src/
│   ├── components/
│   │   ├── universe/
│   │   │   └── SpaceScene.jsx       # 3B sahne React bileşeni
│   │   ├── ConfirmModal.jsx         # Silme onay modalı
│   │   ├── EmptyState.jsx           # Boş durum ekranı
│   │   ├── FloatingHearts.jsx       # Yüzen kalpler
│   │   ├── Header.jsx               # Başlık
│   │   ├── MemoryCard.jsx           # Anı kartı + zoom
│   │   ├── MemoryModal.jsx          # Anı ekleme/düzenleme
│   │   └── Timeline.jsx             # Zaman çizelgesi
│   ├── data/
│   │   └── memoryStorage.js         # IndexedDB + sıkıştırma
│   ├── styles/
│   │   └── main.css                 # Global stiller
│   ├── universe/
│   │   ├── controls.js              # Kamera kontrolleri (class)
│   │   ├── orbs.js                  # Orb oluşturma + shader'lar
│   │   ├── particles.js             # Yıldızlar, nebula, kayan yıldız
│   │   └── scene.js                 # Three.js sahne yöneticisi
│   ├── App.jsx
│   └── main.jsx
├── index.html
├── package.json
└── vite.config.js
```

<br/>

---

<br/>

## 🔮 Kullanım

**Anı eklemek için** — sağ alttaki `+` butonuna tıkla
**Anı Evreni'ni açmak için** — sol alttaki `🌌` butonuna tıkla
**Evrende gezinmek için** — sürükle · kaydır · kürelere tıkla

<br/>

---

<br/>

## 🗺 Yol Haritası

- [ ] IndexedDB → daha güvenli yerel şifreleme
- [ ] Anı kategorileri ve etiketler
- [ ] Arama ve filtreleme
- [ ] Anı sayısına göre evren yoğunluğu
- [ ] Dışa/içe aktarma (JSON backup)
- [ ] PWA desteği — tam offline uygulama

<br/>

---

<br/>

<div align="center">

**Apache 2.0 Lisansı** · Kişisel kullanım için geliştirildi

<br/>

*Her anın, sonsuz uzayda parlayan bir küredir.* ✦

<br/>

</div>