/**
 * AAA Metro Price Scraper
 *
 * Fetches gas prices for US metro areas from AAA's website.
 * Supports caching and historical data via Wayback Machine.
 * 
 * Metro list is fetched from:
 * https://github.com/lykmapipo/US-Gas-Prices/blob/main/data/metro-daily-averages/
 */

import axios from 'axios';
import * as cheerio from 'cheerio';

export interface AAAMetroPrice {
  metroId: string; // e.g. "Los Angeles-Long Beach-Anaheim, CA"
  metroName: string;
  stateAbbr: string; // 2-letter state code
  latitude?: number;
  longitude?: number;
  regular: number | null;
  midGrade: number | null;
  premium: number | null;
  diesel: number | null;
  fetchedAt: Date;
}

/**
 * Extract state abbr from metro name (e.g., "Los Angeles-Long Beach-Anaheim, CA" → "CA")
 */
function extractStateAbbr(metroName: string): string {
  const match = metroName.match(/,\s*([A-Z]{2})$/);
  return match ? match[1] : '';
}

/**
 * Parse a price string like "$3.456" into a number, or null if not parseable
 */
function parsePrice(raw: string): number | null {
  const cleaned = raw.replace(/[^0-9.]/g, '');
  const num = parseFloat(cleaned);
  return isNaN(num) || num < 0.5 || num > 10 ? null : num;
}

/**
 * Primary city coordinates for all AAA metro areas.
 * Key: "PrimaryCity StateAbbr" (e.g., "Los Angeles CA")
 * Primary city = first segment of metro name before any hyphen, with qualifiers stripped.
 */
const PRIMARY_CITY_COORDS: Record<string, [number, number]> = {
  // AK
  'Anchorage AK': [61.2181, -149.9003], 'Fairbanks AK': [64.2008, -149.4937],
  'Juneau AK': [58.3005, -134.4197],
  // AL
  'Anniston AL': [33.6598, -85.8313], 'Auburn AL': [32.6099, -85.4808],
  'Birmingham AL': [33.5186, -86.8104], 'Daphne AL': [30.6035, -87.9036],
  'Decatur AL': [34.6059, -86.9833], 'Dothan AL': [31.2232, -85.3905],
  'Florence AL': [34.7998, -87.6773], 'Gadsden AL': [34.0143, -86.0066],
  'Huntsville AL': [34.7304, -86.5861], 'Mobile AL': [30.6943, -88.0430],
  'Montgomery AL': [32.3668, -86.3000], 'Russell County AL': [32.3296, -85.0849],
  'Tuscaloosa AL': [33.2098, -87.5692],
  // AR
  'Fayetteville AR': [36.0626, -94.1574], 'Fort Smith AR': [35.3859, -94.3985],
  'Hot Springs AR': [34.5037, -93.0552], 'Jonesboro AR': [35.8423, -90.7043],
  'Little Rock AR': [34.7465, -92.2896], 'Pine Bluff AR': [34.2284, -92.0032],
  'Texarkana AR': [33.4251, -94.0477], 'West Memphis AR': [35.1465, -90.1843],
  // AZ
  'East Valley AZ': [33.4152, -111.8313], 'Flagstaff AZ': [35.1983, -111.6513],
  'Glendale AZ': [33.5387, -112.1860], 'Lake Havasu AZ': [34.4839, -114.3225],
  'Peoria AZ': [33.5806, -112.2374], 'Phoenix Proper AZ': [33.4484, -112.0742],
  'Phoenix AZ': [33.4484, -112.0742], 'Pima County AZ': [32.2226, -110.9747],
  'Prescott AZ': [34.5400, -112.4685], 'Scottsdale AZ': [33.4942, -111.9261],
  'Sierra Vista AZ': [31.5455, -110.3032], 'Tucson AZ': [32.2226, -110.9747],
  'West Valley AZ': [33.5225, -112.3509], 'Yuma AZ': [32.6927, -114.6277],
  // CA
  'Bakersfield CA': [35.3733, -119.0187], 'Chico CA': [39.7285, -121.8375],
  'El Centro CA': [32.7920, -115.5631], 'Fresno CA': [36.7469, -119.7726],
  'Hanford CA': [36.3274, -119.6457], 'Los Angeles CA': [34.0522, -118.2437],
  'Madera CA': [36.9613, -120.0607], 'Merced CA': [37.3022, -120.4830],
  'Modesto CA': [37.6391, -120.9969], 'Napa CA': [38.2975, -122.2869],
  'Oakland CA': [37.8044, -122.2712], 'Orange County CA': [33.7175, -117.8311],
  'Redding CA': [40.5865, -122.3917], 'Riverside CA': [33.9806, -117.3755],
  'Sacramento CA': [38.5816, -121.4944], 'Salinas CA': [36.6777, -121.6555],
  'San Bernardino CA': [34.1083, -117.2898], 'San Diego CA': [32.7157, -117.1611],
  'San Francisco CA': [37.7749, -122.4194], 'San Jose CA': [37.3382, -121.8863],
  'San Luis Obispo CA': [35.2828, -120.6596], 'San Rafael CA': [37.9735, -122.5311],
  'Santa Barbara CA': [34.4208, -119.6982], 'Santa Cruz CA': [36.9741, -122.0308],
  'Santa Rosa CA': [38.4404, -122.7141], 'Stockton CA': [37.9577, -121.2908],
  'Vallejo CA': [38.1041, -122.2566], 'Ventura CA': [34.2805, -119.2945],
  'Visalia CA': [36.3302, -119.2921], 'Yolo CA': [38.6791, -121.7669],
  'Yuba City CA': [39.1404, -121.6169],
  // CO
  'Boulder CO': [40.0150, -105.2705], 'Colorado Springs CO': [38.8339, -104.8202],
  'Denver CO': [39.7392, -104.9903], 'Durango CO': [37.2753, -107.8801],
  'Fort Collins CO': [40.5853, -105.0844], 'Glenwood Springs CO': [39.5505, -107.3248],
  'Grand Junction CO': [39.0639, -108.5506], 'Greeley CO': [40.4233, -104.7091],
  'Pueblo CO': [38.2544, -104.6091], 'Vail CO': [39.6433, -106.3781],
  // CT
  'Bridgeport CT': [41.1865, -73.1952], 'Hartford CT': [41.7658, -72.6851],
  'Lower Fairfield County CT': [41.0534, -73.5387], 'New Haven CT': [41.3081, -72.9282],
  'New London CT': [41.3557, -72.0995], 'Windham CT': [41.7006, -72.1621],
  // DC
  'Washington DC': [38.9072, -77.0369],
  // DE
  'Dover DE': [39.1582, -75.5244], 'Milford DE': [38.9126, -75.4282],
  'Wilmington DE': [39.7447, -75.5484],
  // FL
  'Bradenton FL': [27.4989, -82.5748], 'Crestview FL': [30.7657, -86.5699],
  'Daytona Beach FL': [29.2108, -81.0228], 'Fort Lauderdale FL': [26.1224, -80.1373],
  'Fort Myers FL': [26.6406, -81.8723], 'Gainesville FL': [29.6516, -82.3248],
  'Homosassa Springs FL': [28.7978, -82.5762], 'Jacksonville FL': [30.3322, -81.6557],
  'Lakeland FL': [28.0395, -81.9498], 'Melbourne FL': [28.0836, -80.6081],
  'Miami FL': [25.7617, -80.1918], 'Naples FL': [26.1420, -81.7948],
  'Ocala FL': [29.1872, -82.1401], 'Orlando FL': [28.5383, -81.3792],
  'Panama City FL': [30.1588, -85.6602], 'Pensacola FL': [30.4213, -87.2169],
  'Port St. Lucie FL': [27.2939, -80.3503], 'Punta Gorda FL': [26.9298, -82.0451],
  'Sebastian FL': [27.8167, -80.4720], 'Sebring FL': [27.4953, -81.4409],
  'Tallahassee FL': [30.4382, -84.2807], 'Tampa FL': [27.9506, -82.4572],
  'The Villages FL': [28.9070, -81.9596], 'West Palm Beach FL': [26.7153, -80.0534],
  // GA
  'Albany GA': [31.5785, -84.1557], 'Athens GA': [33.9519, -83.3576],
  'Atlanta GA': [33.7490, -84.3880], 'Augusta GA': [33.4735, -82.0105],
  'Brunswick GA': [31.1499, -81.4915], 'Catoosa GA': [34.9120, -85.1324],
  'Columbus GA': [32.4610, -84.9877], 'Dalton GA': [34.7698, -84.9702],
  'Gainesville GA': [34.2979, -83.8241], 'Hinesville GA': [31.8463, -81.5957],
  'Macon GA': [32.8407, -83.6324], 'Rome GA': [34.2573, -85.1647],
  'Savannah GA': [32.0835, -81.0998], 'Valdosta GA': [30.8327, -83.2785],
  'Warner Robins GA': [32.6130, -83.5996],
  // HI
  'Hilo HI': [19.7074, -155.0885], 'Honolulu HI': [21.3099, -157.8581],
  'Kahului HI': [20.8893, -156.4729], 'Lihue HI': [21.9811, -159.3711],
  'Wailuku HI': [20.8950, -156.5070],
  // IA
  'Ames IA': [42.0347, -93.6200], 'Cedar Rapids IA': [42.0049, -91.6446],
  'Council Bluffs IA': [41.2619, -95.8608], 'Davenport IA': [41.5236, -90.5776],
  'Des Moines IA': [41.5868, -93.6250], 'Dubuque IA': [42.5006, -90.6646],
  'Iowa City IA': [41.6611, -91.5302], 'Sioux City IA': [42.4999, -96.4003],
  'Waterloo IA': [42.4928, -92.3426],
  // ID
  'Boise City ID': [43.6150, -116.2023], 'Coeur D\'Alene ID': [47.6776, -116.7805],
  'Franklin ID': [42.0099, -111.8100], 'Idaho Falls ID': [43.4917, -112.0336],
  'Lewiston ID': [46.4165, -117.0177], 'Pocatello ID': [42.8713, -112.4455],
  'Twin Falls ID': [42.5630, -114.4609],
  // IL
  'Alexander County IL': [37.1859, -89.2773], 'Bloomington IL': [40.4842, -88.9937],
  'Carbondale IL': [37.7273, -89.2168], 'Champaign IL': [40.1164, -88.2434],
  'Chicago Metro IL': [41.8781, -87.6298], 'City of Chicago IL': [41.8781, -87.6298],
  'Danville IL': [40.1242, -87.6302], 'Decatur IL': [39.8403, -88.9548],
  'East Saint Louis IL': [38.6245, -90.1520], 'Elgin IL': [42.0354, -88.2826],
  'Kankakee IL': [41.1197, -87.8612], 'Lake County IL': [42.3251, -87.8400],
  'Peoria IL': [40.6936, -89.5890], 'Quincy IL': [39.9356, -91.4099],
  'Rockford IL': [42.2711, -89.0937], 'Springfield IL': [39.7817, -89.6501],
  // IN
  'Bloomington IN': [39.1653, -86.5264], 'Clarksville IN': [38.3537, -85.7591],
  'Columbus IN': [39.2014, -85.9214], 'Dearborn IN': [39.2053, -84.9630],
  'Elkhart IN': [41.6820, -85.9767], 'Evansville IN': [37.9716, -87.5811],
  'Fort Wayne IN': [41.0793, -85.1394], 'Gary IN': [41.5934, -87.3465],
  'Indianapolis IN': [39.7684, -86.1581], 'Kokomo IN': [40.4864, -86.1336],
  'Lafayette IN': [40.4167, -86.8753], 'Michigan City IN': [41.7075, -86.8950],
  'Muncie IN': [40.1934, -85.3864], 'South Bend IN': [41.6764, -86.2520],
  'Terre Haute IN': [39.4667, -87.4139],
  // KS
  'Kansas City KS': [39.1155, -94.6268], 'Lawrence KS': [38.9717, -95.2353],
  'Manhattan KS': [39.1836, -96.5717], 'Topeka KS': [39.0473, -95.6752],
  'Wichita KS': [37.6872, -97.3301],
  // KY
  'Bowling Green KY': [36.9685, -86.4808], 'Covington KY': [39.0839, -84.5085],
  'Elizabethtown KY': [37.6939, -85.8591], 'Henderson KY': [37.8362, -87.5900],
  'Hopkinsville KY': [36.8656, -87.4886], 'Huntington KY': [38.4192, -82.4452],
  'Lexington KY': [38.0406, -84.5037], 'Louisville KY': [38.2527, -85.7585],
  'Owensboro KY': [37.7719, -87.1112],
  // LA
  'Alexandria LA': [31.3113, -92.4451], 'Baton Rouge LA': [30.4515, -91.1871],
  'Hammond LA': [30.5044, -90.4581], 'Houma LA': [29.5958, -90.7195],
  'Lafayette LA': [30.2241, -92.0198], 'Lake Charles LA': [30.2266, -93.2174],
  'Monroe LA': [32.5093, -92.1193], 'New Orleans LA': [29.9511, -90.0715],
  'Shreveport LA': [32.5252, -93.7502],
  // MA
  'Barnstable MA': [41.7003, -70.2987], 'Boston MA': [42.3601, -71.0589],
  'Cambridge MA': [42.3736, -71.1106], 'Pittsfield MA': [42.4501, -73.2621],
  'Seekonk MA': [41.8382, -71.3301], 'Springfield MA': [42.1015, -72.5898],
  'Worcester MA': [42.2626, -71.8023],
  // MD
  'Annapolis MD': [38.9784, -76.4922], 'Baltimore MD': [39.2904, -76.6122],
  'Bowie MD': [38.9423, -76.7791], 'Cumberland MD': [39.6529, -78.7625],
  'Frederick MD': [39.4143, -77.4105], 'Hagerstown MD': [39.6418, -77.7199],
  'Salisbury MD': [38.3607, -75.5994], 'Washington MD': [38.9072, -77.0369],
  // ME
  'Bangor ME': [44.8012, -68.7778], 'Lewiston ME': [44.1004, -70.2148],
  'Portland ME': [43.6591, -70.2568],
  // MI
  'Ann Arbor MI': [42.2808, -83.7430], 'Benton Harbor MI': [42.1167, -86.4542],
  'Flint MI': [43.0125, -83.6875], 'Grand Rapids MI': [42.9634, -85.6681],
  'Jackson MI': [42.2459, -84.4013], 'Lansing MI': [42.7325, -84.5555],
  'Marquette MI': [46.5436, -87.3954], 'Metro Detroit MI': [42.3314, -83.0458],
  'Saginaw MI': [43.4195, -83.9508], 'Traverse City MI': [44.7631, -85.6206],
  // MN
  'Duluth MN': [46.7867, -92.1005], 'Houston County MN': [43.6966, -91.5540],
  'Mankato MN': [44.1636, -93.9994], 'Minneapolis MN': [44.9537, -93.0900],
  'Moorhead MN': [46.8739, -96.7678], 'Polk County MN': [47.7714, -96.4141],
  'Rochester MN': [44.0121, -92.4802], 'St. Cloud MN': [45.5579, -94.1632],
  // MO
  'Cape Girardeau MO': [37.3059, -89.5181], 'Columbia MO': [38.9517, -92.3341],
  'Jefferson City MO': [38.5767, -92.1735], 'Joplin MO': [37.0842, -94.5133],
  'Kansas City MO': [39.0997, -94.5786], 'Springfield MO': [37.2089, -93.2923],
  'St. Joseph MO': [39.7675, -94.8467], 'St. Louis MO': [38.6270, -90.1994],
  // MS
  'Biloxi MS': [30.3960, -88.8853], 'Hattiesburg MS': [31.3271, -89.2903],
  'Jackson MS': [32.2988, -90.1848], 'South Haven MS': [34.6498, -90.0484],
  // MT
  'Billings MT': [45.7833, -108.5007], 'Great Falls MT': [47.5002, -111.3008],
  'Missoula MT': [46.8721, -113.9940],
  // NC
  'Asheville NC': [35.5951, -82.5515], 'Burlington NC': [36.0957, -79.4378],
  'Charlotte NC': [35.2271, -80.8431], 'Durham NC': [35.9940, -78.8986],
  'Fayetteville NC': [35.0527, -78.8784], 'Goldsboro NC': [35.3851, -77.9925],
  'Greensboro NC': [36.0726, -79.7920], 'Hickory NC': [35.7343, -81.3440],
  'Jacksonville NC': [34.7540, -77.4302], 'New Bern NC': [35.1085, -77.0441],
  'Norfolk NC': [36.8508, -76.2859], 'Raleigh NC': [35.7796, -78.6382],
  'Rocky Mount NC': [35.9382, -77.7905], 'Wilmington NC': [34.2257, -77.9447],
  'Winston NC': [36.0999, -80.2442],
  // ND
  'Bismarck ND': [46.8082, -100.7837], 'Fargo ND': [46.8772, -96.7898],
  'Grand Forks ND': [47.9253, -97.0329], 'Minot ND': [48.2325, -101.2963],
  // NE
  'Columbus NE': [41.4300, -97.3686], 'Grand Island NE': [40.9250, -98.3420],
  'Kearney NE': [40.6993, -99.0817], 'Lincoln NE': [40.8136, -96.7026],
  'Norfolk NE': [42.0278, -97.4170], 'North Platte NE': [41.1239, -100.7654],
  'Omaha NE': [41.2565, -95.9345],
  // NH
  'Manchester NH': [42.9956, -71.4548], 'Portsmouth NH': [43.0718, -70.7626],
  // NJ
  'Atlantic City NJ': [39.3643, -74.4229], 'Bergen NJ': [40.9282, -74.0776],
  'Cape May NJ': [38.9351, -74.9060], 'Middlesex NJ': [40.5016, -74.4482],
  'Monmouth NJ': [40.2171, -74.0115], 'Newark NJ': [40.7357, -74.1724],
  'Parsippany NJ': [40.8571, -74.4254], 'Philadelphia NJ': [39.9526, -75.1652],
  'Trenton NJ': [40.2171, -74.7429], 'Vineland NJ': [39.4865, -74.9282],
  'Warren County NJ': [40.8176, -75.0476],
  // NM
  'Albuquerque NM': [35.0844, -106.6504], 'Farmington NM': [36.7281, -108.2087],
  'Las Cruces NM': [32.3199, -106.7637], 'Santa Fe NM': [35.6870, -105.9378],
  // NV
  'Las Vegas NV': [36.1699, -115.1398], 'Reno NV': [39.5296, -119.8138],
  // NY
  'Albany NY': [42.6526, -73.7562], 'Batavia NY': [43.0023, -78.1875],
  'Binghamton NY': [42.0987, -75.9180], 'Buffalo NY': [42.8864, -78.8784],
  'Dutchess NY': [41.7004, -73.9210], 'Elmira NY': [42.0898, -76.8077],
  'Glens Falls NY': [43.3095, -73.6440], 'Ithaca NY': [42.4440, -76.5021],
  'Kingston NY': [41.9270, -73.9974], 'Nassau NY': [40.7282, -73.7949],
  'New York NY': [40.7128, -74.0060], 'Rochester NY': [43.1566, -77.6088],
  'Syracuse NY': [43.0481, -76.1474], 'Utica NY': [43.1009, -75.2327],
  'Watertown NY': [43.9748, -75.9108], 'White Plains NY': [41.0340, -73.7629],
  // OH
  'Akron OH': [41.0814, -81.5190], 'Belmont County OH': [39.9684, -81.1154],
  'Canton OH': [40.7989, -81.3784], 'Cincinnati OH': [39.1031, -84.5120],
  'Cleveland OH': [41.4993, -81.6944], 'Columbus OH': [39.9612, -82.9988],
  'Dayton OH': [39.7589, -84.1916], 'Lawerence County OH': [38.5904, -82.5485],
  'Lima OH': [40.7420, -84.1052], 'Mansfield OH': [40.7584, -82.5154],
  'Springfield OH': [39.9242, -83.8088], 'Steubenville OH': [40.3698, -80.6340],
  'Toledo OH': [41.6639, -83.5552], 'Youngstown OH': [41.0998, -80.6495],
  // OK
  'Lawton OK': [34.6036, -98.3959], 'Le Flore OK': [34.9217, -94.5927],
  'Oklahoma City OK': [35.4676, -97.5164], 'Tulsa OK': [36.1539, -95.9928],
  // OR
  'Albany OR': [44.6365, -123.1059], 'Bend OR': [44.0582, -121.3153],
  'Corvallis OR': [44.5646, -123.2620], 'Eugene OR': [44.0521, -123.0868],
  'Grants Pass OR': [42.4398, -123.3284], 'Medford OR': [42.3265, -122.8756],
  'Pendleton OR': [45.6721, -118.7886], 'Portland OR': [45.5152, -122.6784],
  'Salem OR': [44.9429, -123.0351],
  // PA
  'Allentown PA': [40.6084, -75.4902], 'Altoona PA': [40.5187, -78.3947],
  'Bloomsburg PA': [41.0051, -76.4549], 'Chambersburg PA': [39.9376, -77.6611],
  'East Stroudsburg PA': [41.0037, -75.1807], 'Erie PA': [42.1292, -80.0851],
  'Gettysburg PA': [39.8309, -77.2311], 'Harrisburg PA': [40.2737, -76.8861],
  'Johnstown PA': [40.3267, -78.9219], 'Lancaster PA': [40.0379, -76.3055],
  'Lebanon PA': [40.3384, -76.4124], 'Mercer County PA': [41.2283, -80.2423],
  'Philadelphia PA': [39.9526, -75.1652], 'Pittsburgh PA': [40.4406, -79.9959],
  'Reading PA': [40.3356, -75.9269], 'Scranton PA': [41.4090, -75.6624],
  'State College PA': [40.7934, -77.8600], 'Williamsport PA': [41.2412, -77.0011],
  'York PA': [39.9626, -76.7277],
  // RI
  'Providence RI': [41.8240, -71.4128],
  // SC
  'Aiken SC': [33.5601, -81.7198], 'Charleston SC': [32.7765, -79.9311],
  'Columbia SC': [33.9998, -81.0453], 'Florence SC': [34.1954, -79.7626],
  'Greenville SC': [34.8526, -82.3940], 'Hilton Head SC': [32.2163, -80.7526],
  'Myrtle Beach SC': [33.6890, -78.8867], 'Rock Hill SC': [34.9249, -80.9792],
  'Spartanburg SC': [34.9496, -81.9321], 'Sumter SC': [33.9204, -80.3412],
  // SD
  'North Sioux City SD': [42.5302, -96.4834], 'Rapid City SD': [44.0805, -103.2310],
  'Sioux Falls SD': [43.5446, -96.7311],
  // TN
  'Chattanooga TN': [35.0456, -85.3097], 'Clarksville TN': [36.5298, -87.3595],
  'Cleveland TN': [35.1595, -84.8766], 'Jackson TN': [35.6145, -88.8139],
  'Johnson City TN': [36.3134, -82.3535], 'Kingsport TN': [36.5484, -82.5618],
  'Knoxville TN': [35.9606, -83.9207], 'Memphis TN': [35.1495, -90.0490],
  'Morristown TN': [36.2137, -83.2949], 'Nashville TN': [36.1627, -86.7816],
  // TX
  'Abilene TX': [32.4487, -99.7331], 'Amarillo TX': [35.2220, -101.8313],
  'Austin TX': [30.2672, -97.7431], 'Beaumont TX': [30.0802, -94.1266],
  'Brownsville TX': [25.9018, -97.4975], 'College Station TX': [30.6280, -96.3344],
  'Corpus Christi TX': [27.8006, -97.3964], 'Dallas TX': [32.7767, -96.7970],
  'El Paso TX': [31.7619, -106.4850], 'Fort Worth TX': [32.7555, -97.3308],
  'Galveston TX': [29.3013, -94.7977], 'Houston TX': [29.7604, -95.3698],
  'Killeen TX': [31.1171, -97.7278], 'Laredo TX': [27.5306, -99.4803],
  'Longview TX': [32.5007, -94.7405], 'Lubbock TX': [33.5779, -101.8552],
  'McAllen TX': [26.2034, -98.2300], 'Midland TX': [31.9973, -102.0779],
  'Odessa TX': [31.8457, -102.3830], 'San Angelo TX': [31.4638, -100.4370],
  'San Antonio TX': [29.4241, -98.4936], 'Sherman TX': [33.6357, -96.6089],
  'Texarkana TX': [33.4251, -94.0477], 'Tyler TX': [32.3513, -95.3011],
  'Victoria TX': [28.8053, -97.0036], 'Waco TX': [31.5493, -97.1467],
  'Wichita Falls TX': [33.9137, -98.4934],
  // UT
  'Logan UT': [41.7370, -111.8338], 'Ogden UT': [41.2230, -111.9738],
  'Provo UT': [40.2338, -111.6585], 'Salt Lake City UT': [40.7608, -111.8911],
  'St. George UT': [37.0965, -113.5684],
  // VA
  'Blacksburg VA': [37.2296, -80.4139], 'Charlottesville VA': [38.0293, -78.4767],
  'Harrisonburg VA': [38.4496, -78.8689], 'Lynchburg VA': [37.4138, -79.1422],
  'Richmond VA': [37.5407, -77.4360], 'Roanoke VA': [37.2710, -79.9414],
  'Virginia Beach VA': [36.8529, -75.9780], 'Winchester VA': [39.1857, -78.1633],
  // VT
  'Burlington VT': [44.4759, -73.2121],
  // WA
  'Bellingham WA': [48.7519, -122.4787], 'Bremerton WA': [47.5673, -122.6329],
  'Kennewick WA': [46.2112, -119.1372], 'Longview WA': [46.1382, -122.9382],
  'Mount Vernon WA': [48.4222, -122.3344], 'Olympia WA': [47.0379, -122.9007],
  'Seattle WA': [47.6062, -122.3321], 'Spokane WA': [47.6587, -117.4260],
  'Tacoma WA': [47.2529, -122.4443], 'Wenatchee WA': [47.4235, -120.3103],
  'Yakima WA': [46.6021, -120.5059],
  // WI
  'Appleton WI': [44.2619, -88.4154], 'Eau Claire WI': [44.8113, -91.4985],
  'Fond du Lac WI': [43.7730, -88.4471], 'Green Bay WI': [44.5133, -88.0133],
  'Janesville WI': [42.6828, -89.0187], 'La Crosse WI': [43.8014, -91.2396],
  'Madison WI': [43.0731, -89.4012], 'Milwaukee WI': [43.0389, -87.9065],
  'Oshkosh WI': [44.0247, -88.5426], 'Racine WI': [42.7261, -87.7829],
  'Sheboygan WI': [43.7508, -87.7145], 'Wausau WI': [44.9591, -89.6301],
  // WV
  'Charleston WV': [38.3498, -81.6326], 'Huntington WV': [38.4192, -82.4452],
  'Morgantown WV': [39.6295, -79.9559], 'Parkersburg WV': [39.2667, -81.5615],
  'Wheeling WV': [40.0640, -80.7209],
  // WY
  'Casper WY': [42.8666, -106.3131], 'Cheyenne WY': [41.1400, -104.8202],
};

/**
 * State geographic center coordinates (fallback when primary city is unknown)
 */
const STATE_CENTERS: Record<string, { latitude: number; longitude: number }> = {
  AK: { latitude: 64.2008, longitude: -152.2782 }, AL: { latitude: 32.8067, longitude: -86.7113 },
  AR: { latitude: 34.9697, longitude: -92.3731 },  AZ: { latitude: 33.7298, longitude: -111.4312 },
  CA: { latitude: 36.1162, longitude: -119.6816 }, CO: { latitude: 39.0598, longitude: -105.3111 },
  CT: { latitude: 41.5978, longitude: -72.7554 },  DC: { latitude: 38.9072, longitude: -77.0369 },
  DE: { latitude: 39.3185, longitude: -75.4769 },  FL: { latitude: 27.6648, longitude: -81.5158 },
  GA: { latitude: 33.0406, longitude: -83.6431 },  HI: { latitude: 21.1449, longitude: -157.4983 },
  IA: { latitude: 42.0115, longitude: -93.2105 },  ID: { latitude: 44.2998, longitude: -114.7629 },
  IL: { latitude: 40.3495, longitude: -88.9861 },  IN: { latitude: 39.8494, longitude: -86.2583 },
  KS: { latitude: 38.5266, longitude: -96.7265 },  KY: { latitude: 37.6681, longitude: -84.6701 },
  LA: { latitude: 31.1695, longitude: -91.8749 },  MA: { latitude: 42.2352, longitude: -71.0275 },
  MD: { latitude: 39.0639, longitude: -76.8021 },  ME: { latitude: 44.6939, longitude: -69.3819 },
  MI: { latitude: 43.3266, longitude: -84.5361 },  MN: { latitude: 45.6945, longitude: -93.9196 },
  MO: { latitude: 38.4561, longitude: -92.2884 },  MS: { latitude: 32.7416, longitude: -89.6787 },
  MT: { latitude: 47.0527, longitude: -109.6333 }, NC: { latitude: 35.6301, longitude: -79.8064 },
  ND: { latitude: 47.5289, longitude: -99.7840 },  NE: { latitude: 41.4925, longitude: -99.9018 },
  NH: { latitude: 43.4525, longitude: -71.3187 },  NJ: { latitude: 40.2557, longitude: -74.4888 },
  NM: { latitude: 34.8405, longitude: -106.2371 }, NV: { latitude: 38.3135, longitude: -117.0554 },
  NY: { latitude: 42.1657, longitude: -74.9481 },  OH: { latitude: 40.3888, longitude: -82.7649 },
  OK: { latitude: 35.5653, longitude: -96.9289 },  OR: { latitude: 43.8041, longitude: -120.5542 },
  PA: { latitude: 40.5908, longitude: -77.2098 },  RI: { latitude: 41.6809, longitude: -71.5118 },
  SC: { latitude: 33.8569, longitude: -80.9450 },  SD: { latitude: 44.2998, longitude: -99.4388 },
  TN: { latitude: 35.7478, longitude: -86.6923 },  TX: { latitude: 31.9686, longitude: -99.9018 },
  UT: { latitude: 39.8282, longitude: -111.8910 }, VA: { latitude: 37.4316, longitude: -78.6569 },
  VT: { latitude: 44.0459, longitude: -72.7107 },  WA: { latitude: 47.7511, longitude: -120.7401 },
  WI: { latitude: 43.7844, longitude: -88.7879 },  WV: { latitude: 38.4912, longitude: -82.9006 },
  WY: { latitude: 42.7559, longitude: -107.3025 },
};

/**
 * Extract the primary city from a metro name for coordinate lookup.
 * "Los Angeles-Long Beach, CA" → "Los Angeles"
 * "Fort Smith (AR only), AR" → "Fort Smith"
 * "Davenport-Moline-Rock Island (IA only), IA" → "Davenport"
 */
function extractPrimaryCity(metroName: string): string {
  return metroName
    .replace(/,\s*[A-Z]{2}$/, '')         // Strip ", CA" state suffix
    .replace(/\s*\([^)]+\)\s*/g, ' ')     // Strip "(AR only)" qualifiers
    .split('-')[0]                          // Take first city before any hyphen
    .trim();
}

/**
 * Get metro coordinates using primary city lookup, falling back to state center.
 */
function getMetroCoordinatesWithFallback(
  metroName: string,
  stateAbbr: string
): { latitude: number; longitude: number } {
  const primaryCity = extractPrimaryCity(metroName);
  const key = `${primaryCity} ${stateAbbr}`;
  const coords = PRIMARY_CITY_COORDS[key];
  if (coords) return { latitude: coords[0], longitude: coords[1] };

  // Fallback to state center with modest jitter so dots don't all overlap
  const stateCoords = STATE_CENTERS[stateAbbr];
  if (stateCoords) {
    return {
      latitude: stateCoords.latitude + (Math.random() - 0.5) * 2,
      longitude: stateCoords.longitude + (Math.random() - 0.5) * 2,
    };
  }

  return { latitude: 39.8283, longitude: -98.5795 };
}

/**
 * Fetch all metro prices directly from the GitHub CSV (no individual scraping needed).
 * CSV format: State-Name,State-Abbreviation,Metro-Name,Regular,Mid-Grade,Premium,Diesel,...
 */
export async function fetchMetroPricesFromCSV(): Promise<AAAMetroPrice[]> {
  try {
    const response = await axios.get(
      'https://raw.githubusercontent.com/lykmapipo/US-Gas-Prices/main/data/metro-daily-averages/2026-03-22.csv',
      { timeout: 10000 }
    );

    const results: AAAMetroPrice[] = [];
    const lines = response.data.split('\n');

    // Parse CSV: State-Name,State-Abbreviation,Metro-Name,Regular,Mid-Grade,Premium,Diesel,...
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;

      // Simple CSV parsing - handle quoted fields
      const parts: string[] = [];
      let current = '';
      let inQuotes = false;

      for (let j = 0; j < line.length; j++) {
        const char = line[j];
        if (char === '"') {
          inQuotes = !inQuotes;
        } else if (char === ',' && !inQuotes) {
          parts.push(current.replace(/^"|"$/g, '').trim());
          current = '';
        } else {
          current += char;
        }
      }
      if (current) {
        parts.push(current.replace(/^"|"$/g, '').trim());
      }

      // Format: State-Name, State-Abbr, Metro-Name, Regular, Mid-Grade, Premium, Diesel, ...
      if (parts.length >= 7) {
        const stateAbbr = parts[1];
        const metroName = parts[2];
        const regular = parsePrice(parts[3]);
        const midGrade = parsePrice(parts[4]);
        const premium = parsePrice(parts[5]);
        const diesel = parsePrice(parts[6]);

        if (stateAbbr && metroName && stateAbbr.length === 2) {
          const metroId = `${metroName}, ${stateAbbr}`;
          results.push({
            metroId,
            metroName,
            stateAbbr,
            ...getMetroCoordinatesWithFallback(metroId, stateAbbr),
            regular,
            midGrade,
            premium,
            diesel,
            fetchedAt: new Date(),
          });
        }
      }
    }

    console.log(`✅ Fetched ${results.length} metros with prices from GitHub CSV`);
    return results;
  } catch (err) {
    console.warn('Failed to fetch metro prices from GitHub CSV', err);
    return [];
  }
}

/**
 * Fetch list of available metros from AAA.
 * AAA hosts these at https://gasprices.aaa.com/?state=CA&o=MT (metro view)
 * Returns array of metro IDs/names.
 */
export async function fetchMetroList(): Promise<string[]> {
  try {
    // Fetch latest metro list from GitHub repo
    const response = await axios.get(
      'https://raw.githubusercontent.com/lykmapipo/US-Gas-Prices/main/data/metro-daily-averages/2026-03-22.csv',
      { timeout: 10000 }
    );

    const metros = new Set<string>();
    const lines = response.data.split('\n');

    // Parse CSV: State-Name,State-Abbreviation,Metro-Name,Regular,Mid-Grade,Premium,Diesel,...
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;

      // Simple CSV parsing - handle quoted fields
      const parts: string[] = [];
      let current = '';
      let inQuotes = false;

      for (let j = 0; j < line.length; j++) {
        const char = line[j];
        if (char === '"') {
          inQuotes = !inQuotes;
        } else if (char === ',' && !inQuotes) {
          parts.push(current.replace(/^"|"$/g, '').trim());
          current = '';
        } else {
          current += char;
        }
      }
      if (current) {
        parts.push(current.replace(/^"|"$/g, '').trim());
      }

      // Format: State-Name, State-Abbr, Metro-Name, ...
      if (parts.length >= 3) {
        const stateAbbr = parts[1];
        const metroName = parts[2];

        if (stateAbbr && metroName && stateAbbr.length === 2) {
          metros.add(`${metroName}, ${stateAbbr}`);
        }
      }
    }

    console.log(`✅ Fetched ${metros.size} unique metros from GitHub CSV`);
    return Array.from(metros);
  } catch (err) {
    console.warn('Failed to fetch metro list from GitHub, using fallback list', err);

    // Fallback to a basic list in case GitHub is unreachable
    const fallbackMetros = [
      'Los Angeles-Long Beach, CA',
      'San Francisco, CA',
      'San Diego, CA',
      'Phoenix, AZ',
      'Denver, CO',
      'Salt Lake City, UT',
      'Portland, OR',
      'Seattle, WA',
      'Honolulu, HI',
      'Dallas, TX',
      'Houston, TX',
      'San Antonio, TX',
      'Austin-San Marcos, TX',
      'Minneapolis-St. Paul, MN',
      'Chicago Metro, IL',
      'St. Louis, MO',
      'Kansas City, MO',
      'Memphis, TN',
      'Nashville, TN',
      'New Orleans, LA',
      'Birmingham, AL',
      'Mobile, AL',
      'Atlanta, GA',
      'Miami, FL',
      'Orlando, FL',
      'Tampa-St. Petersburg-Clearwater, FL',
      'Jacksonville, FL',
      'Charlotte-Gastonia-Rock Hill, NC',
      'Charlotte, NC',
      'Raleigh, NC',
      'Greensboro, NC',
      'Charleston, SC',
      'Columbia, SC',
      'Washington, DC',
      'Baltimore, MD',
      'Philadelphia, PA',
      'Pittsburgh, PA',
      'New York, NY',
      'Boston, MA',
      'Providence-Fall River-Warwick, RI',
      'Hartford, CT',
      'Manchester, NH',
      'Portland, ME',
      'Burlington, VT',
      'Detroit, MI',
      'Flint, MI',
      'Milwaukee, WI',
      'Green Bay, WI',
      'Madison, WI',
      'Sioux Falls, SD',
      'Omaha, NE',
      'Topeka, KS',
      'Oklahoma City, OK',
      'Tulsa, OK',
      'Little Rock-North Little Rock, AR',
      'Jackson, MS',
      'Baton Rouge, LA',
      'Louisville, KY',
      'Lexington, KY',
      'Cincinnati, OH',
      'Columbus, OH',
      'Cleveland, OH',
      'Albuquerque, NM',
      'Billings, MT',
      'Missoula, MT',
      'Boise City, ID',
      'Cheyenne, WY',
      'Casper, WY',
      'Rapid City, SD',
      'Fargo-Moorhead, ND',
      'Bismarck, ND',
      'Anchorage, AK',
      'Juneau, AK',
    ];

    return Array.from(new Set(fallbackMetros));
  }
}

/**
 * Fetch gas prices for a single metro from AAA.
 * Metro pages are accessed via: https://gasprices.aaa.com/?state=CA&o=Metro%20Name
 */
export async function fetchMetroPrice(metroName: string): Promise<AAAMetroPrice | null> {
  try {
    const stateAbbr = extractStateAbbr(metroName);
    if (!stateAbbr) {
      console.warn(`Could not extract state from metro name: ${metroName}`);
      return null;
    }

    const metroQuery = encodeURIComponent(metroName.replace(`, ${stateAbbr}`, ''));
    const url = `https://gasprices.aaa.com/?state=${stateAbbr}&o=${metroQuery}`;

    const response = await axios.get(url, {
      timeout: 15000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; GasTrack/1.0; +https://github.com/fuelripple)',
        'Accept': 'text/html',
      },
    });

    const $ = cheerio.load(response.data as string);
    let regular: number | null = null;
    let midGrade: number | null = null;
    let premium: number | null = null;
    let diesel: number | null = null;

    // Similar parsing as state prices — find "Current Avg." row
    $('td').each((_, el) => {
      const text = $(el).text().trim();
      if (text === 'Current Avg.') {
        const row = $(el).closest('tr');
        const priceCells = row.find('td').filter((_, cell) => {
          return $(cell).text().trim() !== 'Current Avg.' && /\$[\d.]+/.test($(cell).text());
        });

        const prices = priceCells.map((_, cell) => parsePrice($(cell).text())).get() as (number | null)[];

        [regular, midGrade, premium, diesel] = [
          prices[0] ?? null,
          prices[1] ?? null,
          prices[2] ?? null,
          prices[3] ?? null,
        ];
        return false;
      }
    });

    return {
      metroId: metroName,
      metroName,
      stateAbbr,
      ...getMetroCoordinatesWithFallback(metroName, stateAbbr),
      regular,
      midGrade,
      premium,
      diesel,
      fetchedAt: new Date(),
    };
  } catch (err: any) {
    console.error(`Failed to fetch metro price for ${metroName}: ${err.message}`);
    return null;
  }
}

/**
 * Fetch all available metro prices from AAA.
 * Now uses CSV data directly (much faster than 474 individual scrape requests)
 */
export async function fetchAllMetroPrices(): Promise<AAAMetroPrice[]> {
  const prices = await fetchMetroPricesFromCSV();
  
  if (prices.length === 0) {
    console.warn('⚠️  No metro prices fetched from CSV, scraping individual metros...');
    // Fallback to individual scraping if CSV fails
    return await fetchAllMetroPricesFallback();
  }

  return prices;
}

/**
 * Fallback: Fetch metro prices by scraping individual metros (slow, ~5+ mins for 474 metros)
 */
export async function fetchAllMetroPricesFallback(): Promise<AAAMetroPrice[]> {
  const metros = await fetchMetroList();
  const results: AAAMetroPrice[] = [];
  let success = 0;
  let failure = 0;

  for (const metro of metros) {
    const data = await fetchMetroPrice(metro);
    if (data && (data.regular !== null || data.diesel !== null)) {
      results.push(data);
      success++;
      console.log(
        `AAA Metro [${metro}] regular=$${data.regular ?? 'N/A'} ` +
        `mid=$${data.midGrade ?? 'N/A'} premium=$${data.premium ?? 'N/A'} ` +
        `diesel=$${data.diesel ?? 'N/A'}`
      );
    } else {
      failure++;
      console.warn(`No price data for metro: ${metro}`);
    }

    // Polite delay between requests
    await new Promise(resolve => setTimeout(resolve, 600));
  }

  console.log(`✅ AAA Metro scrape complete: ${success} succeeded, ${failure} failed`);
  return results;
}
