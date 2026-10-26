// GLSL kaynakları. Görsel kimliği belirleyen kısım burası — değişiklik yaparken dikkat.

/** Fotoğraf küresi: normal.xy düzlemsel projeksiyon + dönen iç halkalar. */
export const innerVertex = /* glsl */ `
  varying vec3 vNormal;
  void main() {
    // BackSide'da normal otomatik ters döner, biz orijinalini istiyoruz
    vNormal     = normalize(normal);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

export const innerFragment = /* glsl */ `
  uniform sampler2D uTex;
  uniform vec3      uColor;
  uniform float     uTime;
  varying vec3      vNormal;

  void main() {
    vec3 n = normalize(vNormal);
    vec2 uv = n.xy * 0.5 + 0.5;

    float wave = sin(uv.x * 6.0 + uTime * 0.7) * 0.007
               + cos(uv.y * 5.0 + uTime * 0.5) * 0.005;
    uv += wave;
    uv = clamp(uv, 0.0, 1.0);

    vec4 photo = texture2D(uTex, uv);

    float dist = length(n.xy);
    float vig  = 1.0 - smoothstep(0.92, 1.0, dist);

    float innerAngle = atan(n.y, n.x) + uTime * 0.5;
    float ring1 = exp(-pow(dist - 0.7, 2.0) * 40.0)
                * (0.5 + 0.5 * sin(innerAngle * 3.0 + uTime * 1.2));
    float ring2 = exp(-pow(dist - 0.85, 2.0) * 60.0)
                * (0.5 + 0.5 * cos(innerAngle * 2.0 - uTime * 0.8));

    vec3 ringCol = uColor * ring1 * 0.45 + uColor * ring2 * 0.28;

    float edge    = smoothstep(0.75, 1.0, dist);
    vec3  edgeCol = uColor * edge * 0.28;

    vec3 tinted = mix(photo.rgb, uColor, 0.09);
    vec3 col    = tinted * vig + ringCol + edgeCol;

    gl_FragColor = vec4(col, vig * 0.98 + 0.02);
  }
`;

/** Cam kabuk: katmanlı Fresnel kenar + atmosfer + halo. */
export const glassVertex = /* glsl */ `
  varying vec3 vNormal;
  varying vec3 vPos;
  varying vec3 vLocalPos;
  void main() {
    vNormal   = normalize(normalMatrix * normal);
    vPos      = (modelMatrix * vec4(position, 1.0)).xyz;
    vLocalPos = position;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

export const glassFragment = /* glsl */ `
  uniform vec3  uColor;
  uniform float uTime;
  varying vec3  vNormal;
  varying vec3  vPos;
  varying vec3  vLocalPos;

  void main() {
    vec3  view  = normalize(cameraPosition - vPos);
    float ndotv = abs(dot(vNormal, view));

    float rim1 = pow(1.0 - ndotv, 5.5);
    float rim2 = pow(1.0 - ndotv, 2.2) * 0.35;
    float halo = pow(1.0 - ndotv, 1.1) * 0.12;

    float angle = atan(vLocalPos.z, vLocalPos.x) + uTime * 0.35;
    float vein  = smoothstep(0.92, 1.0, sin(angle * 2.0)) * rim1 * 0.4;

    float pulse   = 0.5 + 0.5 * sin(uTime * 0.9);
    float breathe = pulse * rim1 * 0.12;

    vec3 rimCol  = uColor * (rim1 + vein + breathe);
    vec3 atmCol  = mix(uColor, uColor * 0.6, 0.4) * rim2;
    vec3 haloCol = uColor * 0.3 * halo;

    vec3  col   = rimCol + atmCol + haloCol;
    float alpha = clamp(rim1 * 0.85 + rim2 * 0.5 + halo * 0.3 + vein * 0.3, 0.0, 1.0);

    gl_FragColor = vec4(col, alpha);
  }
`;

/** Dış glow: gürültü tabanlı, nefes alan atmosfer. */
export const glowVertex = /* glsl */ `
  varying vec3 vNormal;
  varying vec3 vPos;
  varying vec3 vLocal;
  void main() {
    vNormal = normalize(normalMatrix * normal);
    vPos    = (modelMatrix * vec4(position,1.0)).xyz;
    vLocal  = position;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0);
  }
`;

export const glowFragment = /* glsl */ `
  uniform vec3  uColor;
  uniform float uTime;
  varying vec3  vNormal;
  varying vec3  vPos;
  varying vec3  vLocal;

  float hash(vec2 p){ return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453); }
  float noise(vec2 p){
    vec2 i=floor(p), f=fract(p);
    f=f*f*(3.0-2.0*f);
    return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),
               mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),f.x),f.y);
  }

  void main(){
    vec3  view    = normalize(cameraPosition - vPos);
    float fresnel = pow(1.0 - abs(dot(vNormal, view)), 2.2);

    float theta = atan(vLocal.z, vLocal.x);
    float phi   = atan(vLocal.y, length(vLocal.xz));
    vec2  uv    = vec2(theta*0.8 + uTime*0.12, phi*1.2 + uTime*0.08);

    float n1       = noise(uv * 2.5);
    float n2       = noise(uv * 5.0 + 1.3);
    float distort  = 0.55 + 0.45*(n1*0.7 + n2*0.3);
    float breath   = 0.75 + 0.25*sin(uTime*0.9 + n1*2.0);
    float topLight = 0.7  + 0.3*smoothstep(-1.0,1.0, vLocal.y/11.0);
    float sparkle  = pow(max(0.0, noise(uv*12.0 + uTime*0.3)-0.72),2.0)*3.5;

    float alpha = fresnel*distort*breath*topLight*0.38 + sparkle*fresnel*0.15;
    alpha = clamp(alpha, 0.0, 1.0);

    vec3 warm = uColor*1.4 + vec3(0.08,0.04,0.0);
    vec3 cool = uColor*0.7 + vec3(0.0,0.05,0.12);
    vec3 col  = mix(warm, cool, fresnel*0.4) + sparkle*vec3(0.3,0.3,0.4);

    gl_FragColor = vec4(col, alpha);
  }
`;

/** Yıldızlar: boyut + renk özniteliği, sinüs titreşimi. */
export const starVertex = /* glsl */ `
  attribute float size;
  attribute vec3  aColor;
  varying   vec3  vColor;
  uniform   float time;

  void main() {
    vColor = aColor;
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    float flicker = 1.0 + 0.12 * sin(time * 2.0 + position.x * 2.7 + position.y * 1.9);
    gl_PointSize = size * flicker * (220.0 / -mv.z);
    gl_Position  = projectionMatrix * mv;
  }
`;

export const starFragment = /* glsl */ `
  uniform sampler2D pointTex;
  varying vec3 vColor;

  void main() {
    vec4 tex = texture2D(pointTex, gl_PointCoord);
    if (tex.a < 0.01) discard;
    float glow = exp(-length(gl_PointCoord - vec2(0.5)) * 7.0);
    gl_FragColor = vec4(vColor + glow * 0.35, tex.a * (0.65 + glow * 0.35));
  }
`;
