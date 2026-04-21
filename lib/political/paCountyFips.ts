/**
 * Pennsylvania county FIPS (3-digit within state 42), matching COUNTYFP on PA precinct GeoJSON.
 */

/** County FIPS (3 digits) from canonical precinct key `CCC-:-NAME` (PA LUSE UNIQUE_ID). */
export function parsePaCountyFpFromPrecinctKey(canonicalKey: string): string | null {
  const m = /^(\d{3})-:-/.exec(canonicalKey);
  return m ? m[1] : null;
}

export const PA_COUNTY_FP_TO_NAME: Record<string, string> = {
  '001': 'Adams',
  '003': 'Allegheny',
  '005': 'Armstrong',
  '007': 'Beaver',
  '009': 'Bedford',
  '011': 'Berks',
  '013': 'Blair',
  '015': 'Bradford',
  '017': 'Bucks',
  '019': 'Butler',
  '021': 'Cambria',
  '023': 'Cameron',
  '025': 'Carbon',
  '027': 'Centre',
  '029': 'Chester',
  '031': 'Clarion',
  '033': 'Clearfield',
  '035': 'Clinton',
  '037': 'Columbia',
  '039': 'Crawford',
  '041': 'Cumberland',
  '043': 'Dauphin',
  '045': 'Delaware',
  '047': 'Elk',
  '049': 'Erie',
  '051': 'Fayette',
  '053': 'Forest',
  '055': 'Franklin',
  '057': 'Fulton',
  '059': 'Greene',
  '061': 'Huntingdon',
  '063': 'Indiana',
  '065': 'Jefferson',
  '067': 'Juniata',
  '069': 'Lackawanna',
  '071': 'Lancaster',
  '073': 'Lawrence',
  '075': 'Lebanon',
  '077': 'Lehigh',
  '079': 'Luzerne',
  '081': 'Lycoming',
  '083': 'McKean',
  '085': 'Mercer',
  '087': 'Mifflin',
  '089': 'Monroe',
  '091': 'Montgomery',
  '093': 'Montour',
  '095': 'Northampton',
  '097': 'Northumberland',
  '099': 'Perry',
  '101': 'Philadelphia',
  '103': 'Pike',
  '105': 'Potter',
  '107': 'Schuylkill',
  '109': 'Snyder',
  '111': 'Somerset',
  '113': 'Sullivan',
  '115': 'Susquehanna',
  '117': 'Tioga',
  '119': 'Union',
  '121': 'Venango',
  '123': 'Warren',
  '125': 'Washington',
  '127': 'Wayne',
  '129': 'Westmoreland',
  '131': 'Wyoming',
  '133': 'York',
};

export function formatPaPrecinctLocation(
  attrs: Record<string, unknown> | undefined | null,
): string {
  if (!attrs) return 'Pennsylvania';
  const raw = attrs.COUNTYFP;
  if (raw == null || raw === '') return 'Pennsylvania';
  const fp = String(raw).padStart(3, '0');
  const name = PA_COUNTY_FP_TO_NAME[fp];
  return name ? `${name} County, Pennsylvania` : 'Pennsylvania';
}

export function isPaPrecinctAttributes(
  attrs: Record<string, unknown> | undefined | null,
): boolean {
  if (!attrs) return false;
  if (attrs.STATEFP === '42' || attrs.STATEFP === 42) return true;
  const uid = attrs.UNIQUE_ID;
  if (typeof uid === 'string' && uid.includes('-:-')) return true;
  return false;
}
