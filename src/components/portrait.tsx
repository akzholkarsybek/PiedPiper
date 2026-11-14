// Original vector character illustrations; these do not depict real people.
export function Portrait({
  id = "lena",
  className = "",
}: {
  id?: string;
  className?: string;
}) {
  const n = [...id].reduce((v, c) => v + c.charCodeAt(0), 0),
    variant = n % 5;
  const palettes = [
    ["#e7b9a0", "#a65543", "#442c30", "#f8e9d9"],
    ["#d5dfce", "#a46747", "#242c32", "#f7eedb"],
    ["#dcd2e8", "#d69d79", "#57352c", "#744b62"],
    ["#eaceab", "#754b38", "#241e22", "#e1d2ab"],
    ["#c8dcd9", "#dcae8f", "#6b493a", "#497472"],
  ];
  const [bg, skin, hair, shirt] = palettes[variant];
  const short = [
    "daniel",
    "marcus",
    "theo",
    "oliver",
    "ben",
    "james",
    "sam",
    "jamie",
  ].includes(id);
  return (
    <svg
      className={`portrait ${className}`}
      viewBox="0 0 320 360"
      role="img"
      aria-label="Illustration of a fictional demo character"
    >
      <rect width="320" height="360" fill={bg} />
      <circle cx="262" cy="75" r="74" fill="#fff" opacity=".16" />
      <path d="M0 275c90-63 161 69 320-13v98H0" fill="#fff" opacity=".12" />
      <path d="M60 360c0-88 33-116 101-116s103 41 103 116" fill={shirt} />
      {!short && (
        <path
          d="M94 252c-25-53-36-145 9-180s124-14 130 37c6 57-3 117 15 152-56 38-107 39-154-9"
          fill={hair}
        />
      )}
      <path d="M138 219v42q22 25 46 0v-42" fill={skin} />
      <path d="M138 226q27 25 46-2v15q-25 25-46-2" fill="#000" opacity=".08" />
      <ellipse cx="159" cy="159" rx="61" ry="80" fill={skin} />
      <ellipse cx="100" cy="165" rx="9" ry="15" fill={skin} />
      <ellipse cx="218" cy="165" rx="9" ry="15" fill={skin} />
      <path
        d={
          short
            ? "M98 156c-23-62 6-94 58-94 60 0 85 47 61 95l-9-42c-39 12-60-20-85-2z"
            : "M95 171c-24-83 14-111 68-109 59 3 81 61 55 112l-12-48c-30-6-53-21-60-35-9 27-28 35-39 41z"
        }
        fill={hair}
      />
      <path
        d="M119 151q12-7 23-1m35 0q12-7 23 1"
        stroke={hair}
        strokeWidth="4"
        fill="none"
        strokeLinecap="round"
      />
      <ellipse cx="133" cy="163" rx="3" ry="4" fill="#30292a" />
      <ellipse cx="188" cy="163" rx="3" ry="4" fill="#30292a" />
      <path
        d="M160 164l-5 22h10"
        stroke="#714334"
        opacity=".35"
        fill="none"
        strokeWidth="2.5"
        strokeLinecap="round"
      />
      <path d="M141 200q19 17 38-1" fill="#fff" />
      <path
        d="M139 200q20 20 41-1"
        stroke="#975e50"
        strokeWidth="2"
        fill="none"
      />
      {!short && (
        <>
          <circle cx="103" cy="185" r="5" fill="#ead297" />
          <circle cx="217" cy="185" r="5" fill="#ead297" />
        </>
      )}
      <path
        d="M133 260l-18 26 43 32 45-32-17-26"
        stroke="#000"
        opacity=".1"
        strokeWidth="2"
        fill="none"
      />
      <path
        d="M76 327l18 33m143-33-13 33"
        stroke="#000"
        opacity=".1"
        strokeWidth="2"
      />
    </svg>
  );
}
