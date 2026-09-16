import proj4 from 'proj4';
import { CsvContractError } from './csv.mjs';

const EPSG_2263_PROJ4 = '+proj=lcc +lat_0=40.1666666666667 +lon_0=-74 +lat_1=41.0333333333333 +lat_2=40.6666666666667 +x_0=300000 +y_0=0 +datum=NAD83 +units=us-ft +no_defs +type=crs';
const NYC_BOUNDS = { west: -74.3, east: -73.6, south: 40.4, north: 41.0 };

proj4.defs('EPSG:2263', EPSG_2263_PROJ4);

export function epsg2263ToWgs84({ x, y }, rowNumber = undefined) {
  const [longitude, latitude] = proj4('EPSG:2263', 'EPSG:4326', [x, y]);
  if (!Number.isFinite(longitude) || !Number.isFinite(latitude)) {
    throw new CsvContractError('EPSG:2263 coordinate could not be transformed to EPSG:4326', rowNumber);
  }
  if (longitude < NYC_BOUNDS.west || longitude > NYC_BOUNDS.east || latitude < NYC_BOUNDS.south || latitude > NYC_BOUNDS.north) {
    throw new CsvContractError(`transformed coordinate falls outside expected NYC bounds (${longitude}, ${latitude})`, rowNumber);
  }
  return { longitude, latitude };
}
