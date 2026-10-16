"""Nome do pais (Transfermarkt ou Wikipedia, em ingles) -> codigo da bandeira
(ISO 3166-1 alfa-2 minusculo; Inglaterra/Escocia/Gales/Irlanda do Norte em gb-xxx,
como no pacote flag-icons). Pais fora da lista: None, e o gerador para."""

PAISES = {
    "Afghanistan": "af", "Albania": "al", "Algeria": "dz", "Andorra": "ad", "Angola": "ao", "Antigua and Barbuda": "ag",
    "Argentina": "ar", "Armenia": "am", "Aruba": "aw", "Australia": "au", "Austria": "at", "Azerbaijan": "az", "Bahrain": "bh",
    "Bangladesh": "bd", "Barbados": "bb", "Belarus": "by", "Belgium": "be", "Belize": "bz", "Benin": "bj", "Bermuda": "bm",
    "Bhutan": "bt", "Bolivia": "bo", "Bonaire": "bq", "Bosnia-Herzegovina": "ba", "Bosnia and Herzegovina": "ba", "Botswana": "bw",
    "Brazil": "br", "Brunei Darussalam": "bn", "Bulgaria": "bg", "Burkina Faso": "bf", "Burundi": "bi", "Cambodia": "kh",
    "Cameroon": "cm", "Canada": "ca", "Cape Verde": "cv", "Central African Republic": "cf", "Chad": "td", "Chile": "cl",
    "China": "cn", "Chinese Taipei": "tw", "Colombia": "co", "Comoros": "km", "Congo": "cg", "Costa Rica": "cr",
    "Cote d'Ivoire": "ci", "Ivory Coast": "ci", "Croatia": "hr", "Cuba": "cu", "Curacao": "cw", "Curaçao": "cw", "Cyprus": "cy",
    "Czech Republic": "cz", "Czechia": "cz", "DR Congo": "cd", "Denmark": "dk", "Dominican Republic": "do", "Ecuador": "ec",
    "Egypt": "eg", "El Salvador": "sv", "England": "gb-eng", "Equatorial Guinea": "gq", "Eritrea": "er", "Estonia": "ee",
    "Ethiopia": "et", "Faroe Islands": "fo", "Fiji": "fj", "Finland": "fi", "France": "fr", "French Guiana": "gf", "Gabon": "ga",
    "Georgia": "ge", "Germany": "de", "Ghana": "gh", "Gibraltar": "gi", "Greece": "gr", "Grenada": "gd", "Guadeloupe": "gp",
    "Guatemala": "gt", "Guinea": "gn", "Guinea-Bissau": "gw", "Guyana": "gy", "Haiti": "ht", "Honduras": "hn", "Hongkong": "hk",
    "Hungary": "hu", "Iceland": "is", "India": "in", "Indonesia": "id", "Iran": "ir", "Iraq": "iq", "Ireland": "ie",
    "Republic of Ireland": "ie", "Israel": "il", "Italy": "it", "Jamaica": "jm", "Japan": "jp", "Jordan": "jo", "Kazakhstan": "kz",
    "Kenya": "ke", "Korea, North": "kp", "Korea, South": "kr", "South Korea": "kr", "Kosovo": "xk", "Kyrgyzstan": "kg", "Laos": "la",
    "Latvia": "lv", "Lebanon": "lb", "Liberia": "lr", "Libya": "ly", "Liechtenstein": "li", "Lithuania": "lt", "Luxembourg": "lu",
    "Macao": "mo", "Madagascar": "mg", "Malawi": "mw", "Malaysia": "my", "Maldives": "mv", "Mali": "ml", "Malta": "mt",
    "Martinique": "mq", "Mauritania": "mr", "Mauritius": "mu", "Mexico": "mx", "Moldova": "md", "Monaco": "mc", "Mongolia": "mn",
    "Montenegro": "me", "Montserrat": "ms", "Morocco": "ma", "Mozambique": "mz", "Myanmar": "mm", "Netherlands": "nl",
    "Neukaledonien": "nc", "New Caledonia": "nc", "New Zealand": "nz", "Nicaragua": "ni", "Niger": "ne", "Nigeria": "ng",
    "North Macedonia": "mk", "Northern Ireland": "gb-nir", "Norway": "no", "Oman": "om", "Pakistan": "pk", "Palestine": "ps",
    "Panama": "pa", "Papua New Guinea": "pg", "Paraguay": "py", "Peru": "pe", "Philippines": "ph", "Poland": "pl", "Portugal": "pt",
    "Puerto Rico": "pr", "Qatar": "qa", "Romania": "ro", "Russia": "ru", "Rwanda": "rw", "Réunion": "re", "Saint-Martin": "mf",
    "San Marino": "sm", "Sao Tome and Principe": "st", "Saudi Arabia": "sa", "Scotland": "gb-sct", "Senegal": "sn", "Serbia": "rs",
    "Seychelles": "sc", "Sierra Leone": "sl", "Singapore": "sg", "Sint Maarten": "sx", "Slovakia": "sk", "Slovenia": "si",
    "Somalia": "so", "South Africa": "za", "Southern Sudan": "ss", "Spain": "es", "Sri Lanka": "lk", "St. Kitts & Nevis": "kn",
    "St. Lucia": "lc", "St. Vincent & Grenadinen": "vc", "Sudan": "sd", "Suriname": "sr", "Sweden": "se", "Switzerland": "ch",
    "Syria": "sy", "Tahiti": "pf", "Tajikistan": "tj", "Tanzania": "tz", "Thailand": "th", "The Gambia": "gm", "Gambia": "gm",
    "Timor-Leste": "tl", "Togo": "tg", "Trinidad and Tobago": "tt", "Tunisia": "tn", "Turkey": "tr", "Türkiye": "tr",
    "Turkmenistan": "tm", "Uganda": "ug", "Ukraine": "ua", "United Arab Emirates": "ae", "United States": "us", "Uruguay": "uy",
    "Uzbekistan": "uz", "Vanuatu": "vu", "Venezuela": "ve", "Vietnam": "vn", "Wales": "gb-wls", "Yemen": "ye", "Zambia": "zm",
    "Zimbabwe": "zw",
}


def iso_do_pais(nome):
    if not nome:
        return None
    return PAISES.get(nome.strip())
