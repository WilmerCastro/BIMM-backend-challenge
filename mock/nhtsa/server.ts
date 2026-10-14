import { readFileSync } from 'node:fs';
import { createServer, type ServerResponse } from 'node:http';

const PORT = Number(process.env.MOCK_PORT ?? 8080);
const LATENCY_MS = Number(process.env.MOCK_LATENCY_MS ?? 50);
const FAILURE_RATE = Number(process.env.MOCK_FAILURE_RATE ?? 0);
const BLOCK_AFTER = Number(process.env.MOCK_BLOCK_AFTER ?? Infinity);

const makesXml = readFileSync(
  new URL('./getallmakes.xml', import.meta.url),
  'utf8',
);
const knownMakeIds = new Set(
  [...makesXml.matchAll(/<Make_ID>(\d+)<\/Make_ID>/g)].map(([, id]) =>
    Number(id),
  ),
);

const VEHICLE_TYPES = [
  [1, 'Motorcycle'],
  [2, 'Passenger Car'],
  [3, 'Truck'],
  [5, 'Bus'],
  [6, 'Trailer'],
  [7, 'Multipurpose Passenger Vehicle (MPV)'],
  [9, 'Low Speed Vehicle (LSV)'],
  [10, 'Incomplete Vehicle'],
] as const;

const vehicleTypesFor = (makeId: number) => {
  if (makeId % 13 === 0) return [];
  const first = VEHICLE_TYPES[makeId % VEHICLE_TYPES.length];
  const second = VEHICLE_TYPES[(makeId + 3) % VEHICLE_TYPES.length];
  return makeId % 3 === 0 ? [first, second] : [first];
};

const vehicleTypesXml = (makeId: number) => {
  const types = knownMakeIds.has(makeId) ? vehicleTypesFor(makeId) : [];
  const results = types
    .map(
      ([id, name]) =>
        `<VehicleTypesForMakeIds><VehicleTypeId>${id}</VehicleTypeId><VehicleTypeName>${name}</VehicleTypeName></VehicleTypesForMakeIds>`,
    )
    .join('');
  return `<Response><Count>${types.length}</Count><Message>Response returned successfully</Message><SearchCriteria>Make ID: ${makeId}</SearchCriteria>${results ? `<Results>${results}</Results>` : '<Results />'}</Response>`;
};

const send = (
  response: ServerResponse,
  status: number,
  body: string,
  contentType = 'text/xml',
) => {
  response.writeHead(status, { 'content-type': contentType });
  response.end(body);
};

let requestCount = 0;

createServer((request, response) => {
  requestCount += 1;
  const { pathname } = new URL(request.url ?? '/', 'http://mock');

  setTimeout(() => {
    if (requestCount > BLOCK_AFTER) {
      return send(response, 403, '<H1>Access Denied</H1>', 'text/html');
    }
    if (Math.random() < FAILURE_RATE) {
      return send(response, 503, 'Service Unavailable', 'text/plain');
    }
    if (pathname.toLowerCase().endsWith('/getallmakes')) {
      return send(response, 200, makesXml);
    }
    const match = pathname.match(/\/GetVehicleTypesForMakeId\/([^/]+)$/i);
    if (match && /^\d+$/.test(match[1])) {
      return send(response, 200, vehicleTypesXml(Number(match[1])));
    }
    if (match) {
      return send(
        response,
        400,
        JSON.stringify({ message: 'The request is invalid.' }),
        'application/json',
      );
    }
    return send(response, 404, 'Not Found', 'text/plain');
  }, LATENCY_MS);
}).listen(PORT, () => {
  console.log(
    JSON.stringify({
      msg: 'NHTSA mock listening',
      port: PORT,
      makes: knownMakeIds.size,
      latencyMs: LATENCY_MS,
      failureRate: FAILURE_RATE,
      blockAfter: Number.isFinite(BLOCK_AFTER) ? BLOCK_AFTER : 'never',
    }),
  );
});
