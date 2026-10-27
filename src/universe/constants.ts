/** Anı kürelerinin sırayla kullanılan renkleri. */
export const ORB_COLORS = [
  "#fff59d", "#ffab91", "#81d4fa", "#ce93d8",
  "#a5d6a7", "#ffcc80", "#f9a8d4", "#6ee7b7",
  "#80cbc4", "#ef9a9a", "#b39ddb", "#80deea",
] as const;

export const SPHERE_RADIUS = 8;
export const BACKGROUND_COLOR = 0x010816;
export const STAR_COUNT = 14000;

/** Seçili küre kameranın baktığı yönde bu mesafeye gelir. */
export const FOCUS_DISTANCE = 45;
export const FOV_MIN = 35;
export const FOV_MAX = 95;
export const FOV_DEFAULT = 65;


/** Bloom (parlama) ayarları — görünümü buradan ince ayar yapabilirsin. */
export const BLOOM = {
  /** Bu parlaklığın altındaki pikseller parlamaz. Düşürürsen her şey parlar. */
  threshold: 0.55,
  /** Eşik etrafında yumuşak geçiş. */
  smoothing: 0.35,
  /** Parlamanın gücü. Çok parlak gelirse 0.5'e indir. */
  intensity: 0.9,
  /** Parlamanın yayılma mesafesi (0-1). */
  radius: 0.75,
    /** Bulanıklık seviyesi sayısı. Düşük = daha hızlı. */
  levels: 5,
} as const;

export const VIGNETTE = { offset: 0.35, darkness: 0.55 } as const;


/** Dış sarı halenin gücü. 0 = yok, 1 = eski yoğunluk. */
export const GLOW_STRENGTH = 0.01;
/** Cam kabuğun kenar parlaklığı çarpanı. */
export const GLASS_STRENGTH = 0.3;
/** Cam yüzeyin kendisindeki hafif parlaklık (0 = sadece kenar). */
export const GLASS_SHEEN = 0.07;



/** Uzay ortamı ayarları. */
/** Samanyolu bandının düzlem normali (bandın yönünü belirler). */
export const MILKY_WAY_NORMAL: [number, number, number] = [0.3, 0.9, 0.2];
/** Yıldızların kaçta kaçı Samanyolu bandında yoğunlaşsın (0-1). */
export const MILKY_WAY_STAR_SHARE = 0.4;
/** Nebula bulutlarının parlaklığı. 0 = yok. Çok parlak gelirse 0.3'e indir. */
export const NEBULA = { intensity: 0.5, bakeWidth: 2048 } as const;
/** Kameranın yavaş süzülmesi: genlik (birim) ve hız çarpanı. 0 genlik = sabit kamera. */
export const DRIFT = { amplitude: 6, speed: 1 } as const;



/** Performans ayarları. */
/** Fotoğraf dokusunun kenar uzunluğu (px). Küçük = az GPU belleği. */
export const PHOTO_TEXTURE_SIZE = 384;
/** Küre ağı çözünürlüğü. Tüm küreler aynı geometriyi paylaşır. */
export const SPHERE_SEGMENTS = { body: 48, glow: 32 } as const;
/**
 * Otomatik kalite kademeleri (düşükten yükseğe). FPS düşerse sırayla bir alta iner.
 * dpr = çizim çözünürlüğü çarpanı (cihaz oranıyla sınırlanır).
 */
export const QUALITY_TIERS = [
  { dpr: 0.75, bloom: false },
  { dpr: 1, bloom: false },
  { dpr: 1, bloom: true },
  { dpr: 1.5, bloom: true },
] as const;
export const QUALITY = {
  /** Açılıştaki shader derleme takılmasını saymamak için bekleme (sn). */
  warmupSeconds: 2,
  /** FPS bu süre boyunca ortalanır (sn). */
  sampleSeconds: 2,
  /** Bunun altı "yavaş" sayılır. */
  lowFps: 45,
  /** Art arda kaç yavaş ölçüm bir kademe düşürür. */
  badWindows: 2,
  /** true: konsola FPS ve kademe yazar. */
  debug: false,
} as const;


/** Kayan yıldızlar (meteorlar). Aralıklar [en az, en çok]. */
export const METEORS = {
  /** Aynı anda ekranda en fazla kaç tane olabilir. */
  max: 3,
  /** İki kayan yıldız arası bekleme (sn). */
  gap: [4, 12],
  /** Kameradan uzaklık (birim). */
  distance: [190, 260],
  /** Hız (birim/sn). */
  speed: [120, 200],
  /** Yaşam süresi (sn). */
  duration: [0.8, 1.4],
  /** Kuyruk uzunluğu (birim). */
  length: [45, 85],
  /** Çizginin yarı kalınlığı (birim). */
  width: [0.35, 0.6],
  /** İlk kayan yıldız en erken kaç saniye sonra çıksın. */
  firstDelay: 2.5,
} as const;