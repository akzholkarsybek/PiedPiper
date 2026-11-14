// Original, procedurally generated illustrated portraits for FICTIONAL demo
// characters. They are not photographs and do not depict real people. Every
// feature is derived deterministically from the profile id, so the same
// fictional person always looks the same and the 180-person population does
// not repeat one face.
import type { CSSProperties } from "react";

type Gender = "woman" | "man" | "nonbinary" | null | undefined;

const SKIN = [
  ["#f6d9c4", "#e7b99c"],
  ["#efc7a5", "#dba886"],
  ["#e2b08a", "#c98f69"],
  ["#d09a72", "#b77c56"],
  ["#b9805a", "#9b6445"],
  ["#9a6444", "#7e4d33"],
  ["#7c4c33", "#643b27"],
  ["#5e3a28", "#4b2c1e"],
] as const;
const HAIR = ["#1d1718", "#2f221c", "#4a3123", "#6b4428", "#8d5f37", "#b58556"];
const GREY = "#a9a39c";
const CLOTHES = [
  ["#7f9471", "#6c8060"], // sage
  ["#c06a52", "#a95843"], // terracotta
  ["#efe5d3", "#ddd0b9"], // cream
  ["#3f4c5c", "#323d4b"], // navy
  ["#d4a24c", "#bc8b38"], // mustard
  ["#7d5a6e", "#684a5c"], // plum
  ["#7d99b3", "#6884a0"], // denim
  ["#e8b9a6", "#d6a08b"], // blush
  ["#5f6f5a", "#4e5d4a"], // olive
] as const;
const SCENES = [
  ["#e9eee2", "#cfdcc4", "#ffffff"], // garden sage
  ["#f6e3d6", "#e9c2ad", "#fff6ee"], // dusk terracotta
  ["#f4ede1", "#e4d6bf", "#ffffff"], // studio cream
  ["#e2ebf0", "#c3d4de", "#ffffff"], // sky
  ["#eee6d0", "#d8c99d", "#fffaf0"], // golden hour
  ["#efe0e6", "#d9bfca", "#fff7fa"], // blush
  ["#e4e8da", "#bfc9ad", "#fbfdf6"], // olive
] as const;

const WOMAN_HAIR = [
  "long",
  "wavy",
  "bob",
  "curly",
  "bun",
  "pixie",
  "long",
  "wavy",
];
const MAN_HAIR = [
  "crop",
  "side",
  "curlyShort",
  "buzz",
  "wavyShort",
  "crop",
  "side",
];
const OPEN_HAIR = [
  "bob",
  "pixie",
  "curlyShort",
  "wavyShort",
  "curly",
  "side",
  "bun",
  "crop",
];

function hash(s: string) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}
/** Independent, stable choices from one id. */
function picker(id: string) {
  let state = hash(id) || 1;
  return (n: number) => {
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    state >>>= 0;
    return state % n;
  };
}
const LEGACY_MEN = [
  "daniel",
  "marcus",
  "theo",
  "oliver",
  "ben",
  "james",
  "sam",
  "jamie",
];

export function portraitTraits(
  id: string,
  gender?: Gender,
  age?: number | null,
) {
  const pick = picker(id);
  const g: Gender =
    gender ??
    (LEGACY_MEN.includes(id) ? "man" : id === "guest" ? null : "woman");
  const skin = SKIN[pick(SKIN.length)];
  const older = (age ?? 30) >= 40 && pick(3) === 0;
  const hairColor = older ? GREY : HAIR[pick(HAIR.length)];
  const styles =
    g === "man" ? MAN_HAIR : g === "woman" ? WOMAN_HAIR : OPEN_HAIR;
  const hair = styles[pick(styles.length)];
  const facial =
    g === "man"
      ? (["none", "stubble", "beard", "none"] as const)[pick(4)]
      : "none";
  return {
    skin,
    hairColor,
    hair,
    facial,
    glasses: pick(5) === 0,
    earrings: g !== "man" && pick(3) !== 0,
    clothes: CLOTHES[pick(CLOTHES.length)],
    top: (["crew", "collar", "knit", "turtleneck", "jacket"] as const)[pick(5)],
    scene: SCENES[pick(SCENES.length)],
    tilt: (pick(7) - 3) * 0.8,
    smile: pick(3),
    brow: pick(3),
  };
}

export function Portrait({
  id = "lena",
  className = "",
  gender,
  age,
  label,
  style,
}: {
  id?: string;
  className?: string;
  gender?: Gender;
  age?: number | null;
  label?: string;
  style?: CSSProperties;
}) {
  const t = portraitTraits(id, gender, age);
  const uid = `p${hash(id).toString(36)}`;
  const [skin, skinShade] = t.skin;
  const [cloth, clothShade] = t.clothes;
  const [bgA, bgB, glow] = t.scene;
  const longBack = ["long", "wavy", "curly", "bob"].includes(t.hair);
  return (
    <svg
      className={`portrait ${className}`}
      viewBox="30 46 340 425"
      preserveAspectRatio="xMidYMid slice"
      role="img"
      aria-label={label ?? "Illustrated portrait of a fictional demo character"}
      style={style}
    >
      <defs>
        <linearGradient id={`${uid}-bg`} x1="0" y1="0" x2="0.6" y2="1">
          <stop offset="0" stopColor={bgA} />
          <stop offset="1" stopColor={bgB} />
        </linearGradient>
        <radialGradient id={`${uid}-glow`} cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stopColor={glow} stopOpacity="0.85" />
          <stop offset="1" stopColor={glow} stopOpacity="0" />
        </radialGradient>
        <radialGradient id={`${uid}-face`} cx="0.38" cy="0.32" r="0.75">
          <stop offset="0" stopColor="#fff" stopOpacity="0.22" />
          <stop offset="0.55" stopColor="#fff" stopOpacity="0" />
          <stop offset="1" stopColor="#000" stopOpacity="0.12" />
        </radialGradient>
        <linearGradient id={`${uid}-cloth`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor={cloth} />
          <stop offset="1" stopColor={clothShade} />
        </linearGradient>
      </defs>
      <rect width="400" height="500" fill={`url(#${uid}-bg)`} />
      <circle cx="320" cy="90" r="120" fill={`url(#${uid}-glow)`} />
      <circle
        cx="60"
        cy="300"
        r="90"
        fill={`url(#${uid}-glow)`}
        opacity="0.6"
      />
      <circle cx="350" cy="330" r="46" fill="#fff" opacity="0.12" />
      <g transform={`rotate(${t.tilt} 200 300)`}>
        {longBack && <HairBack style={t.hair} color={t.hairColor} />}
        {/* shoulders */}
        <path
          d="M18 500 C22 404 96 350 200 344 C304 350 378 404 382 500 Z"
          fill={`url(#${uid}-cloth)`}
        />
        <Top kind={t.top} cloth={cloth} shade={clothShade} skin={skin} />
        {/* neck */}
        <path
          d="M174 268 L172 336 C186 352 214 352 228 336 L226 268 Z"
          fill={skin}
        />
        <path
          d="M174 282 C188 302 212 302 226 282 L227 298 C212 314 188 314 173 298 Z"
          fill={skinShade}
          opacity="0.55"
        />
        {t.top === "turtleneck" && (
          <path
            d="M164 310 C180 302 220 302 236 310 L240 356 C214 366 186 366 160 356 Z"
            fill={clothShade}
          />
        )}
        {/* ears */}
        <ellipse cx="136" cy="214" rx="13" ry="21" fill={skinShade} />
        <ellipse cx="264" cy="214" rx="13" ry="21" fill={skinShade} />
        {t.earrings && (
          <>
            <circle cx="134" cy="238" r="4.5" fill="#e3c27a" />
            <circle cx="266" cy="238" r="4.5" fill="#e3c27a" />
          </>
        )}
        {/* face */}
        <path
          d="M138 196 C138 138 166 120 200 120 C234 120 262 138 262 196 C262 258 234 294 200 294 C166 294 138 258 138 196 Z"
          fill={skin}
        />
        <path
          d="M138 196 C138 138 166 120 200 120 C234 120 262 138 262 196 C262 258 234 294 200 294 C166 294 138 258 138 196 Z"
          fill={`url(#${uid}-face)`}
        />
        <ellipse
          cx="164"
          cy="236"
          rx="15"
          ry="9"
          fill="#e07a6a"
          opacity="0.16"
        />
        <ellipse
          cx="236"
          cy="236"
          rx="15"
          ry="9"
          fill="#e07a6a"
          opacity="0.16"
        />
        <Facial kind={t.facial} color={t.hairColor} />
        {/* brows */}
        <path
          d={
            t.brow === 0
              ? "M158 186 Q172 178 186 184 M214 184 Q228 178 242 186"
              : t.brow === 1
                ? "M158 184 Q172 176 186 182 M214 182 Q228 176 242 184"
                : "M159 187 Q173 181 186 185 M214 185 Q227 181 241 187"
          }
          stroke={t.hairColor === GREY ? "#7c746c" : t.hairColor}
          strokeWidth="5"
          strokeLinecap="round"
          fill="none"
        />
        {/* eyes */}
        <g fill="#2b2220">
          <ellipse cx="172" cy="206" rx="6.5" ry="7.5" />
          <ellipse cx="228" cy="206" rx="6.5" ry="7.5" />
        </g>
        <circle cx="174.5" cy="203.5" r="2" fill="#fff" opacity="0.9" />
        <circle cx="230.5" cy="203.5" r="2" fill="#fff" opacity="0.9" />
        <path
          d="M162 214 Q172 219 182 214 M218 214 Q228 219 238 214"
          stroke={skinShade}
          strokeWidth="2"
          fill="none"
          strokeLinecap="round"
          opacity="0.8"
        />
        {/* nose */}
        <path
          d="M200 212 C197 226 192 236 196 242 C199 245 205 245 208 242"
          stroke={skinShade}
          strokeWidth="3"
          fill="none"
          strokeLinecap="round"
        />
        {/* mouth */}
        {t.smile === 0 ? (
          <>
            <path
              d="M178 258 Q200 280 222 258 Q200 266 178 258 Z"
              fill="#fff"
            />
            <path
              d="M176 257 Q200 284 224 257"
              stroke="#9b4f45"
              strokeWidth="3"
              fill="none"
              strokeLinecap="round"
            />
          </>
        ) : t.smile === 1 ? (
          <path
            d="M180 259 Q200 274 220 259"
            stroke="#9b4f45"
            strokeWidth="4"
            fill="none"
            strokeLinecap="round"
          />
        ) : (
          <>
            <path d="M182 258 Q200 276 218 258 Z" fill="#b65f53" />
            <path d="M184 259 Q200 265 216 259 Z" fill="#fff" opacity="0.9" />
          </>
        )}
        {t.glasses && (
          <g stroke="#3a2f2b" strokeWidth="3.5" fill="#fff" fillOpacity="0.12">
            <rect x="150" y="190" width="42" height="32" rx="12" />
            <rect x="208" y="190" width="42" height="32" rx="12" />
            <path d="M192 204 Q200 198 208 204" fill="none" />
          </g>
        )}
        <HairFront style={t.hair} color={t.hairColor} />
      </g>
    </svg>
  );
}

function Top({
  kind,
  cloth,
  shade,
  skin,
}: {
  kind: string;
  cloth: string;
  shade: string;
  skin: string;
}) {
  if (kind === "crew")
    return <path d="M164 348 C180 372 220 372 236 348 Z" fill={skin} />;
  if (kind === "collar")
    return (
      <>
        <path d="M168 340 C182 378 218 378 232 340 Z" fill={skin} />
        <path d="M166 336 L196 388 L176 400 L150 350 Z" fill={shade} />
        <path d="M234 336 L204 388 L224 400 L250 350 Z" fill={shade} />
      </>
    );
  if (kind === "knit")
    return (
      <>
        <path d="M166 346 C182 368 218 368 234 346 Z" fill={skin} />
        <path
          d="M160 346 C180 378 220 378 240 346"
          stroke={shade}
          strokeWidth="9"
          fill="none"
        />
        <path
          d="M90 418 L100 500 M130 408 L136 500 M270 408 L264 500 M310 418 L300 500"
          stroke={shade}
          strokeWidth="3"
          opacity="0.6"
        />
      </>
    );
  if (kind === "jacket")
    return (
      <>
        <path
          d="M170 344 C186 368 214 368 230 344 L226 500 L174 500 Z"
          fill="#f4efe6"
        />
        <path d="M166 340 L200 500 L120 500 L118 388 Z" fill={shade} />
        <path d="M234 340 L200 500 L280 500 L282 388 Z" fill={shade} />
        <path d="M166 340 L188 424 L170 438 Z" fill={cloth} opacity="0.85" />
        <path d="M234 340 L212 424 L230 438 Z" fill={cloth} opacity="0.85" />
      </>
    );
  return null;
}

function Facial({ kind, color }: { kind: string; color: string }) {
  if (kind === "stubble")
    return (
      <path
        d="M146 236 C150 276 176 296 200 296 C224 296 250 276 254 236 C246 262 226 282 200 282 C174 282 154 262 146 236 Z"
        fill={color}
        opacity="0.22"
      />
    );
  if (kind === "beard")
    return (
      <>
        <path
          d="M142 222 C144 284 176 304 200 304 C224 304 256 284 258 222 C252 250 240 262 226 266 C214 256 186 256 174 266 C160 262 148 250 142 222 Z"
          fill={color}
        />
        <path
          d="M176 252 C188 244 212 244 224 252 C214 250 186 250 176 252 Z"
          fill={color}
        />
      </>
    );
  return null;
}

function HairBack({ style, color }: { style: string; color: string }) {
  if (style === "long")
    return (
      <path
        d="M118 210 C104 120 156 92 202 92 C252 92 298 124 284 214 C278 290 296 352 304 410 C266 428 134 428 96 410 C106 350 124 290 118 210 Z"
        fill={color}
      />
    );
  if (style === "wavy")
    return (
      <path
        d="M116 206 C102 118 156 90 202 90 C254 90 300 120 286 206 C298 250 274 278 296 316 C312 346 290 376 306 408 C260 430 140 430 94 408 C110 378 88 348 104 316 C124 278 100 250 116 206 Z"
        fill={color}
      />
    );
  if (style === "curly")
    return (
      <g fill={color}>
        <circle cx="200" cy="150" r="96" />
        <circle cx="122" cy="214" r="48" />
        <circle cx="278" cy="214" r="48" />
        <circle cx="124" cy="282" r="40" />
        <circle cx="276" cy="282" r="40" />
        <circle cx="140" cy="330" r="30" />
        <circle cx="260" cy="330" r="30" />
      </g>
    );
  if (style === "bob")
    return (
      <path
        d="M122 206 C110 122 158 94 202 94 C250 94 292 122 280 206 C280 252 288 290 292 312 C252 324 148 324 108 312 C114 290 122 252 122 206 Z"
        fill={color}
      />
    );
  return null;
}

function HairFront({ style, color }: { style: string; color: string }) {
  switch (style) {
    case "long":
    case "wavy":
      return (
        <g fill={color}>
          <path d="M134 214 C126 136 164 104 208 106 C176 128 160 160 152 236 C146 232 138 226 134 214 Z" />
          <path d="M200 106 C246 102 276 136 268 214 C264 224 258 232 252 236 C246 178 232 138 200 120 Z" />
          <path d="M150 150 C176 150 214 136 234 112 C214 104 172 102 150 150 Z" />
        </g>
      );
    case "bob":
      return (
        <path
          d="M134 220 C124 134 166 100 202 100 C244 100 280 132 266 220 C262 190 254 168 240 152 C208 160 172 158 152 146 C142 162 136 190 134 220 Z"
          fill={color}
        />
      );
    case "curly":
      return (
        <g fill={color}>
          <circle cx="160" cy="132" r="30" />
          <circle cx="200" cy="120" r="32" />
          <circle cx="240" cy="132" r="30" />
          <circle cx="140" cy="164" r="22" />
          <circle cx="260" cy="164" r="22" />
        </g>
      );
    case "bun":
      return (
        <g fill={color}>
          <circle cx="200" cy="84" r="34" />
          <path d="M136 196 C130 132 166 108 202 108 C240 108 272 132 264 196 C258 162 240 140 200 138 C162 140 144 160 136 196 Z" />
        </g>
      );
    case "pixie":
      return (
        <path
          d="M134 200 C126 128 166 102 206 102 C248 102 276 132 266 196 C258 168 244 152 226 146 C206 166 168 168 146 156 C138 168 136 184 134 200 Z"
          fill={color}
        />
      );
    case "crop":
      return (
        <path
          d="M136 196 C128 132 160 106 202 106 C246 106 274 134 264 196 C258 170 250 152 236 144 C210 156 170 154 150 146 C142 160 138 176 136 196 Z"
          fill={color}
        />
      );
    case "side":
      return (
        <path
          d="M134 198 C124 128 162 100 204 100 C250 100 278 130 266 200 C262 172 256 154 244 146 C220 142 190 148 170 136 C160 150 148 170 134 198 Z M170 136 C186 120 218 116 244 146 C222 132 196 128 170 136 Z"
          fill={color}
        />
      );
    case "curlyShort":
      return (
        <g fill={color}>
          <circle cx="156" cy="146" r="22" />
          <circle cx="182" cy="126" r="24" />
          <circle cx="214" cy="122" r="24" />
          <circle cx="244" cy="142" r="22" />
          <circle cx="142" cy="174" r="15" />
          <circle cx="258" cy="172" r="15" />
        </g>
      );
    case "buzz":
      return (
        <path
          d="M138 186 C134 134 166 112 200 112 C236 112 266 134 262 186 C254 160 232 146 200 146 C168 146 146 160 138 186 Z"
          fill={color}
          opacity="0.82"
        />
      );
    case "wavyShort":
      return (
        <path
          d="M132 204 C118 128 162 98 206 100 C252 102 284 136 268 204 C264 176 256 160 244 152 C234 162 220 150 208 160 C196 148 180 162 168 150 C156 160 140 176 132 204 Z"
          fill={color}
        />
      );
    default:
      return null;
  }
}
