// Map FIFA 3-letter codes to ISO 3166-1 alpha-2 for flagcdn images.
const FIFA_TO_ISO2: Record<string, string> = {
  AFG:"af",ALB:"al",ALG:"dz",AND:"ad",ANG:"ao",ARG:"ar",ARM:"am",AUS:"au",AUT:"at",AZE:"az",
  BAN:"bd",BEL:"be",BEN:"bj",BFA:"bf",BHR:"bh",BIH:"ba",BLR:"by",BOL:"bo",BOT:"bw",BRA:"br",
  BUL:"bg",BUR:"bi",CAM:"kh",CAN:"ca",CGO:"cg",CHA:"td",CHI:"cl",CHN:"cn",CIV:"ci",CMR:"cm",
  COD:"cd",COL:"co",COM:"km",CPV:"cv",CRC:"cr",CRO:"hr",CUB:"cu",CUW:"cw",CYP:"cy",CZE:"cz",
  DEN:"dk",DJI:"dj",DOM:"do",ECU:"ec",EGY:"eg",ENG:"gb-eng",EQG:"gq",ERI:"er",ESP:"es",EST:"ee",
  ETH:"et",FIJ:"fj",FIN:"fi",FRA:"fr",FRO:"fo",GAB:"ga",GAM:"gm",GEO:"ge",GER:"de",GHA:"gh",
  GIB:"gi",GNB:"gw",GRE:"gr",GRN:"gd",GUA:"gt",GUI:"gn",GUY:"gy",HAI:"ht",HKG:"hk",HON:"hn",
  HUN:"hu",IDN:"id",IND:"in",IRL:"ie",IRN:"ir",IRQ:"iq",ISL:"is",ISR:"il",ITA:"it",JAM:"jm",
  JOR:"jo",JPN:"jp",KAZ:"kz",KEN:"ke",KGZ:"kg",KOR:"kr",KOS:"xk",KSA:"sa",KUW:"kw",LAO:"la",
  LAT:"lv",LBN:"lb",LBR:"lr",LBY:"ly",LES:"ls",LIE:"li",LTU:"lt",LUX:"lu",MAD:"mg",MAR:"ma",
  MAS:"my",MDA:"md",MDV:"mv",MEX:"mx",MKD:"mk",MLI:"ml",MLT:"mt",MNE:"me",MNG:"mn",MOZ:"mz",
  MRI:"mu",MTN:"mr",MWI:"mw",MYA:"mm",NAM:"na",NCA:"ni",NED:"nl",NEP:"np",NGA:"ng",NIG:"ne",
  NIR:"gb-nir",NOR:"no",NZL:"nz",OMA:"om",PAK:"pk",PAN:"pa",PAR:"py",PER:"pe",PHI:"ph",PLE:"ps",
  POL:"pl",POR:"pt",PRK:"kp",PUR:"pr",QAT:"qa",ROU:"ro",RSA:"za",RUS:"ru",RWA:"rw",SCO:"gb-sct",
  SDN:"sd",SEN:"sn",SEY:"sc",SIN:"sg",SLE:"sl",SLV:"sv",SMR:"sm",SOL:"sb",SOM:"so",SRB:"rs",
  SRI:"lk",SSD:"ss",STP:"st",SUI:"ch",SUR:"sr",SVK:"sk",SVN:"si",SWE:"se",SWZ:"sz",SYR:"sy",
  TAH:"pf",TAN:"tz",TGA:"to",THA:"th",TJK:"tj",TKM:"tm",TLS:"tl",TOG:"tg",TPE:"tw",TRI:"tt",
  TUN:"tn",TUR:"tr",UAE:"ae",UGA:"ug",UKR:"ua",URU:"uy",USA:"us",UZB:"uz",VAN:"vu",VEN:"ve",
  VIE:"vn",WAL:"gb-wls",YEM:"ye",ZAM:"zm",ZIM:"zw",
};

export function flagUrl(code?: string | null, size: 40 | 80 | 160 | 320 = 80): string | null {
  if (!code) return null;
  const iso = FIFA_TO_ISO2[code.toUpperCase()];
  if (!iso) return null;
  return `https://flagcdn.com/w${size}/${iso}.png`;
}

const DHAKA = "Asia/Dhaka";
export function bdTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("en-US", {
    timeZone: DHAKA, hour: "numeric", minute: "2-digit", hour12: true,
  });
}
export function bdDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    timeZone: DHAKA, weekday: "long", day: "numeric", month: "long", year: "numeric",
  });
}
export function bdShortDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    timeZone: DHAKA, day: "numeric", month: "short",
  });
}
