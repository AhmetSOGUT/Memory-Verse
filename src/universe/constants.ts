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
export const NEBULA = { intensity: 0.5 } as const;
/** Kameranın yavaş süzülmesi: genlik (birim) ve hız çarpanı. 0 genlik = sabit kamera. */
export const DRIFT = { amplitude: 6, speed: 1 } as const;