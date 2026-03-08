# Memory Verse

**Memory Verse**, React + Vite + Three.js kullanılarak geliştirilen, tamamen **local-first** çalışan kişisel bir anı uygulamasıdır.  
Uygulama, özel anıları hem klasik bir **zaman çizelgesi (timeline)** görünümünde hem de etkileşimli bir **3B Anı Evreni** içinde sunar.

Bu proje kişisel kullanım amacıyla tasarlanmıştır.  
Herhangi bir kullanıcı sistemi, sunucu veya bulut entegrasyonu içermez. Veriler cihaz üzerinde tutulur.

---

## Özellikler

- Anı ekleme, düzenleme ve silme
- Tarih, başlık, açıklama ve fotoğraf destekli anı yapısı
- Romantik ve estetik tasarıma sahip timeline görünümü
- Three.js ile oluşturulmuş etkileşimli **3B Anı Evreni**
- Fare ile sahne döndürme
- Scroll ile yakınlaşma / uzaklaşma hissi
- Orb seçildiğinde detay paneli açılması
- Fotoğraflı anıların küre içinde “anı çekirdeği” gibi gösterilmesi
- Tamamen local çalışan yapı
- Kişisel ve gizli kullanım odaklı tasarım

---

## Kullanılan Teknolojiler

- **React**
- **Vite**
- **Three.js**
- **CSS**
- **localStorage** (şu anki veri katmanı)

---

## Proje Mantığı

Uygulama iki ana bölümden oluşur:

### 1. Timeline Görünümü
Kullanıcı burada:
- yeni anı ekleyebilir,
- mevcut anıları düzenleyebilir,
- anıları silebilir.

Her anı şu bilgileri içerebilir:
- tarih
- başlık
- açıklama
- fotoğraf

### 2. Anı Evreni
Timeline’daki anılar ayrıca 3B uzay benzeri bir sahnede küreler/orblar halinde gösterilir.

Bu bölümde:
- her anı bir orb ile temsil edilir,
- fotoğraflı anılar özel görsel küre yapısıyla sunulur,
- sahne sürüklenebilir,
- orb’lara tıklanabilir,
- seçilen orb için detay paneli açılır.

---

## Gizlilik Yaklaşımı

Bu proje özellikle **kişisel kullanım** için geliştirildiği için gizlilik ön planda tutulmuştur.

- Kullanıcı sistemi yoktur
- Sunucu bağlantısı yoktur
- Veriler herhangi bir bulut servisine gönderilmez
- Anılar cihaz üzerinde tutulur
- Uygulama local-first mantıkla çalışır

> Not: Şu an veri saklama için `localStorage` kullanılmaktadır.  
> İlerleyen aşamalarda daha gelişmiş ve güvenli local veri yönetimi için `IndexedDB` planlanmaktadır.

---

## Klasör Yapısı

```bash
memory-verse/
├─ public/
├─ src/
│  ├─ components/
│  │  ├─ universe/
│  │  │  └─ SpaceScene.jsx
│  │  ├─ EmptyState.jsx
│  │  ├─ FloatingHearts.jsx
│  │  ├─ Header.jsx
│  │  ├─ MemoryCard.jsx
│  │  ├─ MemoryModal.jsx
│  │  └─ Timeline.jsx
│  ├─ data/
│  │  └─ memoryStorage.js
│  ├─ styles/
│  │  └─ main.css
│  ├─ universe/
│  │  ├─ controls.js
│  │  ├─ orbs.js
│  │  ├─ particles.js
│  │  └─ scene.js
│  ├─ App.jsx
│  └─ main.jsx
├─ index.html
├─ package.json
├─ vite.config.js
└─ README.md